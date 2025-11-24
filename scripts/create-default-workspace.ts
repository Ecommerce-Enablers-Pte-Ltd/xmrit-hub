import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { neon } from "@neondatabase/serverless";
import { config } from "dotenv";

// Load environment variables
config();

/**
 * Normalize a string to a stable key format
 * Example: "% of MCB Count" -> "of-mcb-count"
 */
function normalizeKey(str: string): string {
  return str
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Derive submetric key from label
 * Extracts both category prefix and metric name to create a unique key
 * Example: "[Adidas] - % of MCB Count" -> "adidas-of-mcb-count"
 * Example: "[Nike] - % of MCB Count" -> "nike-of-mcb-count"
 * Example: "Transaction Count" -> "transaction-count"
 */
function deriveSubmetricKey(label: string): string {
  // Check if label has the pattern "[Category] - MetricName"
  const categoryMatch = label.match(/^\[([^\]]+)\]\s*-\s*(.+)$/);

  if (categoryMatch) {
    // Extract category and metric name
    const category = categoryMatch[1].trim();
    const metricName = categoryMatch[2].trim();

    // Combine category and metric name for unique key
    return normalizeKey(`${category}-${metricName}`);
  }

  // Otherwise use entire label
  return normalizeKey(label);
}

/**
 * Build submetric key with category prefix
 * This is the correct way to derive submetricKey that includes category
 */
function buildSubmetricKey(category: string | null, label: string): string {
  const categoryPrefix = category ? normalizeKey(category) : null;
  const labelKey = deriveSubmetricKey(label);
  return categoryPrefix ? `${categoryPrefix}-${labelKey}` : labelKey;
}

// Helper function to generate sample data points
function generateSampleDataPoints(
  count: number,
  baseValue: number,
  variance: number,
  source: string = "sample_data",
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
      const revenueMetricKey = normalizeKey("Revenue");

      // Create metric definition (workspace-level)
      const revenueDef = await sql`
        INSERT INTO "metric_definition" (id, "workspaceId", "metricKey", definition, "createdAt", "updatedAt")
        VALUES (
          gen_random_uuid()::text,
          ${workspaceId},
          ${revenueMetricKey},
          'Total revenue over time across all channels and regions',
          NOW(),
          NOW()
        )
        ON CONFLICT ("workspaceId", "metricKey") DO UPDATE
        SET "updatedAt" = NOW()
        RETURNING id
      `;

      // Create metric instance (slide-specific)
      const metric1 = await sql`
        INSERT INTO "metric" (id, name, "slideId", "definitionId", "sortOrder", ranking, "chartType", "createdAt", "updatedAt")
        VALUES (
          gen_random_uuid()::text,
          'Revenue',
          ${slide1Id},
          ${revenueDef[0].id},
          1,
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
        "sales_database",
      );
      const revenueLabel = "All Regions - Total Revenue";
      const revenueCategory = "sales";
      const revenueSubmetricKey = buildSubmetricKey(
        revenueCategory,
        revenueLabel,
      );

      const revenueSubmetricDef = await sql`
        INSERT INTO "submetric_definition" (id, "workspaceId", "metricKey", "submetricKey", label, unit, "preferredTrend", "createdAt", "updatedAt")
        VALUES (
          gen_random_uuid()::text,
          ${workspaceId},
          ${revenueMetricKey},
          ${revenueSubmetricKey},
          ${revenueLabel},
          '$',
          'uptrend',
          NOW(),
          NOW()
        )
        RETURNING id
      `;

      await sql`
        INSERT INTO "submetric" (id, label, category, "metricId", "definitionId", "xAxis", timezone, "preferredTrend", unit, "aggregationType", color, "dataPoints", "createdAt", "updatedAt")
        VALUES (
          gen_random_uuid()::text,
          ${revenueLabel},
          'sales',
          ${metric1Id},
          ${revenueSubmetricDef[0].id},
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
        "ecommerce_platform",
      );
      const onlineRevenueLabel = "Online - Revenue";
      const onlineRevenueCategory = "sales";
      const onlineRevenueSubmetricKey = buildSubmetricKey(
        onlineRevenueCategory,
        onlineRevenueLabel,
      );

      const onlineRevenueDef = await sql`
        INSERT INTO "submetric_definition" (id, "workspaceId", "metricKey", "submetricKey", label, unit, "preferredTrend", "createdAt", "updatedAt")
        VALUES (
          gen_random_uuid()::text,
          ${workspaceId},
          ${revenueMetricKey},
          ${onlineRevenueSubmetricKey},
          ${onlineRevenueLabel},
          '$',
          'uptrend',
          NOW(),
          NOW()
        )
        RETURNING id
      `;

      await sql`
        INSERT INTO "submetric" (id, label, category, "metricId", "definitionId", "xAxis", timezone, "preferredTrend", unit, "aggregationType", color, "dataPoints", "createdAt", "updatedAt")
        VALUES (
          gen_random_uuid()::text,
          ${onlineRevenueLabel},
          'sales',
          ${metric1Id},
          ${onlineRevenueDef[0].id},
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
      const customerMetricKey = normalizeKey("Customer Acquisition");

      // Create metric definition (workspace-level)
      const customerDef = await sql`
        INSERT INTO "metric_definition" (id, "workspaceId", "metricKey", definition, "createdAt", "updatedAt")
        VALUES (
          gen_random_uuid()::text,
          ${workspaceId},
          ${customerMetricKey},
          'New customers acquired through various channels including paid and organic sources',
          NOW(),
          NOW()
        )
        ON CONFLICT ("workspaceId", "metricKey") DO UPDATE
        SET "updatedAt" = NOW()
        RETURNING id
      `;

      // Create metric instance (slide-specific)
      const metric2 = await sql`
        INSERT INTO "metric" (id, name, "slideId", "definitionId", "sortOrder", ranking, "chartType", "createdAt", "updatedAt")
        VALUES (
          gen_random_uuid()::text,
          'Customer Acquisition',
          ${slide1Id},
          ${customerDef[0].id},
          2,
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
      const customersLabel = "Paid - New Customers";
      const customersCategory = "acquisition";
      const customersMetricKey = normalizeKey("Customer Acquisition");
      const customersSubmetricKey = buildSubmetricKey(
        customersCategory,
        customersLabel,
      );

      const customersDef = await sql`
        INSERT INTO "submetric_definition" (id, "workspaceId", "metricKey", "submetricKey", label, unit, "preferredTrend", "createdAt", "updatedAt")
        VALUES (
          gen_random_uuid()::text,
          ${workspaceId},
          ${customersMetricKey},
          ${customersSubmetricKey},
          ${customersLabel},
          'customers',
          'stable',
          NOW(),
          NOW()
        )
        RETURNING id
      `;

      await sql`
        INSERT INTO "submetric" (id, label, category, "metricId", "definitionId", "xAxis", timezone, "preferredTrend", unit, "aggregationType", color, "dataPoints", "createdAt", "updatedAt")
        VALUES (
          gen_random_uuid()::text,
          ${customersLabel},
          'acquisition',
          ${metric2Id},
          ${customersDef[0].id},
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
        "marketing_automation",
      );
      const trialsLabel = "Free Trial - Sign-ups";
      const trialsCategory = "acquisition";
      const trialsSubmetricKey = buildSubmetricKey(trialsCategory, trialsLabel);

      const trialsDef = await sql`
        INSERT INTO "submetric_definition" (id, "workspaceId", "metricKey", "submetricKey", label, unit, "preferredTrend", "createdAt", "updatedAt")
        VALUES (
          gen_random_uuid()::text,
          ${workspaceId},
          ${customersMetricKey},
          ${trialsSubmetricKey},
          ${trialsLabel},
          'sign-ups',
          'uptrend',
          NOW(),
          NOW()
        )
        RETURNING id
      `;

      await sql`
        INSERT INTO "submetric" (id, label, category, "metricId", "definitionId", "xAxis", timezone, "preferredTrend", unit, "aggregationType", color, "dataPoints", "createdAt", "updatedAt")
        VALUES (
          gen_random_uuid()::text,
          ${trialsLabel},
          'acquisition',
          ${metric2Id},
          ${trialsDef[0].id},
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
        "    ✓ Added metric: Customer Acquisition (with 2 submetrics)",
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
      const activeUsersMetricKey = normalizeKey("Active Users");

      // Create metric definition (workspace-level)
      const activeUsersDef = await sql`
        INSERT INTO "metric_definition" (id, "workspaceId", "metricKey", definition, "createdAt", "updatedAt")
        VALUES (
          gen_random_uuid()::text,
          ${workspaceId},
          ${activeUsersMetricKey},
          'Daily and monthly active users across mobile and web platforms',
          NOW(),
          NOW()
        )
        ON CONFLICT ("workspaceId", "metricKey") DO UPDATE
        SET "updatedAt" = NOW()
        RETURNING id
      `;

      // Create metric instance (slide-specific)
      const metric3 = await sql`
        INSERT INTO "metric" (id, name, "slideId", "definitionId", "sortOrder", ranking, "chartType", "createdAt", "updatedAt")
        VALUES (
          gen_random_uuid()::text,
          'Active Users',
          ${slide2Id},
          ${activeUsersDef[0].id},
          1,
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
        "analytics_platform",
      );
      const dauLabel = "Mobile + Web - Daily Active Users";
      const dauCategory = "engagement";
      const dauMetricKey = normalizeKey("Active Users");
      const dauSubmetricKey = buildSubmetricKey(dauCategory, dauLabel);

      const dauDef = await sql`
        INSERT INTO "submetric_definition" (id, "workspaceId", "metricKey", "submetricKey", label, unit, "preferredTrend", "createdAt", "updatedAt")
        VALUES (
          gen_random_uuid()::text,
          ${workspaceId},
          ${dauMetricKey},
          ${dauSubmetricKey},
          ${dauLabel},
          'users',
          'uptrend',
          NOW(),
          NOW()
        )
        RETURNING id
      `;

      await sql`
        INSERT INTO "submetric" (id, label, category, "metricId", "definitionId", "xAxis", timezone, "preferredTrend", unit, "aggregationType", color, "dataPoints", "createdAt", "updatedAt")
        VALUES (
          gen_random_uuid()::text,
          ${dauLabel},
          'engagement',
          ${metric3Id},
          ${dauDef[0].id},
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
        "analytics_platform",
      );
      const sessionLabel = "Average - Session Duration";
      const sessionCategory = "engagement";
      const sessionSubmetricKey = buildSubmetricKey(
        sessionCategory,
        sessionLabel,
      );

      const sessionDef = await sql`
        INSERT INTO "submetric_definition" (id, "workspaceId", "metricKey", "submetricKey", label, unit, "preferredTrend", "createdAt", "updatedAt")
        VALUES (
          gen_random_uuid()::text,
          ${workspaceId},
          ${dauMetricKey},
          ${sessionSubmetricKey},
          ${sessionLabel},
          'minutes',
          'stable',
          NOW(),
          NOW()
        )
        RETURNING id
      `;

      await sql`
        INSERT INTO "submetric" (id, label, category, "metricId", "definitionId", "xAxis", timezone, "preferredTrend", unit, "aggregationType", color, "dataPoints", "createdAt", "updatedAt")
        VALUES (
          gen_random_uuid()::text,
          ${sessionLabel},
          'engagement',
          ${metric3Id},
          ${sessionDef[0].id},
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

      // ==========================================
      // 4. CREATE SAMPLE FOLLOW-UPS
      // ==========================================
      console.log("📋 Creating sample follow-ups...\n");

      // Get the first authenticated user (if any exists) for follow-up creation
      const existingUsers = await sql`
        SELECT id, name, email FROM "user"
        LIMIT 3
      `;

      if (existingUsers.length > 0) {
        console.log(
          `  Found ${existingUsers.length} existing user(s) for follow-up assignments`,
        );

        // Create Follow-up 1: Linked to Revenue submetric definition
        const followUp1 = await sql`
          INSERT INTO "follow_up" (
            id, identifier, title, description, "workspaceId", "slideId",
            "submetricDefinitionId", status, priority, "createdBy", "dueDate",
            "createdAt", "updatedAt"
          )
          VALUES (
            gen_random_uuid()::text,
            'FU-1',
            'Investigate revenue spike in Q4',
            'Revenue increased by 25% in the last week. Investigate if this is due to seasonal factors or a specific campaign.',
            ${workspaceId},
            ${slide1Id},
            ${revenueSubmetricDef[0].id},
            'in_progress',
            'high',
            ${existingUsers[0].id},
            (CURRENT_DATE + INTERVAL '7 days')::date,
            NOW(),
            NOW()
          )
          RETURNING id
        `;

        // Assign multiple users to Follow-up 1
        if (existingUsers.length >= 2) {
          await sql`
            INSERT INTO "follow_up_assignee" (id, "followUpId", "userId", "createdAt")
            VALUES
              (gen_random_uuid()::text, ${followUp1[0].id}, ${existingUsers[0].id}, NOW()),
              (gen_random_uuid()::text, ${followUp1[0].id}, ${existingUsers[1].id}, NOW())
          `;
          console.log(
            "  ✅ Created follow-up: Investigate revenue spike (2 assignees)",
          );
        } else {
          await sql`
            INSERT INTO "follow_up_assignee" (id, "followUpId", "userId", "createdAt")
            VALUES (gen_random_uuid()::text, ${followUp1[0].id}, ${existingUsers[0].id}, NOW())
          `;
          console.log(
            "  ✅ Created follow-up: Investigate revenue spike (1 assignee)",
          );
        }

        // Create Follow-up 2: Linked to Customer Acquisition
        const followUp2 = await sql`
          INSERT INTO "follow_up" (
            id, identifier, title, description, "workspaceId", "slideId",
            "submetricDefinitionId", status, priority, "createdBy", "dueDate",
            "createdAt", "updatedAt"
          )
          VALUES (
            gen_random_uuid()::text,
            'FU-2',
            'Optimize trial-to-paid conversion funnel',
            'Trial sign-ups are increasing but conversion rate is declining. Need to analyze friction points in the onboarding flow.',
            ${workspaceId},
            ${slide1Id},
            ${trialsDef[0].id},
            'todo',
            'medium',
            ${existingUsers[0].id},
            (CURRENT_DATE + INTERVAL '14 days')::date,
            NOW(),
            NOW()
          )
          RETURNING id
        `;

        await sql`
          INSERT INTO "follow_up_assignee" (id, "followUpId", "userId", "createdAt")
          VALUES (gen_random_uuid()::text, ${followUp2[0].id}, ${existingUsers[0].id}, NOW())
        `;
        console.log(
          "  ✅ Created follow-up: Optimize trial conversion (1 assignee)",
        );

        // Create Follow-up 3: General slide-level task (no submetric definition)
        const followUp3 = await sql`
          INSERT INTO "follow_up" (
            id, identifier, title, description, "workspaceId", "slideId",
            status, priority, "createdBy", "dueDate",
            "createdAt", "updatedAt"
          )
          VALUES (
            gen_random_uuid()::text,
            'FU-3',
            'Review and update dashboard metrics',
            'Quarterly review of dashboard metrics and KPIs. Remove outdated metrics and add new strategic indicators.',
            ${workspaceId},
            ${slide2Id},
            'todo',
            'low',
            ${existingUsers[0].id},
            (CURRENT_DATE + INTERVAL '30 days')::date,
            NOW(),
            NOW()
          )
          RETURNING id
        `;

        // Assign all available users to Follow-up 3 (team task)
        if (existingUsers.length >= 3) {
          await sql`
            INSERT INTO "follow_up_assignee" (id, "followUpId", "userId", "createdAt")
            VALUES
              (gen_random_uuid()::text, ${followUp3[0].id}, ${existingUsers[0].id}, NOW()),
              (gen_random_uuid()::text, ${followUp3[0].id}, ${existingUsers[1].id}, NOW()),
              (gen_random_uuid()::text, ${followUp3[0].id}, ${existingUsers[2].id}, NOW())
          `;
          console.log("  ✅ Created follow-up: Review dashboard (3 assignees)");
        } else {
          await sql`
            INSERT INTO "follow_up_assignee" (id, "followUpId", "userId", "createdAt")
            VALUES (gen_random_uuid()::text, ${followUp3[0].id}, ${existingUsers[0].id}, NOW())
          `;
          console.log("  ✅ Created follow-up: Review dashboard (1 assignee)");
        }

        // Create Follow-up 4: Unassigned task
        await sql`
          INSERT INTO "follow_up" (
            id, identifier, title, description, "workspaceId",
            status, priority, "createdBy",
            "createdAt", "updatedAt"
          )
          VALUES (
            gen_random_uuid()::text,
            'FU-4',
            'Document XMR analysis methodology',
            'Create documentation explaining how we calculate control limits and interpret XMR charts for the team.',
            ${workspaceId},
            'todo',
            'low',
            ${existingUsers[0].id},
            NOW(),
            NOW()
          )
        `;
        console.log(
          "  ✅ Created follow-up: Document methodology (unassigned)",
        );

        console.log("\n✅ Sample follow-ups created successfully!\n");
      } else {
        console.log("  ⚠️  No users found - skipping follow-up creation");
        console.log(
          "     Sign in to the app first, then re-run this script to create sample follow-ups\n",
        );
      }

      console.log("✅ Sample data created successfully!\n");
    }

    // ==========================================
    // 5. UPDATE N8N.JSON
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
          if (bodyParam?.includes("workspace_id")) {
            node.parameters.body = bodyParam.replace(
              /workspace_id:\s*"[^"]*"/,
              `workspace_id: "${workspaceId}"`,
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
    } catch (_fileError) {
      console.log("⚠️  Could not update n8n.json file");
    }

    // ==========================================
    // 6. SUMMARY
    // ==========================================
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("🎉 Workspace initialization complete!\n");
    console.log(`📍 Workspace ID: ${workspaceId}`);
    console.log("\n📊 Sample Data Created:");
    console.log("   • 2 Slides with 3 metrics and 6 submetrics");
    console.log("   • 3 Metric definitions (workspace-level documentation)");
    console.log(
      "   • 6 Submetric definitions (stable identities for comments)",
    );
    console.log("   • 180+ data points across all metrics");
    console.log("   • 4 Follow-up tasks (if users exist)");
    console.log("\n📝 Next steps:");
    console.log("   1. Run 'npm run dev' to start the development server");
    console.log("   2. Sign in to create your user account");
    console.log("   3. View sample slides and follow-ups in the dashboard");
    console.log("   4. Configure n8n workflow for data ingestion");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
  } catch (error) {
    console.error("\n❌ Failed to initialize workspace:", error);
    process.exit(1);
  }
}

createDefaultWorkspace();
