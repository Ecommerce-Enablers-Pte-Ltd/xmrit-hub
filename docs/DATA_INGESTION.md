# Data Ingestion API

## Overview

The Data Ingestion API enables programmatic ingestion of metrics data from various sources including data warehouses, ETL pipelines (n8n, Zapier, Airflow), BI tools (Metabase, Tableau), or any HTTP-capable system. This REST API endpoint provides a standardized way to populate Xmrit with time-series data for statistical process control analysis.

**Important:** This API uses **UUIDs (IDs)**, not slugs. While the web application uses URL-friendly slugs (e.g., `/my-workspace/slide/1-weekly-review`), the ingestion API requires workspace and slide UUIDs. See the [Slugs vs IDs](#slugs-vs-ids) section below for details.

## Endpoint

```
POST /api/ingest/metrics
```

## Authentication

The endpoint uses Bearer token authentication for security:

```bash
Authorization: Bearer YOUR_METRICS_API_KEY
Content-Type: application/json
```

### API Key Requirements

- Minimum length: 32 characters
- Set in environment variable: `METRICS_API_KEY`
- Generate using: `openssl rand -hex 32`

### Security Features

- **Authentication Validation**: Every request is validated against the configured API key
- **IP Logging**: Client IP addresses are logged for audit purposes
- **Request Tracking**: All successful and failed attempts are logged with timestamps
- **Unauthorized Access Prevention**: Invalid API keys return 401 Unauthorized

## Request Payload Structure

### Top-Level Fields

| Field               | Type   | Required    | Description                                                                                      |
| ------------------- | ------ | ----------- | ------------------------------------------------------------------------------------------------ |
| `workspace_id`      | UUID   | No          | **UUID** of the target workspace (not slug). If not provided, creates a new public workspace     |
| `slide_id`          | UUID   | No          | **UUID** of the target slide (not slug). If not provided, creates/updates based on `slide_title` |
| `slide_title`       | String | Conditional | Required if `slide_id` not provided. Used to create or update slides                             |
| `slide_date`        | String | No          | Slide date in YYYY-MM-DD format                                                                  |
| `slide_description` | String | No          | Optional description for the slide                                                               |
| `metrics`           | Array  | Yes         | Array of metric objects (see below)                                                              |

**Note:** Both `workspace_id` and `slide_id` are UUIDs, not URL slugs. The web application uses slugs in URLs (e.g., `/my-workspace/slide/1-weekly-review`), but the API requires UUIDs. To find a workspace UUID, check the workspace settings in the UI or query the database.

### Metric Object Structure

| Field         | Type   | Required | Description                                                        |
| ------------- | ------ | -------- | ------------------------------------------------------------------ |
| `metric_name` | String | Yes      | Name of the metric                                                 |
| `description` | String | No       | Optional metric definition (workspace-level, preserved if omitted) |
| `ranking`     | Number | No       | Optional ranking/priority (1=top, 2=second, etc.) - slide-specific |
| `chart_type`  | String | No       | Chart type (default: "line")                                       |
| `submetrics`  | Array  | Yes      | Array of submetric objects                                         |

**Note on `description` field:**

- Stores workspace-level definition in `metricDefinitions` table
- If omitted during ingestion, existing definition is preserved (protects manual UI edits)
- If provided, updates the definition
- Completely optional - you can ingest data without descriptions

**Note on `ranking` field:**

- Slide-specific ranking/priority indicator
- Stored separately from definition (in `metrics` table)
- Editing definition does NOT affect ranking

### Submetric Object Structure

| Field              | Type   | Required | Description                                                                                                                        |
| ------------------ | ------ | -------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `category`         | String | No       | Category/dimension for grouping (e.g., "Brand A", "North America") - stored in definition                                          |
| `timezone`         | String | No       | Timezone - instance-specific config. **Default: `"utc"` (set in schema)**                                                          |
| `xaxis`            | String | No       | X-axis semantic label (stored in definition, e.g., "period", "tracked_week", "transaction_touched_at")                             |
| `yaxis`            | String | No       | Y-axis semantic label / unit (stored in definition, e.g., "hours", "% completion", "complaints"). Also used as fallback for `unit` |
| `preferred_trend`  | String | No       | Expected trend: "uptrend", "downtrend", "stable" (stored in definition)                                                            |
| `unit`             | String | No       | Unit of measurement (stored in definition, e.g., "%", "$", "count"). If omitted, `yaxis` is used as fallback                       |
| `aggregation_type` | String | No       | Aggregation type: "sum", "avg", "min", "max", "none". **Default: `"none"` (set in schema)** - instance-specific config             |
| `color`            | String | No       | Hex color code for chart display - instance-specific config                                                                        |
| `metadata`         | Object | No       | Additional metadata as JSON                                                                                                        |
| `data_points`      | Array  | Yes      | Array of data point objects                                                                                                        |

**Note on Default Values**: Default values are enforced at the database schema level (`src/lib/db/schema.ts`), not in the API route. If you omit optional fields like `timezone` or `aggregation_type`, the database will automatically apply the schema defaults. You only need to include these fields if you want to override the defaults.

**Note on `category` field:**

- Optional dimension/segment identifier (e.g., "Brand A", "North America", "Region A")
- Stored in `submetricDefinitions` along with the parent `metric_name`
- Display label is constructed as `[Category] - Metric Name` in the UI
- If omitted, display shows just the metric name without category prefix

**Note on `xaxis` and `yaxis` fields:**

- Both are stored in `submetricDefinitions` for semantic documentation
- `xaxis` describes what the x-axis represents (e.g., "period", "week", "tracked_week")
- `yaxis` describes what the y-axis represents (e.g., "hours", "% completion", "complaints")
- If `unit` is omitted, `yaxis` is used as the unit value
- Often `yaxis` and `unit` have the same value (e.g., both "hours")

### Data Point Object Structure

| Field        | Type   | Required | Description                           |
| ------------ | ------ | -------- | ------------------------------------- |
| `timestamp`  | String | Yes      | ISO 8601 timestamp or YYYY-MM-DD date |
| `value`      | Number | Yes      | Numeric value for the data point      |
| `confidence` | Number | No       | Confidence level (0-1)                |
| `source`     | String | No       | Data source identifier                |
| `dimensions` | Object | No       | Additional dimensional data           |

## Example Payload

**Important:** The `workspace_id` and `slide_id` fields use UUIDs, not URL slugs. URLs use slugs (e.g., `/my-workspace/slide/1-weekly-review`), but the API requires UUIDs.

```json
{
  "workspace_id": "550e8400-e29b-41d4-a716-446655440000",
  "slide_title": "Q4 2024 Weekly Business Review",
  "slide_date": "2024-10-30",
  "slide_description": "Weekly metrics for Q4 performance tracking",
  "metrics": [
    {
      "metric_name": "Revenue",
      "description": "Total revenue by region",
      "chart_type": "line",
      "submetrics": [
        {
          "category": "North America",
          "timezone": "America/Los_Angeles",
          "xaxis": "week",
          "yaxis": "$",
          "preferred_trend": "uptrend",
          "unit": "$",
          "aggregation_type": "sum",
          "color": "#3b82f6",
          "data_points": [
            {
              "timestamp": "2024-01-01",
              "value": 125000,
              "confidence": 0.95,
              "source": "metabase"
            },
            {
              "timestamp": "2024-01-08",
              "value": 132000,
              "confidence": 0.98,
              "source": "metabase"
            }
          ]
        },
        {
          "category": "Europe",
          "timezone": "Europe/London",
          "xaxis": "week",
          "yaxis": "$",
          "preferred_trend": "uptrend",
          "unit": "$",
          "aggregation_type": "sum",
          "color": "#10b981",
          "data_points": [
            {
              "timestamp": "2024-01-01",
              "value": 95000
            },
            {
              "timestamp": "2024-01-08",
              "value": 98000
            }
          ]
        }
      ]
    },
    {
      "metric_name": "Conversion Rate",
      "description": "Customer conversion percentage",
      "ranking": 2,
      "submetrics": [
        {
          "category": "Overall",
          "xaxis": "week",
          "yaxis": "%",
          "preferred_trend": "uptrend",
          "data_points": [
            {
              "timestamp": "2024-01-01",
              "value": 3.2
            },
            {
              "timestamp": "2024-01-08",
              "value": 3.5
            }
          ]
        }
      ]
    }
  ]
}
```

## Response Format

### Success Response (200 OK)

```json
{
  "success": true,
  "workspace_id": "550e8400-e29b-41d4-a716-446655440000",
  "slide_id": "660e8400-e29b-41d4-a716-446655440001",
  "inserted_metrics": ["metric-uuid-1", "metric-uuid-2"],
  "total_submetrics": 3,
  "total_datapoints": 6
}
```

### Error Responses

**401 Unauthorized**

```json
{
  "error": "Invalid API key"
}
```

**400 Bad Request**

```json
{
  "error": "Invalid request - 'metrics' array is required"
}
```

**404 Not Found**

```json
{
  "error": "Workspace with id '...' not found"
}
```

**500 Internal Server Error**

```json
{
  "error": "Database connection failed",
  "details": "..."
}
```

## Implementation Details

### Data Processing Flow

1. **Authentication**: Validate Bearer token against `METRICS_API_KEY`
2. **Request Parsing**: Parse and validate JSON payload
3. **Workspace Resolution**: Get existing workspace or create new public workspace
4. **Slide Resolution**:
   - If `slide_id` provided: Get existing slide by UUID
   - If `slide_id` not provided: Create new slide with auto-assigned slide number (next sequential number for workspace)
5. **Metric Definition Upsert**: Create or update metric definitions (workspace-level, shared across slides)
6. **Metric Insertion**: Insert metrics linked to definitions with configured chart types and rankings
7. **Submetric Definition Upsert**: Create or update submetric definitions (workspace-level, stable identities)
8. **Submetric Insertion**: Insert submetrics linked to definitions with all attributes and data points
9. **Response**: Return success with IDs and counts

### Metric Definition System

The ingestion API uses a **two-tier definition system** for stable metric identities:

#### Metric Definitions (`metricDefinitions` table)

- **Purpose**: Centralized definition/documentation for metric families across slides
- **Key**: `(workspaceId, metricKey)` - unique per workspace
- **Fields**: `definition` (description text), `metricKey` (stable identifier)
- **Auto-generated**: `metricKey` is derived from `metric_name` (normalized to lowercase with dashes)

**Upsert Behavior:**

- If `description` is provided: Creates new definition or updates existing
- If `description` is omitted: Preserves existing definition (manual UI edits are protected)
- **This allows you to ingest data without affecting manually-edited definitions**

#### Submetric Definitions (`submetricDefinitions` table)

- **Purpose**: Stable identities for logical submetrics, enables persistent comments across slides
- **Key**: `(workspaceId, metricKey, submetricKey)` - unique per workspace
- **Fields**: `category`, `metricName`, `xaxis`, `yaxis`, `unit`, `preferredTrend`
- **Auto-generated**: `submetricKey` includes category for uniqueness (e.g., "brand-a-completion-rate")

**Upsert Behavior:**

- Always updates `category`, `metricName`, `xaxis`, `yaxis`, `unit`, and `preferredTrend` to match latest ingestion
- Preserves `definitionId` for comment thread persistence
- Semantic fields (`xaxis`, `yaxis`) describe what the axes represent (e.g., "period", "hours")

### Ranking vs Definition Separation

**Important**: Metric **ranking** and **definition** are stored separately:

- **Ranking** is stored in the `metrics` table (slide-specific)

  - Changes per slide/time period
  - Not affected by definition updates
  - Example: "Revenue" might be ranked #1 this week, #3 next week

- **Definition** is stored in the `metricDefinitions` table (workspace-level)
  - Shared across all slides
  - Provides documentation/description
  - Example: "Total revenue by region including online and offline sales"

**Editing a definition will NOT affect rankings or ordering** - they are independent concerns.

### Workspace Creation

When `workspace_id` is not provided:

- Creates a new public workspace
- Uses `slide_title` as workspace name (fallback: "API Ingestion Workspace")
- **Schema automatically sets `isPublic: true`** (default value in schema)
- **Schema automatically sets `isArchived: false`** (default value in schema)
- Returns new workspace ID in response

**Note**: Default values (`isPublic`, `isArchived`, `createdAt`, `updatedAt`) are handled by the database schema, not the API route.

### Slide Management

**Creation (when slide_id not provided):**

- Requires `slide_title`
- Uses `slide_date` if provided
- **Automatically assigns slide number**: The API calculates the next sequential slide number for the workspace by finding the maximum existing slide number and adding 1
  - Example: If workspace has slides 1, 2, 3, 4, 5 → new slide gets number 6
  - Example: If workspace has slides 1, 2, 5 (after deletion) → new slide gets number 6 (not 3 - numbers don't fill gaps)
- Creates new slide in specified workspace
- **You don't need to specify slide numbers** - they're automatically assigned per workspace
- **Numbers keep incrementing**: Each new slide creation automatically gets the next number (MAX + 1)

**Update (when matching slide found):**

- Matches by `slide_title` and `slide_date` within workspace
- Updates existing slide instead of creating duplicate
- Slide number remains unchanged (slide numbers are immutable after creation)

**Important Notes:**

- Slide numbers are **immutable identifiers** - once assigned, they never change
- If slides are deleted, the numbers don't "fill in the gaps" - the next slide continues from the highest number
- This ensures stable URLs and prevents breaking links when slides are deleted

### Default Values and Schema Enforcement

**Important**: The ingestion API relies on database schema defaults for consistency. The following defaults are automatically applied by the schema if not provided in the payload:

- **Submetrics:**

  - `timezone`: Defaults to `"utc"` if not specified
  - `aggregationType`: Defaults to `"none"` if not specified
  - `trafficLightColor`: Defaults to `"green"` for new submetrics

- **Workspaces:**

  - `isPublic`: Defaults to `true` for new workspaces
  - `isArchived`: Defaults to `false` for new workspaces

- **Timestamps:**
  - `createdAt` and `updatedAt`: Automatically set to current timestamp

These defaults are defined in `src/lib/db/schema.ts` and enforced at the database level. The API route does not need to (and should not) set these values unless explicitly overriding defaults.

### Data Point Storage

Data points are stored as JSONB arrays in PostgreSQL:

```json
[
  {
    "timestamp": "2024-01-01",
    "value": 125000,
    "confidence": 0.95,
    "source": "api",
    "dimensions": null
  }
]
```

## n8n Integration Example

The repository includes a ready-to-use n8n workflow (`n8n.json`) that demonstrates integration with Metabase:

### Setup Steps

1. Import `n8n.json` into your n8n instance
2. Configure Metabase authentication credentials
3. Set Metabase collection ID to pull data from
4. Set Bearer token to your `METRICS_API_KEY`
5. Configure target workspace ID
6. Run manually or set up scheduled execution

### Workflow Features

- **Auto Date Calculation**: Automatically calculates relative dates (e.g., last week)
- **Batch Processing**: Handles multiple metrics in a single request
- **Retry Logic**: Built-in retry mechanism for failed requests
- **Dynamic Metric Extraction**: Extracts metrics from Metabase API
- **Multi-Dimension Support**: Handles multiple dimensions and categories
- **Error Handling**: Comprehensive error handling and logging

## API Testing

### Using cURL

```bash
curl -X POST https://your-domain.com/api/ingest/metrics \
  -H "Authorization: Bearer your-api-key-here" \
  -H "Content-Type: application/json" \
  -d '{
    "workspace_id": "your-workspace-uuid",
    "slide_title": "Test Slide",
    "slide_date": "2024-10-30",
    "metrics": [
        {
          "metric_name": "Test Metric",
          "submetrics": [
            {
              "category": "Test Category",
              "data_points": [
                {"timestamp": "2024-01-01", "value": 100},
                {"timestamp": "2024-01-02", "value": 105}
              ]
            }
          ]
        }
    ]
  }'
```

### Using Python

```python
import requests
import json

url = "https://your-domain.com/api/ingest/metrics"
headers = {
    "Authorization": "Bearer your-api-key-here",
    "Content-Type": "application/json"
}

payload = {
    "workspace_id": "your-workspace-uuid",
    "slide_title": "Python Test",
    "metrics": [
        {
            "metric_name": "Python Metric",
            "submetrics": [
                {
                    "category": "Test Category",
                    "data_points": [
                        {"timestamp": "2024-01-01", "value": 100},
                        {"timestamp": "2024-01-02", "value": 105}
                    ]
                }
            ]
        }
    ]
}

response = requests.post(url, headers=headers, json=payload)
print(response.json())
```

## Best Practices

### 1. API Key Security

- Store API keys in environment variables, never in code
- Use separate API keys for different environments (dev, staging, prod)
- Rotate API keys periodically
- Monitor API usage logs for suspicious activity

### 2. Data Quality

- Ensure timestamps are in consistent format (ISO 8601 recommended)
- Validate data values before sending (no null/NaN values)
- Use confidence scores when data quality varies
- Include source attribution for data lineage

### 3. Performance Optimization

- Batch multiple metrics in single request when possible
- Limit data points per request to reasonable numbers (< 1000)
- Use compression for large payloads
- Implement retry logic with exponential backoff

### 4. Error Handling

- Log all API responses for debugging
- Implement proper error handling for failed requests
- Set up alerts for repeated failures
- Validate payload structure before sending

### 5. Workspace Organization

- Use consistent workspace IDs for related metrics
- Use descriptive slide titles for easy identification
- Include slide dates for time-based organization
- Add descriptions for context and documentation

### 6. Metric Definition Management

**When to Include Descriptions:**

- **Initial setup**: Include descriptions when first creating metrics to document their meaning
- **Documentation updates**: Include descriptions when you want to update the definition
- **Skip descriptions**: Omit descriptions in regular data ingestion to preserve manual edits made through UI

**Ranking Best Practices:**

- Use `ranking` to highlight top metrics (1 = most important, 2 = second most important)
- Ranking is slide-specific, so you can highlight different metrics each week
- Omit ranking if all metrics are equally important

**Definition vs Data Separation:**

- Think of definitions as "what this metric means" (workspace-level documentation)
- Think of data/ranking as "this week's values and priorities" (slide-specific)
- This separation allows you to update documentation without re-ingesting all historical data

## Troubleshooting

### Common Issues

**Issue: "Invalid API key"**

- Verify API key matches `METRICS_API_KEY` in server environment
- Ensure API key is at least 32 characters
- Check Bearer token format: `Authorization: Bearer <key>`

**Issue: "Workspace not found"**

- Verify workspace UUID is correct
- Check workspace exists in database
- Omit `workspace_id` to create new workspace

**Issue: "Invalid request - 'metrics' array is required"**

- Ensure `metrics` field is present in payload
- Verify `metrics` is an array with at least one element
- Check JSON syntax is valid

**Issue: Data not appearing in charts**

- Verify data points have valid timestamps and values
- Check that submetric has at least 2 data points for XMR analysis
- Ensure values are numeric, not strings

## Rate Limiting

Currently, there is no built-in rate limiting on the ingestion endpoint. Consider implementing rate limiting at the infrastructure level (e.g., API Gateway, Nginx) for production deployments.

## Monitoring and Logging

The API logs the following events:

- **Authentication**: Successful and failed authentication attempts with IP addresses
- **Ingestion Success**: Workspace ID, slide ID, metric counts, duration
- **Errors**: Error type, client IP, timestamp, error details

Example log output:

```
[AUDIT] Authenticated ingest request from 192.168.1.100
[AUDIT] Successfully ingested metrics from 192.168.1.100: workspace=550e8400-..., slide=660e8400-..., metrics=2, submetrics=3, datapoints=12, duration=245ms
```

## Slugs vs IDs

**Important Distinction:** The application uses two different identifiers:

### URLs Use Slugs

- **Workspace slugs**: URL-friendly identifiers (e.g., `my-workspace`, `engineering-team`)

  - Used in web URLs: `/my-workspace/slide/1-weekly-review`
  - Stored in `workspaces.slug` field
  - Auto-generated from workspace name when created via API
  - Immutable after creation

- **Slide slugs**: Combination of slide number and title (e.g., `1-weekly-review`)
  - Used in web URLs: `/my-workspace/slide/1-weekly-review`
  - Not stored in database - constructed from `slideNumber` + `title`
  - Format: `{slideNumber}-{slugified-title}`

### APIs Use UUIDs

- **Workspace IDs**: UUIDs (e.g., `550e8400-e29b-41d4-a716-446655440000`)

  - Used in API endpoints: `/api/workspaces/[workspaceId]/...`
  - Used in ingestion API: `workspace_id` field
  - Stored in `workspaces.id` field

- **Slide IDs**: UUIDs (e.g., `660e8400-e29b-41d4-a716-446655440001`)
  - Used in API endpoints: `/api/slides/[slideId]/...`
  - Used in ingestion API: `slide_id` field
  - Stored in `slides.id` field

### Data Ingestion API

The data ingestion API (`POST /api/ingest/metrics`) **uses UUIDs, not slugs**:

- `workspace_id`: UUID (not workspace slug)
- `slide_id`: UUID (not slide slug)

If you only have a workspace slug, you'll need to:

1. Query the workspace by slug to get its UUID
2. Use the UUID in the ingestion API

**Example:**

```bash
# ❌ Wrong - Don't use slugs in the API
{
  "workspace_id": "my-workspace"  # This is a slug, not a UUID
}

# ✅ Correct - Use UUIDs
{
  "workspace_id": "550e8400-e29b-41d4-a716-446655440000"  # This is a UUID
}
```

## Related Documentation

- [Controller Logic](./CONTROLLER_TRAFFIC_LIGHT.md) - Understanding process control status indicators
- [Auto Lock Limit](./AUTO_LOCK_LIMIT.md) - Automatic outlier detection
- [Lock Limit](./LOCK_LIMIT.md) - Manual limit locking
- [Trend Lines](./TREND_LINES.md) - Trend analysis for time series data
- [Seasonality](./DESEASONALISATION.md) - Seasonal adjustments for recurring patterns
- [Database Schema](./SCHEMA.md) - Complete schema reference including slug fields

## Future Enhancements

Potential improvements under consideration:

- Bulk update support for existing metrics
- Partial updates for appending data points
- Webhook support for real-time data push
- GraphQL API alternative
- Rate limiting and quota management
- API versioning
- Async processing for large payloads
