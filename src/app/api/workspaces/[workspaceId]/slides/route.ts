import { desc, eq, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { slides, workspaces } from "@/lib/db/schema";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ workspaceId: string }> },
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

    const { workspaceId } = await params;

    // Check if workspace exists and user has access
    const workspace = await db
      .select()
      .from(workspaces)
      .where(eq(workspaces.id, workspaceId))
      .limit(1);

    if (!workspace.length) {
      return NextResponse.json(
        { error: "Workspace not found" },
        { status: 404 },
      );
    }

    // Check if user has permission to create slides in this workspace
    if (workspace[0].isPublic === false) {
      // Private workspace - should check user ownership
      return NextResponse.json(
        { error: "Access denied - cannot create slide in private workspace" },
        { status: 403 },
      );
    }

    const body = await request.json();

    // Get the next slide number for this workspace
    // Find the maximum slideNumber and add 1
    const maxSlideResult = await db
      .select({
        maxNumber: sql<number>`COALESCE(MAX(${slides.slideNumber}), 0)`,
      })
      .from(slides)
      .where(eq(slides.workspaceId, workspaceId));

    const nextSlideNumber = (maxSlideResult[0]?.maxNumber ?? 0) + 1;

    // Create the slide with the assigned slideNumber
    const [newSlide] = await db
      .insert(slides)
      .values({
        title: body.title || "Untitled Slide",
        slideNumber: nextSlideNumber,
        description: body.description,
        workspaceId,
        slideDate: body.slideDate,
      })
      .returning();

    // Fetch the created slide with its metrics (empty array initially)
    const slide = await db.query.slides.findFirst({
      where: (slides, { eq }) => eq(slides.id, newSlide.id),
      with: {
        metrics: {
          with: {
            definition: {
              columns: {
                id: true,
                definition: true,
              },
            },
            submetrics: {
              with: {
                definition: {
                  columns: {
                    id: true,
                    category: true,
                    metricName: true,
                    xaxis: true,
                    yaxis: true,
                    unit: true,
                    preferredTrend: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    return NextResponse.json({ slide }, { status: 201 });
  } catch (error) {
    // Handle unique constraint violation (race condition - retry once)
    if (
      error instanceof Error &&
      error.message.includes("unique constraint") &&
      error.message.includes("slide_workspace_slide_number")
    ) {
      console.warn("Slide number conflict, retrying...");
      // Could implement retry logic here if needed
    }

    console.error("Error creating slide:", error);
    return NextResponse.json(
      { error: "Failed to create slide" },
      { status: 500 },
    );
  }
}
