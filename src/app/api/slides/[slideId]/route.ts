import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { slides, workspaces } from "@/lib/db/schema";

// Cache control headers for slide data
const CACHE_REVALIDATE = 300; // 5 minutes

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slideId: string }> }
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
        { status: 401 }
      );
    }

    const { slideId } = await params;

    // Optimized query with ordering
    const slide = await db.query.slides.findFirst({
      where: eq(slides.id, slideId),
      with: {
        workspace: true,
        metrics: {
          orderBy: (metrics, { asc }) => [
            asc(metrics.sortOrder),
            asc(metrics.ranking),
          ],
          with: {
            submetrics: {
              orderBy: (submetrics, { asc }) => [asc(submetrics.createdAt)],
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
        { status: 403 }
      );
    }

    // Return with cache headers
    return NextResponse.json(
      { slide },
      {
        headers: {
          "Cache-Control": `private, s-maxage=${CACHE_REVALIDATE}, stale-while-revalidate`,
        },
      }
    );
  } catch (error) {
    console.error("Error fetching slide:", error);
    return NextResponse.json(
      { error: "Failed to fetch slide" },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ slideId: string }> }
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
        { status: 401 }
      );
    }

    const { slideId } = await params;

    // Check if the slide exists and get its workspace
    const existingSlide = await db.query.slides.findFirst({
      where: eq(slides.id, slideId),
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
        { status: 403 }
      );
    }

    const body = await request.json();

    // Update the slide
    const [updatedSlide] = await db
      .update(slides)
      .set({
        ...body,
        updatedAt: new Date(),
      })
      .where(eq(slides.id, slideId))
      .returning();

    // Fetch the updated slide with its metrics
    const slide = await db.query.slides.findFirst({
      where: eq(slides.id, slideId),
      with: {
        metrics: {
          with: {
            submetrics: true,
          },
        },
      },
    });

    return NextResponse.json({ slide });
  } catch (error) {
    console.error("Error updating slide:", error);
    return NextResponse.json(
      { error: "Failed to update slide" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ slideId: string }> }
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
        { status: 401 }
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
        { status: 403 }
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
      { status: 500 }
    );
  }
}
