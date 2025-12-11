import { desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { slides, workspaces } from "@/lib/db/schema";

// Aggressive caching for sidebar slide list (rarely changes)
const CACHE_REVALIDATE = 600; // 10 minutes

/**
 * Lightweight endpoint for sidebar slide list
 * Only returns slide metadata without metrics/submetrics
 * This reduces payload from ~10MB to ~10KB
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ workspaceId: string }> },
) {
  try {
    const session = await getAuthSession();

    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!session.user.id) {
      return NextResponse.json(
        { error: "Invalid session - user ID missing" },
        { status: 401 },
      );
    }

    const { workspaceId } = await params;

    // Verify workspace exists and user has access
    const workspace = await db
      .select({ id: workspaces.id, isPublic: workspaces.isPublic })
      .from(workspaces)
      .where(eq(workspaces.id, workspaceId))
      .limit(1);

    if (!workspace.length) {
      return NextResponse.json(
        { error: "Workspace not found" },
        { status: 404 },
      );
    }

    if (workspace[0].isPublic === false) {
      return NextResponse.json(
        { error: "Access denied - workspace is private" },
        { status: 403 },
      );
    }

    // Get only slide metadata - NO metrics or submetrics
    const slidesList = await db
      .select({
        id: slides.id,
        title: slides.title,
        slideNumber: slides.slideNumber,
        description: slides.description,
        slideDate: slides.slideDate,
        workspaceId: slides.workspaceId,
        createdAt: slides.createdAt,
        updatedAt: slides.updatedAt,
      })
      .from(slides)
      .where(eq(slides.workspaceId, workspaceId))
      .orderBy(desc(slides.createdAt))
      .limit(100); // Keep limit higher since we're only loading metadata

    return NextResponse.json(
      { slides: slidesList },
      {
        headers: {
          "Cache-Control": `private, s-maxage=${CACHE_REVALIDATE}, stale-while-revalidate`,
        },
      },
    );
  } catch (error) {
    console.error("Error fetching slides list:", error);
    return NextResponse.json(
      { error: "Failed to fetch slides list" },
      { status: 500 },
    );
  }
}
