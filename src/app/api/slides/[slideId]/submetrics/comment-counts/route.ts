import { and, eq, inArray, sql } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { getWorkspaceIdFromSlide } from "@/lib/api/comments";
import { getAuthSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { comments, commentThreads } from "@/lib/db/schema";

/**
 * POST /api/slides/[slideId]/submetrics/comment-counts
 * Batch fetch comment counts for multiple submetric definitions
 * This replaces N individual requests with 1 optimized query
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

    // Verify user has access to this slide
    const workspaceId = await getWorkspaceIdFromSlide(slideId);
    if (!workspaceId) {
      return NextResponse.json({ error: "Slide not found" }, { status: 404 });
    }

    // TODO: Add workspace membership check here if needed
    // await verifyWorkspaceAccess(workspaceId, session.user.id);

    // Single optimized query for ALL definitions
    // Groups by definitionId, bucketType, and bucketValue
    // Returns count of comments for each bucket
    const results = await db
      .select({
        definitionId: commentThreads.definitionId,
        bucketType: commentThreads.bucketType,
        bucketValue: commentThreads.bucketValue,
        count: sql<number>`cast(count(${comments.id}) as integer)`,
      })
      .from(commentThreads)
      .leftJoin(comments, eq(comments.threadId, commentThreads.id))
      .where(
        and(
          inArray(commentThreads.definitionId, definitionIds),
          eq(commentThreads.scope, "point"),
        ),
      )
      .groupBy(
        commentThreads.definitionId,
        commentThreads.bucketType,
        commentThreads.bucketValue,
      );

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

    return NextResponse.json(
      { counts },
      {
        headers: {
          // Cache comment counts for 30 seconds
          "Cache-Control": "private, max-age=30, stale-while-revalidate=60",
          "Content-Type": "application/json; charset=utf-8",
          Vary: "Accept-Encoding",
        },
      },
    );
  } catch (error) {
    console.error("[CommentCounts] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
