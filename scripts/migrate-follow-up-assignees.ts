/**
 * Migration Script: Follow-up Assignees
 *
 * This script migrates the follow-up assignees from the old single assigneeId
 * column to the new followUpAssignees junction table.
 *
 * Changes:
 * 1. Creates followUpAssignees junction table (if not exists via schema push)
 * 2. Migrates existing assigneeId values to the junction table
 * 3. Adds submetricDefinitionId column (via schema push)
 *
 * Usage:
 *   npx tsx scripts/migrate-follow-up-assignees.ts
 */

import { existsSync } from "node:fs";
import { join } from "node:path";
import { config } from "dotenv";

async function main() {
  // Load environment variables from .env.local or .env BEFORE importing db
  const envLocalPath = join(process.cwd(), ".env.local");
  const envPath = join(process.cwd(), ".env");

  if (existsSync(envLocalPath)) {
    config({ path: envLocalPath });
    console.log("✓ Loaded environment variables from .env.local\n");
  } else if (existsSync(envPath)) {
    config({ path: envPath });
    console.log("✓ Loaded environment variables from .env\n");
  } else {
    config(); // Try default .env
    console.log("✓ Loaded environment variables\n");
  }

  // Dynamically import db modules after env vars are loaded
  const { db } = await import("@/lib/db");
  const { followUps, followUpAssignees } = await import("@/lib/db/schema");
  const { isNotNull } = await import("drizzle-orm");

  console.log("Starting follow-up assignees migration...\n");

  try {
    // Step 1: Find all follow-ups with existing assigneeId
    console.log("Fetching follow-ups with assigned users...");
    const followUpsWithAssignees = await db
      .select({
        id: followUps.id,
        assigneeId: followUps.assigneeId,
      })
      .from(followUps)
      .where(isNotNull(followUps.assigneeId));

    console.log(
      `Found ${followUpsWithAssignees.length} follow-ups with assignees\n`,
    );

    if (followUpsWithAssignees.length === 0) {
      console.log(
        "No follow-ups with assignees to migrate. Migration complete!",
      );
      return;
    }

    // Step 2: Check if any of these already exist in the junction table
    console.log("Checking for existing assignee relationships...");
    const existingAssignees = await db
      .select({
        followUpId: followUpAssignees.followUpId,
        userId: followUpAssignees.userId,
      })
      .from(followUpAssignees);

    const existingKeys = new Set(
      existingAssignees.map((a) => `${a.followUpId}:${a.userId}`),
    );

    console.log(
      `Found ${existingAssignees.length} existing assignee relationships\n`,
    );

    // Step 3: Migrate assignees to the junction table
    console.log("Migrating assignees to junction table...");
    let migratedCount = 0;
    let skippedCount = 0;

    for (const followUp of followUpsWithAssignees) {
      if (!followUp.assigneeId) continue;

      const key = `${followUp.id}:${followUp.assigneeId}`;

      // Skip if already exists
      if (existingKeys.has(key)) {
        skippedCount++;
        continue;
      }

      try {
        await db.insert(followUpAssignees).values({
          followUpId: followUp.id,
          userId: followUp.assigneeId,
        });
        migratedCount++;
      } catch (error) {
        console.error(`Error migrating follow-up ${followUp.id}:`, error);
      }
    }

    console.log(`\nMigration Summary:`);
    console.log(
      `  - Total follow-ups with assignees: ${followUpsWithAssignees.length}`,
    );
    console.log(`  - Migrated: ${migratedCount}`);
    console.log(`  - Skipped (already exists): ${skippedCount}`);
    console.log(`\nMigration completed successfully!`);
    console.log(
      `\nNote: The assigneeId column is kept for backward compatibility.`,
    );
    console.log(`You can safely set it to NULL in future updates if needed.`);
  } catch (error) {
    console.error("\nMigration failed:", error);
    throw error;
  }
}

// Run the migration
main()
  .then(() => {
    console.log("\n✅ Migration script completed");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ Migration script failed:", error);
    process.exit(1);
  });
