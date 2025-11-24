# Default Workspace Setup

## Overview

The xmrit-hub project now automatically initializes a default workspace with sample slides, metrics, and submetrics when you run `npm run dev`. This ensures you have example data to work with immediately after setting up the project.

## What Gets Created

### 1. Default Workspace

- **Name**: "Xmrit Hub Sample Workspace"
- **Description**: "Sample workspace with example slides demonstrating XMR charts, metrics tracking, and statistical process control"
- **Visibility**: Public (accessible to all)

### 2. Sample Slides

#### Slide 1: Sales Performance Dashboard

Contains metrics related to sales and revenue tracking.

**Metrics:**

- **Revenue** (2 submetrics)

  - `All Regions - Total Revenue`: $50,000 baseline with 30 days of data (source: sales_database)
  - `Online - Revenue`: $30,000 baseline with 30 days of data (source: ecommerce_platform)

- **Customer Acquisition** (2 submetrics)
  - `Paid - New Customers`: 150 customers/day baseline (source: crm_system)
  - `Free Trial - Sign-ups`: 200 sign-ups/day baseline (source: marketing_automation)

#### Slide 2: Product Engagement Metrics

Contains metrics related to user engagement and product usage.

**Metrics:**

- **Active Users** (2 submetrics)
  - `Mobile + Web - Daily Active Users`: 5,000 users baseline (source: analytics_platform)
  - `Average - Session Duration`: 12 minutes baseline (source: analytics_platform)

### 3. Sample Data Characteristics

All sample data includes:

- **30 days** of historical data points
- **Realistic variation** with random variance
- **Slight upward trend** for demonstration purposes
- **Confidence scores** (0.85-0.99, increasing with data recency)
- **Source attribution** for data lineage tracking
- **Proper XMR chart compatibility** (timestamps and values)
- **Consistent blue color** (#3b82f6) for all line charts
- **Unit specifications** ($, customers, users, minutes, etc.)
- **Category labels** with dash separator format (e.g., `All Regions - Total Revenue`, `Paid - New Customers`)
- **Metric definitions** for workspace-level documentation
- **Submetric definitions** for stable identities and persistent comments

## Usage

### Automatic Initialization

When you run the development server, the script automatically checks and initializes:

```bash
npm run dev
```

This will:

1. ✅ Check if "Default Workspace" exists (create if missing)
2. ✅ Check if sample slides exist in the workspace (create if missing)
3. ✅ Update n8n.json with the workspace ID
4. ✅ Start the Next.js development server

### Skip Initialization

If you want to skip the workspace initialization and run the dev server directly:

```bash
npm run dev:only
```

### Manual Initialization

You can also run the initialization script separately:

```bash
npm run workspace:init
```

## Script Behavior

The script is **idempotent**, meaning:

- It won't create duplicate workspaces or slides
- Running it multiple times is safe
- It only creates missing resources

### First Run

```
🚀 Initializing default workspace and sample data...

✅ Created new default workspace
  ID: abc-123-def-456
  Name: Xmrit Hub Sample Workspace

📊 Creating sample slides with metrics...

  ✅ Created slide: Sales Performance Dashboard
    ✓ Added metric: Revenue (with 2 submetrics)
    ✓ Added metric: Customer Acquisition (with 2 submetrics)
  ✅ Created slide: Product Engagement Metrics
    ✓ Added metric: Active Users (with 2 submetrics)

✅ Sample data created successfully!

✅ Updated n8n.json with workspace ID

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎉 Workspace initialization complete!

📍 Workspace ID: abc-123-def-456

📝 Next steps:
   1. Run 'npm run dev' to start the development server
   2. View sample slides in the dashboard
   3. Configure n8n workflow for data ingestion
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### Subsequent Runs

```
🚀 Initializing default workspace and sample data...

✓ Default workspace already exists
  ID: abc-123-def-456
  Name: Xmrit Hub Sample Workspace

✓ Sample slides already exist in workspace
  Found 2 existing slide(s)
```

## Sample Data Summary

The initialization script creates a comprehensive set of sample data:

- **6 total submetrics** across 2 slides
- **30 days** of historical data per submetric (180 total data points)
- **Confidence scores** ranging from 0.85 to 0.99 (increasing with data recency)
- **Source attribution** for every submetric (sales_database, ecommerce_platform, crm_system, etc.)
- **Consistent blue color** (#3b82f6) for all line charts for clean visualization
- **Category labels** with dash separator (e.g., `All Regions - Total Revenue`, `Paid - New Customers`)
- **Units** properly specified ($, customers, users, minutes)
- **Trend indicators** (uptrend, stable) for process control analysis

All data is fully compatible with:

- XMR charts and statistical process control
- The Data Ingestion API specification
- n8n workflow examples

## Customization

### Modify Sample Data

Edit `/scripts/create-default-workspace.ts` to:

- Change the number of data points (default: 30 days)
- Adjust baseline values and variance
- Add more slides, metrics, or submetrics
- Customize colors, units, and trends

### Example: Change Data Point Count

```typescript
// Change from 30 to 90 days of data
const revenueData = generateSampleDataPoints(90, 50000, 10000);
```

### Example: Add a New Metric

```typescript
// Add after existing metrics in a slide
const metric4 = await sql`
  INSERT INTO "metric" (id, name, description, "slideId", "sortOrder", "chartType", "createdAt", "updatedAt")
  VALUES (
    gen_random_uuid()::text,
    'Conversion Rate',
    'User conversion metrics',
    ${slideId},
    3,
    'line',
    NOW(),
    NOW()
  )
  RETURNING id
`;
```

## Integration with n8n

The script automatically updates `n8n.json` with the workspace ID, making it easy to:

1. Import the workflow into your n8n instance
2. Start ingesting real data from Metabase
3. Replace sample data with production metrics

## Database Schema

The script creates data following this dual hierarchy:

**Definition Hierarchy (Workspace-Level, Shared):**
```
Workspace
  ├── MetricDefinition(s)
  │     └── definition: Documentation text
  └── SubmetricDefinition(s)
        ├── label: Display label
        ├── unit: Measurement unit
        └── preferredTrend: Expected direction
```

**Instance Hierarchy (Slide-Specific, Temporal):**
```
Workspace
  └── Slide(s)
        └── Metric(s) → links to MetricDefinition
              └── Submetric(s) → links to SubmetricDefinition
                    └── Data Points (JSON array)
```

**Key Points:**
- **Definitions** are workspace-level and shared across all slides
- **Instances** are slide-specific with unique data points
- **Metrics** can have optional rankings (slide-specific priority)
- **Definitions** enable persistent comments and documentation
- Each level has timestamps, descriptions, and configuration options for visualization and analysis

## Troubleshooting

### Database Connection Issues

```
❌ DATABASE_URL not found in environment
```

**Solution**: Ensure your `.env.local` file contains a valid `DATABASE_URL`

### Script Fails Mid-Creation

If the script fails partway through, it's safe to run again. The script checks for existing resources and only creates what's missing.

### Reset Everything

To start fresh:

```bash
npm run db:reset
npm run workspace:init
```

## Next Steps

1. **View the dashboard**: Navigate to `/[workspaceId]` to see your sample slides
2. **Explore metrics**: Click on any slide to view the XMR charts
3. **Configure n8n**: Set up your data ingestion workflow
4. **Add real data**: Replace sample data with production metrics from your sources
