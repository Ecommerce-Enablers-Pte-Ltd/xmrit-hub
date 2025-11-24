import { type NextRequest, NextResponse } from "next/server";
import {
  createPointComment,
  getAllPointComments,
  getPointThread,
  getWorkspaceIdFromDefinition,
} from "@/lib/api/comments";
import { auth } from "@/lib/auth";
import type { TimeBucket } from "@/lib/time-buckets";

/**
 * GET /api/submetrics/definitions/[definitionId]/points
 * Get a point-level comment thread with paginated comments
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ definitionId: string }> },
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
    const bucketValue = searchParams.get("bucketValue");
    const cursor = searchParams.get("cursor") || undefined;
    const limitParam = searchParams.get("limit");
    const limit = limitParam ? Number.parseInt(limitParam, 10) : undefined;

    // Get workspace from definition and verify access
    const workspaceId = await getWorkspaceIdFromDefinition(definitionId);
    if (!workspaceId) {
      return NextResponse.json(
        { error: "Definition not found" },
        { status: 404 },
      );
    }

    // TODO: Add workspace membership check here when workspace auth is implemented
    // For now, assume all authenticated users can access public workspaces

    // If no bucket params provided, return all comments
    if (!bucketType || !bucketValue) {
      const result = await getAllPointComments(definitionId);
      return NextResponse.json(result);
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
        { status: 400 },
      );
    }

    // Get thread for specific point
    const result = await getPointThread(
      definitionId,
      bucketType,
      bucketValue,
      cursor,
      limit,
    );

    if (!result) {
      // No thread exists yet - return empty response
      return NextResponse.json({
        thread: null,
        comments: [],
        nextCursor: null,
        hasMore: false,
      });
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("Error getting point thread:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

/**
 * POST /api/submetrics/definitions/[definitionId]/points
 * Create a comment in a point-level thread
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ definitionId: string }> },
) {
  try {
    // Auth check
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { definitionId } = await params;

    // Parse request body
    const body = await request.json();
    const { bucketType, bucketValue, body: commentBody, parentId } = body;

    // Validate required fields
    if (!bucketType || !bucketValue || !commentBody) {
      return NextResponse.json(
        { error: "Missing required fields: bucketType, bucketValue, body" },
        { status: 400 },
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
        { status: 400 },
      );
    }

    // Validate body length
    if (typeof commentBody !== "string" || commentBody.trim().length === 0) {
      return NextResponse.json(
        { error: "Comment body cannot be empty" },
        { status: 400 },
      );
    }

    if (commentBody.length > 10000) {
      return NextResponse.json(
        { error: "Comment body too long (max 10000 characters)" },
        { status: 400 },
      );
    }

    // Get workspace from definition and verify access
    const workspaceId = await getWorkspaceIdFromDefinition(definitionId);
    if (!workspaceId) {
      return NextResponse.json(
        { error: "Definition not found" },
        { status: 404 },
      );
    }

    // TODO: Add workspace membership check here

    // Create comment
    const result = await createPointComment(
      workspaceId,
      definitionId,
      bucketType,
      bucketValue,
      session.user.id,
      commentBody.trim(),
      parentId,
    );

    return NextResponse.json(result, { status: 201 });
  } catch (error: any) {
    console.error("Error creating point comment:", error);

    if (error.message === "Invalid parent comment") {
      return NextResponse.json(
        { error: "Invalid parent comment" },
        { status: 400 },
      );
    }

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
