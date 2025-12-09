import { neon } from "@neondatabase/serverless";
import { config } from "dotenv";

// Load environment variables
config();

async function resetDatabase() {
  const DATABASE_URL = process.env.DATABASE_URL;

  if (!DATABASE_URL) {
    console.error("❌ DATABASE_URL not found in environment");
    process.exit(1);
  }

  console.log("🗑️  Resetting database...\n");

  try {
    const sql = neon(DATABASE_URL);

    console.log("Dropping all tables...\n");

    // Drop tables in correct order (respecting foreign key constraints)
    // Most dependent tables first, then work up to base tables

    // Auth tables (depend on user)
    await sql`DROP TABLE IF EXISTS "account" CASCADE`;
    console.log("  ✓ Dropped account");

    await sql`DROP TABLE IF EXISTS "session" CASCADE`;
    console.log("  ✓ Dropped session");

    // Follow-up tables (depend on follow_up, user)
    await sql`DROP TABLE IF EXISTS "follow_up_assignee" CASCADE`;
    console.log("  ✓ Dropped follow_up_assignee");

    // Follow-up (depends on workspace, slide, submetric_definition, comment_thread, user)
    await sql`DROP TABLE IF EXISTS "follow_up" CASCADE`;
    console.log("  ✓ Dropped follow_up");

    // Comment tables (depend on comment_thread, user)
    await sql`DROP TABLE IF EXISTS "comment" CASCADE`;
    console.log("  ✓ Dropped comment");

    // Comment thread (depends on workspace, submetric_definition, slide, user)
    await sql`DROP TABLE IF EXISTS "comment_thread" CASCADE`;
    console.log("  ✓ Dropped comment_thread");

    // Submetric (depends on metric, submetric_definition)
    await sql`DROP TABLE IF EXISTS "submetric" CASCADE`;
    console.log("  ✓ Dropped submetric");

    // Submetric definition (depends on workspace)
    await sql`DROP TABLE IF EXISTS "submetric_definition" CASCADE`;
    console.log("  ✓ Dropped submetric_definition");

    // Metric (depends on slide, metric_definition)
    await sql`DROP TABLE IF EXISTS "metric" CASCADE`;
    console.log("  ✓ Dropped metric");

    // Metric definition (depends on workspace)
    await sql`DROP TABLE IF EXISTS "metric_definition" CASCADE`;
    console.log("  ✓ Dropped metric_definition");

    // Slide (depends on workspace)
    await sql`DROP TABLE IF EXISTS "slide" CASCADE`;
    console.log("  ✓ Dropped slide");

    // Base tables (no dependencies)
    await sql`DROP TABLE IF EXISTS "workspace" CASCADE`;
    console.log("  ✓ Dropped workspace");

    await sql`DROP TABLE IF EXISTS "user" CASCADE`;
    console.log("  ✓ Dropped user");

    // Drop enums (must be after tables that use them)
    await sql`DROP TYPE IF EXISTS "time_bucket" CASCADE`;
    console.log("  ✓ Dropped time_bucket enum");

    await sql`DROP TYPE IF EXISTS "thread_scope" CASCADE`;
    console.log("  ✓ Dropped thread_scope enum");

    await sql`DROP TYPE IF EXISTS "follow_up_status" CASCADE`;
    console.log("  ✓ Dropped follow_up_status enum");

    await sql`DROP TYPE IF EXISTS "follow_up_priority" CASCADE`;
    console.log("  ✓ Dropped follow_up_priority enum");

    await sql`DROP TYPE IF EXISTS "traffic_light_color" CASCADE`;
    console.log("  ✓ Dropped traffic_light_color enum");

    // Drop migrations tracking table
    await sql`DROP TABLE IF EXISTS "__drizzle_migrations" CASCADE`;
    console.log("  ✓ Dropped migrations table");

    console.log("\n✅ Database reset complete!");
    console.log("\n📝 Next steps:");
    console.log(
      "   1. Run: npm run db:push or npm run db:migrate to apply the schema",
    );
    console.log("   2. Your database is now clean and ready!");
  } catch (error) {
    console.error("\n❌ Failed to reset database:", error);
    process.exit(1);
  }
}

resetDatabase();
