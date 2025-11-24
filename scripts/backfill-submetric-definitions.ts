import "dotenv/config";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";

/**
 * Backfill submetric definitions from existing submetrics
 *
 * Strategy:
 * 1. Query all submetrics with their metric -> slide -> workspace path
 * 2. For each submetric, derive:
 *    - workspaceId (from slide)
 *    - metricKey (normalized metric.name)
 *    - submetricKey (normalized submetric.label - take text after '-' or whole label)
 * 3. Upsert into submetric_definition
 * 4. Update submetric.definitionId
 * 5. After all done, set definitionId to NOT NULL
 */

function normalizeKey(str: string): string {
  return str
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

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

async function backfillDefinitions() {
  try {
    console.log("Starting backfill of submetric definitions...\n");

    // Step 1: Get all submetrics with their workspace path
    console.log("Fetching all submetrics with workspace paths...");
    const submetrics = await db.execute(sql`
      SELECT
        s.id as submetric_id,
        s.label as submetric_label,
        s.category as submetric_category,
        s.unit,
        s."preferredTrend",
        m.name as metric_name,
        sl."workspaceId"
      FROM submetric s
      JOIN metric m ON s."metricId" = m.id
      JOIN slide sl ON m."slideId" = sl.id
      ORDER BY sl."workspaceId", m.name, s.category, s.label
    `);

    console.log(`Found ${submetrics.rows.length} submetrics to process\n`);

    // Step 2: Process each submetric and upsert definitions
    const definitionMap = new Map<string, string>(); // key: workspaceId|metricKey|submetricKey -> definitionId
    let processedCount = 0;
    let createdCount = 0;
    let updatedCount = 0;

    for (const row of submetrics.rows) {
      const {
        submetric_id,
        submetric_label,
        submetric_category,
        unit,
        preferredTrend,
        metric_name,
        workspaceId,
      } = row as any;

      // Derive keys (include category)
      const metricKey = normalizeKey(metric_name);
      const categoryPrefix = submetric_category
        ? normalizeKey(submetric_category)
        : null;
      const labelKey = deriveSubmetricKey(submetric_label);
      const submetricKey = categoryPrefix
        ? `${categoryPrefix}-${labelKey}`
        : labelKey;
      const compositeKey = `${workspaceId}|${metricKey}|${submetricKey}`;

      // Check if we've already created this definition in this run
      let definitionId = definitionMap.get(compositeKey);

      if (!definitionId) {
        // Upsert definition
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
            ${submetricKey},
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

        definitionId = (result.rows[0] as any).id as string;
        definitionMap.set(compositeKey, definitionId);

        // Check if this was an insert or update
        const checkResult = await db.execute(sql`
          SELECT COUNT(*) as count FROM submetric_definition
          WHERE id = ${definitionId} AND "createdAt" = "updatedAt"
        `);

        if ((checkResult.rows[0] as any).count > 0) {
          createdCount++;
        } else {
          updatedCount++;
        }
      }

      // Update submetric with definitionId
      await db.execute(sql`
        UPDATE submetric
        SET "definitionId" = ${definitionId}
        WHERE id = ${submetric_id}
      `);

      processedCount++;

      if (processedCount % 10 === 0) {
        console.log(
          `Processed ${processedCount}/${submetrics.rows.length} submetrics...`,
        );
      }
    }

    console.log(`\n✓ Processed all ${processedCount} submetrics`);
    console.log(`  - Created ${createdCount} new definitions`);
    console.log(`  - Updated ${updatedCount} existing definitions`);

    // Step 3: Verify all submetrics have definitionId
    console.log("\nVerifying all submetrics have definitionId...");
    const nullCheck = await db.execute(sql`
      SELECT COUNT(*) as count FROM submetric WHERE "definitionId" IS NULL
    `);

    const nullCount = (nullCheck.rows[0] as any).count;
    if (nullCount > 0) {
      throw new Error(`${nullCount} submetrics still have NULL definitionId!`);
    }

    console.log("✓ All submetrics have definitionId");

    // Step 4: Set NOT NULL constraint
    console.log("\nSetting NOT NULL constraint on submetric.definitionId...");
    await db.execute(sql`
      ALTER TABLE submetric
      ALTER COLUMN "definitionId" SET NOT NULL
    `);

    console.log("✓ NOT NULL constraint applied");

    // Step 5: Print summary
    console.log("\n=== Backfill Summary ===");
    console.log(`Total submetrics processed: ${processedCount}`);
    console.log(`Unique definitions created/updated: ${definitionMap.size}`);
    console.log(`New definitions: ${createdCount}`);
    console.log(`Updated definitions: ${updatedCount}`);
    console.log("\n✓ Backfill completed successfully!");
  } catch (error) {
    console.error("\n✗ Error during backfill:", error);
    throw error;
  }
}

backfillDefinitions()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
