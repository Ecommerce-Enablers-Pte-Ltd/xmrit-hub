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

| Column        | Type      | Description                        |
| ------------- | --------- | ---------------------------------- |
| `id`          | text      | Primary key (UUID)                 |
| `name`        | text      | Workspace name (required)          |
| `description` | text      | Optional description               |
| `settings`    | json      | Workspace-level configuration      |
| `isArchived`  | boolean   | Soft delete flag (default: false)  |
| `isPublic`    | boolean   | Public access flag (default: true) |
| `createdAt`   | timestamp | Creation timestamp                 |
| `updatedAt`   | timestamp | Last update timestamp              |

**Indexes:**

- `workspace_name_idx` on `name`

**Relations:**

- Has many `slides`
- Has many `submetricDefinitions`
- Has many `commentThreads`

**Key Concepts:**

- **Public workspaces** (`isPublic: true`): Accessible to all authenticated users
- **Private workspaces** (`isPublic: false`): Access control (future enhancement)
- **Archived workspaces** (`isArchived: true`): Hidden from default views but data retained

### Slides (`slide`)

Presentation containers representing a specific time period or reporting cycle. Replaces traditional "folder" concepts with date-aware organization.

| Column        | Type      | Description                         |
| ------------- | --------- | ----------------------------------- |
| `id`          | text      | Primary key (UUID)                  |
| `title`       | text      | Slide title (required)              |
| `description` | text      | Optional description                |
| `workspaceId` | text      | Foreign key to `workspace.id`       |
| `slideDate`   | date      | Date this slide represents          |
| `sortOrder`   | integer   | Display order (default: 0)          |
| `layout`      | json      | UI layout configuration             |
| `isPublished` | boolean   | Publication status (default: false) |
| `createdAt`   | timestamp | Creation timestamp                  |
| `updatedAt`   | timestamp | Last update timestamp               |

**Indexes:**

- `slide_workspace_id_idx` on `workspaceId`
- `slide_date_idx` on `slideDate`
- `slide_sort_order_idx` on `sortOrder`

**Foreign Keys:**

- `workspaceId` → `workspace.id` (cascade delete)

**Relations:**

- Belongs to one `workspace`
- Has many `metrics`
- Referenced by `commentThreads` (submetric-scoped threads)

**Key Concepts:**

- **Slide Date** (`slideDate`): Represents the reporting period (e.g., "2024-10-30" for weekly review)
- **Sort Order** (`sortOrder`): Controls display order within workspace
- **Layout** (`layout`): JSON configuration for custom layouts (future enhancement)
- **Published Status** (`isPublished`): Controls visibility (future enhancement)

### Metrics (`metric`)

High-level metric containers that group related submetrics. Provides hierarchical organization.

| Column        | Type      | Description                         |
| ------------- | --------- | ----------------------------------- |
| `id`          | text      | Primary key (UUID)                  |
| `name`        | text      | Metric name (required)              |
| `description` | text      | Optional description                |
| `slideId`     | text      | Foreign key to `slide.id`           |
| `sortOrder`   | integer   | Display order (default: 0)          |
| `ranking`     | integer   | Optional importance ranking (1=top) |
| `chartType`   | text      | Chart type (default: "line")        |
| `chartConfig` | json      | Chart configuration options         |
| `createdAt`   | timestamp | Creation timestamp                  |
| `updatedAt`   | timestamp | Last update timestamp               |

**Indexes:**

- `metric_slide_id_idx` on `slideId`
- `metric_sort_order_idx` on `sortOrder`
- `metric_ranking_idx` on `ranking`

**Foreign Keys:**

- `slideId` → `slide.id` (cascade delete)

**Relations:**

- Belongs to one `slide`
- Has many `submetrics`

**Key Concepts:**

- **Ranking** (`ranking`): Priority indicator (1 = highest, 2 = second, etc.)
- **Chart Type** (`chartType`): Reserved for future visualization types
- **Chart Config** (`chartConfig`): Extensible configuration (future enhancement)

### Submetric Definitions (`submetric_definition`)

**Purpose:** Stable, cross-slide identities for logical metrics. Enables persistent comments and analysis across multiple time periods.

| Column           | Type      | Description                             |
| ---------------- | --------- | --------------------------------------- |
| `id`             | text      | Primary key (UUID)                      |
| `workspaceId`    | text      | Foreign key to `workspace.id`           |
| `metricKey`      | text      | Stable metric family identifier         |
| `submetricKey`   | text      | Stable submetric identifier             |
| `label`          | text      | Display label (latest)                  |
| `unit`           | text      | Unit of measurement (%, $, units)       |
| `preferredTrend` | text      | Preferred direction (uptrend/downtrend) |
| `createdAt`      | timestamp | Creation timestamp                      |
| `updatedAt`      | timestamp | Last update timestamp                   |

**Indexes:**

- `submetric_definition_ws_metric_sub_idx` (unique) on (`workspaceId`, `metricKey`, `submetricKey`)

**Foreign Keys:**

- `workspaceId` → `workspace.id` (cascade delete)

**Relations:**

- Belongs to one `workspace`
- Has many `submetrics` (across different slides)
- Has many `commentThreads`

**Key Concepts:**

- **Metric Key** (`metricKey`): Stable identifier for metric family (e.g., "revenue", "conversion_rate")
- **Submetric Key** (`submetricKey`): Stable identifier for specific submetric (e.g., "north_america", "mobile_web")
- **Composite Uniqueness**: One definition per (`workspaceId`, `metricKey`, `submetricKey`) combination
- **Cross-Slide Identity**: Same definition can be referenced by multiple submetrics across different slides
- **Comment Persistence**: Comments are attached to definitions, not slide-specific instances

**Example:**

```
Definition: workspace=abc, metricKey="revenue", submetricKey="north_america"
  ├── Submetric in Slide "2024-10-30 Weekly Review"
  ├── Submetric in Slide "2024-11-06 Weekly Review"
  └── Comment Thread (persists across both slides)
```

### Submetrics (`submetric`)

Specific metric implementations with visualization configuration and data points. These are slide-specific instances.

| Column            | Type      | Description                              |
| ----------------- | --------- | ---------------------------------------- |
| `id`              | text      | Primary key (UUID)                       |
| `label`           | text      | Display label (required)                 |
| `category`        | text      | Optional category/grouping               |
| `metricId`        | text      | Foreign key to `metric.id`               |
| `definitionId`    | text      | Foreign key to `submetric_definition.id` |
| `xAxis`           | text      | X-axis label (default: "date")           |
| `yAxis`           | text      | Y-axis label                             |
| `timezone`        | text      | Timezone (default: "UTC")                |
| `preferredTrend`  | text      | Trend preference (uptrend/downtrend)     |
| `unit`            | text      | Unit of measurement                      |
| `aggregationType` | text      | Aggregation type (sum/avg/count)         |
| `color`           | text      | Hex color for visualization              |
| `metadata`        | json      | Additional metadata                      |
| `dataPoints`      | json      | Array of time-series data points         |
| `createdAt`       | timestamp | Creation timestamp                       |
| `updatedAt`       | timestamp | Last update timestamp                    |

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
- `submetric_category_idx` on `category`
- `submetric_definition_id_idx` on `definitionId`

**Foreign Keys:**

- `metricId` → `metric.id` (cascade delete)
- `definitionId` → `submetric_definition.id` (set null on delete)

**Relations:**

- Belongs to one `metric`
- Optionally references one `submetricDefinition`

**Key Concepts:**

- **Data Points in JSON**: Time-series data stored as JSON array for flexibility
- **Optional Definition Link**: Can exist without definition (ad-hoc metrics)
- **Visualization Config**: All chart settings stored at submetric level
- **Auto-Apply Features**: Labels like "(Trend)" or "(Seasonality)" trigger automatic analysis

## Comment System

### Enums

**`time_bucket`** - Time period granularity for point-level comments:

- `day` - Daily data points
- `week` - Weekly data points
- `month` - Monthly data points
- `quarter` - Quarterly data points
- `year` - Yearly data points

**`thread_scope`** - Comment thread scope:

- `point` - Comments on specific data point (time bucket)
- `submetric` - Comments on entire submetric (across all slides)

### Comment Threads (`comment_thread`)

Conversation threads attached to either specific data points or entire submetrics.

| Column             | Type         | Description                              |
| ------------------ | ------------ | ---------------------------------------- |
| `id`               | text         | Primary key (UUID)                       |
| `workspaceId`      | text         | Foreign key to `workspace.id`            |
| `definitionId`     | text         | Foreign key to `submetric_definition.id` |
| `scope`            | thread_scope | Thread scope (point/submetric)           |
| `slideId`          | text         | FK to `slide.id` (for submetric scope)   |
| `bucketType`       | time_bucket  | Time granularity (for point scope)       |
| `bucketValue`      | text         | Normalized date key (for point scope)    |
| `title`            | text         | Optional thread title                    |
| `isResolved`       | boolean      | Resolution status (default: false)       |
| `createdBy`        | text         | Foreign key to `user.id`                 |
| `createdAt`        | timestamp    | Creation timestamp                       |
| `updatedAt`        | timestamp    | Last update timestamp                    |
| `summary`          | text         | AI-generated summary (reserved)          |
| `lastSummarizedAt` | timestamp    | Last summary timestamp (reserved)        |

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
| `isDeleted` | boolean   | Soft delete flag (default: false)  |
| `createdAt` | timestamp | Creation timestamp                 |
| `updatedAt` | timestamp | Last update timestamp              |

**Indexes:**

- `comment_thread_created_idx` on (`threadId`, `createdAt`, `id`)
- `comment_thread_deleted_idx` on (`threadId`, `isDeleted`)

**Foreign Keys:**

- `threadId` → `comment_thread.id` (cascade delete)
- `userId` → `user.id` (set null on delete)
- `parentId` → `comment.id` (cascade delete, self-referential)

**Relations:**

- Belongs to one `commentThread`
- Written by one `user`
- Optionally replies to one `comment` (parent)

**Key Concepts:**

- **Soft Delete**: `isDeleted: true` hides comment but preserves structure
- **Nested Replies**: One level of nesting supported via `parentId`
- **Optimized Counts**: Indexes support efficient COUNT queries with isDeleted filter

## Relationships & Data Flow

### Workspace → Slide → Metric → Submetric (Display Hierarchy)

```
Workspace "Engineering"
  └── Slide "2024-10-30 Weekly Review"
      └── Metric "API Performance"
          ├── Submetric "[Auth Service] - Response Time"
          │   └── dataPoints: [{timestamp, value}, ...]
          └── Submetric "[Payment Service] - Response Time"
              └── dataPoints: [{timestamp, value}, ...]
```

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

## Index Strategy

### Performance Optimizations

**Workspace & Slide Queries:**

- Workspace name lookups: `workspace_name_idx`
- Slide filtering by workspace: `slide_workspace_id_idx`
- Slide sorting by date: `slide_date_idx`

**Metric Hierarchy:**

- Metrics by slide: `metric_slide_id_idx`
- Submetrics by metric: `submetric_metric_id_idx`
- Submetrics by category: `submetric_category_idx` (group filtering)

**Comment System (Optimized for 100+ Definitions):**

- Thread lookup by scope & definition: `comment_thread_scope_def_idx`
- Batch comment count queries: `comment_thread_grouping_idx`
- Thread filtering: `comment_thread_ws_def_scope_idx`
- Comment queries: `comment_thread_created_idx`, `comment_thread_deleted_idx`

**Submetric Definitions:**

- Unique constraint ensures one definition per logical metric: `submetric_definition_ws_metric_sub_idx`

## Migrations & Schema Evolution

### Migration History

The schema has evolved through several migrations (managed by Drizzle Kit):

- **0000**: Initial schema (users, accounts, sessions, workspaces, slides, metrics, submetrics)
- **0001**: Added submetric definitions for stable metric identities
- **0002**: Added comment system (threads and comments)
- **0003**: Enhanced comment thread indexes for performance
- **0004**: Added submetric-scoped comment threads
- **0005**: Added comment uniqueness constraint for point-level threads
- **0006**: Removed redundant point lookup index, added optimized batch query indexes

### Running Migrations

```bash
# Generate migration from schema changes
npm run db:generate

# Apply migrations to database
npm run db:migrate

# Push schema directly (dev only - skips migrations)
npm run db:push

# Reset database (⚠️ destructive - deletes all data)
npm run db:reset
```

### Schema Management Tools

**Drizzle Studio** - Visual database browser:

```bash
npm run db:studio
```

Opens web UI at `https://local.drizzle.studio` for browsing data, running queries, and testing relationships.

## Data Ingestion

### API Payload Structure

The ingestion API (`POST /api/ingest/metrics`) creates/updates the entire hierarchy atomically:

```json
{
  "workspace_id": "uuid",
  "slide_title": "2024-10-30 Weekly Review",
  "slide_date": "2024-10-30",
  "metrics": [
    {
      "metric_name": "API Performance",
      "submetrics": [
        {
          "label": "[Auth Service] - Response Time",
          "category": "Auth Service",
          "metric_key": "api_performance",
          "submetric_key": "auth_service",
          "timezone": "America/Los_Angeles",
          "xaxis": "week",
          "preferred_trend": "down",
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

1. **Workspace Validation**: Verify workspace exists
2. **Slide Creation/Update**: Upsert slide by title
3. **Metric Creation/Update**: Upsert metrics under slide
4. **Definition Resolution**: Find or create submetric definitions
5. **Submetric Creation/Update**: Upsert submetrics with data points
6. **Definition Linking**: Link submetrics to definitions for comment persistence

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
- **Lowercase with underscores**: `api_performance`, `conversion_rate`
- **Hierarchical structure**: `metricKey` (family) + `submetricKey` (specific)
- **Example**: `metricKey="revenue"`, `submetricKey="north_america"`

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

**Archive old slides** (soft delete pattern):

```sql
-- Mark old slides as unpublished
UPDATE slide SET "isPublished" = false WHERE "slideDate" < '2023-01-01';
```

**Remove soft-deleted comments**:

```sql
-- Permanently delete comments older than 1 year
DELETE FROM comment
WHERE "isDeleted" = true
  AND "createdAt" < NOW() - INTERVAL '1 year';
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
- **[Default Workspace Setup](./DEFAULT_WORKSPACE_SETUP.md)** - Initial workspace creation

## References

- [Drizzle ORM Documentation](https://orm.drizzle.team)
- [NextAuth.js Adapter](https://authjs.dev/reference/adapter/drizzle)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [Neon Database](https://neon.tech/docs)
