import "dotenv/config";
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";

/**
 * Fix submetric definitions to include category in submetricKey
 *
 * Problem: Previous implementation didn't include category/brand in submetricKey,
 * causing different submetrics (e.g., [Adidas] vs [Nike]) to share the same
 * definition and thus share comment threads.
 *
 * Solution:
 * 1. Re-derive submetricKey using new logic that includes category
 * 2. Create new definitions where necessary
 * 3. Update submetric.definitionId to point to correct definitions
 * 4. Clean up orphaned comment threads (optional)
 */

function normalizeKey(str: string): string {
  return str
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * NEW: Derive submetric key from label including category
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

async function fixDefinitions() {
  try {
    console.log("Starting fix of submetric definitions...\n");

    // Step 1: Get all submetrics with their workspace path
    console.log("Fetching all submetrics...");
    const submetrics = await db.execute(sql`
      SELECT
        s.id as submetric_id,
        s.label as submetric_label,
        s.category as submetric_category,
        s.unit,
        s."preferredTrend",
        s."definitionId" as old_definition_id,
        m.name as metric_name,
        sl."workspaceId"
      FROM submetric s
      JOIN metric m ON s."metricId" = m.id
      JOIN slide sl ON m."slideId" = sl.id
      ORDER BY sl."workspaceId", m.name, s.category, s.label
    `);

    console.log(`Found ${submetrics.rows.length} submetrics to process\n`);

    // Step 2: Re-derive keys and update definitions
    const definitionMap = new Map<string, string>(); // compositeKey -> definitionId
    let processedCount = 0;
    let createdCount = 0;
    let updatedCount = 0;
    let unchangedCount = 0;

    for (const row of submetrics.rows) {
      const {
        submetric_id,
        submetric_label,
        submetric_category,
        unit,
        preferredTrend,
        old_definition_id,
        metric_name,
        workspaceId,
      } = row as any;

      // Derive NEW keys using updated logic (include category)
      const metricKey = normalizeKey(metric_name);
      const categoryPrefix = submetric_category
        ? normalizeKey(submetric_category)
        : null;
      const labelKey = deriveSubmetricKey(submetric_label);
      const newSubmetricKey = categoryPrefix
        ? `${categoryPrefix}-${labelKey}`
        : labelKey;
      const compositeKey = `${workspaceId}|${metricKey}|${newSubmetricKey}`;

      console.log(
        `Processing: ${
          submetric_category ? `[${submetric_category}] ` : ""
        }${submetric_label}`
      );
      console.log(`  Workspace: ${workspaceId}`);
      console.log(`  Metric Key: ${metricKey}`);
      console.log(`  Category: ${submetric_category || "None"}`);
      console.log(`  New Submetric Key: ${newSubmetricKey}`);

      // Check if we've already created this definition in this run
      let newDefinitionId = definitionMap.get(compositeKey);

      if (!newDefinitionId) {
        // Upsert definition with new submetricKey
        const result = await db.execute(sql`
          INSERT INTO submetric_definition (
            id,
            "workspaceId",
            "metricKey",
            "submetricKey",
            label,
            unit,
            "preferredTrend",
            "createdAt",
            "updatedAt"
          )
          VALUES (
            gen_random_uuid(),
            ${workspaceId},
            ${metricKey},
            ${newSubmetricKey},
            ${submetric_label},
            ${unit},
            ${preferredTrend},
            NOW(),
            NOW()
          )
          ON CONFLICT ("workspaceId", "metricKey", "submetricKey")
          DO UPDATE SET
            label = EXCLUDED.label,
            unit = EXCLUDED.unit,
            "preferredTrend" = EXCLUDED."preferredTrend",
            "updatedAt" = NOW()
          RETURNING id
        `);

        newDefinitionId = (result.rows[0] as any).id as string;
        definitionMap.set(compositeKey, newDefinitionId);

        // Determine if this was newly created
        if (newDefinitionId !== old_definition_id) {
          createdCount++;
          console.log(`  ✓ Created new definition: ${newDefinitionId}`);
        } else {
          unchangedCount++;
          console.log(`  ✓ Definition unchanged: ${newDefinitionId}`);
        }
      } else {
        console.log(`  ✓ Using existing definition: ${newDefinitionId}`);
      }

      // Update submetric with new definitionId (if changed)
      if (newDefinitionId !== old_definition_id) {
        await db.execute(sql`
          UPDATE submetric
          SET "definitionId" = ${newDefinitionId}
          WHERE id = ${submetric_id}
        `);
        updatedCount++;
        console.log(
          `  ✓ Updated submetric definitionId: ${old_definition_id} -> ${newDefinitionId}`
        );
      }

      processedCount++;
      console.log("");
    }

    console.log(`\n=== Fix Summary ===`);
    console.log(`Total submetrics processed: ${processedCount}`);
    console.log(`Submetrics with updated definitionId: ${updatedCount}`);
    console.log(`Submetrics unchanged: ${unchangedCount}`);
    console.log(`New definitions created: ${createdCount}`);
    console.log(`Unique definitions after fix: ${definitionMap.size}`);

    // Step 3: Identify orphaned definitions (optional)
    console.log("\n=== Checking for orphaned definitions ===");
    const orphanedDefs = await db.execute(sql`
      SELECT
        sd.id,
        sd."metricKey",
        sd."submetricKey",
        sd.label,
        COUNT(s.id) as submetric_count
      FROM submetric_definition sd
      LEFT JOIN submetric s ON s."definitionId" = sd.id
      GROUP BY sd.id, sd."metricKey", sd."submetricKey", sd.label
      HAVING COUNT(s.id) = 0
    `);

    if (orphanedDefs.rows.length > 0) {
      console.log(`Found ${orphanedDefs.rows.length} orphaned definitions:`);
      for (const def of orphanedDefs.rows) {
        const { id, metricKey, submetricKey, label } = def as any;
        console.log(`  - ${id}: ${metricKey}/${submetricKey} (${label})`);
      }
      console.log(
        "\nNote: These orphaned definitions may have associated comment threads."
      );
      console.log(
        "You may want to manually review and clean them up if appropriate."
      );
    } else {
      console.log("✓ No orphaned definitions found");
    }

    // Step 4: Show comment thread distribution
    console.log("\n=== Comment Thread Distribution ===");
    const threadStats = await db.execute(sql`
      SELECT
        sd."metricKey",
        sd."submetricKey",
        sd.label,
        COUNT(DISTINCT ct.id) as thread_count,
        COUNT(DISTINCT c.id) as comment_count
      FROM submetric_definition sd
      LEFT JOIN comment_thread ct ON ct."definitionId" = sd.id
      LEFT JOIN comment c ON c."threadId" = ct.id
      WHERE ct.id IS NOT NULL
      GROUP BY sd.id, sd."metricKey", sd."submetricKey", sd.label
      ORDER BY thread_count DESC, comment_count DESC
    `);

    if (threadStats.rows.length > 0) {
      console.log("Definitions with comment threads:");
      for (const stat of threadStats.rows) {
        const { metricKey, submetricKey, label, thread_count, comment_count } =
          stat as any;
        console.log(
          `  - ${metricKey}/${submetricKey}: ${thread_count} threads, ${comment_count} comments`
        );
        console.log(`    Label: ${label}`);
      }
    } else {
      console.log("No comment threads found in the system");
    }

    console.log("\n✓ Fix completed successfully!");
  } catch (error) {
    console.error("\n✗ Error during fix:", error);
    throw error;
  }
}

fixDefinitions()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
