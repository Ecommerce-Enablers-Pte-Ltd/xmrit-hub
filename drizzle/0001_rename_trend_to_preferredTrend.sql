-- Migration: Rename trend column to preferredTrend in submetric table
ALTER TABLE "submetric" RENAME COLUMN "trend" TO "preferredTrend";

