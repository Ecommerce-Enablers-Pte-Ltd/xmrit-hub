import { desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { getAuthSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { slides, workspaces } from "@/lib/db/schema";
import {
  updateWorkspaceSchema,
  workspaceIdSchema,
} from "@/lib/validations/workspace";

// Cache control headers for workspace data
const CACHE_REVALIDATE = 300; // 5 minutes

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ workspaceId: string }> },
) {
  try {
    const session = await getAuthSession();

    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify user has a valid ID
    if (!session.user.id) {
      console.error("Session missing user ID:", session);
      return NextResponse.json(
        { error: "Invalid session - user ID missing" },
        { status: 401 },
      );
    }

    const { workspaceId } = await params;

    // Get workspace with its slides
    const workspace = await db
      .select()
      .from(workspaces)
      .where(eq(workspaces.id, workspaceId))
      .limit(1);

    if (!workspace.length) {
      return NextResponse.json(
        { error: "Workspace not found" },
        { status: 404 },
      );
    }

    // Check if workspace is public or user has access
    // Since there's no userId field in workspace, we allow access to public workspaces
    if (workspace[0].isPublic === false) {
      // Private workspaces should not be accessible without proper authorization
      // In a full implementation, you'd check workspace membership here
      return NextResponse.json(
        { error: "Access denied - workspace is private" },
        { status: 403 },
      );
    }

    // Get slides for this workspace with optimized metrics loading
    // Exclude heavy dataPoints column for performance
    const workspaceSlides = await db.query.slides.findMany({
      where: eq(slides.workspaceId, workspaceId),
      with: {
        metrics: {
          orderBy: (metrics, { asc }) => [
            asc(metrics.sortOrder),
            asc(metrics.ranking),
          ],
          with: {
            definition: {
              columns: {
                id: true,
                definition: true,
              },
            },
            submetrics: {
              orderBy: (submetrics, { asc }) => [asc(submetrics.createdAt)],
              // Exclude dataPoints to reduce payload size (can be 1-10MB per slide!)
              columns: {
                id: true,
                label: true,
                category: true,
                metricId: true,
                definitionId: true,
                xAxis: true,
                timezone: true,
                preferredTrend: true,
                unit: true,
                aggregationType: true,
                color: true,
                metadata: true,
                createdAt: true,
                updatedAt: true,
                // dataPoints: false - explicitly excluded
              },
            },
          },
        },
      },
      orderBy: [desc(slides.createdAt)],
      limit: 50, // Reduced from 100 to 50 for faster load
    });

    return NextResponse.json(
      {
        workspace: {
          ...workspace[0],
          slides: workspaceSlides,
        },
      },
      {
        headers: {
          "Cache-Control": `private, s-maxage=${CACHE_REVALIDATE}, stale-while-revalidate`,
        },
      },
    );
  } catch (error) {
    console.error("Error fetching workspace:", error);
    return NextResponse.json(
      { error: "Failed to fetch workspace" },
      { status: 500 },
    );
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ workspaceId: string }> },
) {
  try {
    const session = await getAuthSession();

    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify user has a valid ID
    if (!session.user.id) {
      console.error("Session missing user ID:", session);
      return NextResponse.json(
        { error: "Invalid session - user ID missing" },
        { status: 401 },
      );
    }

    const { workspaceId } = await params;

    // Validate workspaceId parameter
    const validatedParams = workspaceIdSchema.parse({ workspaceId });

    // Check if workspace exists and user has access
    const existingWorkspace = await db
      .select()
      .from(workspaces)
      .where(eq(workspaces.id, validatedParams.workspaceId))
      .limit(1);

    if (!existingWorkspace.length) {
      return NextResponse.json(
        { error: "Workspace not found" },
        { status: 404 },
      );
    }

    // Check if user has permission to modify workspace
    // For private workspaces, only owners should be able to modify
    if (existingWorkspace[0].isPublic === false) {
      return NextResponse.json(
        { error: "Access denied - cannot modify private workspace" },
        { status: 403 },
      );
    }

    const body = await request.json();

    // Validate request body with Zod
    const validatedData = updateWorkspaceSchema.parse(body);

    const updatedWorkspace = await db
      .update(workspaces)
      .set({
        ...validatedData,
        updatedAt: new Date(),
      })
      .where(eq(workspaces.id, validatedParams.workspaceId))
      .returning();

    if (!updatedWorkspace.length) {
      throw new Error("Workspace not found");
    }

    return NextResponse.json({ workspace: updatedWorkspace[0] });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        {
          error: "Validation failed",
          details: error.issues.map((e) => ({
            field: e.path.join("."),
            message: e.message,
          })),
        },
        { status: 400 },
      );
    }

    console.error("Error updating workspace:", error);
    return NextResponse.json(
      { error: "Failed to update workspace" },
      { status: 500 },
    );
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ workspaceId: string }> },
) {
  try {
    const session = await getAuthSession();

    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify user has a valid ID
    if (!session.user.id) {
      console.error("Session missing user ID:", session);
      return NextResponse.json(
        { error: "Invalid session - user ID missing" },
        { status: 401 },
      );
    }

    const { workspaceId } = await params;

    // Validate workspaceId parameter
    const validatedParams = workspaceIdSchema.parse({ workspaceId });

    // Check if workspace exists and user has access
    const existingWorkspace = await db
      .select()
      .from(workspaces)
      .where(eq(workspaces.id, validatedParams.workspaceId))
      .limit(1);

    if (!existingWorkspace.length) {
      return NextResponse.json(
        { error: "Workspace not found" },
        { status: 404 },
      );
    }

    // Check if user has permission to delete workspace
    // For private workspaces, only owners should be able to delete
    if (existingWorkspace[0].isPublic === false) {
      return NextResponse.json(
        { error: "Access denied - cannot delete private workspace" },
        { status: 403 },
      );
    }

    // Soft delete by marking as archived
    await db
      .update(workspaces)
      .set({
        isArchived: true,
        updatedAt: new Date(),
      })
      .where(eq(workspaces.id, validatedParams.workspaceId));

    return NextResponse.json({
      message: "Workspace deleted successfully",
      workspaceId: validatedParams.workspaceId,
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        {
          error: "Validation failed",
          details: error.issues.map((e) => ({
            field: e.path.join("."),
            message: e.message,
          })),
        },
        { status: 400 },
      );
    }

    console.error("Error deleting workspace:", error);
    return NextResponse.json(
      { error: "Failed to delete workspace" },
      { status: 500 },
    );
  }
}
