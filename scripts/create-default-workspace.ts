import { config } from "dotenv";
import { neon } from "@neondatabase/serverless";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

// Load environment variables
config();

// Helper function to generate sample data points
function generateSampleDataPoints(
  count: number,
  baseValue: number,
  variance: number,
  source: string = "sample_data"
): Array<{
  timestamp: string;
  value: number;
  confidence?: number;
  source?: string;
}> {
  const dataPoints = [];
  const now = new Date();

  for (let i = count - 1; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);

    // Add some realistic variation
    const randomVariance = (Math.random() - 0.5) * variance;
    const trendVariance = (count - i) * 0.1; // Slight upward trend
    const value = baseValue + randomVariance + trendVariance;

    // Add confidence scores that increase over time (newer data = more confident)
    const confidence = 0.85 + (i / count) * 0.14; // Range from 0.85 to 0.99

    dataPoints.push({
      timestamp: date.toISOString(),
      value: Math.round(value * 100) / 100, // Round to 2 decimal places
      confidence: Math.round(confidence * 100) / 100,
      source: source,
    });
  }

  return dataPoints;
}

async function createDefaultWorkspace() {
  const DATABASE_URL = process.env.DATABASE_URL;

  if (!DATABASE_URL) {
    console.error("❌ DATABASE_URL not found in environment");
    process.exit(1);
  }

  console.log("🚀 Initializing default workspace and sample data...\n");

  try {
    const sql = neon(DATABASE_URL);

    // ==========================================
    // 1. CHECK/CREATE DEFAULT WORKSPACE
    // ==========================================
    const existingWorkspaces = await sql`
      SELECT id, name FROM "workspace"
      WHERE name = 'Xmrit Hub Sample Workspace'
      LIMIT 1
    `;

    let workspaceId: string;

    if (existingWorkspaces.length > 0) {
      workspaceId = existingWorkspaces[0].id;
      console.log("✓ Default workspace already exists");
      console.log(`  ID: ${workspaceId}`);
      console.log(`  Name: ${existingWorkspaces[0].name}\n`);
    } else {
      const newWorkspace = await sql`
        INSERT INTO "workspace" (id, name, description, "isPublic", "isArchived", "createdAt", "updatedAt")
        VALUES (
          gen_random_uuid()::text,
          'Xmrit Hub Sample Workspace',
          'Sample workspace with example slides demonstrating XMR charts, metrics tracking, and statistical process control',
          true,
          false,
          NOW(),
          NOW()
        )
        RETURNING id, name
      `;

      workspaceId = newWorkspace[0].id;
      console.log("✅ Created new default workspace");
      console.log(`  ID: ${workspaceId}`);
      console.log(`  Name: ${newWorkspace[0].name}\n`);
    }

    // ==========================================
    // 2. CHECK/CREATE SAMPLE SLIDES
    // ==========================================
    const existingSlides = await sql`
      SELECT id, title FROM "slide"
      WHERE "workspaceId" = ${workspaceId}
      LIMIT 1
    `;

    if (existingSlides.length > 0) {
      console.log("✓ Sample slides already exist in workspace");
      console.log(`  Found ${existingSlides.length} existing slide(s)\n`);
    } else {
      console.log("📊 Creating sample slides with metrics...\n");

      // Create Sample Slide 1: Sales Performance
      const slide1 = await sql`
        INSERT INTO "slide" (id, title, description, "workspaceId", "slideDate", "sortOrder", "isPublished", "createdAt", "updatedAt")
        VALUES (
          gen_random_uuid()::text,
          'Sales Performance Dashboard',
          'Key sales metrics and performance indicators',
          ${workspaceId},
          CURRENT_DATE,
          1,
          true,
          NOW(),
          NOW()
        )
        RETURNING id
      `;
      const slide1Id = slide1[0].id;
      console.log("  ✅ Created slide: Sales Performance Dashboard");

      // Create Metric 1: Revenue
      const metric1 = await sql`
        INSERT INTO "metric" (id, name, description, "slideId", "sortOrder", "chartType", "createdAt", "updatedAt")
        VALUES (
          gen_random_uuid()::text,
          'Revenue',
          'Total revenue over time',
          ${slide1Id},
          1,
          'line',
          NOW(),
          NOW()
        )
        RETURNING id
      `;
      const metric1Id = metric1[0].id;

      // Create Submetric 1.1: Total Revenue
      const revenueData = generateSampleDataPoints(
        30,
        50000,
        10000,
        "sales_database"
      );
      await sql`
        INSERT INTO "submetric" (id, label, category, "metricId", "xAxis", timezone, "preferredTrend", unit, "aggregationType", color, "dataPoints", "createdAt", "updatedAt")
        VALUES (
          gen_random_uuid()::text,
          'All Regions - Total Revenue',
          'sales',
          ${metric1Id},
          'date',
          'UTC',
          'uptrend',
          '$',
          'sum',
          '#3b82f6',
          ${JSON.stringify(revenueData)},
          NOW(),
          NOW()
        )
      `;

      // Create Submetric 1.2: Online Revenue
      const onlineRevenueData = generateSampleDataPoints(
        30,
        30000,
        6000,
        "ecommerce_platform"
      );
      await sql`
        INSERT INTO "submetric" (id, label, category, "metricId", "xAxis", timezone, "preferredTrend", unit, "aggregationType", color, "dataPoints", "createdAt", "updatedAt")
        VALUES (
          gen_random_uuid()::text,
          'Online - Revenue',
          'sales',
          ${metric1Id},
          'date',
          'UTC',
          'uptrend',
          '$',
          'sum',
          '#3b82f6',
          ${JSON.stringify(onlineRevenueData)},
          NOW(),
          NOW()
        )
      `;

      console.log("    ✓ Added metric: Revenue (with 2 submetrics)");

      // Create Metric 2: Customer Acquisition
      const metric2 = await sql`
        INSERT INTO "metric" (id, name, description, "slideId", "sortOrder", "chartType", "createdAt", "updatedAt")
        VALUES (
          gen_random_uuid()::text,
          'Customer Acquisition',
          'New customers acquired over time',
          ${slide1Id},
          2,
          'line',
          NOW(),
          NOW()
        )
        RETURNING id
      `;
      const metric2Id = metric2[0].id;

      // Create Submetric 2.1: New Customers
      const customersData = generateSampleDataPoints(30, 150, 30, "crm_system");
      await sql`
        INSERT INTO "submetric" (id, label, category, "metricId", "xAxis", timezone, "preferredTrend", unit, "aggregationType", color, "dataPoints", "createdAt", "updatedAt")
        VALUES (
          gen_random_uuid()::text,
          'Paid - New Customers',
          'acquisition',
          ${metric2Id},
          'date',
          'UTC',
          'stable',
          'customers',
          'count',
          '#3b82f6',
          ${JSON.stringify(customersData)},
          NOW(),
          NOW()
        )
      `;

      // Create Submetric 2.2: Trial Sign-ups
      const trialsData = generateSampleDataPoints(
        30,
        200,
        40,
        "marketing_automation"
      );
      await sql`
        INSERT INTO "submetric" (id, label, category, "metricId", "xAxis", timezone, "preferredTrend", unit, "aggregationType", color, "dataPoints", "createdAt", "updatedAt")
        VALUES (
          gen_random_uuid()::text,
          'Free Trial - Sign-ups',
          'acquisition',
          ${metric2Id},
          'date',
          'UTC',
          'uptrend',
          'sign-ups',
          'count',
          '#3b82f6',
          ${JSON.stringify(trialsData)},
          NOW(),
          NOW()
        )
      `;

      console.log(
        "    ✓ Added metric: Customer Acquisition (with 2 submetrics)"
      );

      // Create Sample Slide 2: Product Metrics
      const slide2 = await sql`
        INSERT INTO "slide" (id, title, description, "workspaceId", "slideDate", "sortOrder", "isPublished", "createdAt", "updatedAt")
        VALUES (
          gen_random_uuid()::text,
          'Product Engagement Metrics',
          'User engagement and product usage statistics',
          ${workspaceId},
          CURRENT_DATE,
          2,
          true,
          NOW(),
          NOW()
        )
        RETURNING id
      `;
      const slide2Id = slide2[0].id;
      console.log("  ✅ Created slide: Product Engagement Metrics");

      // Create Metric 3: Active Users
      const metric3 = await sql`
        INSERT INTO "metric" (id, name, description, "slideId", "sortOrder", "chartType", "createdAt", "updatedAt")
        VALUES (
          gen_random_uuid()::text,
          'Active Users',
          'Daily and monthly active users',
          ${slide2Id},
          1,
          'line',
          NOW(),
          NOW()
        )
        RETURNING id
      `;
      const metric3Id = metric3[0].id;

      // Create Submetric 3.1: Daily Active Users
      const dauData = generateSampleDataPoints(
        30,
        5000,
        500,
        "analytics_platform"
      );
      await sql`
        INSERT INTO "submetric" (id, label, category, "metricId", "xAxis", timezone, "preferredTrend", unit, "aggregationType", color, "dataPoints", "createdAt", "updatedAt")
        VALUES (
          gen_random_uuid()::text,
          'Mobile + Web - Daily Active Users',
          'engagement',
          ${metric3Id},
          'date',
          'UTC',
          'uptrend',
          'users',
          'avg',
          '#3b82f6',
          ${JSON.stringify(dauData)},
          NOW(),
          NOW()
        )
      `;

      // Create Submetric 3.2: Session Duration
      const sessionData = generateSampleDataPoints(
        30,
        12,
        2,
        "analytics_platform"
      );
      await sql`
        INSERT INTO "submetric" (id, label, category, "metricId", "xAxis", timezone, "preferredTrend", unit, "aggregationType", color, "dataPoints", "createdAt", "updatedAt")
        VALUES (
          gen_random_uuid()::text,
          'Average - Session Duration',
          'engagement',
          ${metric3Id},
          'date',
          'UTC',
          'stable',
          'minutes',
          'avg',
          '#3b82f6',
          ${JSON.stringify(sessionData)},
          NOW(),
          NOW()
        )
      `;

      console.log("    ✓ Added metric: Active Users (with 2 submetrics)\n");

      console.log("✅ Sample data created successfully!\n");
    }

    // ==========================================
    // 3. UPDATE N8N.JSON
    // ==========================================
    const n8nJsonPath = join(process.cwd(), "n8n.json");

    try {
      const n8nConfig = JSON.parse(readFileSync(n8nJsonPath, "utf-8"));

      let updated = false;
      for (const node of n8nConfig.nodes) {
        if (
          node.name === "HTTP Request" &&
          node.type === "n8n-nodes-base.httpRequest"
        ) {
          const bodyParam = node.parameters.body;
          if (bodyParam && bodyParam.includes("workspace_id")) {
            node.parameters.body = bodyParam.replace(
              /workspace_id:\s*"[^"]*"/,
              `workspace_id: "${workspaceId}"`
            );
            updated = true;
            console.log("✅ Updated n8n.json with workspace ID");
          }
        }
      }

      if (updated) {
        writeFileSync(n8nJsonPath, JSON.stringify(n8nConfig, null, 2));
        console.log(`  File: ${n8nJsonPath}\n`);
      }
    } catch (fileError) {
      console.log("⚠️  Could not update n8n.json file");
    }

    // ==========================================
    // 4. SUMMARY
    // ==========================================
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("🎉 Workspace initialization complete!\n");
    console.log("📍 Workspace ID: " + workspaceId);
    console.log("\n📝 Next steps:");
    console.log("   1. Run 'npm run dev' to start the development server");
    console.log("   2. View sample slides in the dashboard");
    console.log("   3. Configure n8n workflow for data ingestion");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
  } catch (error) {
    console.error("\n❌ Failed to initialize workspace:", error);
    process.exit(1);
  }
}

createDefaultWorkspace();
