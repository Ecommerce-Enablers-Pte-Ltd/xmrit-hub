/**
 * Comment API helper functions
 */

import { and, desc, eq, gt, inArray, or, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  comments,
  commentThreads,
  slides,
  submetricDefinitions,
  users,
} from "@/lib/db/schema";
import type { TimeBucket } from "@/lib/time-buckets";
import type {
  CommentThreadResponse,
  CommentWithUser,
  CreateCommentResponse,
} from "@/types/db/comment";

const DEFAULT_PAGE_LIMIT = 20;
const MAX_PAGE_LIMIT = 100;

/**
 * Get workspace ID from definition ID
 */
export async function getWorkspaceIdFromDefinition(
  definitionId: string,
): Promise<string | null> {
  const result = await db
    .select({ workspaceId: submetricDefinitions.workspaceId })
    .from(submetricDefinitions)
    .where(eq(submetricDefinitions.id, definitionId))
    .limit(1);

  return result[0]?.workspaceId || null;
}

/**
 * Get workspace ID from slide ID
 */
export async function getWorkspaceIdFromSlide(
  slideId: string,
): Promise<string | null> {
  const result = await db
    .select({ workspaceId: slides.workspaceId })
    .from(slides)
    .where(eq(slides.id, slideId))
    .limit(1);

  return result[0]?.workspaceId || null;
}

/**
 * Parse keyset cursor for pagination
 * Format: `${createdAt.getTime()}_${id}`
 */
function parseCursor(cursor: string): { createdAt: Date; id: string } | null {
  try {
    const [timestamp, id] = cursor.split("_");
    if (!timestamp || !id) return null;
    return {
      createdAt: new Date(Number(timestamp)),
      id,
    };
  } catch {
    return null;
  }
}

/**
 * Create keyset cursor for pagination
 */
function createCursor(createdAt: Date, id: string): string {
  return `${createdAt.getTime()}_${id}`;
}

/**
 * Get or create a point-level comment thread
 */
export async function getOrCreatePointThread(
  workspaceId: string,
  definitionId: string,
  bucketType: TimeBucket,
  bucketValue: string,
  createdBy: string,
): Promise<string> {
  // Try to find existing thread
  const existing = await db
    .select({ id: commentThreads.id })
    .from(commentThreads)
    .where(
      and(
        eq(commentThreads.definitionId, definitionId),
        eq(commentThreads.scope, "point"),
        eq(commentThreads.bucketType, bucketType),
        eq(commentThreads.bucketValue, bucketValue),
      ),
    )
    .limit(1);

  if (existing[0]) {
    return existing[0].id;
  }

  // Create new thread
  const newThread = await db
    .insert(commentThreads)
    .values({
      workspaceId,
      definitionId,
      scope: "point",
      bucketType,
      bucketValue,
      isResolved: false,
      createdBy,
    })
    .returning({ id: commentThreads.id });

  return newThread[0].id;
}

/**
 * Get all point-level comments for a definition (across all data points)
 */
export async function getAllPointComments(
  definitionId: string,
): Promise<{ threads: CommentThreadResponse[] }> {
  // Get all threads for this definition
  const allThreads = await db
    .select()
    .from(commentThreads)
    .where(
      and(
        eq(commentThreads.definitionId, definitionId),
        eq(commentThreads.scope, "point"),
      ),
    )
    .orderBy(desc(commentThreads.updatedAt));

  if (allThreads.length === 0) {
    return { threads: [] };
  }

  // Get all comments for these threads
  const threadIds = allThreads.map((t) => t.id);
  const allComments = await db
    .select({
      id: comments.id,
      threadId: comments.threadId,
      userId: comments.userId,
      body: comments.body,
      parentId: comments.parentId,
      createdAt: comments.createdAt,
      updatedAt: comments.updatedAt,
      userName: users.name,
      userEmail: users.email,
      userImage: users.image,
    })
    .from(comments)
    .innerJoin(users, eq(comments.userId, users.id))
    .where(inArray(comments.threadId, threadIds))
    .orderBy(comments.createdAt);

  // Group comments by thread
  const commentsByThread = new Map<string, CommentWithUser[]>();
  for (const comment of allComments) {
    if (!commentsByThread.has(comment.threadId)) {
      commentsByThread.set(comment.threadId, []);
    }
    commentsByThread.get(comment.threadId)?.push({
      id: comment.id,
      threadId: comment.threadId,
      userId: comment.userId,
      body: comment.body,
      parentId: comment.parentId,
      createdAt: comment.createdAt,
      updatedAt: comment.updatedAt,
      user: {
        id: comment.userId,
        name: comment.userName,
        email: comment.userEmail,
        image: comment.userImage,
      },
    });
  }

  // Build response for each thread
  const threads = allThreads.map((thread) => ({
    thread,
    comments: commentsByThread.get(thread.id) || [],
    nextCursor: null,
    hasMore: false,
  }));

  return { threads };
}

/**
 * Get point thread with paginated comments
 */
export async function getPointThread(
  definitionId: string,
  bucketType: TimeBucket,
  bucketValue: string,
  cursor?: string,
  limit: number = DEFAULT_PAGE_LIMIT,
): Promise<CommentThreadResponse | null> {
  // Clamp limit
  const effectiveLimit = Math.min(Math.max(1, limit), MAX_PAGE_LIMIT);

  // Get thread
  const thread = await db
    .select()
    .from(commentThreads)
    .where(
      and(
        eq(commentThreads.definitionId, definitionId),
        eq(commentThreads.scope, "point"),
        eq(commentThreads.bucketType, bucketType),
        eq(commentThreads.bucketValue, bucketValue),
      ),
    )
    .limit(1);

  if (!thread[0]) {
    return null;
  }

  // Build comment query with keyset pagination
  const cursorData = cursor ? parseCursor(cursor) : null;

  const commentQuery = db
    .select({
      id: comments.id,
      threadId: comments.threadId,
      userId: comments.userId,
      body: comments.body,
      parentId: comments.parentId,
      createdAt: comments.createdAt,
      updatedAt: comments.updatedAt,
      userName: users.name,
      userEmail: users.email,
      userImage: users.image,
    })
    .from(comments)
    .innerJoin(users, eq(comments.userId, users.id))
    .where(
      and(
        eq(comments.threadId, thread[0].id),
        cursorData
          ? or(
              gt(comments.createdAt, cursorData.createdAt),
              and(
                eq(comments.createdAt, cursorData.createdAt),
                gt(comments.id, cursorData.id),
              ),
            )
          : undefined,
      ),
    )
    .orderBy(comments.createdAt, comments.id)
    .limit(effectiveLimit + 1); // Fetch one extra to check for more

  const results = await commentQuery;

  // Check if there are more results
  const hasMore = results.length > effectiveLimit;
  const commentsToReturn = hasMore ? results.slice(0, effectiveLimit) : results;

  // Format comments
  const formattedComments: CommentWithUser[] = commentsToReturn.map((row) => ({
    id: row.id,
    threadId: row.threadId,
    userId: row.userId,
    body: row.body,
    parentId: row.parentId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    user: {
      id: row.userId,
      name: row.userName,
      email: row.userEmail,
      image: row.userImage,
    },
  }));

  // Create next cursor if there are more results
  const nextCursor =
    hasMore && commentsToReturn.length > 0
      ? createCursor(
          commentsToReturn[commentsToReturn.length - 1].createdAt,
          commentsToReturn[commentsToReturn.length - 1].id,
        )
      : null;

  return {
    thread: thread[0],
    comments: formattedComments,
    nextCursor,
    hasMore,
  };
}

/**
 * Create a comment in a point thread
 */
export async function createPointComment(
  workspaceId: string,
  definitionId: string,
  bucketType: TimeBucket,
  bucketValue: string,
  userId: string,
  body: string,
  parentId?: string,
): Promise<CreateCommentResponse> {
  // Get or create thread
  const threadId = await getOrCreatePointThread(
    workspaceId,
    definitionId,
    bucketType,
    bucketValue,
    userId,
  );

  // Validate parentId if provided
  if (parentId) {
    const parent = await db
      .select({ threadId: comments.threadId })
      .from(comments)
      .where(eq(comments.id, parentId))
      .limit(1);

    if (!parent[0] || parent[0].threadId !== threadId) {
      throw new Error("Invalid parent comment");
    }
  }

  // Create comment
  const newComment = await db
    .insert(comments)
    .values({
      threadId,
      userId,
      body,
      parentId: parentId || null,
    })
    .returning();

  // Update thread updatedAt
  await db
    .update(commentThreads)
    .set({ updatedAt: new Date() })
    .where(eq(commentThreads.id, threadId));

  // Get thread
  const thread = await db
    .select()
    .from(commentThreads)
    .where(eq(commentThreads.id, threadId))
    .limit(1);

  // Get user info
  const user = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  const createdComment = newComment[0];
  const commentWithUser: CommentWithUser = {
    id: createdComment.id,
    threadId: createdComment.threadId,
    userId: createdComment.userId,
    body: createdComment.body,
    parentId: createdComment.parentId,
    createdAt: createdComment.createdAt,
    updatedAt: createdComment.updatedAt,
    user: {
      id: user[0].id,
      name: user[0].name,
      email: user[0].email,
      image: user[0].image,
    },
  };

  return {
    comment: commentWithUser,
    thread: thread[0],
  };
}

/**
 * Get comment counts for multiple buckets (batch operation)
 */
export async function getPointCommentCounts(
  definitionId: string,
  bucketType: TimeBucket,
  bucketValues: string[],
): Promise<Record<string, number>> {
  if (bucketValues.length === 0) {
    return {};
  }

  // Query to count comments for each bucket
  const results = await db
    .select({
      bucketValue: commentThreads.bucketValue,
      count: sql<number>`cast(count(${comments.id}) as integer)`,
    })
    .from(commentThreads)
    .leftJoin(comments, eq(comments.threadId, commentThreads.id))
    .where(
      and(
        eq(commentThreads.definitionId, definitionId),
        eq(commentThreads.scope, "point"),
        eq(commentThreads.bucketType, bucketType),
        inArray(commentThreads.bucketValue, bucketValues),
      ),
    )
    .groupBy(commentThreads.bucketValue);

  // Build response map
  const counts: Record<string, number> = {};
  for (const value of bucketValues) {
    counts[value] = 0;
  }

  for (const row of results) {
    if (row.bucketValue) {
      counts[row.bucketValue] = row.count;
    }
  }

  return counts;
}

/**
 * Get or create a slide-scoped submetric thread
 */
export async function getOrCreateSlideThread(
  workspaceId: string,
  slideId: string,
  definitionId: string,
  createdBy: string,
): Promise<string> {
  // Try to find existing thread
  const existing = await db
    .select({ id: commentThreads.id })
    .from(commentThreads)
    .where(
      and(
        eq(commentThreads.definitionId, definitionId),
        eq(commentThreads.scope, "submetric"),
        eq(commentThreads.slideId, slideId),
      ),
    )
    .limit(1);

  if (existing[0]) {
    return existing[0].id;
  }

  // Create new thread
  const newThread = await db
    .insert(commentThreads)
    .values({
      workspaceId,
      definitionId,
      scope: "submetric",
      slideId,
      bucketType: null,
      bucketValue: null,
      isResolved: false,
      createdBy,
    })
    .returning({ id: commentThreads.id });

  return newThread[0].id;
}

/**
 * Get slide-scoped threads for a submetric with paginated comments
 */
export async function getSlideThreads(
  slideId: string,
  definitionId: string,
  cursor?: string,
  limit: number = DEFAULT_PAGE_LIMIT,
): Promise<CommentThreadResponse | null> {
  // Clamp limit
  const effectiveLimit = Math.min(Math.max(1, limit), MAX_PAGE_LIMIT);

  // Get thread
  const thread = await db
    .select()
    .from(commentThreads)
    .where(
      and(
        eq(commentThreads.definitionId, definitionId),
        eq(commentThreads.scope, "submetric"),
        eq(commentThreads.slideId, slideId),
      ),
    )
    .limit(1);

  if (!thread[0]) {
    return null;
  }

  // Build comment query with keyset pagination
  const cursorData = cursor ? parseCursor(cursor) : null;

  const commentQuery = db
    .select({
      id: comments.id,
      threadId: comments.threadId,
      userId: comments.userId,
      body: comments.body,
      parentId: comments.parentId,
      createdAt: comments.createdAt,
      updatedAt: comments.updatedAt,
      userName: users.name,
      userEmail: users.email,
      userImage: users.image,
    })
    .from(comments)
    .innerJoin(users, eq(comments.userId, users.id))
    .where(
      and(
        eq(comments.threadId, thread[0].id),
        cursorData
          ? or(
              gt(comments.createdAt, cursorData.createdAt),
              and(
                eq(comments.createdAt, cursorData.createdAt),
                gt(comments.id, cursorData.id),
              ),
            )
          : undefined,
      ),
    )
    .orderBy(comments.createdAt, comments.id)
    .limit(effectiveLimit + 1);

  const results = await commentQuery;

  // Check if there are more results
  const hasMore = results.length > effectiveLimit;
  const commentsToReturn = hasMore ? results.slice(0, effectiveLimit) : results;

  // Format comments
  const formattedComments: CommentWithUser[] = commentsToReturn.map((row) => ({
    id: row.id,
    threadId: row.threadId,
    userId: row.userId,
    body: row.body,
    parentId: row.parentId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    user: {
      id: row.userId,
      name: row.userName,
      email: row.userEmail,
      image: row.userImage,
    },
  }));

  // Create next cursor
  const nextCursor =
    hasMore && commentsToReturn.length > 0
      ? createCursor(
          commentsToReturn[commentsToReturn.length - 1].createdAt,
          commentsToReturn[commentsToReturn.length - 1].id,
        )
      : null;

  return {
    thread: thread[0],
    comments: formattedComments,
    nextCursor,
    hasMore,
  };
}

/**
 * Create a comment in a slide-scoped thread
 */
export async function createSlideComment(
  workspaceId: string,
  slideId: string,
  definitionId: string,
  userId: string,
  body: string,
  parentId?: string,
  title?: string,
): Promise<CreateCommentResponse> {
  // Get or create thread
  const threadId = await getOrCreateSlideThread(
    workspaceId,
    slideId,
    definitionId,
    userId,
  );

  // Update title if provided (first comment can set title)
  if (title) {
    await db
      .update(commentThreads)
      .set({ title })
      .where(eq(commentThreads.id, threadId));
  }

  // Validate parentId if provided
  if (parentId) {
    const parent = await db
      .select({ threadId: comments.threadId })
      .from(comments)
      .where(eq(comments.id, parentId))
      .limit(1);

    if (!parent[0] || parent[0].threadId !== threadId) {
      throw new Error("Invalid parent comment");
    }
  }

  // Create comment
  const newComment = await db
    .insert(comments)
    .values({
      threadId,
      userId,
      body,
      parentId: parentId || null,
    })
    .returning();

  // Update thread updatedAt
  await db
    .update(commentThreads)
    .set({ updatedAt: new Date() })
    .where(eq(commentThreads.id, threadId));

  // Get thread
  const thread = await db
    .select()
    .from(commentThreads)
    .where(eq(commentThreads.id, threadId))
    .limit(1);

  // Get user info
  const user = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  const createdComment = newComment[0];
  const commentWithUser: CommentWithUser = {
    id: createdComment.id,
    threadId: createdComment.threadId,
    userId: createdComment.userId,
    body: createdComment.body,
    parentId: createdComment.parentId,
    createdAt: createdComment.createdAt,
    updatedAt: createdComment.updatedAt,
    user: {
      id: user[0].id,
      name: user[0].name,
      email: user[0].email,
      image: user[0].image,
    },
  };

  return {
    comment: commentWithUser,
    thread: thread[0],
  };
}
