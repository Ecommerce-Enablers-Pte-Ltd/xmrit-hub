import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { getAuthSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { metricDefinitions } from "@/lib/db/schema";
import { updateMetricDefinitionSchema } from "@/lib/validations/metric";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ definitionId: string }> },
) {
  try {
    const session = await getAuthSession();

    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!session.user.id) {
      console.error("Session missing user ID:", session);
      return NextResponse.json(
        { error: "Invalid session - user ID missing" },
        { status: 401 },
      );
    }

    const { definitionId } = await params;

    // Check if the metric definition exists
    const existingDefinition = await db.query.metricDefinitions.findFirst({
      where: eq(metricDefinitions.id, definitionId),
      with: {
        workspace: true,
      },
    });

    if (!existingDefinition) {
      return NextResponse.json(
        { error: "Metric definition not found" },
        { status: 404 },
      );
    }

    // Check if the workspace is public or user has access
    if (
      existingDefinition.workspace &&
      (existingDefinition.workspace as any).isPublic === false
    ) {
      return NextResponse.json(
        {
          error:
            "Access denied - cannot modify metric definition from private workspace",
        },
        { status: 403 },
      );
    }

    const body = await request.json();

    // Validate request body with Zod
    const validatedData = updateMetricDefinitionSchema.parse(body);

    // Update the metric definition
    const [updatedDefinition] = await db
      .update(metricDefinitions)
      .set({
        ...validatedData,
        updatedAt: new Date(),
      })
      .where(eq(metricDefinitions.id, definitionId))
      .returning();

    return NextResponse.json({ definition: updatedDefinition });
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

    console.error("Error updating metric definition:", error);
    return NextResponse.json(
      { error: "Failed to update metric definition" },
      { status: 500 },
    );
  }
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ definitionId: string }> },
) {
  try {
    const session = await getAuthSession();

    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!session.user.id) {
      console.error("Session missing user ID:", session);
      return NextResponse.json(
        { error: "Invalid session - user ID missing" },
        { status: 401 },
      );
    }

    const { definitionId } = await params;

    const definition = await db.query.metricDefinitions.findFirst({
      where: eq(metricDefinitions.id, definitionId),
      with: {
        workspace: true,
      },
    });

    if (!definition) {
      return NextResponse.json(
        { error: "Metric definition not found" },
        { status: 404 },
      );
    }

    // Check if the workspace is public or user has access
    if (
      definition.workspace &&
      (definition.workspace as any).isPublic === false
    ) {
      return NextResponse.json(
        {
          error:
            "Access denied - metric definition belongs to a private workspace",
        },
        { status: 403 },
      );
    }

    return NextResponse.json({ definition });
  } catch (error) {
    console.error("Error fetching metric definition:", error);
    return NextResponse.json(
      { error: "Failed to fetch metric definition" },
      { status: 500 },
    );
  }
}
