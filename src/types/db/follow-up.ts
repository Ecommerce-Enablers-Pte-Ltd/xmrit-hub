/**
 * Follow-up related database entity types
 */

import type { Slide } from "./slide";
import type { SubmetricDefinition } from "./submetric";
import type { User } from "./user";

export type FollowUpStatus =
  | "backlog"
  | "todo"
  | "in_progress"
  | "done"
  | "cancelled";

export type FollowUpPriority =
  | "no_priority"
  | "urgent"
  | "high"
  | "medium"
  | "low";

export interface FollowUp {
  id: string;
  identifier: string; // e.g., "FU-123"
  title: string;
  description: string | null;
  workspaceId: string;
  slideId: string | null;
  submetricDefinitionId: string | null;
  threadId: string | null;
  resolvedAtSlideId: string | null; // tracks which slide resolved the follow-up
  status: FollowUpStatus;
  priority: FollowUpPriority;
  assigneeId: string | null; // DEPRECATED: kept for backward compatibility
  createdBy: string;
  dueDate: string | null;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Follow-up assignee relationship
 */
export interface FollowUpAssignee {
  id: string;
  followUpId: string;
  userId: string;
  createdAt: Date;
}

/**
 * Extended follow-up type with related entities
 */
export interface FollowUpWithDetails extends FollowUp {
  assignee: User | null; // DEPRECATED: kept for backward compatibility
  assignees: Array<{
    id: string;
    followUpId: string;
    userId: string;
    user: User;
  }>;
  createdByUser: User | null;
  slide: Slide | null;
  resolvedAtSlide: Slide | null;
  submetricDefinition: SubmetricDefinition | null;
}

/**
 * Type for creating a new follow-up
 */
export interface CreateFollowUpInput {
  title: string;
  description?: string;
  slideId?: string;
  submetricDefinitionId?: string;
  threadId?: string;
  status?: FollowUpStatus;
  priority?: FollowUpPriority;
  assigneeIds?: string[]; // New: multiple assignees
  dueDate?: string;
}

/**
 * Type for updating a follow-up
 */
export interface UpdateFollowUpInput {
  title?: string;
  description?: string;
  slideId?: string;
  submetricDefinitionId?: string;
  threadId?: string;
  resolvedAtSlideId?: string | null;
  status?: FollowUpStatus;
  priority?: FollowUpPriority;
  assigneeIds?: string[]; // New: multiple assignees
  dueDate?: string;
}

/**
 * Pagination metadata
 */
export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasMore: boolean;
}

/**
 * Paginated follow-ups response
 */
export interface PaginatedFollowUpsResponse {
  followUps: FollowUpWithDetails[];
  pagination: PaginationMeta;
}

/**
 * Query parameters for follow-up list
 */
export interface FollowUpQueryParams {
  page?: number;
  limit?: number;
  sortBy?:
    | "createdAt"
    | "updatedAt"
    | "title"
    | "status"
    | "priority"
    | "dueDate"
    | "identifier";
  sortOrder?: "asc" | "desc";
  status?: FollowUpStatus;
  priority?: FollowUpPriority;
  assigneeId?: string;
  slideId?: string;
  submetricDefinitionId?: string;
  search?: string;
  unassigned?: boolean;
  overdue?: boolean;
}
