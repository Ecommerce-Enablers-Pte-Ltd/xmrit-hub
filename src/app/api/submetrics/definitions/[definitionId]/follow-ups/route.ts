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

      // Group by resolution status relative to the slide's timeline
      const currentSlideDate = currentSlide?.slideDate
        ? new Date(currentSlide.slideDate)
        : null;

      // Resolved: Follow-ups that were resolved on or before the current slide (chronologically)
      resolved = filteredFollowUps.filter((fu) => {
        // Must have done/cancelled status
        if (fu.status !== "done" && fu.status !== "cancelled") {
          return false;
        }

        // If no resolvedAtSlide, it's not resolved
        if (!fu.resolvedAtSlide?.slideDate) {
          return false;
        }

        // Compare dates: resolved if resolvedAtSlide date <= current slide date
        const resolvedDate = new Date(fu.resolvedAtSlide.slideDate);
        // Validate resolved date
        if (Number.isNaN(resolvedDate.getTime())) {
          // Invalid resolved date, treat as not resolved
          return false;
        }

        if (!currentSlideDate) {
          // If current slide has no date, only show if resolved at this exact slide
          return fu.resolvedAtSlideId === slideId;
        }

        // Validate current slide date
        if (Number.isNaN(currentSlideDate.getTime())) {
          // Invalid current slide date, only show if resolved at this exact slide
          return fu.resolvedAtSlideId === slideId;
        }

        return resolvedDate <= currentSlideDate;
      });

      // Unresolved: Follow-ups that either:
      // 1. Have status other than "done" or "cancelled" (can't be resolved yet)
      // 2. Have status "done" or "cancelled" but resolved in the future (after current slide)
      // 3. Have status "done" or "cancelled" but no resolvedAtSlideId set
      unresolved = filteredFollowUps.filter((fu) => {
        // Not done/cancelled status = always unresolved
        if (fu.status !== "done" && fu.status !== "cancelled") {
          return true;
        }

        // Done/cancelled but no resolvedAtSlideId = unresolved
        if (!fu.resolvedAtSlideId || !fu.resolvedAtSlide?.slideDate) {
          return true;
        }

        // Done/cancelled with resolvedAtSlide: check if resolved in the future
        const resolvedDate = new Date(fu.resolvedAtSlide.slideDate);
        // Validate resolved date
        if (Number.isNaN(resolvedDate.getTime())) {
          // Invalid resolved date, treat as unresolved
          return true;
        }

        if (!currentSlideDate) {
          // If current slide has no date, show as unresolved if not resolved at this exact slide
          return fu.resolvedAtSlideId !== slideId;
        }

        // Validate current slide date
        if (Number.isNaN(currentSlideDate.getTime())) {
          // Invalid current slide date, show as unresolved if not resolved at this exact slide
          return fu.resolvedAtSlideId !== slideId;
        }

        return resolvedDate > currentSlideDate;
      });
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
