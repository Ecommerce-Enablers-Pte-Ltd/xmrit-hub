import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { getAuthSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { slides } from "@/lib/db/schema";
import { slideIdSchema, updateSlideSchema } from "@/lib/validations/slide";

// Cache control headers for slide data
// Increased cache time since metric definitions are relatively stable
const CACHE_REVALIDATE = 600; // 10 minutes

// Enable Next.js route segment caching
// Note: Must be a literal value, not a constant reference
export const revalidate = 600; // 10 minutes

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slideId: string }> },
) {
  try {
    const session = await getAuthSession();

    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify user has a valid ID
    if (!session.user.id) {
      console.error("Session missing user ID:", session);
      return NextResponse.json(
        { error: "Invalid session - user ID missing" },
        { status: 401 },
      );
    }

    const { slideId } = await params;

    // Optimized query with ordering and selective field loading
    const slide = await db.query.slides.findFirst({
      where: eq(slides.id, slideId),
      with: {
        workspace: true,
        metrics: {
          orderBy: (metrics, { asc }) => [asc(metrics.ranking)],
          with: {
            // Only load the definition fields we actually use
            definition: {
              columns: {
                id: true,
                definition: true,
              },
            },
            submetrics: {
              orderBy: (submetrics, { asc }) => [asc(submetrics.createdAt)],
              // Limit columns to reduce payload size
              columns: {
                id: true,
                metricId: true,
                definitionId: true,
                label: true,
                category: true,
                xAxis: true,
                yAxis: true,
                timezone: true,
                preferredTrend: true,
                unit: true,
                aggregationType: true,
                color: true,
                trafficLightColor: true,
                metadata: true,
                dataPoints: true,
                createdAt: true,
                updatedAt: true,
              },
            },
          },
        },
      },
    });

    if (!slide) {
      return NextResponse.json({ error: "Slide not found" }, { status: 404 });
    }

    // Check if the workspace is public or user has access
    if (slide.workspace && (slide.workspace as any).isPublic === false) {
      // Private workspace - should check user membership
      return NextResponse.json(
        { error: "Access denied - slide belongs to a private workspace" },
        { status: 403 },
      );
    }

    // Return with enhanced cache headers
    // Note: Compression is handled automatically by Next.js/deployment platform
    return NextResponse.json(
      { slide },
      {
        headers: {
          "Cache-Control": `private, max-age=${CACHE_REVALIDATE}, stale-while-revalidate=${
            CACHE_REVALIDATE * 2
          }`,
          "CDN-Cache-Control": `max-age=${CACHE_REVALIDATE}`,
          "Vercel-CDN-Cache-Control": `max-age=${CACHE_REVALIDATE}`,
          "Content-Type": "application/json; charset=utf-8",
          // Hint to client that response should be cached aggressively
          "X-Cache-Strategy": "stale-while-revalidate",
          Vary: "Accept-Encoding",
        },
      },
    );
  } catch (error) {
    console.error("Error fetching slide:", error);
    return NextResponse.json(
      { error: "Failed to fetch slide" },
      { status: 500 },
    );
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ slideId: string }> },
) {
  try {
    const session = await getAuthSession();

    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify user has a valid ID
    if (!session.user.id) {
      console.error("Session missing user ID:", session);
      return NextResponse.json(
        { error: "Invalid session - user ID missing" },
        { status: 401 },
      );
    }

    const { slideId } = await params;

    // Validate slideId parameter
    const validatedParams = slideIdSchema.parse({ slideId });

    // Check if the slide exists and get its workspace
    const existingSlide = await db.query.slides.findFirst({
      where: eq(slides.id, validatedParams.slideId),
      with: {
        workspace: true,
      },
    });

    if (!existingSlide) {
      return NextResponse.json({ error: "Slide not found" }, { status: 404 });
    }

    // Check if the workspace is public or user has access
    if (
      existingSlide.workspace &&
      (existingSlide.workspace as any).isPublic === false
    ) {
      // Private workspace - should check user ownership before allowing modification
      return NextResponse.json(
        { error: "Access denied - cannot modify slide from private workspace" },
        { status: 403 },
      );
    }

    const body = await request.json();

    // Validate request body with Zod
    const validatedData = updateSlideSchema.parse(body);

    // Update the slide
    const [_updatedSlide] = await db
      .update(slides)
      .set({
        ...validatedData,
        updatedAt: new Date(),
      })
      .where(eq(slides.id, validatedParams.slideId))
      .returning();

    // Fetch the updated slide with its metrics (optimized field selection)
    const slide = await db.query.slides.findFirst({
      where: eq(slides.id, validatedParams.slideId),
      with: {
        metrics: {
          with: {
            definition: {
              columns: {
                id: true,
                definition: true,
              },
            },
            submetrics: true,
          },
        },
      },
    });

    return NextResponse.json({ slide });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        {
          error: "Validation failed",
          details: error.issues.map((e) => ({
            field: e.path.join("."),
            message: e.message,
          })),
        },
        { status: 400 },
      );
    }

    console.error("Error updating slide:", error);
    return NextResponse.json(
      { error: "Failed to update slide" },
      { status: 500 },
    );
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ slideId: string }> },
) {
  try {
    const session = await getAuthSession();

    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify user has a valid ID
    if (!session.user.id) {
      console.error("Session missing user ID:", session);
      return NextResponse.json(
        { error: "Invalid session - user ID missing" },
        { status: 401 },
      );
    }

    const { slideId } = await params;

    // First check if the slide exists and get its workspace
    const slide = await db.query.slides.findFirst({
      where: eq(slides.id, slideId),
      with: {
        workspace: true,
      },
    });

    if (!slide) {
      return NextResponse.json({ error: "Slide not found" }, { status: 404 });
    }

    // Check if the workspace is public or user has access
    if (slide.workspace && (slide.workspace as any).isPublic === false) {
      // Private workspace - should check user ownership before allowing delete
      return NextResponse.json(
        { error: "Access denied - cannot delete slide from private workspace" },
        { status: 403 },
      );
    }

    // Delete the slide - this will cascade to metrics and submetrics (with datapoints)
    await db.delete(slides).where(eq(slides.id, slideId));

    return NextResponse.json({
      message: "Slide deleted successfully",
      slideId,
    });
  } catch (error) {
    console.error("Error deleting slide:", error);
    return NextResponse.json(
      { error: "Failed to delete slide" },
      { status: 500 },
    );
  }
}
