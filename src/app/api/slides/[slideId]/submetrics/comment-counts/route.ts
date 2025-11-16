import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { commentThreads, comments } from "@/lib/db/schema";
import { eq, and, sql, inArray } from "drizzle-orm";
import { getWorkspaceIdFromSlide } from "@/lib/api/comments";

/**
 * POST /api/slides/[slideId]/submetrics/comment-counts
 * Batch fetch comment counts for multiple submetric definitions
 * This replaces N individual requests with 1 optimized query
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slideId: string }> }
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

    // Verify user has access to this slide
    const workspaceId = await getWorkspaceIdFromSlide(slideId);
    if (!workspaceId) {
      return NextResponse.json({ error: "Slide not found" }, { status: 404 });
    }

    // TODO: Add workspace membership check here if needed
    // await verifyWorkspaceAccess(workspaceId, session.user.id);

    console.log(
      `[CommentCounts] Fetching counts for ${definitionIds.length} definitions`
    );

    // Single optimized query for ALL definitions
    // Groups by definitionId, bucketType, and bucketValue
    // Returns count of non-deleted comments for each bucket
    const results = await db
      .select({
        definitionId: commentThreads.definitionId,
        bucketType: commentThreads.bucketType,
        bucketValue: commentThreads.bucketValue,
        count: sql<number>`cast(count(CASE WHEN ${comments.isDeleted} = false THEN ${comments.id} END) as integer)`,
      })
      .from(commentThreads)
      .leftJoin(comments, eq(comments.threadId, commentThreads.id))
      .where(
        and(
          inArray(commentThreads.definitionId, definitionIds),
          eq(commentThreads.scope, "point")
        )
      )
      .groupBy(
        commentThreads.definitionId,
        commentThreads.bucketType,
        commentThreads.bucketValue
      );

    console.log(`[CommentCounts] Found ${results.length} bucket counts`);

    // Organize by "definitionId:bucketType" -> { bucketValue: count }
    // This structure allows O(1) lookups on the client
    const counts: Record<string, Record<string, number>> = {};

    for (const row of results) {
      if (row.definitionId && row.bucketType && row.bucketValue) {
        const key = `${row.definitionId}:${row.bucketType}`;

        if (!counts[key]) {
          counts[key] = {};
        }

        // Only include buckets with comments (count > 0)
        if (row.count > 0) {
          counts[key][row.bucketValue] = row.count;
        }
      }
    }

    return NextResponse.json({ counts });
  } catch (error) {
    console.error("[CommentCounts] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
