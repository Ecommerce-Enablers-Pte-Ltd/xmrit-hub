import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { followUpAssignees, followUps } from "@/lib/db/schema";
import { updateFollowUpSchema } from "@/lib/validations/follow-up";

// GET /api/follow-ups/[followUpId] - Get single follow-up
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ followUpId: string }> },
) {
  try {
    const session = await getAuthSession();

    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { followUpId } = await params;

    // Get follow-up with related data
    const followUp = await db.query.followUps.findFirst({
      where: (followUps, { eq }) => eq(followUps.id, followUpId),
      with: {
        assignee: true,
        assignees: {
          with: {
            user: true,
          },
        },
        createdByUser: true,
        slide: true,
        resolvedAtSlide: true,
        submetricDefinition: true,
      },
    });

    if (!followUp) {
      return NextResponse.json(
        { error: "Follow-up not found" },
        { status: 404 },
      );
    }

    return NextResponse.json({ followUp }, { status: 200 });
  } catch (error) {
    console.error("Error fetching follow-up:", error);
    return NextResponse.json(
      { error: "Failed to fetch follow-up" },
      { status: 500 },
    );
  }
}

// PUT /api/follow-ups/[followUpId] - Update follow-up
// PATCH /api/follow-ups/[followUpId] - Partial update follow-up
async function updateFollowUp(
  request: Request,
  { params }: { params: Promise<{ followUpId: string }> },
) {
  try {
    const session = await getAuthSession();

    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { followUpId } = await params;

    // Check if follow-up exists
    const existingFollowUp = await db
      .select()
      .from(followUps)
      .where(eq(followUps.id, followUpId))
      .limit(1);

    if (!existingFollowUp.length) {
      return NextResponse.json(
        { error: "Follow-up not found" },
        { status: 404 },
      );
    }

    const body = await request.json();

    // Validate request body
    const validationResult = updateFollowUpSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: "Invalid request data",
          details: validationResult.error.issues,
        },
        { status: 400 },
      );
    }

    const validatedData = validationResult.data;

    // Prepare update values
    const updateValues: Record<string, any> = {
      updatedAt: new Date(),
    };

    if (validatedData.title !== undefined) {
      updateValues.title = validatedData.title;
    }
    if (validatedData.description !== undefined) {
      updateValues.description = validatedData.description ?? null;
    }
    if (validatedData.slideId !== undefined) {
      updateValues.slideId = validatedData.slideId ?? null;
    }
    if (validatedData.submetricDefinitionId !== undefined) {
      updateValues.submetricDefinitionId =
        validatedData.submetricDefinitionId ?? null;
    }
    if (validatedData.threadId !== undefined) {
      updateValues.threadId = validatedData.threadId ?? null;
    }
    if (validatedData.resolvedAtSlideId !== undefined) {
      updateValues.resolvedAtSlideId = validatedData.resolvedAtSlideId ?? null;
    }
    if (validatedData.status !== undefined) {
      updateValues.status = validatedData.status;
      // Auto-set completedAt when status changes to done
      if (validatedData.status === "done" && !existingFollowUp[0].completedAt) {
        updateValues.completedAt = new Date();
        // Auto-set resolvedAtSlideId when status changes to done (if slideId provided and not already set)
        if (
          validatedData.slideId &&
          updateValues.resolvedAtSlideId === undefined
        ) {
          updateValues.resolvedAtSlideId = validatedData.slideId;
        }
      } else if (validatedData.status !== "done" && validatedData.status !== "cancelled") {
        updateValues.completedAt = null;
        // Clear resolvedAtSlideId when status changes from done/cancelled to another status
        // (backlog, todo, in_progress)
        if (
          (existingFollowUp[0].status === "done" || existingFollowUp[0].status === "cancelled") &&
          updateValues.resolvedAtSlideId === undefined
        ) {
          updateValues.resolvedAtSlideId = null;
        }
      }
    }
    if (validatedData.priority !== undefined) {
      updateValues.priority = validatedData.priority;
    }
    if (validatedData.dueDate !== undefined) {
      updateValues.dueDate = validatedData.dueDate ?? null;
    }

    // Handle assignee updates
    if (validatedData.assigneeIds !== undefined) {
      // Delete existing assignees
      await db
        .delete(followUpAssignees)
        .where(eq(followUpAssignees.followUpId, followUpId));

      // Add new assignees
      if (validatedData.assigneeIds && validatedData.assigneeIds.length > 0) {
        await db.insert(followUpAssignees).values(
          validatedData.assigneeIds.map((userId) => ({
            followUpId,
            userId,
          })),
        );
      }
    }

    // Update the follow-up
    await db
      .update(followUps)
      .set(updateValues)
      .where(eq(followUps.id, followUpId));

    // Fetch updated follow-up with related data
    const followUp = await db.query.followUps.findFirst({
      where: (followUps, { eq }) => eq(followUps.id, followUpId),
      with: {
        assignee: true,
        assignees: {
          with: {
            user: true,
          },
        },
        createdByUser: true,
        slide: true,
        resolvedAtSlide: true,
        submetricDefinition: true,
      },
    });

    return NextResponse.json({ followUp }, { status: 200 });
  } catch (error) {
    console.error("Error updating follow-up:", error);
    return NextResponse.json(
      { error: "Failed to update follow-up" },
      { status: 500 },
    );
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ followUpId: string }> },
) {
  return updateFollowUp(request, { params });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ followUpId: string }> },
) {
  return updateFollowUp(request, { params });
}

// DELETE /api/follow-ups/[followUpId] - Delete follow-up
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ followUpId: string }> },
) {
  try {
    const session = await getAuthSession();

    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { followUpId } = await params;

    // Check if follow-up exists
    const existingFollowUp = await db
      .select()
      .from(followUps)
      .where(eq(followUps.id, followUpId))
      .limit(1);

    if (!existingFollowUp.length) {
      return NextResponse.json(
        { error: "Follow-up not found" },
        { status: 404 },
      );
    }

    // Delete the follow-up
    await db.delete(followUps).where(eq(followUps.id, followUpId));

    return NextResponse.json(
      { message: "Follow-up deleted successfully" },
      { status: 200 },
    );
  } catch (error) {
    console.error("Error deleting follow-up:", error);
    return NextResponse.json(
      { error: "Failed to delete follow-up" },
      { status: 500 },
    );
  }
}
