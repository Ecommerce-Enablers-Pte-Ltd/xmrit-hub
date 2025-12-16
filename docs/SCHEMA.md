# Database Schema Documentation

## Overview

This document describes the database schema for the Xmrit Hub Statistical Process Control Dashboard. The schema is designed to support multi-workspace XMR chart analysis with flexible metric hierarchies, persistent comments, and stable metric identities across time periods.

## Technology Stack

- **Database:** PostgreSQL (Neon recommended)
- **ORM:** Drizzle ORM
- **Migrations:** Drizzle Kit
- **Authentication:** NextAuth.js

## Schema Architecture

The schema follows a hierarchical structure with clear separation of concerns:

```
Workspaces (organization boundary)
  ├── Slides (presentation containers with date context)
  │   └── Metrics (high-level metric groupings)
  │       └── Submetrics (specific XMR charts with data points)
  │
  └── Submetric Definitions (stable metric identities)
      └── Comment Threads (persistent discussions)
          └── Comments (individual messages)
```

## Architectural Overview

### Metric Definition System

The schema implements a **two-tier definition system** that separates stable metric identities from slide-specific instances:

**Tier 1: Definitions (Workspace-Level)**

- `metricDefinitions`: Centralized documentation for metric families
- `submetricDefinitions`: Stable identities for logical submetrics

**Tier 2: Instances (Slide-Specific)**

- `metrics`: Specific metric instances with rankings
- `submetrics`: Specific data points and visualization configs

This separation enables:

- **Persistent comments** across slides (attached to definitions)
- **Independent documentation** that doesn't require data re-ingestion
- **Flexible ranking** that can change per slide without affecting definitions
- **Protected manual edits** - ingestion preserves UI-edited definitions

## Core Tables

### Users (`user`)

Authentication and user management (NextAuth.js compatible).

| Column          | Type      | Description                  |
| --------------- | --------- | ---------------------------- |
| `id`            | text      | Primary key (UUID)           |
| `name`          | text      | User's full name             |
| `email`         | text      | Email address (unique)       |
| `emailVerified` | timestamp | Email verification timestamp |
| `image`         | text      | Profile image URL            |

**Indexes:** None (email has unique constraint)

**Relations:**

- Has many `accounts` (OAuth providers)
- Has many `sessions` (active sessions)
- Creates many `commentThreads` (via `createdBy`)
- Authors many `comments` (via `userId`)

### Accounts (`account`)

OAuth provider accounts (NextAuth.js adapter).

| Column              | Type    | Description                       |
| ------------------- | ------- | --------------------------------- |
| `userId`            | text    | Foreign key to `user.id`          |
| `type`              | text    | Account type (oauth, email, etc.) |
| `provider`          | text    | Provider name (google, github)    |
| `providerAccountId` | text    | Provider's account ID             |
| `refresh_token`     | text    | OAuth refresh token               |
| `access_token`      | text    | OAuth access token                |
| `expires_at`        | integer | Token expiration timestamp        |
| `token_type`        | text    | Token type (Bearer, etc.)         |
| `scope`             | text    | OAuth scopes granted              |
| `id_token`          | text    | OpenID Connect ID token           |
| `session_state`     | text    | OAuth session state               |

**Primary Key:** Composite (`provider`, `providerAccountId`)

**Foreign Keys:**

- `userId` → `user.id` (cascade delete)

### Sessions (`session`)

Active user sessions (NextAuth.js adapter).

| Column         | Type      | Description                |
| -------------- | --------- | -------------------------- |
| `sessionToken` | text      | Primary key (unique token) |
| `userId`       | text      | Foreign key to `user.id`   |
| `expires`      | timestamp | Session expiration date    |

**Foreign Keys:**

- `userId` → `user.id` (cascade delete)

### Workspaces (`workspace`)

Top-level organization boundary. All metrics and comments are scoped to a workspace.

| Column        | Type      | Description                   | Default Value                     |
| ------------- | --------- | ----------------------------- | --------------------------------- |
| `id`          | text      | Primary key (UUID)            | Auto-generated UUID               |
| `name`        | text      | Workspace name (required)     | None (required)                   |
| `slug`        | text      | URL-friendly slug (unique)    | None (required, auto-generated)   |
| `description` | text      | Optional description          | `null`                            |
| `settings`    | json      | Workspace-level configuration | `null`                            |
| `isArchived`  | boolean   | Soft delete flag              | `false` (set in schema)           |
| `isPublic`    | boolean   | Public access flag            | `true` (set in schema)            |
| `createdAt`   | timestamp | Creation timestamp            | Current timestamp (set in schema) |
| `updatedAt`   | timestamp | Last update timestamp         | Current timestamp (set in schema) |

**Default Values (Handled by Schema):**

- `isArchived`: Defaults to `false` - new workspaces are active by default
- `isPublic`: Defaults to `true` - new workspaces are publicly accessible by default
- `createdAt` and `updatedAt`: Automatically set to current timestamp on creation
- **Note**: These defaults are enforced at the database schema level, not in application code

**Indexes:**

- `workspace_name_idx` on `name`
- `workspace_slug_idx` (unique) on `slug` - for URL routing and lookups
- `workspace_updated_at_idx` on `updatedAt` (for ordering workspaces)
- `workspace_is_archived_idx` on `isArchived` (for filtering archived workspaces)

**Relations:**

- Has many `slides`
- Has many `submetricDefinitions`
- Has many `commentThreads`

**Key Concepts:**

- **Slug vs ID**:
  - `id`: UUID used in API endpoints (e.g., `/api/workspaces/[workspaceId]`)
  - `slug`: URL-friendly identifier used in web URLs (e.g., `/my-workspace/slide/1-weekly-review`)
  - Slugs are auto-generated from workspace name when created via API
  - Slugs are immutable after creation (unique constraint)
- **Public workspaces** (`isPublic: true`): Accessible to all authenticated users
- **Private workspaces** (`isPublic: false`): Access control (future enhancement)
- **Archived workspaces** (`isArchived: true`): Hidden from default views but data retained

### Slides (`slide`)

Presentation containers representing a specific time period or reporting cycle. Replaces traditional "folder" concepts with date-aware organization.

| Column        | Type      | Description                                                 |
| ------------- | --------- | ----------------------------------------------------------- |
| `id`          | text      | Primary key (UUID)                                          |
| `title`       | text      | Slide title (required)                                      |
| `slideNumber` | integer   | Per-workspace sequential number (Metabase-style, immutable) |
| `description` | text      | Optional description                                        |
| `workspaceId` | text      | Foreign key to `workspace.id`                               |
| `slideDate`   | date      | Date this slide represents                                  |
| `createdAt`   | timestamp | Creation timestamp                                          |
| `updatedAt`   | timestamp | Last update timestamp                                       |

**Indexes:**

- `slide_workspace_id_idx` on `workspaceId`
- `slide_workspace_slide_number_idx` (unique) on (`workspaceId`, `slideNumber`) - ensures unique slide numbers per workspace
- `slide_date_idx` on `slideDate`
- `slide_created_at_idx` on `createdAt` (for ordering recent slides)

**Foreign Keys:**

- `workspaceId` → `workspace.id` (cascade delete)

**Relations:**

- Belongs to one `workspace`
- Has many `metrics`
- Referenced by `commentThreads` (submetric-scoped threads)

**Key Concepts:**

- **ID vs Slug**:
  - `id`: UUID used in API endpoints (e.g., `/api/slides/[slideId]`)
  - Slide slugs are not stored in the database - they're constructed from `slideNumber` + `title` for URLs
  - URL format: `/{workspaceSlug}/slide/{slideNumber}-{slugified-title}` (e.g., `/my-workspace/slide/1-weekly-review`)
- **Slide Number** (`slideNumber`): Per-workspace sequential number (1, 2, 3, ...), automatically assigned and immutable after creation
  - Auto-increments: Each new slide gets MAX(slideNumber) + 1 for the workspace
  - Numbers don't fill gaps: If slides are deleted, the next slide continues from the highest number (e.g., slides 1,2,5 → next slide is 6, not 3)
  - This ensures stable URLs and prevents breaking links when slides are deleted
- **Slide Date** (`slideDate`): Represents the reporting period (e.g., "2024-10-30" for weekly review)
- **Ordering**: Slides are ordered by `slideDate` (primary) and `createdAt` (secondary), no manual sort order

### Metric Definitions (`metric_definition`)

**Purpose:** Workspace-level documentation and stable identities for metric families. Shared across all slides in a workspace.

| Column        | Type      | Description                              |
| ------------- | --------- | ---------------------------------------- |
| `id`          | text      | Primary key (UUID)                       |
| `workspaceId` | text      | Foreign key to `workspace.id`            |
| `metricKey`   | text      | Stable metric family identifier          |
| `definition`  | text      | Metric definition/description (nullable) |
| `createdAt`   | timestamp | Creation timestamp                       |
| `updatedAt`   | timestamp | Last update timestamp                    |

**Indexes:**

- `metric_definition_ws_metric_idx` (unique) on (`workspaceId`, `metricKey`)

**Foreign Keys:**

- `workspaceId` → `workspace.id` (cascade delete)

**Relations:**

- Belongs to one `workspace`
- Has many `metrics` (across different slides)

**Key Concepts:**

- **Metric Key** (`metricKey`): Normalized stable identifier (e.g., "revenue", "transaction-count")
  - Auto-generated from metric name during ingestion
  - Example: "% Completion Rate" → "completion-rate"
- **Definition** (`definition`): Optional documentation text
  - Can be edited through UI
  - Protected during ingestion when omitted from payload
- **Workspace-Level**: One definition per `(workspaceId, metricKey)` combination
- **Cross-Slide Identity**: Same definition referenced by metrics across multiple slides

**Ingestion Behavior:**

```
If description provided in payload:
  → Update definition field

If description omitted in payload:
  → Preserve existing definition (protects manual UI edits)
```

### Metrics (`metric`)

**Purpose:** Slide-specific metric grouping containers with rankings. Provides high-level organization for submetrics within a slide.

| Column         | Type      | Description                           |
| -------------- | --------- | ------------------------------------- |
| `id`           | text      | Primary key (UUID)                    |
| `name`         | text      | Metric name (required)                |
| `slideId`      | text      | Foreign key to `slide.id`             |
| `definitionId` | text      | Foreign key to `metric_definition.id` |
| `ranking`      | integer   | Optional importance ranking (1=top)   |
| `createdAt`    | timestamp | Creation timestamp                    |
| `updatedAt`    | timestamp | Last update timestamp                 |

**Indexes:**

- `metric_slide_id_idx` on `slideId`
- `metric_ranking_idx` on `ranking`
- `metric_definition_id_idx` on `definitionId`

**Foreign Keys:**

- `slideId` → `slide.id` (cascade delete)
- `definitionId` → `metric_definition.id` (set null on delete)

**Relations:**

- Belongs to one `slide`
- Optionally references one `metricDefinition`
- Has many `submetrics`

**Key Concepts:**

- **Ranking** (`ranking`): Slide-specific priority indicator (1 = highest, 2 = second, etc.)
  - Stored separately from definition
  - **Can change per slide without affecting definition**
  - Example: "Revenue" ranked #1 this week, #3 next week
- **Definition Link** (`definitionId`): References workspace-level definition
  - Provides documentation/description
  - Enables cross-slide metric tracking
- **Grouping Role**: Metrics serve as containers for organizing related submetrics (the actual time-series data)

**Important:** Editing a metric definition does NOT affect ranking - they are independent concerns stored in separate tables.

### Submetric Definitions (`submetric_definition`)

**Purpose:** Stable, cross-slide identities for logical metrics. Enables persistent comments and analysis across multiple time periods. Explicitly separates category (dimension) from metric name.

| Column           | Type      | Description                                                                      |
| ---------------- | --------- | -------------------------------------------------------------------------------- |
| `id`             | text      | Primary key (UUID)                                                               |
| `workspaceId`    | text      | Foreign key to `workspace.id`                                                    |
| `metricKey`      | text      | Stable metric family identifier                                                  |
| `submetricKey`   | text      | Stable submetric identifier                                                      |
| `category`       | text      | Dimension/segment (e.g., "Brand A", "North America")                             |
| `metricName`     | text      | Actual metric name (nullable for ingestion safety)                               |
| `xaxis`          | text      | X-axis semantic label (e.g., "period", "tracked_week", "transaction_touched_at") |
| `yaxis`          | text      | Y-axis semantic label / unit (e.g., "hours", "% completion", "complaints")       |
| `unit`           | text      | Unit of measurement (%, $, count) - often same as yaxis                          |
| `preferredTrend` | text      | Preferred direction (uptrend/downtrend/stable)                                   |
| `createdAt`      | timestamp | Creation timestamp                                                               |
| `updatedAt`      | timestamp | Last update timestamp                                                            |

**Indexes:**

- `submetric_definition_ws_metric_sub_idx` (unique) on (`workspaceId`, `metricKey`, `submetricKey`)

**Foreign Keys:**

- `workspaceId` → `workspace.id` (cascade delete)

**Relations:**

- Belongs to one `workspace`
- Has many `submetrics` (across different slides)
- Has many `commentThreads`

**Key Concepts:**

- **Metric Key** (`metricKey`): Stable identifier for metric family (e.g., "revenue", "conversion-rate")
- **Submetric Key** (`submetricKey`): Stable identifier combining category + metric (e.g., "brand-a-completion-rate", "brand-b-completion-rate")
- **Category vs Metric Name Separation**:
  - `category`: Optional dimension/segment (e.g., "Brand A", "North America")
  - `metricName`: The actual metric being measured (e.g., "% Completion Rate", "Revenue")
    - Nullable for ingestion safety (handles edge cases gracefully)
    - UI falls back to "Untitled Submetric" if null
  - Display label constructed as `[Category] - Metric Name` or just `Metric Name` if no category
- **Axis Semantic Labels**:
  - `xaxis`: Describes what the x-axis represents (e.g., "period", "week", "tracked_week", "transaction_touched_at")
  - `yaxis`: Describes what the y-axis represents (e.g., "hours", "% completion", "complaints", "count")
  - Both are stored for semantic documentation and data lineage
  - Often `yaxis` and `unit` have the same value
  - If `unit` is not provided during ingestion, `yaxis` is used as fallback
- **Composite Uniqueness**: One definition per (`workspaceId`, `metricKey`, `submetricKey`) combination
- **Cross-Slide Identity**: Same definition can be referenced by multiple submetrics across different slides
- **Comment Persistence**: Comments are attached to definitions, not slide-specific instances

**Examples:**

```
Definition 1: workspace=abc, metricKey="completion-metrics", submetricKey="brand-a-completion-rate"
  ├── category: "Brand A"
  ├── metricName: "% Completion Rate"
  ├── Submetric in Slide "2024-10-30 Weekly Review"
  ├── Submetric in Slide "2024-11-06 Weekly Review"
  └── Comment Thread (persists across both slides)

Definition 2: workspace=abc, metricKey="revenue", submetricKey="total-revenue"
  ├── category: null (no category)
  ├── metricName: "Total Revenue"
  └── Submetrics across slides
```

### Submetrics (`submetric`)

Slide-specific time-series instances with visualization configuration and data points. The actual metric data tied to a specific slide.

**Important:** Semantic fields (`category`, `metricName`, `unit`, `preferredTrend`) are stored in `submetric_definition` and accessed via the `definitionId` relationship.

| Column              | Type                | Description                              | Default Value                     |
| ------------------- | ------------------- | ---------------------------------------- | --------------------------------- |
| `id`                | text                | Primary key (UUID)                       | Auto-generated UUID               |
| `metricId`          | text                | Foreign key to `metric.id`               | None (required)                   |
| `definitionId`      | text                | Foreign key to `submetric_definition.id` | `null`                            |
| `timezone`          | text                | Timezone                                 | `"utc"` (set in schema)           |
| `aggregationType`   | text                | Aggregation type (sum/avg/count/none)    | `"none"` (set in schema)          |
| `color`             | text                | Hex color for visualization              | `null`                            |
| `trafficLightColor` | traffic_light_color | Slide-specific traffic light status      | `"green"` (set in schema)         |
| `metadata`          | json                | Additional metadata                      | `null`                            |
| `dataPoints`        | json                | Array of time-series data points         | `[]` (empty array)                |
| `createdAt`         | timestamp           | Creation timestamp                       | Current timestamp (set in schema) |
| `updatedAt`         | timestamp           | Last update timestamp                    | Current timestamp (set in schema) |

**Default Values (Handled by Schema):**

- `timezone`: Defaults to `"utc"` - all submetrics use UTC timezone unless explicitly specified
- `aggregationType`: Defaults to `"none"` - no aggregation applied unless specified
- `trafficLightColor`: Defaults to `"green"` - new submetrics start with green status
- `createdAt` and `updatedAt`: Automatically set to current timestamp on creation
- **Note**: These defaults are enforced at the database schema level, not in application code. API routes should not set these values unless explicitly overriding defaults.

**Data Points Structure:**

```typescript
{
  timestamp: string;      // ISO date string (YYYY-MM-DD, YYYYMMDD, or YYYYMM)
  value: number;          // Metric value
  confidence?: number;    // Optional confidence score (0-1)
  source?: string;        // Optional data source identifier
  dimensions?: object;    // Optional dimensional attributes
}
```

**Indexes:**

- `submetric_metric_id_idx` on `metricId`
- `submetric_definition_id_idx` on `definitionId`

**Foreign Keys:**

- `metricId` → `metric.id` (cascade delete)
- `definitionId` → `submetric_definition.id` (set null on delete)

**Relations:**

- Belongs to one `metric`
- Optionally references one `submetricDefinition`

**Key Concepts:**

- **Instance-Definition Separation**: Submetric instances store only visualization config and data; semantic fields come from `submetricDefinition`
- **Data Points in JSON**: Time-series data stored as JSON array for flexibility
- **Optional Definition Link**: Can exist without definition (ad-hoc metrics)
- **Visualization Config**: Chart-specific settings (color, timezone, aggregation) stored at instance level
- **Traffic Light Color**: **Slide-specific** status indicator (green/yellow/red) for quick visual assessment
  - Set by users per slide instance
  - Independent from statistical control limits
  - Cycles through green → yellow → red → green
- **Semantic Fields**: `category`, `metricName`, `unit`, `preferredTrend` are read from `submetricDefinition` via the `definitionId` relationship
- **Display Label**: Constructed from category and metricName as `[Category] - Metric Name` (or just `Metric Name` if no category)
- **Auto-Apply Features**: Metric names like "Transaction Count (Trend)" or "Revenue (Seasonality)" trigger automatic analysis

## Enums

### Comment System Enums

**`time_bucket`** - Time period granularity for point-level comments:

- `day` - Daily data points
- `week` - Weekly data points
- `month` - Monthly data points
- `quarter` - Quarterly data points
- `year` - Yearly data points

**`thread_scope`** - Comment thread scope:

- `point` - Comments on specific data point (time bucket)
- `submetric` - Comments on entire submetric (across all slides)

### Follow-up System Enums

**`follow_up_status`** - Follow-up task status:

- `todo` - Ready to be worked on
- `in_progress` - Currently being worked on
- `done` - Completed
- `cancelled` - No longer needed
- `resolved` - Resolved (can be used independently of `resolvedAtSlideId` for tracking resolution status)

**`follow_up_priority`** - Follow-up task priority:

- `no_priority` - No priority set
- `urgent` - Needs immediate attention
- `high` - High priority
- `medium` - Medium priority
- `low` - Low priority

### Traffic Light System Enum

**`traffic_light_color`** - Manual process control status indicator:

- `green` - Process in control (good state)
- `yellow` - Process needs attention (warning state)
- `red` - Process out of control (critical state)

**Key Concepts:**

- Manual indicator set by users (not auto-calculated from control limits)
- Persists across slides when attached to submetric definitions
- Used for quick visual status assessment in dashboards
- Independent from statistical control limit violations
- Cycles through green → yellow → red → green when clicked

## Comment System

### Comment Threads (`comment_thread`)

Conversation threads attached to either specific data points or entire submetrics.

| Column             | Type         | Description                              | Default Value                     |
| ------------------ | ------------ | ---------------------------------------- | --------------------------------- |
| `id`               | text         | Primary key (UUID)                       | Auto-generated UUID               |
| `workspaceId`      | text         | Foreign key to `workspace.id`            | None (required)                   |
| `definitionId`     | text         | Foreign key to `submetric_definition.id` | None (required)                   |
| `scope`            | thread_scope | Thread scope (point/submetric)           | None (required)                   |
| `slideId`          | text         | FK to `slide.id` (for submetric scope)   | `null`                            |
| `bucketType`       | time_bucket  | Time granularity (for point scope)       | `null`                            |
| `bucketValue`      | text         | Normalized date key (for point scope)    | `null`                            |
| `title`            | text         | Optional thread title                    | `null`                            |
| `isResolved`       | boolean      | Resolution status                        | `false` (set in schema)           |
| `createdBy`        | text         | Foreign key to `user.id`                 | None (required)                   |
| `createdAt`        | timestamp    | Creation timestamp                       | Current timestamp (set in schema) |
| `updatedAt`        | timestamp    | Last update timestamp                    | Current timestamp (set in schema) |
| `summary`          | text         | AI-generated summary (reserved)          | `null`                            |
| `lastSummarizedAt` | timestamp    | Last summary timestamp (reserved)        | `null`                            |

**Default Values (Handled by Schema):**

- `isResolved`: Defaults to `false` - new comment threads start as unresolved
- `createdAt` and `updatedAt`: Automatically set to current timestamp on creation
- **Note**: These defaults are enforced at the database schema level, not in application code

**Indexes:**

- `comment_thread_ws_def_scope_idx` on (`workspaceId`, `definitionId`, `scope`)
- `comment_thread_slide_idx` on `slideId`
- `comment_thread_unique_point_idx` (unique) on (`definitionId`, `scope`, `bucketType`, `bucketValue`)
- `comment_thread_scope_def_idx` on (`scope`, `definitionId`)
- `comment_thread_grouping_idx` on (`definitionId`, `bucketType`, `bucketValue`, `scope`)

**Foreign Keys:**

- `workspaceId` → `workspace.id` (cascade delete)
- `definitionId` → `submetric_definition.id` (cascade delete)
- `slideId` → `slide.id` (cascade delete, nullable)
- `createdBy` → `user.id` (set null on delete)

**Relations:**

- Belongs to one `workspace`
- Belongs to one `submetricDefinition`
- Optionally belongs to one `slide` (for submetric-scoped threads)
- Created by one `user`
- Has many `comments`

**Key Concepts:**

**Point-Scoped Threads:**

- Comments on specific data point (time bucket)
- Requires: `scope='point'`, `bucketType`, `bucketValue`
- Example: Comment on "2024-10-30" weekly revenue data
- Persists across slides (attached to definition, not slide)

**Submetric-Scoped Threads:**

- Comments on entire submetric within a slide
- Requires: `scope='submetric'`, `slideId`
- Example: General discussion about North America revenue metric

**Bucket Value Normalization:**

- Day: `2024-10-30` (ISO date)
- Week: `2024-W44` (ISO week format)
- Month: `2024-10` (ISO month format)
- Quarter: `2024-Q4` (year-quarter format)
- Year: `2024` (year format)

**Uniqueness Constraint:**

- One thread per (`definitionId`, `scope`, `bucketType`, `bucketValue`) combination
- Ensures single conversation per data point

**Optimized Indexes:**

- `scopeDefIdx`: Fast filtering by scope and definition (100+ definitions)
- `groupingIdx`: Efficient batch queries for comment counts

### Comments (`comment`)

Individual messages within a thread. Supports flat replies (parent-child relationship).

| Column      | Type      | Description                        |
| ----------- | --------- | ---------------------------------- |
| `id`        | text      | Primary key (UUID)                 |
| `threadId`  | text      | Foreign key to `comment_thread.id` |
| `userId`    | text      | Foreign key to `user.id`           |
| `body`      | text      | Comment text content (required)    |
| `parentId`  | text      | Foreign key to parent `comment.id` |
| `createdAt` | timestamp | Creation timestamp                 |
| `updatedAt` | timestamp | Last update timestamp              |

**Indexes:**

- `comment_thread_created_idx` on (`threadId`, `createdAt`, `id`)

**Foreign Keys:**

- `threadId` → `comment_thread.id` (cascade delete)
- `userId` → `user.id` (set null on delete)
- `parentId` → `comment.id` (cascade delete, self-referential)

**Relations:**

- Belongs to one `commentThread`
- Written by one `user`
- Optionally replies to one `comment` (parent)

**Key Concepts:**

- **Hard Delete**: Comments are permanently deleted when removed (child replies cascade delete automatically)
- **Nested Replies**: One level of nesting supported via `parentId`

## Follow-up System

The follow-up system enables task/ticket management for tracking action items related to slides, submetric definitions, and comment threads.

### Follow-ups (`follow_up`)

Task tracking system integrated with workspace, slides, and submetric definitions.

| Column                  | Type               | Description                                                    | Default Value                     |
| ----------------------- | ------------------ | -------------------------------------------------------------- | --------------------------------- |
| `id`                    | text               | Primary key (UUID)                                             | Auto-generated UUID               |
| `identifier`            | text               | Human-readable identifier (e.g., "FU-123")                     | None (required, auto-generated)   |
| `title`                 | text               | Follow-up title (required)                                     | None (required)                   |
| `description`           | text               | Optional detailed description                                  | `null`                            |
| `workspaceId`           | text               | Foreign key to `workspace.id`                                  | None (required)                   |
| `slideId`               | text               | Foreign key to `slide.id` (nullable)                           | `null`                            |
| `submetricDefinitionId` | text               | Foreign key to `submetric_definition.id` (nullable)            | `null`                            |
| `threadId`              | text               | Foreign key to `comment_thread.id` (nullable)                  | `null`                            |
| `resolvedAtSlideId`     | text               | Foreign key to `slide.id` - tracks resolution slide (nullable) | `null`                            |
| `status`                | follow_up_status   | Task status                                                    | `"todo"` (set in schema)          |
| `priority`              | follow_up_priority | Task priority                                                  | `"no_priority"` (set in schema)   |
| `assigneeId`            | text               | DEPRECATED: Use `followUpAssignees` instead                    | `null`                            |
| `createdBy`             | text               | Foreign key to `user.id`                                       | None (required)                   |
| `dueDate`               | date               | Optional due date                                              | `null`                            |
| `completedAt`           | timestamp          | Completion timestamp                                           | `null`                            |
| `createdAt`             | timestamp          | Creation timestamp                                             | Current timestamp (set in schema) |
| `updatedAt`             | timestamp          | Last update timestamp                                          | Current timestamp (set in schema) |

**Default Values (Handled by Schema):**

- `status`: Defaults to `"todo"` - new follow-ups start in todo status
- `priority`: Defaults to `"no_priority"` - new follow-ups have no priority set
- `createdAt` and `updatedAt`: Automatically set to current timestamp on creation
- **Note**: These defaults are enforced at the database schema level, not in application code. API routes should not set these values unless explicitly overriding defaults.

**Indexes:**

- `follow_up_workspace_id_idx` on `workspaceId`
- `follow_up_assignee_id_idx` on `assigneeId` (deprecated)
- `follow_up_status_idx` on `status`
- `follow_up_submetric_definition_id_idx` on `submetricDefinitionId`
- `follow_up_resolved_at_slide_id_idx` on `resolvedAtSlideId`
- `follow_up_identifier_idx` (unique) on (`workspaceId`, `identifier`)

**Foreign Keys:**

- `workspaceId` → `workspace.id` (cascade delete)
- `slideId` → `slide.id` (set null on delete)
- `submetricDefinitionId` → `submetric_definition.id` (set null on delete)
- `threadId` → `comment_thread.id` (set null on delete)
- `resolvedAtSlideId` → `slide.id` (set null on delete)
- `assigneeId` → `user.id` (set null on delete, deprecated)
- `createdBy` → `user.id` (set null on delete)

**Relations:**

- Belongs to one `workspace`
- Optionally belongs to one `slide` (via `slideId` - creation slide)
- Optionally belongs to one `slide` (via `resolvedAtSlideId` - resolution slide)
- Optionally references one `submetricDefinition`
- Optionally references one `commentThread`
- Created by one `user`
- Has many `followUpAssignees` (junction table for multiple assignees)

**Key Concepts:**

- **Unique Identifier**: Auto-generated per workspace (e.g., "FU-1", "FU-2")
- **Multiple Assignees**: Uses junction table for many-to-many relationship
- **Flexible Linking**: Can be linked to slides, submetric definitions, or comment threads
- **Status Workflow**: todo → in_progress → done/cancelled
- **Priority Levels**: Supports 5 priority levels for task organization
- **Temporal Resolution Tracking**: `resolvedAtSlideId` enables timeline-aware resolution
  - Follow-ups show as "resolved" only on/after the resolution slide's date
  - Enables accurate historical views of past slide states
  - Status can be "done"/"cancelled" independently of resolution
  - Resolution cannot occur on slides before follow-up creation

### Follow-up Assignees (`follow_up_assignee`)

Junction table for many-to-many relationship between follow-ups and users.

| Column       | Type      | Description                   |
| ------------ | --------- | ----------------------------- |
| `id`         | text      | Primary key (UUID)            |
| `followUpId` | text      | Foreign key to `follow_up.id` |
| `userId`     | text      | Foreign key to `user.id`      |
| `createdAt`  | timestamp | Assignment timestamp          |

**Indexes:**

- `follow_up_assignee_follow_up_user_idx` (unique) on (`followUpId`, `userId`)
- `follow_up_assignee_follow_up_id_idx` on `followUpId`
- `follow_up_assignee_user_id_idx` on `userId`

**Foreign Keys:**

- `followUpId` → `follow_up.id` (cascade delete)
- `userId` → `user.id` (cascade delete)

**Relations:**

- Belongs to one `followUp`
- Belongs to one `user`

**Key Concepts:**

- **Many-to-Many**: One follow-up can have multiple assignees, one user can have multiple follow-ups
- **Unique Constraint**: Prevents duplicate assignments
- **Cascade Delete**: Assignments automatically removed when follow-up or user is deleted

## Relationships & Data Flow

### Dual Hierarchy: Definitions vs Instances

The schema maintains two parallel hierarchies:

**Definition Hierarchy (Workspace-Level, Stable)**

```
Workspace "Engineering"
  ├── MetricDefinition (metricKey="api-performance")
  │   └── definition: "API response time metrics across services"
  └── SubmetricDefinition (metricKey="api-performance", submetricKey="auth-service-response-time")
      ├── label: "[Auth Service] - Response Time"
      ├── unit: "ms"
      └── CommentThreads (persistent across slides)
```

**Instance Hierarchy (Slide-Specific, Temporal)**

```
Workspace "Engineering"
  └── Slide "2024-10-30 Weekly Review"
      └── Metric "API Performance" (ranking=1, links to MetricDefinition)
          ├── Submetric "[Auth Service] - Response Time" (links to SubmetricDefinition)
          │   └── dataPoints: [{timestamp, value}, ...]
          └── Submetric "[Payment Service] - Response Time" (links to SubmetricDefinition)
              └── dataPoints: [{timestamp, value}, ...]
```

**Key Points:**

- Definitions are **shared** across all slides in a workspace
- Instances are **specific** to individual slides
- Rankings exist only on instances (can differ per slide)
- Definitions carry documentation (can be edited independently)
- Comments attach to definitions (persist across slides)

### Submetric Definition → Comment Thread (Persistent Identity)

```
SubmetricDefinition (metricKey="api_performance", submetricKey="auth_service")
  ├── Submetric in Slide "2024-10-30" (this week's data)
  ├── Submetric in Slide "2024-11-06" (next week's data)
  └── CommentThread (scope=point, bucketValue="2024-10-30")
      ├── Comment by User A: "Spike due to deployment"
      └── Comment by User B (reply): "Rolling back now"
```

Comments persist across slides because they're attached to the stable definition, not the slide-specific submetric instance.

### Follow-up → Multiple Assignees (Task Management with Temporal Resolution)

```
FollowUp "FU-123: Investigate API spike"
  ├── workspace: "Engineering"
  ├── slide: "2024-10-30 Weekly Review" (creation slide)
  ├── resolvedAtSlide: "2024-11-06 Weekly Review" (resolution slide)
  ├── submetricDefinition: "api_performance.auth_service"
  ├── status: "done"
  ├── priority: "urgent"
  └── assignees (via junction table):
      ├── FollowUpAssignee → User "Alice"
      ├── FollowUpAssignee → User "Bob"
      └── FollowUpAssignee → User "Charlie"
```

**Temporal Resolution Logic:**

- On slide "2024-10-30": Shows as "unresolved" (not yet resolved)
- On slide "2024-11-06": Shows as "resolved" (resolved on this slide)
- On slide "2024-11-13": Shows as "resolved" (already resolved)
- On slide "2024-10-23": Would not appear (created after this slide)

Follow-ups can be linked to slides, submetric definitions, or comment threads, and support multiple assignees through a many-to-many junction table. The temporal resolution system enables accurate historical views and "time travel" through past slide states.

## Index Strategy

### Performance Optimizations

**Workspace & Slide Queries:**

- Workspace name lookups: `workspace_name_idx`
- Workspace ordering by update time: `workspace_updated_at_idx`
- Workspace filtering by archived status: `workspace_is_archived_idx`
- Slide filtering by workspace: `slide_workspace_id_idx`
- Slide sorting by date: `slide_date_idx`
- Slide ordering by creation time: `slide_created_at_idx`

**Metric Hierarchy:**

- Metrics by slide: `metric_slide_id_idx`
- Submetrics by metric: `submetric_metric_id_idx`
- Submetrics by category: `submetric_category_idx` (group filtering)

**Comment System (Optimized for 100+ Definitions):**

- Thread lookup by scope & definition: `comment_thread_scope_def_idx`
- Batch comment count queries: `comment_thread_grouping_idx`
- Thread filtering: `comment_thread_ws_def_scope_idx`
- Comment queries: `comment_thread_created_idx`

**Submetric Definitions:**

- Unique constraint ensures one definition per logical metric: `submetric_definition_ws_metric_sub_idx`

## Schema Management & Evolution

### Schema Change Strategy

**This project uses `db:push` for schema changes** instead of traditional migrations. This approach provides faster iteration and simpler schema management.

```bash
# Apply schema changes directly to database (primary method)
npm run db:push

# Reset database (⚠️ destructive - deletes all data)
npm run db:reset
```

### Historical Migrations (Frozen)

The `/drizzle/meta` directory contains historical migration files (0000-0006) that document the initial schema evolution:

- **0000**: Initial schema (users, accounts, sessions, workspaces, slides, metrics, submetrics)
- **0001**: Renamed trend field to preferredTrend in submetric definitions
- **0002**: Added comment system (threads and comments)
- **0003**: Enhanced comment thread indexes for performance
- **0004**: Added submetric-scoped comment threads
- **0005**: Added comment uniqueness constraint for point-level threads
- **0006**: Removed redundant point lookup index, added optimized batch query indexes

**These migrations are now frozen for historical reference only.** New schema changes should be applied via `db:push`.

### Why db:push?

- **Faster development**: No need to generate and manage migration files
- **Simpler workflow**: Schema changes go directly from `schema.ts` to database
- **Good for this stage**: Suitable for projects that can tolerate occasional schema resets
- **Caveat**: Not recommended for production databases with critical data that cannot be re-ingested

### Rebuild from Scratch

To recreate the database from the current schema:

```bash
# Drop all tables and recreate from schema.ts
npm run db:reset
npm run db:push
```

### Schema Management Tools

**Drizzle Studio** - Visual database browser:

```bash
npm run db:studio
```

Opens web UI at `https://local.drizzle.studio` for browsing data, running queries, and testing relationships.

## Default Values and Schema Enforcement

**Important**: Default values are enforced at the database schema level, not in application code. This ensures consistency and reduces the chance of errors.

### Schema-Level Defaults

The following defaults are set in `schema.ts` and automatically applied by the database:

**Workspaces:**

- `isArchived`: `false`
- `isPublic`: `true`
- `createdAt`: Current timestamp
- `updatedAt`: Current timestamp

**Submetrics:**

- `timezone`: `"utc"`
- `aggregationType`: `"none"`
- `trafficLightColor`: `"green"`
- `createdAt`: Current timestamp
- `updatedAt`: Current timestamp

**Comment Threads:**

- `isResolved`: `false`
- `createdAt`: Current timestamp
- `updatedAt`: Current timestamp

**Follow-ups:**

- `status`: `"todo"`
- `priority`: `"no_priority"`
- `createdAt`: Current timestamp
- `updatedAt`: Current timestamp

### Best Practices

- **Do not set defaults in API routes** - Let the schema handle defaults
- **Only override defaults when necessary** - Explicitly set values only when they differ from defaults
- **Trust the schema** - The database will apply defaults automatically for nullable fields with defaults

## Data Ingestion

### API Payload Structure

The ingestion API (`POST /api/ingest/metrics`) creates/updates the entire hierarchy atomically:

**Important:** The API uses UUIDs (`workspace_id`, `slide_id`), not slugs. URLs use slugs, but the API requires UUIDs.

```json
{
  "workspace_id": "550e8400-e29b-41d4-a716-446655440000",
  "slide_title": "2024-10-30 Weekly Review",
  "slide_date": "2024-10-30",
  "metrics": [
    {
      "metric_name": "API Performance",
      "submetrics": [
        {
          "category": "Auth Service",
          "timezone": "America/Los_Angeles",
          "xaxis": "week",
          "yaxis": "milliseconds",
          "unit": "ms",
          "preferred_trend": "downtrend",
          "data_points": [
            { "timestamp": "2024-01-01", "value": 150 },
            { "timestamp": "2024-01-08", "value": 145 }
          ]
        }
      ]
    }
  ]
}
```

### Ingestion Flow

The API ingestion endpoint processes data in this order:

1. **Workspace Validation**: Verify workspace exists or create new one
2. **Slide Creation/Update**: Upsert slide by title and date
3. **Metric Definition Upsert**:
   - Derive `metricKey` from `metric_name` (normalized)
   - Find or create `metric_definition` for `(workspaceId, metricKey)`
   - Update `definition` field only if `description` provided in payload
   - Preserve existing definition if `description` omitted
4. **Metric Creation**:
   - Insert `metric` record linked to slide
   - Link to `metric_definition` via `definitionId`
   - Set `ranking` if provided (slide-specific)
5. **Submetric Definition Upsert**:
   - Extract `category` from explicit field (optional dimension/segment like "Brand A", "North America")
   - Use parent `metric_name` as the `metricName` for all submetrics under this metric
   - Derive `metricKey` from parent metric name (normalized to lowercase-with-dashes)
   - Derive `submetricKey` from category + metricName (normalized, e.g., "brand-a-completion-rate")
   - Find or create `submetric_definition` for `(workspaceId, metricKey, submetricKey)`
   - Always update `category`, `metricName`, `xaxis`, `yaxis`, `unit`, `preferredTrend` to match latest data
   - If `unit` is omitted, use `yaxis` value as fallback for unit field
6. **Submetric Creation**:
   - Insert `submetric` record with data points
   - Link to `submetric_definition` via `definitionId`
   - Enable persistent comments across slides

**Key Behavior:**

- Metric definitions are **preserved** when description is omitted (protects manual edits)
- Submetric definitions are **always updated** to match latest ingestion data
- Rankings are **slide-specific** and independent of definitions
- Definitions enable **cross-slide comment persistence**
- **Default values** (timezone, aggregationType, trafficLightColor) are applied automatically by the schema if not provided in the payload

## Best Practices

### Workspace Organization

- **One workspace per team/product**: Engineering, Marketing, Sales, etc.
- **Use public workspaces** for cross-team visibility
- **Archive old workspaces** rather than deleting (preserves history)

### Slide Naming

- **Include date context**: "2024-10-30 Weekly Review"
- **Consistent naming**: Use same pattern across team
- **Set slideDate**: Enables time-based filtering and sorting

### Metric Keys (Definitions)

- **Stable identifiers**: Don't change once created
- **Lowercase with dashes**: `api-performance`, `conversion-rate` (auto-normalized from names)
- **Hierarchical structure**: `metricKey` (family) + `submetricKey` (specific)
- **Example**: `metricKey="revenue"`, `submetricKey="north-america"`

### Definition Management

- **When to provide descriptions during ingestion:**

  - Initial setup: Document metrics when first creating them
  - Documentation updates: Update definitions intentionally
  - Skip descriptions: Omit to preserve manual UI edits

- **Ranking best practices:**

  - Rankings are slide-specific, change as priorities shift
  - Use 1 for highest priority, 2 for second, etc.
  - Rankings don't affect definitions or historical data

- **Definition vs Data separation:**
  - Definitions answer "what does this metric mean?"
  - Rankings answer "how important is this metric right now?"
  - This separation enables independent documentation updates

### Data Points

- **Consistent timestamps**: Use ISO format (YYYY-MM-DD)
- **Regular intervals**: Daily, weekly, monthly (supports XMR analysis)
- **Minimum 10 points**: Required for reliable control limits
- **Include confidence**: Use when data quality varies

### Comments

- **Use point-scoped threads** for specific data point discussions
- **Use submetric-scoped threads** for general metric discussions
- **Resolve threads** when issues are addressed
- **Reference data** in comments (dates, values, changes)

## Database Maintenance

### Backups

**Recommended**: Daily automated backups via Neon or your PostgreSQL provider.

**Manual backup:**

```bash
pg_dump $DATABASE_URL > backup-$(date +%Y%m%d).sql
```

### Performance Monitoring

**Key metrics to monitor:**

- Query response times (aim for <100ms for most queries)
- Comment thread lookup performance (with 100+ definitions)
- Submetric data point queries (JSON operations)
- Index hit ratios (should be >99%)

**Use EXPLAIN ANALYZE** for slow queries:

```sql
EXPLAIN ANALYZE
SELECT * FROM submetric WHERE "metricId" = 'uuid';
```

### Cleanup Operations

**Archive old slides**:

```sql
-- Mark old slides as unpublished
UPDATE slide SET "isPublished" = false WHERE "slideDate" < '2023-01-01';
```

**Remove old comment threads**:

```sql
-- Delete comment threads older than 1 year (comments cascade delete automatically)
DELETE FROM comment_thread
WHERE "createdAt" < NOW() - INTERVAL '1 year';
```

## Security Considerations

### Authentication

- **NextAuth.js**: Handles OAuth and session management
- **Session tokens**: Stored in `session` table, expire after configured period
- **User IDs**: Used throughout schema for audit trails

### Access Control

- **Workspace-level**: All data scoped to workspaces
- **Public workspaces**: Accessible to all authenticated users
- **Private workspaces**: Reserved for future enhancement
- **API keys**: Separate authentication for data ingestion

### Data Isolation

- **Foreign key constraints**: Enforce referential integrity
- **Cascade deletes**: Automatically clean up related data
- **Workspace boundaries**: Comments, definitions, slides all scoped to workspace

## Troubleshooting

### Common Issues

**"Unique constraint violation on submetric_definition"**

- Cause: Attempting to create duplicate definition (same workspaceId, metricKey, submetricKey)
- Solution: Query existing definition first, reuse if exists

**"Comment thread not found"**

- Cause: Bucket value normalization mismatch
- Solution: Ensure consistent date formatting (YYYY-MM-DD, YYYY-W##, etc.)

**"Submetric has no definition"**

- Cause: `definitionId` is null (ad-hoc metric)
- Solution: Create definition first, or allow null for one-off metrics

**"Slow comment count queries"**

- Cause: Missing indexes or inefficient JOIN
- Solution: Use `comment_thread_grouping_idx` for batch queries

### Schema Inspection

**Check foreign key relationships:**

```sql
SELECT
  tc.table_name,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY';
```

**Check index usage:**

```sql
SELECT
  schemaname,
  tablename,
  indexname,
  idx_scan,
  idx_tup_read,
  idx_tup_fetch
FROM pg_stat_user_indexes
ORDER BY idx_scan DESC;
```

## Related Documentation

- **[Data Ingestion API](./DATA_INGESTION.md)** - Programmatic data ingestion
- **[Comment System](./COMMENT_SYSTEM.md)** - Comment features and workflows
- **[Follow-up System](./FOLLOW_UP.md)** - Task/ticket management with temporal resolution tracking
- **[Auto Lock Limit](./AUTO_LOCK_LIMIT.md)** - Automatic outlier detection
- **[Lock Limit](./LOCK_LIMIT.md)** - Manual limit locking
- **[Trend Lines](./TREND_LINES.md)** - Trend analysis for time series data
- **[Seasonality](./DESEASONALISATION.md)** - Seasonal adjustments for recurring patterns

## References

- [Drizzle ORM Documentation](https://orm.drizzle.team)
- [NextAuth.js Adapter](https://authjs.dev/reference/adapter/drizzle)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [Neon Database](https://neon.tech/docs)
