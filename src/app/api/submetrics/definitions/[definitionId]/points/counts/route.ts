import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  getWorkspaceIdFromDefinition,
  getPointCommentCounts,
} from "@/lib/api/comments";
import type { TimeBucket } from "@/lib/time-buckets";

/**
 * GET /api/submetrics/definitions/[definitionId]/points/counts
 * Get comment counts for multiple bucket values (batch operation)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ definitionId: string }> }
) {
  try {
    // Auth check
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { definitionId } = await params;

    // Get query params
    const searchParams = request.nextUrl.searchParams;
    const bucketType = searchParams.get("bucketType") as TimeBucket | null;
    const bucketValuesParam = searchParams.get("bucketValues");

    // Validate required params
    if (!bucketType || !bucketValuesParam) {
      return NextResponse.json(
        { error: "Missing required parameters: bucketType, bucketValues" },
        { status: 400 }
      );
    }

    // Parse bucket values (comma-separated)
    const bucketValues = bucketValuesParam.split(",").filter((v) => v.length > 0);

    if (bucketValues.length === 0) {
      return NextResponse.json({ counts: {} });
    }

    // Limit to max 100 buckets per request
    if (bucketValues.length > 100) {
      return NextResponse.json(
        { error: "Too many bucket values (max 100)" },
        { status: 400 }
      );
    }

    // Validate bucketType
    const validBuckets: TimeBucket[] = [
      "day",
      "week",
      "month",
      "quarter",
      "year",
    ];
    if (!validBuckets.includes(bucketType)) {
      return NextResponse.json(
        { error: "Invalid bucketType" },
        { status: 400 }
      );
    }

    // Get workspace from definition and verify access
    const workspaceId = await getWorkspaceIdFromDefinition(definitionId);
    if (!workspaceId) {
      return NextResponse.json(
        { error: "Definition not found" },
        { status: 404 }
      );
    }

    // TODO: Add workspace membership check here

    // Get counts
    const counts = await getPointCommentCounts(
      definitionId,
      bucketType,
      bucketValues
    );

    return NextResponse.json({ counts });
  } catch (error) {
    console.error("Error getting point comment counts:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

