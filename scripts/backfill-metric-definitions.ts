/**
 * Backfill Metric Definitions
 *
 * This script creates metricDefinition entries for all existing metrics
 * and links them via definitionId.
 *
 * Usage: npx tsx scripts/backfill-metric-definitions.ts
 */

import { neon } from "@neondatabase/serverless";
import { config } from "dotenv";
import { eq, isNull } from "drizzle-orm";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "../src/lib/db/schema";

// Load environment variables
config();

// Check for DATABASE_URL
if (!process.env.DATABASE_URL) {
  console.error("❌ ERROR: DATABASE_URL environment variable is not set.");
  console.error("Please check your .env file.");
  process.exit(1);
}

// Create database connection
const sql = neon(process.env.DATABASE_URL);
const db = drizzle(sql, { schema });

// Helper function to normalize metric names into stable keys
function normalizeKey(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function backfillMetricDefinitions() {
  console.log("Starting metric definitions backfill...\n");

  // Find all metrics that don't have a definitionId
  const metricsWithoutDefinition = await db.query.metrics.findMany({
    where: isNull(schema.metrics.definitionId),
    with: {
      slide: {
        columns: {
          workspaceId: true,
        },
      },
    },
  });

  console.log(
    `Found ${metricsWithoutDefinition.length} metrics without definitions\n`,
  );

  if (metricsWithoutDefinition.length === 0) {
    console.log("✅ All metrics already have definitions!");
    return;
  }

  let created = 0;
  let linked = 0;
  let errors = 0;

  for (const metric of metricsWithoutDefinition) {
    try {
      if (!metric.slide?.workspaceId) {
        console.log(`⚠️  Skipping metric ${metric.id} - no workspace found`);
        errors++;
        continue;
      }

      const workspaceId = metric.slide.workspaceId;
      const metricKey = normalizeKey(metric.name);

      // Try to find existing definition
      let definition = await db.query.metricDefinitions.findFirst({
        where: (metricDefinitions, { and, eq }) =>
          and(
            eq(metricDefinitions.workspaceId, workspaceId),
            eq(metricDefinitions.metricKey, metricKey),
          ),
      });

      // Create definition if it doesn't exist
      if (!definition) {
        [definition] = await db
          .insert(schema.metricDefinitions)
          .values({
            workspaceId,
            metricKey,
            definition: null, // Start with null, users can fill it in later
          })
          .returning();
        created++;
        console.log(
          `✨ Created definition for metric "${metric.name}" (key: ${metricKey})`,
        );
      }

      // Link metric to definition
      await db
        .update(schema.metrics)
        .set({
          definitionId: definition.id,
          updatedAt: new Date(),
        })
        .where(eq(schema.metrics.id, metric.id));

      linked++;
    } catch (error) {
      console.error(
        `❌ Error processing metric ${metric.id} (${metric.name}):`,
        error,
      );
      errors++;
    }
  }

  console.log(`\n${"=".repeat(50)}`);
  console.log("Backfill Summary:");
  console.log("=".repeat(50));
  console.log(`✨ Definitions created: ${created}`);
  console.log(`🔗 Metrics linked: ${linked}`);
  console.log(`❌ Errors: ${errors}`);
  console.log("=".repeat(50));

  if (errors === 0) {
    console.log("\n✅ Backfill completed successfully!");
  } else {
    console.log(
      `\n⚠️  Backfill completed with ${errors} error(s). Please review above.`,
    );
  }
}

// Run the backfill
backfillMetricDefinitions()
  .then(() => {
    console.log("\nDone!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("Fatal error during backfill:", error);
    process.exit(1);
  });
