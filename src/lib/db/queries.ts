/**
 * Centralized database query helpers.
 * Use these helpers to ensure consistent slug normalization across the codebase.
 */

import { eq } from "drizzle-orm";
import { normalizeSlug } from "@/lib/utils";
import { db } from "./index";
import { workspaces } from "./schema";

/**
 * Find a workspace by its slug.
 * Automatically normalizes the slug to lowercase before querying.
 * @param slug - The workspace slug (any case)
 * @returns The workspace or undefined if not found
 */
export async function getWorkspaceBySlug(slug: string) {
  const normalized = normalizeSlug(slug);
  return db.query.workspaces.findFirst({
    where: eq(workspaces.slug, normalized),
  });
}

/**
 * Find a workspace by its slug with all related data.
 * Automatically normalizes the slug to lowercase before querying.
 * @param slug - The workspace slug (any case)
 * @returns The workspace with slides or undefined if not found
 */
export async function getWorkspaceBySlugWithSlides(slug: string) {
  const normalized = normalizeSlug(slug);
  return db.query.workspaces.findFirst({
    where: eq(workspaces.slug, normalized),
    with: {
      slides: {
        orderBy: (slides, { asc }) => [asc(slides.slideNumber)],
      },
    },
  });
}

/**
 * Check if a workspace with the given slug exists.
 * Automatically normalizes the slug to lowercase before querying.
 * @param slug - The workspace slug (any case)
 * @returns true if the workspace exists, false otherwise
 */
export async function workspaceSlugExists(slug: string): Promise<boolean> {
  const normalized = normalizeSlug(slug);
  const result = await db
    .select({ id: workspaces.id })
    .from(workspaces)
    .where(eq(workspaces.slug, normalized))
    .limit(1);
  return result.length > 0;
}
