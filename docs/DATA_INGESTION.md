# Data Ingestion API

## Overview

The Data Ingestion API enables programmatic ingestion of metrics data from various sources including data warehouses, ETL pipelines (n8n, Zapier, Airflow), BI tools (Metabase, Tableau), or any HTTP-capable system. This REST API endpoint provides a standardized way to populate Xmrit with time-series data for statistical process control analysis.

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

| Field               | Type   | Required    | Description                                                              |
| ------------------- | ------ | ----------- | ------------------------------------------------------------------------ |
| `workspace_id`      | UUID   | No          | Target workspace ID. If not provided, creates a new public workspace     |
| `slide_id`          | UUID   | No          | Target slide ID. If not provided, creates/updates based on `slide_title` |
| `slide_title`       | String | Conditional | Required if `slide_id` not provided. Used to create or update slides     |
| `slide_date`        | String | No          | Slide date in YYYY-MM-DD format                                          |
| `slide_description` | String | No          | Optional description for the slide                                       |
| `metrics`           | Array  | Yes         | Array of metric objects (see below)                                      |

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

| Field              | Type   | Required | Description                                                    |
| ------------------ | ------ | -------- | -------------------------------------------------------------- |
| `label`            | String | Yes      | Display label for the submetric                                |
| `category`         | String | No       | Category for grouping                                          |
| `timezone`         | String | No       | Timezone (default: "UTC")                                      |
| `xaxis`            | String | No       | X-axis type: "date", "week", "month", etc. (default: "date")   |
| `preferred_trend`  | String | No       | Expected trend: "up", "down", "uptrend", "downtrend"           |
| `unit`             | String | No       | Unit of measurement (e.g., "%", "$", "count")                  |
| `aggregation_type` | String | No       | Aggregation type: "sum", "avg", "min", "max" (default: "none") |
| `color`            | String | No       | Hex color code for chart display (default: "#3b82f6" - blue)   |
| `metadata`         | Object | No       | Additional metadata as JSON                                    |
| `data_points`      | Array  | Yes      | Array of data point objects                                    |

### Data Point Object Structure

| Field        | Type   | Required | Description                           |
| ------------ | ------ | -------- | ------------------------------------- |
| `timestamp`  | String | Yes      | ISO 8601 timestamp or YYYY-MM-DD date |
| `value`      | Number | Yes      | Numeric value for the data point      |
| `confidence` | Number | No       | Confidence level (0-1)                |
| `source`     | String | No       | Data source identifier                |
| `dimensions` | Object | No       | Additional dimensional data           |

## Example Payload

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
          "label": "[North America] - Revenue",
          "category": "North America",
          "timezone": "America/Los_Angeles",
          "xaxis": "week",
          "preferred_trend": "up",
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
          "label": "[Europe] - Revenue",
          "category": "Europe",
          "timezone": "Europe/London",
          "xaxis": "week",
          "preferred_trend": "up",
          "unit": "$",
          "aggregation_type": "sum",
          "color": "#3b82f6",
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
      "submetrics": [
        {
          "label": "Overall Conversion Rate",
          "category": "Performance",
          "unit": "%",
          "preferred_trend": "up",
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
4. **Slide Resolution**: Get existing slide by ID or create/update by title and date
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
- **Fields**: `label`, `unit`, `preferredTrend`
- **Auto-generated**: `submetricKey` includes category for uniqueness (e.g., "region-a-of-total-count")

**Upsert Behavior:**

- Always updates `label`, `unit`, and `preferredTrend` to match latest ingestion
- Preserves `definitionId` for comment thread persistence

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
- Sets `isPublic: true` for accessibility
- Returns new workspace ID in response

### Slide Management

**Creation (when slide_id not provided):**

- Requires `slide_title`
- Uses `slide_date` if provided
- Creates new slide in specified workspace

**Update (when matching slide found):**

- Matches by `slide_title` and `slide_date` within workspace
- Updates existing slide instead of creating duplicate

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
            "label": "Test Submetric",
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
                    "label": "Test Data",
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

## Related Documentation

- [Controller Logic](./CONTROLLER_TRAFFIC_LIGHT.md) - Understanding process control status indicators
- [Auto Lock Limit](./AUTO_LOCK_LIMIT.md) - Automatic outlier detection
- [Lock Limit](./LOCK_LIMIT.md) - Manual limit locking
- [Trend Lines](./TREND_LINES.md) - Trend analysis for time series data
- [Seasonality](./DESEASONALISATION.md) - Seasonal adjustments for recurring patterns

## Future Enhancements

Potential improvements under consideration:

- Bulk update support for existing metrics
- Partial updates for appending data points
- Webhook support for real-time data push
- GraphQL API alternative
- Rate limiting and quota management
- API versioning
- Async processing for large payloads
