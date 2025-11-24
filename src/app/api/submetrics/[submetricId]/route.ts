import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { submetrics } from "@/lib/db/schema";

const trafficLightColorSchema = z.enum(["green", "yellow", "red"]).nullable();

const updateSubmetricSchema = z.object({
  trafficLightColor: trafficLightColorSchema,
});

/**
 * PATCH /api/submetrics/[submetricId]
 * Update a submetric's traffic light color
 */
export async function PATCH(
  request: Request,
  context: { params: Promise<{ submetricId: string }> },
) {
  try {
    const { submetricId } = await context.params;
    const body = await request.json();

    // Validate the request body
    const validatedData = updateSubmetricSchema.parse(body);

    // Update the submetric
    const [updatedSubmetric] = await db
      .update(submetrics)
      .set({
        trafficLightColor: validatedData.trafficLightColor,
        updatedAt: new Date(),
      })
      .where(eq(submetrics.id, submetricId))
      .returning();

    if (!updatedSubmetric) {
      return NextResponse.json(
        { error: "Submetric not found" },
        { status: 404 },
      );
    }

    return NextResponse.json(updatedSubmetric);
  } catch (error) {
    console.error("Error updating submetric:", error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid request body", details: error.issues },
        { status: 400 },
      );
    }

    return NextResponse.json(
      { error: "Failed to update submetric" },
      { status: 500 },
    );
  }
}
