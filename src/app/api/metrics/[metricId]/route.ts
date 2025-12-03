import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { getAuthSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { metrics } from "@/lib/db/schema";
import { metricIdSchema, updateMetricSchema } from "@/lib/validations/metric";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ metricId: string }> },
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

    const { metricId } = await params;

    // Validate metricId parameter
    const validatedParams = metricIdSchema.parse({ metricId });

    // Check if the metric exists and get its slide/workspace
    const existingMetric = await db.query.metrics.findFirst({
      where: eq(metrics.id, validatedParams.metricId),
      with: {
        slide: {
          with: {
            workspace: true,
          },
        },
      },
    });

    if (!existingMetric) {
      return NextResponse.json({ error: "Metric not found" }, { status: 404 });
    }

    // Check if the workspace is public or user has access
    if (
      existingMetric.slide?.workspace &&
      (existingMetric.slide.workspace as any).isPublic === false
    ) {
      // Private workspace - should check user ownership before allowing modification
      return NextResponse.json(
        {
          error: "Access denied - cannot modify metric from private workspace",
        },
        { status: 403 },
      );
    }

    const body = await request.json();

    // Validate request body with Zod
    const validatedData = updateMetricSchema.parse(body);

    // Update the metric
    const [updatedMetric] = await db
      .update(metrics)
      .set({
        ...validatedData,
        updatedAt: new Date(),
      })
      .where(eq(metrics.id, validatedParams.metricId))
      .returning();

    return NextResponse.json({ metric: updatedMetric });
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

    console.error("Error updating metric:", error);
    return NextResponse.json(
      { error: "Failed to update metric" },
      { status: 500 },
    );
  }
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ metricId: string }> },
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

    const { metricId } = await params;

    const metric = await db.query.metrics.findFirst({
      where: eq(metrics.id, metricId),
      with: {
        slide: {
          with: {
            workspace: true,
          },
        },
        submetrics: {
          with: {
            definition: {
              columns: {
                id: true,
                category: true,
                metricName: true,
                xaxis: true,
                yaxis: true,
                unit: true,
                preferredTrend: true,
              },
            },
          },
        },
      },
    });

    if (!metric) {
      return NextResponse.json({ error: "Metric not found" }, { status: 404 });
    }

    // Check if the workspace is public or user has access
    if (
      metric.slide?.workspace &&
      (metric.slide.workspace as any).isPublic === false
    ) {
      return NextResponse.json(
        { error: "Access denied - metric belongs to a private workspace" },
        { status: 403 },
      );
    }

    return NextResponse.json({ metric });
  } catch (error) {
    console.error("Error fetching metric:", error);
    return NextResponse.json(
      { error: "Failed to fetch metric" },
      { status: 500 },
    );
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ metricId: string }> },
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

    const { metricId } = await params;

    // Check if the metric exists and get its slide/workspace
    const existingMetric = await db.query.metrics.findFirst({
      where: eq(metrics.id, metricId),
      with: {
        slide: {
          with: {
            workspace: true,
          },
        },
      },
    });

    if (!existingMetric) {
      return NextResponse.json({ error: "Metric not found" }, { status: 404 });
    }

    // Check if the workspace is public or user has access
    if (
      existingMetric.slide?.workspace &&
      (existingMetric.slide.workspace as any).isPublic === false
    ) {
      return NextResponse.json(
        {
          error: "Access denied - cannot delete metric from private workspace",
        },
        { status: 403 },
      );
    }

    // Delete the metric - this will cascade to submetrics
    await db.delete(metrics).where(eq(metrics.id, metricId));

    return NextResponse.json({
      message: "Metric deleted successfully",
      metricId,
    });
  } catch (error) {
    console.error("Error deleting metric:", error);
    return NextResponse.json(
      { error: "Failed to delete metric" },
      { status: 500 },
    );
  }
}
