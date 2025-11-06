import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { workspaces } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function GET() {
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

    const allWorkspaces = await db
      .select()
      .from(workspaces)
      .where(eq(workspaces.isArchived, false))
      .orderBy(workspaces.updatedAt);

    return NextResponse.json({ workspaces: allWorkspaces });
  } catch (error) {
    console.error("Error fetching workspaces:", error);
    return NextResponse.json(
      { error: "Failed to fetch workspaces" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
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

    const body = await request.json();

    const newWorkspace = await db
      .insert(workspaces)
      .values({
        name: body.name || "Untitled Workspace",
        description: body.description,
        settings: body.settings,
        isArchived: body.isArchived || false,
        isPublic: body.isPublic ?? true,
      })
      .returning();

    return NextResponse.json({ workspace: newWorkspace[0] }, { status: 201 });
  } catch (error) {
    console.error("Error creating workspace:", error);
    return NextResponse.json(
      { error: "Failed to create workspace" },
      { status: 500 }
    );
  }
}
