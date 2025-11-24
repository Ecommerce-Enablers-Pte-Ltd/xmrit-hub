# Submetric Comments System v1

## Overview

The comment system enables persistent, cross-slide discussion threads tied to submetrics and their data points. Comments on a specific date (e.g., "Week of Jan 1, 2024") persist across all slides, allowing teams to maintain context as new weekly data is ingested.

## Key Features

### 1. **Stable Submetric Identities**

- `submetric_definition` table provides stable IDs across slides
- Keyed by `(workspaceId, metricKey, submetricKey)`
- Weekly data ingestion links to existing definitions via `submetric.definitionId`

### 2. **Two Comment Modes**

#### Point-Level Comments (Cross-Slide)

- Comments tied to `(definitionId, bucketType, bucketValue)`
- Example: Comments on "Week of 2024-01-01" for "Orders/Completion Rate"
- Persist across all slides containing that time bucket
- **UI**: Click any data point on X-chart to open comment dialog

#### Slide-Scoped Notes

- Comments tied to `(slideId, definitionId, scope='submetric')`
- For slide-specific observations (e.g., "This week's data had collection issues")
- **UI**: (Not implemented in v1; reserved for future)

### 3. **Normalized Time Buckets**

- Detects data granularity: `day`, `week`, `month`, `quarter`, `year`
- Normalizes timestamps to bucket start (e.g., ISO week Monday for weekly data)
- Utility: `/src/lib/time-buckets.ts`

### 4. **Efficient Pagination**

- Keyset cursor pagination: `createdAt + id`
- Default 20 comments/page, max 100
- Batch comment counts for chart badges

### 5. **Multi-Tenant & LLM-Ready**

- All records scoped to `workspaceId`
- Reserved fields: `summary`, `lastSummarizedAt` (for future AI summarization)
- No embeddings in v1

## Database Schema

### Core Tables

```sql
-- Stable submetric identities
CREATE TABLE submetric_definition (
  id TEXT PRIMARY KEY,
  workspaceId TEXT NOT NULL REFERENCES workspace(id),
  metricKey TEXT NOT NULL,        -- normalized metric name
  submetricKey TEXT NOT NULL,     -- normalized submetric label
  label TEXT,
  unit TEXT,
  preferredTrend TEXT,
  createdAt TIMESTAMP NOT NULL,
  updatedAt TIMESTAMP NOT NULL,
  UNIQUE (workspaceId, metricKey, submetricKey)
);

-- Comment threads (point-level or slide-scoped)
CREATE TABLE comment_thread (
  id TEXT PRIMARY KEY,
  workspaceId TEXT NOT NULL REFERENCES workspace(id),
  definitionId TEXT NOT NULL REFERENCES submetric_definition(id),
  scope ENUM('point', 'submetric') NOT NULL,
  slideId TEXT REFERENCES slide(id),         -- for scope='submetric'
  bucketType ENUM(...) NULL,                 -- for scope='point'
  bucketValue TEXT NULL,                     -- normalized date key
  title TEXT,
  isResolved BOOLEAN NOT NULL DEFAULT FALSE,
  createdBy TEXT NOT NULL REFERENCES "user"(id),
  createdAt TIMESTAMP NOT NULL,
  updatedAt TIMESTAMP NOT NULL,
  summary TEXT,                              -- LLM reserve
  lastSummarizedAt TIMESTAMP,                -- LLM reserve
  UNIQUE (definitionId, scope, bucketType, bucketValue)
);

-- Comments within threads (supports replies)
CREATE TABLE comment (
  id TEXT PRIMARY KEY,
  threadId TEXT NOT NULL REFERENCES comment_thread(id),
  userId TEXT NOT NULL REFERENCES "user"(id),
  body TEXT NOT NULL,
  parentId TEXT REFERENCES comment(id),      -- for nested replies
  isDeleted BOOLEAN NOT NULL DEFAULT FALSE,
  createdAt TIMESTAMP NOT NULL,
  updatedAt TIMESTAMP NOT NULL
);
```

### Key Relationships

- `submetric.definitionId` → `submetric_definition.id`
- `comment_thread.definitionId` → `submetric_definition.id`
- `comment.threadId` → `comment_thread.id`
- `comment.parentId` → `comment.id` (self-reference for replies)

## API Endpoints

### Point Thread (Cross-Slide Comments)

#### GET `/api/submetrics/definitions/[definitionId]/points`

Get comments for a specific data point.

**Query Params:**

- `bucketType` (required): `day|week|month|quarter|year`
- `bucketValue` (required): Normalized date key (YYYY-MM-DD)
- `cursor` (optional): Pagination cursor
- `limit` (optional): Page size (default 20, max 100)

**Response:**

```json
{
  "thread": { "id": "...", ... },
  "comments": [
    {
      "id": "...",
      "body": "Comment text",
      "user": { "name": "...", "email": "..." },
      "createdAt": "2024-01-01T00:00:00Z",
      "parentId": null
    }
  ],
  "nextCursor": "1704067200000_abc123",
  "hasMore": true
}
```

#### POST `/api/submetrics/definitions/[definitionId]/points`

Create a comment on a data point.

**Body:**

```json
{
  "bucketType": "week",
  "bucketValue": "2024-01-01",
  "body": "Comment text (max 10k chars)",
  "parentId": "optional-reply-to-id"
}
```

**Response:**

```json
{
  "comment": { ... },
  "thread": { ... }
}
```

#### GET `/api/submetrics/definitions/[definitionId]/points/counts`

Batch get comment counts for multiple data points (for chart badges).

**Query Params:**

- `bucketType`: `week`
- `bucketValues`: `2024-01-01,2024-01-08,2024-01-15` (comma-separated, max 100)

**Response:**

```json
{
  "counts": {
    "2024-01-01": 5,
    "2024-01-08": 2,
    "2024-01-15": 0
  }
}
```

### Slide-Scoped Notes (Reserved for Future)

#### GET `/api/slides/[slideId]/submetrics/[definitionId]/threads`

#### POST `/api/slides/[slideId]/submetrics/[definitionId]/threads`

## Frontend Components

### `PointCommentsSheet`

Path: `/src/app/[workspaceId]/slide/[slideId]/components/point-comments-sheet.tsx`

- Opens when user clicks a data point on X-chart
- Shows threaded comments with nested replies
- Composer for new comments
- Auto-detects bucket type from data granularity

### `SubmetricXChart` Integration

Path: `/src/app/[workspaceId]/slide/[slideId]/components/submetric-x-chart.tsx`

- Added `onClick` handler to `activeDot`
- Tooltip hint: "Click point to view/add comments"
- Detects `bucketType` via `detectBucketType(timestamps)`
- Normalizes clicked point timestamp to `bucketValue`

## Helper Utilities

### `/src/lib/time-buckets.ts`

- `normalizeToBucket(timestamp, bucketType)` → Normalized key (YYYY-MM-DD)
- `detectBucketType(timestamps[])` → Auto-detect granularity
- `getBucketLabel(bucketValue, bucketType)` → Human-readable label
- `parseTimestamp(timestamp)` → Handles YYYYMM, YYYYMMDD, ISO

### `/src/lib/api/comments.ts`

- `getWorkspaceIdFromDefinition(definitionId)`
- `getWorkspaceIdFromSlide(slideId)`
- `getPointThread(...)` → Fetch thread with pagination
- `createPointComment(...)` → Create comment (auto-creates thread)
- `getPointCommentCounts(...)` → Batch counts
- `getSlideThreads(...)`, `createSlideComment(...)` (reserved)

## Data Migration

### Backfill Script

Path: `/scripts/backfill-submetric-definitions.ts`

Ran once to:

1. Compute `(workspaceId, metricKey, submetricKey)` for existing submetrics
2. Upsert `submetric_definition` rows
3. Set `submetric.definitionId`
4. Enforce NOT NULL constraint

**Results:**

- 83 submetrics processed
- 22 unique definitions created
- All `submetric.definitionId` populated

### Key Derivation Logic

- `metricKey`: Normalize `metric.name` → lowercase slug with dashes
  - Example: "% of Total Count" → "of-total-count"
- `submetricKey`: Combine `category` + normalized `label` → lowercase slug with dashes
  - Example: Category: `"Region A"`, Label: `"% Completion Rate"`
  - Result: `submetricKey="region-a-completion-rate"`
- Full example:
  - Metric: `"Orders"`, Category: `"Region A"`, Label: `"% Completion Rate"`
  - Result: `metricKey="orders"`, `submetricKey="region-a-completion-rate"`
- **Important**: Category field is used to ensure different categories get different definitions and isolated comment threads

### Definition System Integration

The comment system relies on the stable definition system:

**Metric Definitions (`metricDefinitions` table):**

- Workspace-level documentation for metric families
- Can be edited through UI without affecting historical data
- Ingestion preserves definitions when description is omitted

**Submetric Definitions (`submetricDefinitions` table):**

- Stable identities for logical submetrics
- Comments attach here for cross-slide persistence
- Auto-updated during ingestion to match latest data structure

This two-tier system enables comments to persist across slides while allowing independent documentation management.

## Authorization

**Current (v1):**

- All authenticated users can access public workspaces
- `workspaceId` resolved from `definitionId` or `slideId`
- TODO markers for workspace membership checks

**Future:**

- Add `workspace_member` table
- Enforce role-based access (viewer, editor, admin)

## LLM Integration (Future)

**Reserved Fields:**

- `comment_thread.summary`: AI-generated thread summary
- `comment_thread.lastSummarizedAt`: When summary was last updated

**Planned Features:**

- Automatic thread summarization for long discussions
- `comment_embedding` table for semantic search
- Cross-thread insights (e.g., "Similar discussions on other metrics")

**Design Principles:**

- Keep raw bodies text-only (no provider coupling)
- Support multiple embedding providers (OpenAI, Cohere, local)
- Embeddings generated on-demand, not inline

## Usage Example

### Weekly Data Ingestion Flow

1. **Week 1**: Ingest slide with:

   - `metric.name="Orders"`
   - `submetric.category="Region A"`
   - `submetric.label="Completion Rate"`
   - System creates `submetric_definition(metricKey="orders", submetricKey="region-a-completion-rate")`
   - Links `submetric.definitionId`

2. **User adds comment** on Region A data point "2024-01-08":

   - System auto-detects `bucketType="week"`
   - Normalizes "2024-01-08" → "2024-01-08" (ISO week start is Monday)
   - Creates `comment_thread(definitionId, scope='point', bucketType='week', bucketValue='2024-01-08')`
   - Adds `comment(body="Spike due to promo campaign")`

3. **Week 2**: Ingest new slide with same metric/category/label

   - Links to existing `submetric_definition` via `definitionId` (same as Week 1)
   - User hovers "2024-01-08" data point for Region A
   - **Comment persists**: Shows "Spike due to promo campaign" from Week 1

4. **Different Category (Region B)**:

   - Region B submetric has different `definitionId` (metricKey="orders", submetricKey="region-b-completion-rate")
   - Comments on Region A data points do NOT appear on Region B data points
   - Each category maintains isolated comment threads

5. **Cross-Slide Visibility**:
   - All slides with same `definitionId` (Region A Orders Completion Rate) show comments for "2024-01-08"
   - Historical context preserved across weekly refreshes
   - Comments properly isolated per category

## Testing

### Manual Test Checklist

- [ ] Click data point → dialog opens
- [ ] Create comment → appears in thread
- [ ] Reply to comment → nested display
- [ ] Close/reopen dialog → data persists
- [ ] Click different point → shows different thread
- [ ] Ingest new slide → old comments still visible on same dates
- [ ] Long comment body (10k chars) → accepted
- [ ] Empty body → rejected (400 error)
- [ ] Pagination → cursor works

### Unit Tests (TODO)

- Time bucket normalization edge cases
- Cursor encoding/decoding
- Comment tree building logic

## Deployment

### Pre-Deploy

1. Run migration: `npx tsx scripts/apply-comment-migration.ts`
2. Run backfill: `npx tsx scripts/backfill-submetric-definitions.ts`
3. Verify: Check `submetric.definitionId IS NOT NULL`

### Environment Variables

- `DATABASE_URL`: Neon/Vercel Postgres connection string
- `NEXTAUTH_*`: For session/auth (already configured)

### Database Access

- Read `/src/lib/db/schema.ts` for Drizzle ORM types
- Use `db.select()`, `db.insert()`, etc. from `/src/lib/db/index.ts`

## Known Limitations (v1)

1. **No workspace membership enforcement** (TODO markers in API routes)
2. **No comment editing** (only create/soft delete)
3. **No slide-scoped notes UI** (API exists, UI pending)
4. **No comment badges on dots** (counts endpoint exists, UI pending)
5. **No LLM features** (schema ready, features pending)
6. **No real-time updates** (manual refresh required)

## Future Enhancements

### Short-term

- Add comment badges to chart dots (show count)
- Implement slide-scoped notes panel in `submetric-card.tsx`
- Add comment editing and deletion
- Real-time updates via WebSocket/SSE

### Medium-term

- Thread resolution workflow
- @mention notifications
- Attachment support (images, links)
- Comment search

### Long-term

- AI-generated summaries
- Semantic search across comments
- Anomaly → comment suggestions
- Cross-metric insights

## Support

For questions or issues:

- Schema: `/src/lib/db/schema.ts`
- API helpers: `/src/lib/api/comments.ts`
- Time utilities: `/src/lib/time-buckets.ts`
- Sheet component: `/.../components/point-comments-sheet.tsx`
