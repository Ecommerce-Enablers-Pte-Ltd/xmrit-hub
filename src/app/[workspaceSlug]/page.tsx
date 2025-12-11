import { eq, sql } from "drizzle-orm";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { workspaces } from "@/lib/db/schema";
import { normalizeSlug } from "@/lib/utils";
import { WorkspaceClient } from "./components/workspace-client";

interface WorkspacePageProps {
  params: Promise<{
    workspaceSlug: string;
  }>;
  searchParams: Promise<{
    page?: string;
    limit?: string;
  }>;
}

// Enable ISR caching for workspace pages
export const revalidate = 60;

// Lightweight workspace data for listing page
export interface SlideListItem {
  id: string;
  title: string;
  slideNumber: number;
  description: string | null;
  workspaceId: string;
  slideDate: string | null;
  createdAt: Date;
  updatedAt: Date;
  metricsCount: number;
  submetricsCount: number;
}

export interface WorkspaceListData {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  settings: unknown;
  isArchived: boolean | null;
  isPublic: boolean | null;
  createdAt: Date;
  updatedAt: Date;
  slides: SlideListItem[];
  totalSlides: number;
}

// Ultra-optimized: SINGLE raw SQL query with LEFT JOINs and aggregations
// Fetches everything in one database roundtrip
// Now looks up by workspace slug instead of ID (case-insensitive since slugs are stored lowercase)
async function getWorkspaceDataBySlug(
  workspaceSlug: string,
  page: number = 1,
  limit: number = 20,
): Promise<WorkspaceListData | null> {
  const offset = (page - 1) * limit;
  // Normalize slug using centralized helper
  const normalizedSlug = normalizeSlug(workspaceSlug);

  // Single query: workspace + paginated slides + counts + total
  // Uses window function for total count to avoid extra query
  const result = await db.execute<{
    // Workspace fields
    ws_id: string;
    ws_name: string;
    ws_slug: string;
    ws_description: string | null;
    ws_settings: unknown;
    ws_is_archived: boolean | null;
    ws_is_public: boolean | null;
    ws_created_at: Date;
    ws_updated_at: Date;
    // Slide fields (null if no slides)
    slide_id: string | null;
    slide_title: string | null;
    slide_number: number | null;
    slide_description: string | null;
    slide_date: string | null;
    slide_created_at: Date | null;
    slide_updated_at: Date | null;
    // Aggregated counts
    metrics_count: number;
    submetrics_count: number;
    // Total for pagination
    total_slides: number;
  }>(sql`
    WITH workspace_lookup AS (
      SELECT id, name, slug, description, settings, "isArchived", "isPublic", "createdAt", "updatedAt"
      FROM workspace
      WHERE slug = ${normalizedSlug}
      LIMIT 1
    ),
    slide_counts AS (
      SELECT
        s.id,
        s.title,
        s."slideNumber",
        s.description,
        s."slideDate",
        s."createdAt",
        s."updatedAt",
        COALESCE(mc.metrics_count, 0)::int AS metrics_count,
        COALESCE(sc.submetrics_count, 0)::int AS submetrics_count,
        COUNT(*) OVER() AS total_slides
      FROM slide s
      LEFT JOIN LATERAL (
        SELECT COUNT(*)::int AS metrics_count
        FROM metric m
        WHERE m."slideId" = s.id
      ) mc ON true
      LEFT JOIN LATERAL (
        SELECT COUNT(*)::int AS submetrics_count
        FROM submetric sm
        INNER JOIN metric m ON sm."metricId" = m.id
        WHERE m."slideId" = s.id
      ) sc ON true
      WHERE s."workspaceId" = (SELECT id FROM workspace_lookup)
      ORDER BY s."createdAt" DESC
      LIMIT ${limit} OFFSET ${offset}
    )
    SELECT
      w.id AS ws_id,
      w.name AS ws_name,
      w.slug AS ws_slug,
      w.description AS ws_description,
      w.settings AS ws_settings,
      w."isArchived" AS ws_is_archived,
      w."isPublic" AS ws_is_public,
      w."createdAt" AS ws_created_at,
      w."updatedAt" AS ws_updated_at,
      sc.id AS slide_id,
      sc.title AS slide_title,
      sc."slideNumber" AS slide_number,
      sc.description AS slide_description,
      sc."slideDate" AS slide_date,
      sc."createdAt" AS slide_created_at,
      sc."updatedAt" AS slide_updated_at,
      COALESCE(sc.metrics_count, 0)::int AS metrics_count,
      COALESCE(sc.submetrics_count, 0)::int AS submetrics_count,
      COALESCE(sc.total_slides, (
        SELECT COUNT(*)::int FROM slide WHERE "workspaceId" = (SELECT id FROM workspace_lookup)
      ))::int AS total_slides
    FROM workspace_lookup w
    LEFT JOIN slide_counts sc ON true
  `);

  const rows = result.rows;
  if (!rows.length) return null;

  // First row has workspace info
  const firstRow = rows[0];

  const workspace: WorkspaceListData = {
    id: firstRow.ws_id,
    name: firstRow.ws_name,
    slug: firstRow.ws_slug,
    description: firstRow.ws_description,
    settings: firstRow.ws_settings,
    isArchived: firstRow.ws_is_archived,
    isPublic: firstRow.ws_is_public,
    createdAt: firstRow.ws_created_at,
    updatedAt: firstRow.ws_updated_at,
    totalSlides: firstRow.total_slides ?? 0,
    slides: [],
  };

  // Map rows to slides (skip if slide_id is null - means no slides)
  for (const row of rows) {
    if (
      row.slide_id &&
      row.slide_title &&
      row.slide_number &&
      row.slide_created_at &&
      row.slide_updated_at
    ) {
      workspace.slides.push({
        id: row.slide_id,
        title: row.slide_title,
        slideNumber: row.slide_number,
        description: row.slide_description,
        workspaceId: workspace.id,
        slideDate: row.slide_date,
        createdAt: row.slide_created_at,
        updatedAt: row.slide_updated_at,
        metricsCount: row.metrics_count ?? 0,
        submetricsCount: row.submetrics_count ?? 0,
      });
    }
  }

  return workspace;
}

// Metadata generation - lightweight query, no auth needed
export async function generateMetadata({
  params,
}: WorkspacePageProps): Promise<Metadata> {
  const { workspaceSlug } = await params;

  // Single field select for minimal overhead (case-insensitive lookup)
  const result = await db
    .select({ name: workspaces.name, description: workspaces.description })
    .from(workspaces)
    .where(eq(workspaces.slug, normalizeSlug(workspaceSlug)))
    .limit(1);

  if (!result.length) {
    return {
      title: "Workspace - Xmrit Hub",
      description: "Statistical Process Control and XMR Chart Analysis",
    };
  }

  const title = `${result[0].name} - Xmrit Hub`;
  const description = result[0].description || `Workspace: ${result[0].name}`;

  return {
    title,
    description,
    openGraph: { title, description, type: "website" },
    twitter: { card: "summary", title, description },
  };
}

export default async function WorkspacePage({
  params,
  searchParams,
}: WorkspacePageProps) {
  // URL Normalization is handled by the parent layout (client-side router.replace)
  // Use normalized slug for database queries
  const { workspaceSlug } = await params;
  const normalizedSlug = normalizeSlug(workspaceSlug);

  // Parse params in parallel
  const [{ page: pageStr, limit: limitStr }, session] = await Promise.all([
    searchParams,
    auth(),
  ]);

  // Auth check - redirect if not authenticated (temporary redirect)
  if (!session) {
    redirect("/auth/signin");
  }

  // Parse pagination params with defaults
  const page = Math.max(1, parseInt(pageStr || "1", 10));
  const limit = Math.min(100, Math.max(10, parseInt(limitStr || "20", 10)));

  // Single optimized query for all data (use normalized slug)
  const workspace = await getWorkspaceDataBySlug(normalizedSlug, page, limit);

  if (!workspace) {
    notFound();
  }

  return (
    <WorkspaceClient
      workspace={workspace}
      pagination={{ page, limit, totalSlides: workspace.totalSlides }}
    />
  );
}
