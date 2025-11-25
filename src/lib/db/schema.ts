import { relations } from "drizzle-orm";
import {
  boolean,
  date,
  index,
  integer,
  json,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import type { AdapterAccount } from "next-auth/adapters";

export const users = pgTable("user", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text("name"),
  email: text("email").unique(),
  emailVerified: timestamp("emailVerified", { mode: "date" }),
  image: text("image"),
});

export const accounts = pgTable(
  "account",
  {
    userId: text("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").$type<AdapterAccount["type"]>().notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("providerAccountId").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (account) => ({
    compoundKey: primaryKey({
      columns: [account.provider, account.providerAccountId],
    }),
  }),
);

export const sessions = pgTable("session", {
  sessionToken: text("sessionToken").primaryKey(),
  userId: text("userId")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { mode: "date" }).notNull(),
});

export const workspaces = pgTable(
  "workspace",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    name: text("name").notNull(),
    description: text("description"),
    settings: json("settings"), // JSON for workspace-level settings
    isArchived: boolean("isArchived").default(false),
    isPublic: boolean("isPublic").default(true), // Public workspaces accessible to all
    createdAt: timestamp("createdAt", { mode: "date" })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: timestamp("updatedAt", { mode: "date" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => ({
    nameIdx: index("workspace_name_idx").on(table.name),
    updatedAtIdx: index("workspace_updated_at_idx").on(table.updatedAt), // For ordering workspaces
    isArchivedIdx: index("workspace_is_archived_idx").on(table.isArchived), // For filtering archived workspaces
  }),
);

// Slides table - replaces folders as presentation containers
export const slides = pgTable(
  "slide",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    title: text("title").notNull(),
    description: text("description"),
    workspaceId: text("workspaceId")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    slideDate: date("slideDate"), // Date when the slide represents data for
    sortOrder: integer("sortOrder").default(0),
    layout: json("layout"), // JSON for slide layout configuration
    isPublished: boolean("isPublished").default(false),
    createdAt: timestamp("createdAt", { mode: "date" })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: timestamp("updatedAt", { mode: "date" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => ({
    workspaceIdIdx: index("slide_workspace_id_idx").on(table.workspaceId),
    dateIdx: index("slide_date_idx").on(table.slideDate),
    sortOrderIdx: index("slide_sort_order_idx").on(table.sortOrder),
    createdAtIdx: index("slide_created_at_idx").on(table.createdAt), // For ordering recent slides
  }),
);

// Metric definitions - stable identities across slides
export const metricDefinitions = pgTable(
  "metric_definition",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    workspaceId: text("workspaceId")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    metricKey: text("metricKey").notNull(), // stable key for metric family
    definition: text("definition"), // metric definition/description
    createdAt: timestamp("createdAt", { mode: "date" })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: timestamp("updatedAt", { mode: "date" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => ({
    workspaceMetricIdx: uniqueIndex("metric_definition_ws_metric_idx").on(
      table.workspaceId,
      table.metricKey,
    ),
  }),
);

// Metrics table - high-level metric containers
// NOTE: Uses `ranking` field for priority/importance ordering (1=top, 2=second, etc.)
// Slides have a separate `sortOrder` field for manual ordering within workspace.
// This distinction prevents confusion between metric ordering (priority-based) and slide ordering (manual).
export const metrics = pgTable(
  "metric",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    name: text("name").notNull(),
    slideId: text("slideId")
      .notNull()
      .references(() => slides.id, { onDelete: "cascade" }),
    definitionId: text("definitionId").references(() => metricDefinitions.id, {
      onDelete: "set null",
    }),
    ranking: integer("ranking"), // Optional ranking: 1 = top, 2 = second, etc.
    chartType: text("chartType").default("line"), // line, bar, area, etc.
    chartConfig: json("chartConfig"), // JSON for chart configuration
    createdAt: timestamp("createdAt", { mode: "date" })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: timestamp("updatedAt", { mode: "date" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => ({
    slideIdIdx: index("metric_slide_id_idx").on(table.slideId),
    rankingIdx: index("metric_ranking_idx").on(table.ranking),
    definitionIdIdx: index("metric_definition_id_idx").on(table.definitionId),
  }),
);

// Enums for comment system
export const timeBucketEnum = pgEnum("time_bucket", [
  "day",
  "week",
  "month",
  "quarter",
  "year",
]);

export const threadScopeEnum = pgEnum("thread_scope", ["point", "submetric"]);

// Follow-up enums
export const followUpStatusEnum = pgEnum("follow_up_status", [
  "todo",
  "in_progress",
  "done",
  "cancelled",
  "resolved",
]);

export const followUpPriorityEnum = pgEnum("follow_up_priority", [
  "no_priority",
  "urgent",
  "high",
  "medium",
  "low",
]);

export const trafficLightColorEnum = pgEnum("traffic_light_color", [
  "green",
  "yellow",
  "red",
]);

// Submetric definitions - stable identities across slides
export const submetricDefinitions = pgTable(
  "submetric_definition",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    workspaceId: text("workspaceId")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    metricKey: text("metricKey").notNull(), // stable key for metric family
    submetricKey: text("submetricKey").notNull(), // stable key for logical submetric
    label: text("label"), // display label (latest)
    unit: text("unit"),
    preferredTrend: text("preferredTrend"),
    createdAt: timestamp("createdAt", { mode: "date" })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: timestamp("updatedAt", { mode: "date" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => ({
    workspaceMetricSubIdx: uniqueIndex(
      "submetric_definition_ws_metric_sub_idx",
    ).on(table.workspaceId, table.metricKey, table.submetricKey),
  }),
);

// Submetrics table - specific metric implementations with visualization config
export const submetrics = pgTable(
  "submetric",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    label: text("label").notNull(),
    category: text("category"),
    metricId: text("metricId")
      .notNull()
      .references(() => metrics.id, { onDelete: "cascade" }),
    definitionId: text("definitionId").references(
      () => submetricDefinitions.id,
      { onDelete: "set null" },
    ),
    // Visualization configuration
    xAxis: text("xAxis").notNull().default("date"),
    yAxis: text("yAxis"),
    timezone: text("timezone").default("UTC"),
    preferredTrend: text("preferredTrend"), // uptrend, downtrend, stable, etc.
    unit: text("unit"), // %, $, units, etc.
    aggregationType: text("aggregationType").default("none"), // sum, avg, count, etc.
    color: text("color"), // hex color for visualization
    trafficLightColor: trafficLightColorEnum("trafficLightColor"), // Manual traffic light indicator (per submetric, not auto-calculated)
    metadata: json("metadata"), // JSON for additional submetric metadata
    // Data points stored as JSON array
    dataPoints:
      json("dataPoints").$type<
        Array<{
          timestamp: string; // ISO date string
          value: number;
          confidence?: number | null;
          source?: string | null;
          dimensions?: Record<string, unknown> | null;
        }>
      >(),
    createdAt: timestamp("createdAt", { mode: "date" })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: timestamp("updatedAt", { mode: "date" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => ({
    metricIdIdx: index("submetric_metric_id_idx").on(table.metricId),
    categoryIdx: index("submetric_category_idx").on(table.category),
    definitionIdIdx: index("submetric_definition_id_idx").on(
      table.definitionId,
    ),
  }),
);

// Comment threads - supports both point-level and submetric-scoped
export const commentThreads = pgTable(
  "comment_thread",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    workspaceId: text("workspaceId")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    definitionId: text("definitionId")
      .notNull()
      .references(() => submetricDefinitions.id, { onDelete: "cascade" }),
    scope: threadScopeEnum("scope").notNull(), // 'point' or 'submetric'
    slideId: text("slideId").references(() => slides.id, {
      onDelete: "cascade",
    }), // nullable; used when scope='submetric'
    bucketType: timeBucketEnum("bucketType"), // required when scope='point'
    bucketValue: text("bucketValue"), // normalized key (ISO date start)
    title: text("title"),
    isResolved: boolean("isResolved").notNull().default(false),
    createdBy: text("createdBy")
      .notNull()
      .references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("createdAt", { mode: "date" })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: timestamp("updatedAt", { mode: "date" })
      .notNull()
      .$defaultFn(() => new Date()),
    // LLM-aware reserves (unused in v1)
    summary: text("summary"),
    lastSummarizedAt: timestamp("lastSummarizedAt", { mode: "date" }),
  },
  (table) => ({
    wsDefScopeIdx: index("comment_thread_ws_def_scope_idx").on(
      table.workspaceId,
      table.definitionId,
      table.scope,
    ),
    // pointLookupIdx removed in migration 0006 - was redundant, covered by groupingIdx
    slideIdx: index("comment_thread_slide_idx").on(table.slideId),
    uniquePointThreadIdx: uniqueIndex("comment_thread_unique_point_idx").on(
      table.definitionId,
      table.scope,
      table.bucketType,
      table.bucketValue,
    ),
    // Optimized indexes for batch comment count queries (100+ definitions)
    scopeDefIdx: index("comment_thread_scope_def_idx").on(
      table.scope,
      table.definitionId,
    ),
    groupingIdx: index("comment_thread_grouping_idx").on(
      table.definitionId,
      table.bucketType,
      table.bucketValue,
      table.scope,
    ),
  }),
);

// Comments - items within a thread (supports replies)
export const comments = pgTable(
  "comment",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    threadId: text("threadId")
      .notNull()
      .references(() => commentThreads.id, { onDelete: "cascade" }),
    userId: text("userId")
      .notNull()
      .references(() => users.id, { onDelete: "set null" }),
    body: text("body").notNull(),
    parentId: text("parentId").references((): any => comments.id, {
      onDelete: "cascade",
    }),
    isDeleted: boolean("isDeleted").notNull().default(false),
    createdAt: timestamp("createdAt", { mode: "date" })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: timestamp("updatedAt", { mode: "date" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => ({
    threadCreatedIdx: index("comment_thread_created_idx").on(
      table.threadId,
      table.createdAt,
      table.id,
    ),
    // Optimized for batch count queries with LEFT JOIN and isDeleted filter
    threadDeletedIdx: index("comment_thread_deleted_idx").on(
      table.threadId,
      table.isDeleted,
    ),
  }),
);

// ============================================================================
// RELATIONS - Enable efficient relational queries
// ============================================================================

export const usersRelations = relations(users, ({ many }) => ({
  accounts: many(accounts),
  sessions: many(sessions),
  workspaces: many(workspaces),
}));

export const accountsRelations = relations(accounts, ({ one }) => ({
  user: one(users, {
    fields: [accounts.userId],
    references: [users.id],
  }),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, {
    fields: [sessions.userId],
    references: [users.id],
  }),
}));

export const workspacesRelations = relations(workspaces, ({ many }) => ({
  slides: many(slides),
}));

export const slidesRelations = relations(slides, ({ one, many }) => ({
  workspace: one(workspaces, {
    fields: [slides.workspaceId],
    references: [workspaces.id],
  }),
  metrics: many(metrics),
}));

export const metricDefinitionsRelations = relations(
  metricDefinitions,
  ({ one, many }) => ({
    workspace: one(workspaces, {
      fields: [metricDefinitions.workspaceId],
      references: [workspaces.id],
    }),
    metrics: many(metrics),
  }),
);

export const metricsRelations = relations(metrics, ({ one, many }) => ({
  slide: one(slides, {
    fields: [metrics.slideId],
    references: [slides.id],
  }),
  definition: one(metricDefinitions, {
    fields: [metrics.definitionId],
    references: [metricDefinitions.id],
  }),
  submetrics: many(submetrics),
}));

export const submetricDefinitionsRelations = relations(
  submetricDefinitions,
  ({ one, many }) => ({
    workspace: one(workspaces, {
      fields: [submetricDefinitions.workspaceId],
      references: [workspaces.id],
    }),
    submetrics: many(submetrics),
    commentThreads: many(commentThreads),
  }),
);

export const submetricsRelations = relations(submetrics, ({ one }) => ({
  metric: one(metrics, {
    fields: [submetrics.metricId],
    references: [metrics.id],
  }),
  definition: one(submetricDefinitions, {
    fields: [submetrics.definitionId],
    references: [submetricDefinitions.id],
  }),
}));

export const commentThreadsRelations = relations(
  commentThreads,
  ({ one, many }) => ({
    workspace: one(workspaces, {
      fields: [commentThreads.workspaceId],
      references: [workspaces.id],
    }),
    definition: one(submetricDefinitions, {
      fields: [commentThreads.definitionId],
      references: [submetricDefinitions.id],
    }),
    slide: one(slides, {
      fields: [commentThreads.slideId],
      references: [slides.id],
    }),
    createdByUser: one(users, {
      fields: [commentThreads.createdBy],
      references: [users.id],
    }),
    comments: many(comments),
  }),
);

export const commentsRelations = relations(comments, ({ one }) => ({
  thread: one(commentThreads, {
    fields: [comments.threadId],
    references: [commentThreads.id],
  }),
  user: one(users, {
    fields: [comments.userId],
    references: [users.id],
  }),
  parent: one(comments, {
    fields: [comments.parentId],
    references: [comments.id],
  }),
}));

// Follow-ups table - task/ticket management
export const followUps = pgTable(
  "follow_up",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    identifier: text("identifier").notNull(), // e.g., "FU-123"
    title: text("title").notNull(),
    description: text("description"),
    workspaceId: text("workspaceId")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    slideId: text("slideId").references(() => slides.id, {
      onDelete: "set null",
    }), // optional link to a slide
    submetricDefinitionId: text("submetricDefinitionId").references(
      () => submetricDefinitions.id,
      { onDelete: "set null" },
    ), // optional link to a submetric definition
    threadId: text("threadId").references(() => commentThreads.id, {
      onDelete: "set null",
    }), // optional link to a comment thread
    resolvedAtSlideId: text("resolvedAtSlideId").references(() => slides.id, {
      onDelete: "set null",
    }), // tracks which slide resolved the follow-up when status changes to "done"
    status: followUpStatusEnum("status").notNull().default("todo"),
    priority: followUpPriorityEnum("priority").notNull().default("no_priority"),
    assigneeId: text("assigneeId").references(() => users.id, {
      onDelete: "set null",
    }), // DEPRECATED: kept for backward compatibility, use followUpAssignees instead
    createdBy: text("createdBy")
      .notNull()
      .references(() => users.id, { onDelete: "set null" }),
    dueDate: date("dueDate"),
    completedAt: timestamp("completedAt", { mode: "date" }),
    createdAt: timestamp("createdAt", { mode: "date" })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: timestamp("updatedAt", { mode: "date" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => ({
    workspaceIdIdx: index("follow_up_workspace_id_idx").on(table.workspaceId),
    assigneeIdIdx: index("follow_up_assignee_id_idx").on(table.assigneeId),
    statusIdx: index("follow_up_status_idx").on(table.status),
    submetricDefinitionIdIdx: index("follow_up_submetric_definition_id_idx").on(
      table.submetricDefinitionId,
    ),
    resolvedAtSlideIdIdx: index("follow_up_resolved_at_slide_id_idx").on(
      table.resolvedAtSlideId,
    ),
    identifierIdx: uniqueIndex("follow_up_identifier_idx").on(
      table.workspaceId,
      table.identifier,
    ),
  }),
);

// Follow-up assignees junction table - many-to-many relationship
export const followUpAssignees = pgTable(
  "follow_up_assignee",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    followUpId: text("followUpId")
      .notNull()
      .references(() => followUps.id, { onDelete: "cascade" }),
    userId: text("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("createdAt", { mode: "date" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => ({
    followUpUserIdx: uniqueIndex("follow_up_assignee_follow_up_user_idx").on(
      table.followUpId,
      table.userId,
    ),
    followUpIdIdx: index("follow_up_assignee_follow_up_id_idx").on(
      table.followUpId,
    ),
    userIdIdx: index("follow_up_assignee_user_id_idx").on(table.userId),
  }),
);

export const followUpsRelations = relations(followUps, ({ one, many }) => ({
  workspace: one(workspaces, {
    fields: [followUps.workspaceId],
    references: [workspaces.id],
  }),
  slide: one(slides, {
    fields: [followUps.slideId],
    references: [slides.id],
  }),
  resolvedAtSlide: one(slides, {
    fields: [followUps.resolvedAtSlideId],
    references: [slides.id],
  }),
  submetricDefinition: one(submetricDefinitions, {
    fields: [followUps.submetricDefinitionId],
    references: [submetricDefinitions.id],
  }),
  thread: one(commentThreads, {
    fields: [followUps.threadId],
    references: [commentThreads.id],
  }),
  assignee: one(users, {
    fields: [followUps.assigneeId],
    references: [users.id],
  }),
  createdByUser: one(users, {
    fields: [followUps.createdBy],
    references: [users.id],
  }),
  assignees: many(followUpAssignees),
}));

export const followUpAssigneesRelations = relations(
  followUpAssignees,
  ({ one }) => ({
    followUp: one(followUps, {
      fields: [followUpAssignees.followUpId],
      references: [followUps.id],
    }),
    user: one(users, {
      fields: [followUpAssignees.userId],
      references: [users.id],
    }),
  }),
);
