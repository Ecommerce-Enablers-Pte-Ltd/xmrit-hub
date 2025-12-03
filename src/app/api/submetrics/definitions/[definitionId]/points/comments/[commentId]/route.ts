import { and, eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { comments } from "@/lib/db/schema";

/**
 * PATCH /api/submetrics/definitions/[definitionId]/points/comments/[commentId]
 * Update a comment (only by owner)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ definitionId: string; commentId: string }> },
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { commentId } = await params;
    const body = await request.json();
    const { body: commentBody } = body;

    if (!commentBody || typeof commentBody !== "string") {
      return NextResponse.json(
        { error: "Comment body is required" },
        { status: 400 },
      );
    }

    // Verify comment exists and belongs to user
    const [existingComment] = await db
      .select()
      .from(comments)
      .where(
        and(eq(comments.id, commentId), eq(comments.userId, session.user.id)),
      )
      .limit(1);

    if (!existingComment) {
      return NextResponse.json(
        { error: "Comment not found or you don't have permission to edit it" },
        { status: 404 },
      );
    }

    // Update comment
    const [updatedComment] = await db
      .update(comments)
      .set({
        body: commentBody,
        updatedAt: new Date(),
      })
      .where(eq(comments.id, commentId))
      .returning();

    return NextResponse.json(updatedComment);
  } catch (error) {
    console.error("Error updating comment:", error);
    return NextResponse.json(
      { error: "Failed to update comment" },
      { status: 500 },
    );
  }
}

/**
 * DELETE /api/submetrics/definitions/[definitionId]/points/comments/[commentId]
 * Delete a comment (only by owner) - child comments cascade delete via DB foreign key
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ definitionId: string; commentId: string }> },
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { commentId } = await params;

    // Verify comment exists and belongs to user
    const [existingComment] = await db
      .select()
      .from(comments)
      .where(
        and(eq(comments.id, commentId), eq(comments.userId, session.user.id)),
      )
      .limit(1);

    if (!existingComment) {
      return NextResponse.json(
        {
          error: "Comment not found or you don't have permission to delete it",
        },
        { status: 404 },
      );
    }

    // Hard delete - child comments will cascade delete via DB foreign key constraint
    await db.delete(comments).where(eq(comments.id, commentId));

    return NextResponse.json({
      success: true,
      deletedId: commentId,
    });
  } catch (error) {
    console.error("Error deleting comment:", error);
    return NextResponse.json(
      { error: "Failed to delete comment" },
      { status: 500 },
    );
  }
}
