import "dotenv/config";
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";
import * as fs from "fs";
import * as path from "path";

async function applyMigration() {
  try {
    console.log("Applying comment system migration...");

    // Read the migration file
    const migrationPath = path.join(process.cwd(), "drizzle", "0003_pink_marvex.sql");
    const migrationSQL = fs.readFileSync(migrationPath, "utf-8");

    // Split by statement-breakpoint and execute each statement
    const statements = migrationSQL
      .split("--> statement-breakpoint")
      .map(s => s.trim())
      .filter(s => s.length > 0);

    for (const statement of statements) {
      console.log(`Executing: ${statement.substring(0, 80)}...`);
      await db.execute(sql.raw(statement));
    }

    console.log("✓ Migration applied successfully!");
  } catch (error) {
    console.error("Error applying migration:", error);
    throw error;
  }
}

applyMigration()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

