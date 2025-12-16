import { and, eq, inArray, ne, sql } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { followUps, slides } from "@/lib/db/schema";

/**
 * POST /api/slides/[slideId]/submetrics/follow-up-counts
 * Batch fetch unresolved follow-up counts for multiple submetric definitions
 * This replaces N individual requests with 1 optimized query
 *
 * Key optimization for mobile devices:
 * - Instead of 100+ individual API calls to /api/submetrics/definitions/[id]/follow-ups
 * - We make 1 batch call that returns all counts at once
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slideId: string }> },
) {
  const session = await getAuthSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { slideId } = await params;
    const body = await request.json();
    const { definitionIds } = body;

    // Validate input
    if (!Array.isArray(definitionIds) || definitionIds.length === 0) {
      return NextResponse.json({ counts: {} });
    }

    // Verify slide exists and get its date for filtering
    const currentSlide = await db.query.slides.findFirst({
      where: eq(slides.id, slideId),
      columns: { id: true, workspaceId: true, slideDate: true },
    });

    if (!currentSlide) {
      return NextResponse.json({ error: "Slide not found" }, { status: 404 });
    }

    // Get unresolved follow-up counts for all requested definitions
    // A follow-up is "unresolved" if its status is not "resolved"
    // We also filter to only include follow-ups created on or before the current slide date
    const currentDate = currentSlide.slideDate
      ? new Date(currentSlide.slideDate)
      : null;

    // Build the query - count unresolved follow-ups per submetric definition
    // We need to join with the creation slide to filter by slide date
    const results = await db
      .select({
        definitionId: followUps.submetricDefinitionId,
        count: sql<number>`cast(count(${followUps.id}) as integer)`,
      })
      .from(followUps)
      .leftJoin(slides, eq(followUps.slideId, slides.id))
      .where(
        and(
          inArray(followUps.submetricDefinitionId, definitionIds),
          ne(followUps.status, "resolved"),
          // Only include follow-ups created on or before the current slide date
          currentDate
            ? sql`${slides.slideDate} IS NULL OR ${
                slides.slideDate
              } <= ${currentDate.toISOString()}`
            : sql`true`,
        ),
      )
      .groupBy(followUps.submetricDefinitionId);

    // Convert to a simple map: definitionId -> count
    const counts: Record<string, number> = {};

    for (const row of results) {
      if (row.definitionId && row.count > 0) {
        counts[row.definitionId] = row.count;
      }
    }

    return NextResponse.json(
      { counts },
      {
        headers: {
          // Cache follow-up counts for 15 seconds (they change more frequently than comments)
          "Cache-Control": "private, max-age=15, stale-while-revalidate=30",
          "Content-Type": "application/json; charset=utf-8",
          Vary: "Accept-Encoding",
        },
      },
    );
  } catch (error) {
    console.error("[FollowUpCounts] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
