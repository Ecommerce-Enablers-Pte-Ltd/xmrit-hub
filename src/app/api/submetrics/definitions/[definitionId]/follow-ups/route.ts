import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { followUps, slides, submetricDefinitions } from "@/lib/db/schema";

/**
 * GET /api/submetrics/definitions/[definitionId]/follow-ups
 * Get all follow-ups for a specific submetric definition
 * Optional query param: slideId - to determine resolution context
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ definitionId: string }> },
) {
  try {
    const session = await getAuthSession();

    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { definitionId } = await params;

    // Check if submetric definition exists
    const definition = await db
      .select()
      .from(submetricDefinitions)
      .where(eq(submetricDefinitions.id, definitionId))
      .limit(1);

    if (!definition.length) {
      return NextResponse.json(
        { error: "Submetric definition not found" },
        { status: 404 },
      );
    }

    // Get optional slideId from query params for resolution context
    const { searchParams } = new URL(request.url);
    const slideId = searchParams.get("slideId");

    // Fetch all follow-ups for this submetric definition
    const submetricFollowUps = await db.query.followUps.findMany({
      where: eq(followUps.submetricDefinitionId, definitionId),
      with: {
        assignee: true,
        assignees: {
          with: {
            user: true,
          },
        },
        createdByUser: true,
        slide: true,
        resolvedAtSlide: true,
        submetricDefinition: true,
      },
      orderBy: (followUps, { desc }) => [desc(followUps.createdAt)],
    });

    // If slideId is provided, add resolution context
    let resolved: typeof submetricFollowUps = [];
    let unresolved: typeof submetricFollowUps = [];
    let filteredFollowUps = submetricFollowUps;

    if (slideId) {
      // Get current slide to check its date
      const currentSlide = await db.query.slides.findFirst({
        where: eq(slides.id, slideId),
      });

      // Filter follow-ups to only include those created on or before the current slide
      if (currentSlide?.slideDate) {
        const currentDate = new Date(currentSlide.slideDate);
        // Validate current date
        if (Number.isNaN(currentDate.getTime())) {
          // Invalid current slide date, show all follow-ups
          filteredFollowUps = submetricFollowUps;
        } else {
          filteredFollowUps = submetricFollowUps.filter((fu) => {
            if (!fu.slide?.slideDate) {
              return true; // Include if no creation date
            }
            const creationDate = new Date(fu.slide.slideDate);
            // Validate creation date
            if (Number.isNaN(creationDate.getTime())) {
              return true; // Include if invalid date
            }
            return creationDate <= currentDate;
          });
        }
      }

      // Group by resolution status (simplified logic)
      // Resolved: status === "resolved"
      resolved = filteredFollowUps.filter((fu) => fu.status === "resolved");

      // Unresolved: status !== "resolved"
      unresolved = filteredFollowUps.filter((fu) => fu.status !== "resolved");
    }

    return NextResponse.json(
      {
        followUps: submetricFollowUps,
        count: submetricFollowUps.length,
        ...(slideId && {
          resolved,
          unresolved,
          resolvedCount: resolved.length,
          unresolvedCount: unresolved.length,
        }),
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("Error fetching submetric definition follow-ups:", error);
    return NextResponse.json(
      { error: "Failed to fetch follow-ups" },
      { status: 500 },
    );
  }
}
