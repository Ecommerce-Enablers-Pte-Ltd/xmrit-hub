import type { SQL } from "drizzle-orm";
import { and, eq, like, lt, or, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { followUpAssignees, followUps, workspaces } from "@/lib/db/schema";
import {
  createFollowUpSchema,
  followUpQuerySchema,
} from "@/lib/validations/follow-up";

// GET /api/workspaces/[workspaceId]/follow-ups - List follow-ups with pagination and filtering
export async function GET(
  request: Request,
  { params }: { params: Promise<{ workspaceId: string }> },
) {
  try {
    const session = await getAuthSession();

    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { workspaceId } = await params;

    // Check if workspace exists
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

    // Parse and validate query parameters
    const { searchParams } = new URL(request.url);
    const queryParams = Object.fromEntries(searchParams.entries());

    const validationResult = followUpQuerySchema.safeParse(queryParams);
    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: "Invalid query parameters",
          details: validationResult.error.issues,
        },
        { status: 400 },
      );
    }

    const {
      page,
      limit,
      sortBy,
      sortOrder,
      status,
      priority,
      assigneeId,
      slideId,
      submetricDefinitionId,
      search,
      unassigned,
      overdue,
    } = validationResult.data;

    // Build where conditions
    const conditions: SQL[] = [eq(followUps.workspaceId, workspaceId)];

    // Status filter
    if (status) {
      conditions.push(eq(followUps.status, status));
    }

    // Priority filter
    if (priority) {
      conditions.push(eq(followUps.priority, priority));
    }

    // Slide filter
    if (slideId) {
      conditions.push(eq(followUps.slideId, slideId));
    }

    // Submetric definition filter
    if (submetricDefinitionId) {
      conditions.push(
        eq(followUps.submetricDefinitionId, submetricDefinitionId),
      );
    }

    // Search filter (title, description, identifier)
    if (search) {
      const searchPattern = `%${search}%`;
      const searchCondition = or(
        like(followUps.title, searchPattern),
        like(followUps.description, searchPattern),
        like(followUps.identifier, searchPattern),
      );
      if (searchCondition) {
        conditions.push(searchCondition);
      }
    }

    // Overdue filter
    if (overdue) {
      const overdueCondition = and(
        lt(followUps.dueDate, new Date().toISOString().split("T")[0]),
        sql`${followUps.status} != 'done'`,
      );
      if (overdueCondition) {
        conditions.push(overdueCondition);
      }
    }

    // Get all follow-ups that match the conditions (for assignee filtering)
    const baseQuery = db.query.followUps.findMany({
      where: and(...conditions),
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

    let allFollowUps = await baseQuery;

    // Client-side filtering for assignee (complex join)
    if (unassigned) {
      allFollowUps = allFollowUps.filter(
        (followUp) => !followUp.assignees || followUp.assignees.length === 0,
      );
    } else if (assigneeId) {
      allFollowUps = allFollowUps.filter((followUp) =>
        followUp.assignees?.some((assignee) => assignee.userId === assigneeId),
      );
    }

    // Sort
    allFollowUps.sort((a, b) => {
      let aVal: any;
      let bVal: any;

      switch (sortBy) {
        case "createdAt":
          aVal = new Date(a.createdAt);
          bVal = new Date(b.createdAt);
          break;
        case "updatedAt":
          aVal = new Date(a.updatedAt);
          bVal = new Date(b.updatedAt);
          break;
        case "title":
          aVal = a.title.toLowerCase();
          bVal = b.title.toLowerCase();
          break;
        case "status":
          aVal = a.status;
          bVal = b.status;
          break;
        case "priority": {
          const priorityOrder = {
            urgent: 0,
            high: 1,
            medium: 2,
            low: 3,
            no_priority: 4,
          };
          aVal = priorityOrder[a.priority as keyof typeof priorityOrder];
          bVal = priorityOrder[b.priority as keyof typeof priorityOrder];
          break;
        }
        case "dueDate":
          aVal = a.dueDate ? new Date(a.dueDate) : new Date("9999-12-31");
          bVal = b.dueDate ? new Date(b.dueDate) : new Date("9999-12-31");
          break;
        case "identifier":
          aVal = a.identifier.toLowerCase();
          bVal = b.identifier.toLowerCase();
          break;
        default:
          aVal = new Date(a.createdAt);
          bVal = new Date(b.createdAt);
      }

      if (aVal < bVal) return sortOrder === "asc" ? -1 : 1;
      if (aVal > bVal) return sortOrder === "asc" ? 1 : -1;
      return 0;
    });

    // Calculate pagination
    const total = allFollowUps.length;
    const totalPages = Math.ceil(total / limit);
    const offset = (page - 1) * limit;
    const paginatedFollowUps = allFollowUps.slice(offset, offset + limit);

    return NextResponse.json(
      {
        followUps: paginatedFollowUps,
        pagination: {
          page,
          limit,
          total,
          totalPages,
          hasMore: page < totalPages,
        },
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("Error fetching follow-ups:", error);
    return NextResponse.json(
      { error: "Failed to fetch follow-ups" },
      { status: 500 },
    );
  }
}

// POST /api/workspaces/[workspaceId]/follow-ups - Create new follow-up
export async function POST(
  request: Request,
  { params }: { params: Promise<{ workspaceId: string }> },
) {
  try {
    const session = await getAuthSession();

    if (!session || !session.user || !session.user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { workspaceId } = await params;

    // Check if workspace exists
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

    const body = await request.json();

    // Validate request body
    const validationResult = createFollowUpSchema.safeParse(body);
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

    // Generate unique identifier for the follow-up
    // Use a retry loop to handle race conditions with identifier generation
    let newFollowUp: typeof followUps.$inferSelect | undefined;
    let attempts = 0;
    const maxAttempts = 5;

    while (attempts < maxAttempts) {
      try {
        // Get the highest existing identifier number for this workspace
        const existingFollowUps = await db
          .select({ identifier: followUps.identifier })
          .from(followUps)
          .where(eq(followUps.workspaceId, workspaceId))
          .orderBy(sql`${followUps.identifier} DESC`)
          .limit(1);

        // Extract the number from the last identifier (e.g., "FU-123" -> 123)
        let nextNumber = 1;
        if (existingFollowUps.length > 0) {
          const lastIdentifier = existingFollowUps[0].identifier;
          const match = lastIdentifier.match(/FU-(\d+)/);
          if (match) {
            nextNumber = Number.parseInt(match[1], 10) + 1;
          }
        }

        const identifier = `FU-${nextNumber.toString().padStart(3, "0")}`;

        // Try to create the follow-up
        const [createdFollowUp] = await db
          .insert(followUps)
          .values({
            title: validatedData.title,
            description: validatedData.description ?? null,
            workspaceId,
            slideId: validatedData.slideId ?? null,
            submetricDefinitionId: validatedData.submetricDefinitionId ?? null,
            threadId: validatedData.threadId ?? null,
            status: validatedData.status,
            priority: validatedData.priority,
            assigneeId: null, // DEPRECATED: no longer used, using assignees junction table
            createdBy: session.user.id,
            dueDate: validatedData.dueDate ?? null,
            identifier,
          })
          .returning();

        newFollowUp = createdFollowUp;
        break; // Success! Exit the loop
      } catch (err: any) {
        // Check if it's a duplicate key error
        if (
          err.code === "23505" &&
          err.constraint === "follow_up_identifier_idx"
        ) {
          attempts++;
          if (attempts >= maxAttempts) {
            console.error(
              "Failed to generate unique identifier after retries:",
              err,
            );
            return NextResponse.json(
              {
                error:
                  "Failed to generate unique identifier. Please try again.",
              },
              { status: 500 },
            );
          }
          // Wait a short random time before retrying to reduce collision probability
          await new Promise((resolve) =>
            setTimeout(resolve, Math.random() * 100),
          );
          continue;
        }
        // For other errors, throw immediately
        throw err;
      }
    }

    // Safety check - should never happen due to maxAttempts check inside the loop
    if (!newFollowUp) {
      return NextResponse.json(
        { error: "Failed to create follow-up" },
        { status: 500 },
      );
    }

    // Now we can safely use newFollowUp - assign to const for clarity
    const createdFollowUpId = newFollowUp.id;

    // Create assignee relationships if provided
    if (validatedData.assigneeIds && validatedData.assigneeIds.length > 0) {
      await db.insert(followUpAssignees).values(
        validatedData.assigneeIds.map((userId) => ({
          followUpId: createdFollowUpId,
          userId,
        })),
      );
    }

    // Fetch the created follow-up with related data
    const followUp = await db.query.followUps.findFirst({
      where: (followUps, { eq }) => eq(followUps.id, createdFollowUpId),
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

    return NextResponse.json({ followUp }, { status: 201 });
  } catch (error) {
    console.error("Error creating follow-up:", error);
    return NextResponse.json(
      { error: "Failed to create follow-up" },
      { status: 500 },
    );
  }
}
