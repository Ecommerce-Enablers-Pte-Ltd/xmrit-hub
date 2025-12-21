import { eq, sql } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  metricDefinitions,
  metrics,
  slides,
  submetricDefinitions,
  submetrics,
  workspaces,
} from "@/lib/db/schema";
import { slugify } from "@/lib/utils";

/**
 * Metric Ingestion API
 *
 * POST /api/ingest/metrics
 *
 * Headers:
 *   - Authorization: Bearer <API_KEY>
 *   - Content-Type: application/json
 *
 * Body:
 * {
 *   "workspace_id": "uuid", // optional - will create if not provided
 *   "slide_id": "uuid",     // optional - will create if not provided
 *   "slide_title": "My Slide Title", // required if slide_id not provided
 *   "slide_date": "2025-10-06",      // optional
 *   "metrics": [
 *     {
 *       "metric_name": "Transaction Count",
 *       "description": "Optional description",
 *       "ranking": 1,         // optional - 1 = top, 2 = second, etc.
 *       "chart_type": "line", // optional, default: "line"
 *       "submetrics": [
 *         {
 *           "category": "Category A",        // optional - category/dimension (e.g., "Category A", "Region 1")
 *           "timezone": "ltz",               // optional - default: "UTC"
 *           "xaxis": "period",               // optional - x-axis semantic label (stored in definition)
 *           "yaxis": "% of transactions",    // optional - y-axis semantic label (stored in definition, fallback for unit)
 *           "preferred_trend": "downtrend",  // optional - uptrend/downtrend/stable
 *           "unit": "%",                     // optional - if omitted, uses yaxis value
 *           "aggregation_type": "avg",       // optional - default: "none"
 *           "color": "#3b82f6",              // optional - hex color
 *           "data_points": [
 *             {
 *               "timestamp": "2025-08-04",
 *               "value": 6.963562753036437,
 *               "confidence": 0.95,          // optional
 *               "source": "api"              // optional
 *             }
 *           ]
 *         }
 *       ]
 *     }
 *   ]
 * }
 */

interface DataPointInput {
  timestamp: string;
  value: number;
  confidence?: number;
  source?: string;
  dimensions?: Record<string, unknown>;
}

interface SubmetricInput {
  category?: string; // Category/dimension (e.g., "Category A", "Region 1")
  timezone?: string;
  xaxis?: string; // X-axis semantic label (stored in definition, e.g., "period", "tracked_week")
  yaxis?: string; // Y-axis semantic label (stored in definition, e.g., "hours", "% of total")
  preferred_trend?: "uptrend" | "downtrend" | "stable" | null;
  unit?: string; // Unit of measurement (stored in definition, takes precedence over yaxis if both provided)
  aggregation_type?: string;
  color?: string;
  metadata?: Record<string, unknown>;
  data_points: DataPointInput[];
}

interface MetricInput {
  metric_name: string;
  description?: string;
  ranking?: number; // Optional ranking: 1 = top, 2 = second, etc.
  chart_type?: "line" | "bar" | "area" | "pie" | "scatter";
  submetrics: SubmetricInput[];
}

interface IngestRequest {
  workspace_id?: string;
  slide_id?: string;
  slide_title?: string;
  slide_date?: string;
  slide_description?: string;
  metrics: MetricInput[];
}

/**
 * Normalize a string to a stable key format
 * Example: "% of Total Count" -> "of-total-count"
 */
function normalizeKey(str: string): string {
  return str
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Derive stable submetric key from category and metric name
 * Example: category="Category A", metricName="% of Total Count" -> "category-a-of-total-count"
 * Example: category=null, metricName="Transaction Count" -> "transaction-count"
 */
function deriveSubmetricKey(
  category: string | null,
  metricName: string,
): string {
  if (category) {
    return normalizeKey(`${category}-${metricName}`);
  }
  return normalizeKey(metricName);
}

// Validate API key from environment variable
function validateApiKey(request: NextRequest): {
  valid: boolean;
  error?: string;
} {
  const authHeader = request.headers.get("authorization");
  const apiKey = process.env.METRICS_API_KEY;

  // Check if API key is configured
  if (!apiKey) {
    console.error(
      "[SECURITY] METRICS_API_KEY environment variable not set. Ingestion endpoint is disabled.",
    );
    return { valid: false, error: "Service temporarily unavailable" };
  }

  // Validate API key strength (minimum 32 characters)
  if (apiKey.length < 32) {
    console.error(
      "[SECURITY] METRICS_API_KEY is too weak (< 32 characters). Please use a stronger key.",
    );
    return { valid: false, error: "Service configuration error" };
  }

  // Check authorization header format
  if (!authHeader?.startsWith("Bearer ")) {
    console.warn(
      `[SECURITY] Invalid authorization header format from ${
        request.headers.get("x-forwarded-for") ||
        request.headers.get("x-real-ip") ||
        "unknown IP"
      }`,
    );
    return { valid: false, error: "Invalid authorization header" };
  }

  const providedKey = authHeader.substring(7);

  // Validate provided key
  if (!providedKey || providedKey.length === 0) {
    console.warn(
      `[SECURITY] Empty API key provided from ${
        request.headers.get("x-forwarded-for") ||
        request.headers.get("x-real-ip") ||
        "unknown IP"
      }`,
    );
    return { valid: false, error: "Invalid API key" };
  }

  // Use timing-safe comparison to prevent timing attacks
  if (providedKey === apiKey) {
    return { valid: true };
  }

  // Log failed authentication attempts
  console.warn(
    `[SECURITY] Failed API key authentication attempt from ${
      request.headers.get("x-forwarded-for") ||
      request.headers.get("x-real-ip") ||
      "unknown IP"
    }`,
  );
  return { valid: false, error: "Invalid API key" };
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  const clientIp =
    request.headers.get("x-forwarded-for") ||
    request.headers.get("x-real-ip") ||
    "unknown";

  try {
    // Validate API key
    const authResult = validateApiKey(request);
    if (!authResult.valid) {
      console.warn(
        `[SECURITY] Unauthorized ingest attempt from ${clientIp}: ${authResult.error}`,
      );
      return NextResponse.json(
        { error: authResult.error || "Unauthorized" },
        { status: 401 },
      );
    }

    // Log successful authentication
    console.log(`[AUDIT] Authenticated ingest request from ${clientIp}`);

    // Parse request body
    const body: IngestRequest = await request.json();

    // Validate required fields
    if (
      !body.metrics ||
      !Array.isArray(body.metrics) ||
      body.metrics.length === 0
    ) {
      return NextResponse.json(
        { error: "Invalid request - 'metrics' array is required" },
        { status: 400 },
      );
    }

    // Get or validate workspace
    let workspaceId = body.workspace_id;
    if (!workspaceId) {
      // Create a new public workspace if not provided
      const workspaceName = body.slide_title || "API Ingestion Workspace";
      // Generate a unique slug by combining slugified name with a timestamp suffix
      // Use fallback "api-workspace" if slugify returns empty (e.g., all special chars)
      const baseSlug = slugify(workspaceName, "api-workspace");
      const uniqueSlug = `${baseSlug}-${Date.now().toString(36)}`;
      const [newWorkspace] = await db
        .insert(workspaces)
        .values({
          name: workspaceName,
          slug: uniqueSlug,
          description: "Created via API",
          isPublic: true,
        })
        .returning();
      workspaceId = newWorkspace.id;
    } else {
      // Verify workspace exists
      const workspace = await db.query.workspaces.findFirst({
        where: eq(workspaces.id, workspaceId),
      });

      if (!workspace) {
        return NextResponse.json(
          { error: `Workspace with id '${workspaceId}' not found` },
          { status: 404 },
        );
      }
    }

    // Get or create slide
    let slideId = body.slide_id;
    if (!slideId) {
      if (!body.slide_title) {
        return NextResponse.json(
          { error: "Either 'slide_id' or 'slide_title' is required" },
          { status: 400 },
        );
      }

      // Get the next slide number for this workspace
      const maxSlideNumberResult = await db
        .select({ maxNum: sql<number>`COALESCE(MAX("slideNumber"), 0)` })
        .from(slides)
        .where(eq(slides.workspaceId, workspaceId));
      const nextSlideNumber = (maxSlideNumberResult[0]?.maxNum ?? 0) + 1;

      // Create new slide
      const [newSlide] = await db
        .insert(slides)
        .values({
          title: body.slide_title,
          slideNumber: nextSlideNumber,
          description: body.slide_description || null,
          workspaceId,
          slideDate: body.slide_date || null,
        })
        .returning();
      slideId = newSlide.id;
    } else {
      // Verify slide exists and belongs to workspace
      const slide = await db.query.slides.findFirst({
        where: eq(slides.id, slideId),
      });

      if (!slide) {
        return NextResponse.json(
          { error: `Slide with id '${slideId}' not found` },
          { status: 404 },
        );
      }

      if (slide.workspaceId !== workspaceId) {
        return NextResponse.json(
          { error: "Slide does not belong to the specified workspace" },
          { status: 400 },
        );
      }
    }

    // Insert metrics, submetrics, and data points
    const insertedMetrics: string[] = [];
    let totalSubmetrics = 0;
    let totalDataPoints = 0;

    for (const metricInput of body.metrics) {
      // Derive stable key for metric definition lookup/creation
      const metricKey = normalizeKey(metricInput.metric_name);

      // Upsert metric definition (auto-create/update)
      const [metricDef] = await db
        .insert(metricDefinitions)
        .values({
          workspaceId,
          metricKey,
          definition: metricInput.description || null,
        })
        .onConflictDoUpdate({
          target: [metricDefinitions.workspaceId, metricDefinitions.metricKey],
          set: {
            // Only update definition if explicitly provided in the payload
            // This preserves manual edits made through the UI
            ...(metricInput.description
              ? { definition: metricInput.description }
              : {}),
            updatedAt: new Date(),
          },
        })
        .returning();

      // Insert metric linked to definition
      const [metric] = await db
        .insert(metrics)
        .values({
          name: metricInput.metric_name,
          slideId,
          definitionId: metricDef.id,
          ranking: metricInput.ranking || null,
        })
        .returning();

      insertedMetrics.push(metric.id);

      // Insert submetrics with data points
      for (const submetricInput of metricInput.submetrics) {
        // Category and metricName come from explicit fields
        // All submetrics under this metric share the same metricName (from parent metric_name)
        const category = submetricInput.category || null;
        const metricName = metricInput.metric_name;

        // Derive stable keys for definition lookup/creation
        const metricKey = normalizeKey(metricInput.metric_name);
        const submetricKey = deriveSubmetricKey(category, metricName);

        // Extract axis and unit fields
        // unit takes precedence, but yaxis is also stored as semantic axis label
        const unit = submetricInput.unit || submetricInput.yaxis || null;
        const xaxis = submetricInput.xaxis || null;
        const yaxis = submetricInput.yaxis || null;

        // Upsert submetric definition (auto-create/update)
        const [definition] = await db
          .insert(submetricDefinitions)
          .values({
            workspaceId,
            metricKey,
            submetricKey,
            category,
            metricName,
            xaxis,
            yaxis,
            unit,
            preferredTrend: submetricInput.preferred_trend || null,
          })
          .onConflictDoUpdate({
            target: [
              submetricDefinitions.workspaceId,
              submetricDefinitions.metricKey,
              submetricDefinitions.submetricKey,
            ],
            set: {
              category,
              metricName,
              xaxis,
              yaxis,
              unit,
              preferredTrend: submetricInput.preferred_trend || null,
              updatedAt: new Date(),
            },
          })
          .returning();

        // Prepare data points as JSON array
        const dataPointsJson =
          submetricInput.data_points && submetricInput.data_points.length > 0
            ? submetricInput.data_points.map((dp) => ({
                timestamp: dp.timestamp,
                value: dp.value,
                confidence: dp.confidence ?? null,
                source: dp.source ?? null,
                dimensions: dp.dimensions ?? null,
              }))
            : [];

        // Insert submetric with definitionId
        // Note: label, unit, preferredTrend now stored in submetricDefinitions only
        await db.insert(submetrics).values({
          metricId: metric.id,
          definitionId: definition.id,
          timezone: submetricInput.timezone || "UTC",
          aggregationType: submetricInput.aggregation_type || "none",
          color: submetricInput.color || null,
          metadata: submetricInput.metadata || null,
          dataPoints: dataPointsJson,
        });

        totalSubmetrics++;
        totalDataPoints += dataPointsJson.length;
      }
    }

    const duration = Date.now() - startTime;
    console.log(
      `[AUDIT] Successfully ingested metrics from ${clientIp}: ` +
        `workspace=${workspaceId}, slide=${slideId}, ` +
        `metrics=${insertedMetrics.length}, submetrics=${totalSubmetrics}, ` +
        `datapoints=${totalDataPoints}, duration=${duration}ms`,
    );

    return NextResponse.json(
      {
        success: true,
        message: "Metrics ingested successfully",
        data: {
          workspace_id: workspaceId,
          slide_id: slideId,
          metrics_created: insertedMetrics.length,
          submetrics_created: totalSubmetrics,
          data_points_created: totalDataPoints,
          metric_ids: insertedMetrics,
        },
      },
      { status: 201 },
    );
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(
      `[ERROR] Failed to ingest metrics from ${clientIp} after ${duration}ms:`,
      error,
    );

    // Don't leak internal error details to the client
    const isValidationError =
      error instanceof Error &&
      (error.message.includes("not found") ||
        error.message.includes("required") ||
        error.message.includes("invalid"));

    return NextResponse.json(
      {
        error: isValidationError
          ? error.message
          : "Internal server error - please contact support",
        ...(process.env.NODE_ENV === "development" && {
          debug: error instanceof Error ? error.message : "Unknown error",
        }),
      },
      { status: isValidationError ? 400 : 500 },
    );
  }
}

// GET endpoint to check API status (also requires authentication)
export async function GET(request: NextRequest) {
  const clientIp =
    request.headers.get("x-forwarded-for") ||
    request.headers.get("x-real-ip") ||
    "unknown";

  const authResult = validateApiKey(request);
  if (!authResult.valid) {
    console.warn(
      `[SECURITY] Unauthorized GET attempt to ingest endpoint from ${clientIp}`,
    );
    return NextResponse.json(
      { error: "Unauthorized - API documentation requires authentication" },
      { status: 401 },
    );
  }

  console.log(`[AUDIT] API documentation accessed from ${clientIp}`);

  return NextResponse.json({
    endpoint: "/api/ingest/metrics",
    methods: ["POST", "GET"],
    description: "Ingest metrics with Bearer token authentication",
    authentication: {
      type: "Bearer",
      header: "Authorization: Bearer <METRICS_API_KEY>",
      note: "API key must be at least 32 characters",
    },
    post_body_example: {
      workspace_id: "uuid (optional - will create if not provided)",
      slide_id: "uuid (optional - will create if not provided)",
      slide_title: "My Slide Title (required if slide_id not provided)",
      slide_date: "2025-10-06 (optional)",
      slide_description: "Optional description",
      metrics: [
        {
          metric_name: "% of Total Count to Total Transactions",
          description: "Optional description",
          ranking: 1,
          chart_type: "line",
          submetrics: [
            {
              category: "Category A",
              timezone: "ltz",
              xaxis: "period",
              yaxis: "% of total",
              unit: "%",
              preferred_trend: "downtrend",
              aggregation_type: "avg",
              color: "#3b82f6",
              data_points: [
                {
                  timestamp: "2025-08-04",
                  value: 6.963562753036437,
                  confidence: 0.95,
                  source: "api",
                },
              ],
            },
          ],
        },
      ],
    },
  });
}
