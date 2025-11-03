import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import {
  getWorkspaceById,
  updateWorkspace,
  deleteWorkspace,
} from "@/lib/action/workspace";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ workspaceId: string }> }
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
        { status: 401 }
      );
    }

    const { workspaceId } = await params;
    const workspace = await getWorkspaceById(workspaceId);

    if (!workspace) {
      return NextResponse.json(
        { error: "Workspace not found" },
        { status: 404 }
      );
    }

    // Check if workspace is public or user has access
    // Since there's no userId field in workspace, we allow access to public workspaces
    if (workspace.isPublic === false) {
      // Private workspaces should not be accessible without proper authorization
      // In a full implementation, you'd check workspace membership here
      return NextResponse.json(
        { error: "Access denied - workspace is private" },
        { status: 403 }
      );
    }

    return NextResponse.json({ workspace });
  } catch (error) {
    console.error("Error fetching workspace:", error);
    return NextResponse.json(
      { error: "Failed to fetch workspace" },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ workspaceId: string }> }
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
        { status: 401 }
      );
    }

    const { workspaceId } = await params;

    // Check if workspace exists and user has access
    const existingWorkspace = await getWorkspaceById(workspaceId);

    if (!existingWorkspace) {
      return NextResponse.json(
        { error: "Workspace not found" },
        { status: 404 }
      );
    }

    // Check if user has permission to modify workspace
    // For private workspaces, only owners should be able to modify
    if (existingWorkspace.isPublic === false) {
      return NextResponse.json(
        { error: "Access denied - cannot modify private workspace" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const workspace = await updateWorkspace(workspaceId, body);

    return NextResponse.json({ workspace });
  } catch (error) {
    console.error("Error updating workspace:", error);
    return NextResponse.json(
      { error: "Failed to update workspace" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ workspaceId: string }> }
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
        { status: 401 }
      );
    }

    const { workspaceId } = await params;

    // Check if workspace exists and user has access
    const existingWorkspace = await getWorkspaceById(workspaceId);

    if (!existingWorkspace) {
      return NextResponse.json(
        { error: "Workspace not found" },
        { status: 404 }
      );
    }

    // Check if user has permission to delete workspace
    // For private workspaces, only owners should be able to delete
    if (existingWorkspace.isPublic === false) {
      return NextResponse.json(
        { error: "Access denied - cannot delete private workspace" },
        { status: 403 }
      );
    }

    await deleteWorkspace(workspaceId);

    return NextResponse.json({
      message: "Workspace deleted successfully",
      workspaceId,
    });
  } catch (error) {
    console.error("Error deleting workspace:", error);
    return NextResponse.json(
      { error: "Failed to delete workspace" },
      { status: 500 }
    );
  }
}
