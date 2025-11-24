import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error(
    "DATABASE_URL environment variable is not set. Please check your .env.local file.",
  );
}

// Configure Neon connection with optimizations
// Neon serverless driver uses HTTP, which is stateless and automatically pooled
// These options optimize for production performance
const sql = neon(databaseUrl, {
  // Enable fetch cache for better performance (default: true)
  fetchOptions: {
    // Use high priority for database queries
    priority: "high",
  },
  // Fetch endpoint will use connection pooling automatically
  // No manual pool configuration needed for Neon serverless
});

export const db = drizzle(sql, {
  schema,
  // Enable logger in development only
  // logger: process.env.NODE_ENV === "development",
});
