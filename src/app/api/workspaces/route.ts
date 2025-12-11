import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { getAuthSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { workspaces } from "@/lib/db/schema";
import { createWorkspaceSchema } from "@/lib/validations/workspace";

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
        { status: 401 },
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
      { status: 500 },
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
        { status: 401 },
      );
    }

    const body = await request.json();

    // Validate and normalize request body with Zod
    // Note: slug is automatically normalized to lowercase by the schema
    const validatedData = createWorkspaceSchema.parse(body);

    // Check if slug already exists (slug is already normalized by schema)
    const existingWorkspace = await db
      .select({ id: workspaces.id })
      .from(workspaces)
      .where(eq(workspaces.slug, validatedData.slug))
      .limit(1);

    if (existingWorkspace.length > 0) {
      return NextResponse.json(
        {
          error: "Slug already taken",
          code: "SLUG_TAKEN",
          details: [
            {
              field: "slug",
              message:
                "This slug is already in use. Please choose a different one.",
            },
          ],
        },
        { status: 400 },
      );
    }

    const newWorkspace = await db
      .insert(workspaces)
      .values({
        name: validatedData.name,
        slug: validatedData.slug,
        description: validatedData.description,
        settings: validatedData.settings,
        isArchived: validatedData.isArchived,
        isPublic: validatedData.isPublic,
      })
      .returning();

    return NextResponse.json({ workspace: newWorkspace[0] }, { status: 201 });
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

    // Handle unique constraint violation (race condition fallback)
    if (error instanceof Error && error.message.includes("unique constraint")) {
      return NextResponse.json(
        {
          error: "Slug already taken",
          code: "SLUG_TAKEN",
          details: [
            {
              field: "slug",
              message:
                "This slug is already in use. Please choose a different one.",
            },
          ],
        },
        { status: 400 },
      );
    }

    console.error("Error creating workspace:", error);
    return NextResponse.json(
      { error: "Failed to create workspace" },
      { status: 500 },
    );
  }
}
