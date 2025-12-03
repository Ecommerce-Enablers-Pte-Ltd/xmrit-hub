# Follow-up System Documentation

## Overview

The follow-up system provides task/ticket management capabilities for tracking action items related to workspace slides, submetric definitions, and comment threads. This document covers the schema design, API usage, migration guide, and best practices.

## Key Features

- **Multi-assignee support**: Assign multiple users to a single follow-up via many-to-many junction table
- **Flexible linking**: Link follow-ups to slides, submetric definitions, or comment threads
- **Status workflow**: Track progress from todo → in_progress → done/cancelled
- **Priority levels**: Five priority levels (no_priority, urgent, high, medium, low)
- **Auto-generated identifiers**: Human-readable identifiers (e.g., "FU-1", "FU-2") per workspace
- **Due date tracking**: Optional due dates with overdue filtering
- **Pagination & filtering**: Advanced query capabilities for large datasets

## Database Schema

### Primary Table: `follow_up`

Stores follow-up tasks with their metadata and relationships:

```sql
CREATE TABLE follow_up (
  id TEXT PRIMARY KEY,
  identifier TEXT NOT NULL,  -- e.g., "FU-123"
  title TEXT NOT NULL,
  description TEXT,
  workspaceId TEXT NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
  slideId TEXT REFERENCES slide(id) ON DELETE SET NULL,
  submetricDefinitionId TEXT REFERENCES submetric_definition(id) ON DELETE SET NULL,
  threadId TEXT REFERENCES comment_thread(id) ON DELETE SET NULL,
  resolvedAtSlideId TEXT REFERENCES slide(id) ON DELETE SET NULL,  -- NEW: Tracks resolution slide
  status follow_up_status NOT NULL DEFAULT 'todo',
  priority follow_up_priority NOT NULL DEFAULT 'no_priority',
  assigneeId TEXT REFERENCES user(id) ON DELETE SET NULL,  -- DEPRECATED
  createdBy TEXT NOT NULL REFERENCES user(id) ON DELETE SET NULL,
  dueDate DATE,
  completedAt TIMESTAMP,
  createdAt TIMESTAMP NOT NULL DEFAULT NOW(),
  updatedAt TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE(workspaceId, identifier)
);

CREATE INDEX follow_up_workspace_id_idx ON follow_up(workspaceId);
CREATE INDEX follow_up_status_idx ON follow_up(status);
CREATE INDEX follow_up_submetric_definition_id_idx ON follow_up(submetricDefinitionId);
CREATE INDEX follow_up_resolved_at_slide_id_idx ON follow_up(resolvedAtSlideId);  -- NEW
```

### Junction Table: `follow_up_assignee`

Many-to-many relationship table for multiple assignees per follow-up:

```sql
CREATE TABLE follow_up_assignee (
  id TEXT PRIMARY KEY,
  followUpId TEXT NOT NULL REFERENCES follow_up(id) ON DELETE CASCADE,
  userId TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  createdAt TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE(followUpId, userId)
);

CREATE INDEX follow_up_assignee_follow_up_id_idx ON follow_up_assignee(followUpId);
CREATE INDEX follow_up_assignee_user_id_idx ON follow_up_assignee(userId);
```

### Enums

Status and priority enums for follow-ups:

```sql
CREATE TYPE follow_up_status AS ENUM ('todo', 'in_progress', 'done', 'cancelled', 'resolved');
CREATE TYPE follow_up_priority AS ENUM ('no_priority', 'urgent', 'high', 'medium', 'low');
```

### Key Schema Concepts

1. **Unique Identifiers**: Each workspace has auto-incrementing identifiers (FU-1, FU-2, etc.)
2. **Soft Delete**: Follow-ups can be set to "cancelled" status instead of deleting
3. **Flexible Relationships**: Optional foreign keys allow linking to slides, definitions, or threads
4. **Deprecated `assigneeId`**: Kept for backward compatibility; use `follow_up_assignee` junction table instead
5. **Resolution Tracking**: `resolvedAtSlideId` tracks which slide a follow-up was resolved on
   - Enables temporal follow-up views (view past slide states)
   - Follow-ups only show as "resolved" on/after the resolution slide's date
   - Allows marking follow-ups as "done" without immediately resolving them

## Migration Steps

### Step 1: Push Schema Changes

Run the following command to push the new schema to your database:

```bash
npm run db:push
```

This will:

- Create the `follow_up_assignee` junction table
- Add the `submetricDefinitionId` column to the `follow_up` table
- Create necessary indexes

### Step 2: Migrate Existing Data

Run the migration script to move existing assignee data to the new junction table:

```bash
npm run db:migrate-follow-up-assignees
```

This script will:

- Find all follow-ups with an `assigneeId` value
- Create corresponding entries in the `follow_up_assignee` table
- Skip any entries that already exist (idempotent)

### Step 3: Verify Migration

You can verify the migration was successful by:

1. Opening Drizzle Studio:

   ```bash
   npm run db:studio
   ```

2. Checking that:
   - All follow-ups with assignees have corresponding entries in `follow_up_assignee`
   - The application correctly displays multiple assignees

## API Documentation

### Base Endpoints

**List Follow-ups**

```
GET /api/workspaces/{workspaceId}/follow-ups
```

**Create Follow-up**

```
POST /api/workspaces/{workspaceId}/follow-ups
```

**Get Single Follow-up**

```
GET /api/follow-ups/{followUpId}
```

**Update Follow-up**

```
PATCH /api/follow-ups/{followUpId}
```

**Delete Follow-up**

```
DELETE /api/follow-ups/{followUpId}
```

**Get Submetric Follow-ups** (NEW)

```
GET /api/submetrics/definitions/{definitionId}/follow-ups?slideId={slideId}
```

Get all follow-ups for a specific submetric definition with temporal filtering based on slide date.

### Request/Response Formats

#### Create Follow-up Request

```json
{
  "title": "Investigate API performance spike",
  "description": "Response times increased by 50% on Oct 30",
  "slideId": "slide-123",
  "submetricDefinitionId": "def-456",
  "threadId": "thread-789",
  "status": "todo",
  "priority": "urgent",
  "assigneeIds": ["user-123", "user-456"],
  "dueDate": "2024-11-15"
}
```

**Validation Rules:**

- `title`: Required, 1-200 characters
- `description`: Optional, max 2000 characters
- `slideId`: Optional, valid UUID
- `submetricDefinitionId`: Optional, valid UUID
- `threadId`: Optional, valid UUID
- `status`: Optional, **defaults to `"todo"` (set in schema)** - enforced at database level
- `priority`: Optional, **defaults to `"no_priority"` (set in schema)** - enforced at database level
- `assigneeIds`: Optional array of user UUIDs
- `dueDate`: Optional, YYYY-MM-DD format

**Note on Default Values**: Default values for `status` and `priority` are enforced at the database schema level (`src/lib/db/schema.ts`), not in the API route. If you omit these fields, the database will automatically apply the schema defaults.

#### Follow-up Response

```json
{
  "id": "fu-123",
  "identifier": "FU-15",
  "title": "Investigate API performance spike",
  "description": "Response times increased by 50% on Oct 30",
  "workspaceId": "ws-123",
  "slideId": "slide-123",
  "submetricDefinitionId": "def-456",
  "threadId": "thread-789",
  "status": "in_progress",
  "priority": "urgent",
  "assigneeId": null,
  "createdBy": "user-000",
  "dueDate": "2024-11-15",
  "completedAt": null,
  "createdAt": "2024-10-30T10:00:00Z",
  "updatedAt": "2024-10-31T14:30:00Z",
  "assignees": [
    {
      "id": "rel-1",
      "followUpId": "fu-123",
      "userId": "user-123",
      "createdAt": "2024-10-30T10:00:00Z",
      "user": {
        "id": "user-123",
        "name": "Alice Johnson",
        "email": "alice@example.com",
        "image": "https://..."
      }
    },
    {
      "id": "rel-2",
      "followUpId": "fu-123",
      "userId": "user-456",
      "createdAt": "2024-10-30T10:00:00Z",
      "user": {
        "id": "user-456",
        "name": "Bob Smith",
        "email": "bob@example.com",
        "image": "https://..."
      }
    }
  ],
  "createdByUser": {
    "id": "user-000",
    "name": "Charlie Brown",
    "email": "charlie@example.com",
    "image": "https://..."
  },
  "slide": {
    "id": "slide-123",
    "title": "2024-10-30 Weekly Review",
    "slideDate": "2024-10-30"
  },
  "submetricDefinition": {
    "id": "def-456",
    "label": "[Auth Service] - Response Time",
    "unit": "ms",
    "metricKey": "api_performance",
    "submetricKey": "auth_service"
  }
}
```

#### List Follow-ups Query Parameters

```
GET /api/workspaces/{workspaceId}/follow-ups?page=1&limit=20&status=todo&priority=high&sortBy=dueDate&sortOrder=asc
```

**Available Parameters:**

- `page`: Page number (default: 1)
- `limit`: Items per page (max: 100, default: 20)
- `sortBy`: createdAt | updatedAt | title | status | priority | dueDate | identifier
- `sortOrder`: asc | desc (default: desc)
- `status`: Filter by status (todo, in_progress, done, cancelled)
- `priority`: Filter by priority (no_priority, urgent, high, medium, low)
- `assigneeId`: Filter by assignee user ID
- `slideId`: Filter by slide ID
- `search`: Search in title and description
- `unassigned`: true/false - Show only unassigned follow-ups
- `overdue`: true/false - Show only overdue follow-ups

**Response:**

```json
{
  "followUps": [
    /* array of follow-ups */
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 45,
    "totalPages": 3,
    "hasMore": true
  }
}
```

### Submetric Follow-ups Endpoint (Temporal Filtering)

```
GET /api/submetrics/definitions/{definitionId}/follow-ups?slideId={slideId}
```

**Query Parameters:**

- `slideId` (optional): When provided, filters and categorizes follow-ups based on the slide's date

**Response without slideId:**

```json
{
  "followUps": [
    /* all follow-ups for this definition */
  ],
  "count": 10
}
```

**Response with slideId:**

```json
{
  "followUps": [
    /* all follow-ups for this definition */
  ],
  "count": 10,
  "resolved": [
    /* Follow-ups that are:
       - Status: "done" or "cancelled"
       - resolvedAtSlideId is set
       - Resolution slide date <= current slide date
       - Created on or before current slide date */
  ],
  "unresolved": [
    /* Follow-ups that are:
       - Status: "todo", or "in_progress", OR
       - Status: "done"/"cancelled" but no resolvedAtSlideId, OR
       - Status: "done"/"cancelled" but resolved in the future (after current slide date)
       - Created on or before current slide date */
  ],
  "resolvedCount": 2,
  "unresolvedCount": 8
}
```

**Key Concepts:**

- **Temporal Filtering**: Only shows follow-ups created on or before the current slide's date
- **Resolution Context**: A follow-up is only "resolved" if it was resolved on or before the current slide
- **Time Travel**: View past slide states to see what follow-ups were unresolved at that time
- **Status vs Resolution**:
  - Status = "done" means the work is complete
  - resolvedAtSlideId = when it shows as "resolved" in the UI
  - Allows marking tasks done without immediately resolving them

## UI Components

### Follow-up Dialog

Interactive form for creating and editing follow-ups with the following features:

1. **Title & Description**: Text input and textarea for task details
2. **Slide Selector**: Dropdown to link follow-up to a specific slide
3. **Submetric Definition Selector**: Appears when slide is selected, shows all definitions from that slide
4. **Multi-Assignee Selector**:
   - Searchable command palette interface
   - Shows user avatars and names
   - Displays selected assignees as dismissible badges
   - Expands when more than 2 assignees are selected
5. **Status & Priority**: Dropdown selectors with visual indicators
6. **Due Date**: Calendar picker for date selection

### Follow-up Table

Comprehensive table view with the following features:

1. **Columns**:

   - **Identifier**: Human-readable ID (e.g., "FU-15")
   - **Title**: Click to edit, shows description on hover
   - **Status**: Badge with color coding (gray/blue/yellow/green/red)
   - **Priority**: Badge with priority level (urgent/high/medium/low)
   - **Assignees**: Up to 3 avatars, "+N more" indicator for additional
   - **Due Date**: Shows date with overdue indicator (red text)
   - **Actions**: Edit, delete, and status quick-update

2. **Interactions**:

   - Click row to open edit dialog
   - Click assignee avatars to filter by that user
   - Click status/priority badges to filter
   - Hover over title to see full description

3. **Filtering & Sorting**:
   - Filter by status, priority, assignee, slide
   - Sort by any column
   - Search by title/description
   - Show only unassigned or overdue items

### User Assignee Multi-Selector Component

Reusable component for selecting multiple users:

```tsx
<UserAssigneeMultiSelector
  selectedUserIds={selectedUserIds}
  onSelectedUserIdsChange={setSelectedUserIds}
  workspaceId={workspaceId}
/>
```

**Features:**

- Command palette-style interface with search
- Fetches users from `/api/users?workspaceId=...`
- Checkbox selection with "Select All" support
- Displays selected users as dismissible badges
- Keyboard navigation support

### Follow-up Tab Component (NEW)

Slide-specific view of follow-ups for a submetric definition with temporal filtering:

**Location:** `src/app/[workspaceId]/slide/[slideId]/components/follow-up-tab.tsx`

**Features:**

1. **Temporal Context**: Shows follow-ups as they appeared on the slide's date

   - Only displays follow-ups created on or before the slide date
   - Categorizes resolved/unresolved based on resolution timeline

2. **Two-Section Layout**:

   - **Unresolved Section**: Active follow-ups for this slide
     - Status is not "done" or "cancelled", OR
     - Status is "done"/"cancelled" but not yet resolved, OR
     - Resolved in the future (after this slide's date)
   - **Resolved Section**: Follow-ups completed by this slide
     - Status is "done" or "cancelled" AND
     - resolvedAtSlideId is set AND
     - Resolution slide date is on or before current slide date

3. **Resolution Controls**:

   - **Circle Button**: Mark as resolved (sets resolvedAtSlideId to current slide)
   - **Check Circle Button**: Mark as unresolved (clears resolvedAtSlideId)
   - Only shown when status is "done" or "cancelled"
   - Disabled if current slide is before follow-up creation date

4. **Navigation**:

   - Click "Created on {slide}" → navigates to creation slide using `router.push()`
   - Click "Resolved on {slide}" → navigates to resolution slide using `router.push()`
   - Click identifier (e.g., "FU-123") → navigates to workspace follow-ups page

5. **Integrated Management**:
   - Create new follow-ups (pre-filled with current slide and submetric)
   - Edit existing follow-ups
   - Delete follow-ups
   - Change status via dropdown
   - View assignees with avatars

**Usage:**

```tsx
<FollowUpTab
  definitionId="submetric-def-id"
  slideId="current-slide-id"
  workspaceId="workspace-id"
/>
```

**Key Implementation Details:**

- Uses `useSubmetricFollowUps()` hook to fetch filtered follow-ups
- Fetches workspace slides for date comparison
- Prevents resolution on slides before follow-up creation
- Automatically invalidates queries after mutations
- Shows loading skeletons during data fetch

## Best Practices

### When to Use Follow-ups

1. **Action Items from Comments**: Convert discussion threads into trackable tasks
2. **Slide-Level Tasks**: Track overall improvements or data quality issues
3. **Metric Investigations**: Link to specific submetric definitions for deep dives
4. **Cross-Team Collaboration**: Assign multiple team members to complex issues

### Workflow Recommendations

**Todo → In Progress:**

- Move to "in_progress" when actively working on the task

**Todo → In Progress:**

- Assign to specific team members
- Set due dates
- Link to relevant slides/definitions

**In Progress → Done:**

- Update status to "done" when work is completed
- Optionally set resolvedAtSlideId to mark when it should show as "resolved"
- Leave description comments about resolution
- Consider linking to follow-up slides/metrics

**Resolution Workflow (NEW):**

1. Complete the work and set status to "done" or "cancelled"
2. Navigate to the slide where you want to mark it as resolved
3. Click the circle button to set resolvedAtSlideId
4. The follow-up will now show as "resolved" on that slide and all future slides

**Important Resolution Notes:**

- Status change (to "done"/"cancelled") can happen independently from resolution
- Marking as "resolved" is a UI/reporting action that sets the resolution timeline
- Once resolved, the follow-up moves to the "Resolved" section for that slide and future slides
- Past slides will still show it as "unresolved" (temporal accuracy)
- Cannot resolve on a slide dated before the follow-up was created

**Cancellation:**

- Use "cancelled" status instead of deleting
- Preserves history and context
- Add reason in description
- Can still be marked as "resolved" to remove from active view

### Naming Conventions

**Good Titles:**

- "Investigate API spike on 2024-10-30"
- "Fix data quality issue in Revenue metric"
- "Update seasonality model for Q4"

**Bad Titles:**

- "Fix this" (too vague)
- "API" (not actionable)
- "..." (meaningless)

### Assignment Strategy

1. **Single Assignee**: Use for focused, individual tasks
2. **Multiple Assignees**: Use for:
   - Cross-functional collaboration
   - Tasks requiring multiple approvals
   - Knowledge sharing across team members
3. **Unassigned**: Use for:
   - Todo items not yet assigned
   - General team tasks (anyone can pick up)

## Migration Guide

### Initial Schema Setup

If deploying follow-ups for the first time:

```bash
# Push schema changes to database
npm run db:push
```

This creates:

- `follow_up` table with all columns
- `follow_up_assignee` junction table
- Necessary indexes and foreign keys
- Enum types for status and priority

### Migrating Existing Data

If you have existing follow-ups with the old single-assignee system:

```bash
# Run migration script to move assigneeId → follow_up_assignee
npm run db:migrate-follow-up-assignees
```

**What the script does:**

1. Finds all follow-ups with `assigneeId` set
2. Creates corresponding entries in `follow_up_assignee` table
3. Skips entries that already exist (idempotent)
4. Leaves `assigneeId` unchanged for backward compatibility

**Verification:**

```bash
# Open Drizzle Studio to verify migration
npm run db:studio
```

Check:

- All follow-ups with assignees have entries in `follow_up_assignee`
- User relationships are correct
- Counts match between old and new system

## Rollback Plan

### If Migration Fails

1. **Revert junction table**: Drop `follow_up_assignee` table
2. **Keep assigneeId**: Use the deprecated `assigneeId` column
3. **Update API code**: Revert to single-assignee logic

### Data Preservation

- The `assigneeId` column is never deleted
- Old data remains accessible even after migration
- Junction table can be rebuilt from `assigneeId` if needed

## Troubleshooting

### Common Issues

**"Unique constraint violation on follow_up_assignee"**

- Cause: Attempting to assign same user twice to one follow-up
- Solution: Check existing assignments before adding

**"Follow-up identifier already exists"**

- Cause: Identifier collision within workspace
- Solution: System auto-generates next available identifier

**"Cannot delete user with follow-up assignments"**

- Cause: Foreign key constraint in `follow_up_assignee`
- Solution: Reassign or remove user from follow-ups first (or use CASCADE DELETE)

**"Follow-ups not showing in list"**

- Check: Pagination parameters
- Check: Filter settings (status, assignee, etc.)
- Check: Workspace ID matches

### Performance Considerations

**Large Result Sets:**

- Use pagination (limit: 20-50 items per page)
- Apply filters to reduce dataset
- Index on frequently queried columns (status, assigneeId)

**Multi-Assignee Queries:**

- Junction table adds JOINs, slight performance impact
- Indexes on `followUpId` and `userId` optimize lookups
- Batch queries when fetching multiple follow-ups

## Related Files

- **Schema**: `src/lib/db/schema.ts`
- **Types**: `src/types/db/follow-up.ts`
- **Validation**: `src/lib/validations/follow-up.ts`
- **API Routes**:
  - `src/app/api/workspaces/[workspaceId]/follow-ups/route.ts`
  - `src/app/api/follow-ups/[followUpId]/route.ts`
  - `src/app/api/submetrics/definitions/[definitionId]/follow-ups/route.ts` (NEW)
- **API Client Hooks**:
  - `src/lib/api/follow-ups.ts` (includes `useSubmetricFollowUps()`)
- **Components**:
  - `src/app/[workspaceId]/follow-ups/components/follow-up-dialog.tsx`
  - `src/app/[workspaceId]/follow-ups/components/user-assignee-multi-selector.tsx`
  - `src/app/[workspaceId]/follow-ups/components/follow-up-table.tsx`
  - `src/app/[workspaceId]/slide/[slideId]/components/follow-up-tab.tsx` (NEW)
  - `src/app/[workspaceId]/slide/[slideId]/components/slide-sheet.tsx` (NEW)
- **Migration Script**: `scripts/migrate-follow-up-assignees.ts`
