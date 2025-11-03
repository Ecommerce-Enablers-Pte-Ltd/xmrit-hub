import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { getWorkspaceById } from "@/lib/action/workspace";
import { db } from "@/lib/db";
import { slides } from "@/lib/db/schema";

export async function POST(
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
    const workspace = await getWorkspaceById(workspaceId);

    if (!workspace) {
      return NextResponse.json(
        { error: "Workspace not found" },
        { status: 404 }
      );
    }

    // Check if user has permission to create slides in this workspace
    if (workspace.isPublic === false) {
      // Private workspace - should check user ownership
      return NextResponse.json(
        { error: "Access denied - cannot create slide in private workspace" },
        { status: 403 }
      );
    }

    const body = await request.json();

    // Create the slide
    const [newSlide] = await db
      .insert(slides)
      .values({
        title: body.title || "Untitled Slide",
        description: body.description,
        workspaceId,
        slideDate: body.slideDate,
        sortOrder: body.sortOrder ?? 0,
        layout: body.layout,
        isPublished: body.isPublished ?? false,
      })
      .returning();

    // Fetch the created slide with its metrics (empty array initially)
    const slide = await db.query.slides.findFirst({
      where: (slides, { eq }) => eq(slides.id, newSlide.id),
      with: {
        metrics: {
          with: {
            submetrics: true,
          },
        },
      },
    });

    return NextResponse.json({ slide }, { status: 201 });
  } catch (error) {
    console.error("Error creating slide:", error);
    return NextResponse.json(
      { error: "Failed to create slide" },
      { status: 500 }
    );
  }
}
