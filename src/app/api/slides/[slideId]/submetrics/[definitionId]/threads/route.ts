import { type NextRequest, NextResponse } from "next/server";
import {
  createSlideComment,
  getSlideThreads,
  getWorkspaceIdFromSlide,
} from "@/lib/api/comments";
import { auth } from "@/lib/auth";

/**
 * GET /api/slides/[slideId]/submetrics/[definitionId]/threads
 * Get slide-scoped submetric thread with paginated comments
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slideId: string; definitionId: string }> },
) {
  try {
    // Auth check
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { slideId, definitionId } = await params;

    // Get query params
    const searchParams = request.nextUrl.searchParams;
    const cursor = searchParams.get("cursor") || undefined;
    const limitParam = searchParams.get("limit");
    const limit = limitParam ? Number.parseInt(limitParam, 10) : undefined;

    // Get workspace from slide and verify access
    const workspaceId = await getWorkspaceIdFromSlide(slideId);
    if (!workspaceId) {
      return NextResponse.json({ error: "Slide not found" }, { status: 404 });
    }

    // TODO: Add workspace membership check here

    // Get threads
    const result = await getSlideThreads(slideId, definitionId, cursor, limit);

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
    console.error("Error getting slide threads:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

/**
 * POST /api/slides/[slideId]/submetrics/[definitionId]/threads
 * Create a comment in a slide-scoped thread
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slideId: string; definitionId: string }> },
) {
  try {
    // Auth check
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { slideId, definitionId } = await params;

    // Parse request body
    const body = await request.json();
    const { body: commentBody, parentId, title } = body;

    // Validate required fields
    if (!commentBody) {
      return NextResponse.json(
        { error: "Missing required field: body" },
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

    // Get workspace from slide and verify access
    const workspaceId = await getWorkspaceIdFromSlide(slideId);
    if (!workspaceId) {
      return NextResponse.json({ error: "Slide not found" }, { status: 404 });
    }

    // TODO: Add workspace membership check here

    // Create comment
    const result = await createSlideComment(
      workspaceId,
      slideId,
      definitionId,
      session.user.id,
      commentBody.trim(),
      parentId,
      title,
    );

    return NextResponse.json(result, { status: 201 });
  } catch (error: any) {
    console.error("Error creating slide comment:", error);

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
