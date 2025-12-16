import { eq, inArray } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { slides, submetrics } from "@/lib/db/schema";
import type { DataPointJson } from "@/types/db/submetric";

// Cache control - data points change infrequently
const CACHE_REVALIDATE = 300; // 5 minutes

/**
 * POST /api/slides/[slideId]/submetrics/data-points
 * Batch fetch dataPoints for multiple submetrics
 * This replaces N individual requests with 1 optimized query
 *
 * Request body: { submetricIds: string[] }
 * Response: { dataPointsBySubmetricId: Record<string, DataPointJson[]> }
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
    const { submetricIds } = body;

    // Validate input
    if (!Array.isArray(submetricIds) || submetricIds.length === 0) {
      return NextResponse.json({ dataPointsBySubmetricId: {} });
    }

    // Limit batch size to prevent abuse
    const MAX_BATCH_SIZE = 50;
    const limitedIds = submetricIds.slice(0, MAX_BATCH_SIZE);

    // Verify slide exists and user has access
    const slide = await db.query.slides.findFirst({
      where: eq(slides.id, slideId),
      with: {
        workspace: true,
      },
    });

    if (!slide) {
      return NextResponse.json({ error: "Slide not found" }, { status: 404 });
    }

    // Check workspace access (public workspaces are accessible to all authenticated users)
    const workspace = slide.workspace as { isPublic?: boolean | null } | null;
    if (workspace && workspace.isPublic === false) {
      return NextResponse.json(
        { error: "Access denied - slide belongs to a private workspace" },
        { status: 403 },
      );
    }

    // Fetch dataPoints for requested submetrics
    // Only select id and dataPoints columns for minimal payload
    const results = await db
      .select({
        id: submetrics.id,
        dataPoints: submetrics.dataPoints,
      })
      .from(submetrics)
      .where(inArray(submetrics.id, limitedIds));

    // Build response map
    const dataPointsBySubmetricId: Record<string, DataPointJson[]> = {};

    for (const row of results) {
      if (row.id && row.dataPoints) {
        // dataPoints is stored as JSON array in the database
        dataPointsBySubmetricId[row.id] = row.dataPoints as DataPointJson[];
      } else if (row.id) {
        // Submetric exists but has no dataPoints
        dataPointsBySubmetricId[row.id] = [];
      }
    }

    return NextResponse.json(
      { dataPointsBySubmetricId },
      {
        headers: {
          // Cache data points for 5 minutes - they change infrequently
          "Cache-Control": `private, max-age=${CACHE_REVALIDATE}, stale-while-revalidate=${CACHE_REVALIDATE * 2}`,
          "CDN-Cache-Control": `max-age=${CACHE_REVALIDATE}`,
          "Content-Type": "application/json; charset=utf-8",
          Vary: "Accept-Encoding",
        },
      },
    );
  } catch (error) {
    console.error("[DataPoints] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
