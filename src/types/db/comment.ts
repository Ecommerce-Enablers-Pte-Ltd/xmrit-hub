/**
 * Comment-related database entity types
 */

import type { TimeBucket } from "@/lib/time-buckets";

export type ThreadScope = "point" | "submetric";

export interface CommentThread {
  id: string;
  workspaceId: string;
  definitionId: string;
  scope: ThreadScope;
  slideId: string | null;
  bucketType: TimeBucket | null;
  bucketValue: string | null;
  title: string | null;
  isResolved: boolean;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  summary: string | null;
  lastSummarizedAt: Date | null;
}

export interface Comment {
  id: string;
  threadId: string;
  userId: string;
  body: string;
  parentId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Extended types with relations for API responses
 */
export interface CommentWithUser extends Comment {
  user: {
    id: string;
    name: string | null;
    email: string | null;
    image: string | null;
  };
}

export interface CommentThreadWithComments extends CommentThread {
  comments: CommentWithUser[];
  commentCount: number;
}

/**
 * API request/response types
 */

// Point thread API
export interface GetPointThreadRequest {
  definitionId: string;
  bucketType: TimeBucket;
  bucketValue: string;
  cursor?: string;
  limit?: number;
}

export interface CreatePointCommentRequest {
  definitionId: string;
  bucketType: TimeBucket;
  bucketValue: string;
  body: string;
  parentId?: string;
}

export interface GetPointCountsRequest {
  definitionId: string;
  bucketType: TimeBucket;
  bucketValues: string[];
}

export interface GetPointCountsResponse {
  counts: Record<string, number>;
}

// Slide-scoped thread API
export interface GetSlideThreadsRequest {
  slideId: string;
  definitionId: string;
  cursor?: string;
  limit?: number;
}

export interface CreateSlideThreadRequest {
  slideId: string;
  definitionId: string;
  title?: string;
  body: string;
  parentId?: string;
}

// Common responses
export interface CommentThreadResponse {
  thread: CommentThread;
  comments: CommentWithUser[];
  nextCursor: string | null;
  hasMore: boolean;
}

export interface CreateCommentResponse {
  comment: CommentWithUser;
  thread: CommentThread;
}
