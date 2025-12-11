import { and, eq } from "drizzle-orm";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getAuthSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { getWorkspaceBySlug as getWorkspaceBySlugQuery } from "@/lib/db/queries";
import { slides } from "@/lib/db/schema";
import { normalizeSlug } from "@/lib/utils";
import { parseSlideSlug } from "@/lib/validations/slide";
import type { SlideWithMetrics } from "@/types/db/slide";
import type { Workspace } from "@/types/db/workspace";
import { SlideClient } from "./components/slide-client";

interface SlidePageProps {
  params: Promise<{
    workspaceSlug: string;
    slideSlug: string;
  }>;
}

// Enable Next.js caching for frequently accessed slides
export const revalidate = 300; // Revalidate cached data every 5 minutes (ISR)
// Note: We use ISR instead of full static generation due to auth requirements

// Get workspace by slug with auth check
async function getWorkspaceBySlugWithAuth(
  workspaceSlug: string,
): Promise<Workspace | null> {
  const session = await getAuthSession();
  if (!session) return null;

  // Uses centralized helper that handles slug normalization
  const workspace = await getWorkspaceBySlugQuery(workspaceSlug);
  return workspace || null;
}

// Get slide by workspace ID and slide number
async function getSlideByNumber(
  workspaceId: string,
  slideNumber: number,
): Promise<SlideWithMetrics | null> {
  const session = await getAuthSession();
  if (!session) return null;

  const slide = await db.query.slides.findFirst({
    where: and(
      eq(slides.workspaceId, workspaceId),
      eq(slides.slideNumber, slideNumber),
    ),
    with: {
      metrics: {
        orderBy: (metrics, { asc }) => [asc(metrics.ranking)],
        with: {
          // Only load the definition field we actually use in the UI
          definition: {
            columns: {
              id: true,
              definition: true,
            },
          },
          submetrics: {
            orderBy: (submetrics, { asc }) => [asc(submetrics.createdAt)],
            // Fetch definition for category, metricName, xaxis, yaxis, unit, preferredTrend
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
            // Limit columns to reduce data transfer (especially important for dataPoints JSONB)
            columns: {
              id: true,
              metricId: true,
              definitionId: true,
              timezone: true,
              aggregationType: true,
              color: true,
              trafficLightColor: true,
              metadata: true,
              dataPoints: true,
              createdAt: true,
              updatedAt: true,
            },
          },
        },
      },
    },
  });

  return slide as SlideWithMetrics | null;
}

// Metadata generation
export async function generateMetadata({
  params,
}: SlidePageProps): Promise<Metadata> {
  const { workspaceSlug, slideSlug } = await params;

  // Parse the slide number from the slug (e.g., "1-my-slide" -> 1)
  const slideNumber = parseSlideSlug(slideSlug);
  if (!slideNumber) {
    return {
      title: "Slide - Xmrit Hub",
      description: "Statistical Process Control and XMR Chart Analysis",
    };
  }

  const workspace = await getWorkspaceBySlugWithAuth(workspaceSlug);
  if (!workspace) {
    return {
      title: "Slide - Xmrit Hub",
      description: "Statistical Process Control and XMR Chart Analysis",
    };
  }

  const slide = await getSlideByNumber(workspace.id, slideNumber);
  if (!slide) {
    return {
      title: "Slide - Xmrit Hub",
      description: "Statistical Process Control and XMR Chart Analysis",
    };
  }

  const title = `${slide.title} - Xmrit Hub`;
  const description = slide.description || `Slide: ${slide.title}`;
  const slideDate = slide.slideDate
    ? new Date(slide.slideDate).toLocaleDateString("en-CA")
    : null;

  return {
    title,
    description: slideDate ? `${description} (${slideDate})` : description,
    openGraph: {
      title,
      description: slideDate ? `${description} (${slideDate})` : description,
      type: "website",
    },
    twitter: {
      card: "summary",
      title,
      description: slideDate ? `${description} (${slideDate})` : description,
    },
  };
}

export default async function SlidePage({ params }: SlidePageProps) {
  const { workspaceSlug, slideSlug } = await params;

  // URL Normalization is handled by the parent layout (client-side router.replace)
  // Use normalized slug for database queries
  const normalizedSlug = normalizeSlug(workspaceSlug);

  // Parse the slide number from the slug (e.g., "1-my-slide" -> 1)
  const slideNumber = parseSlideSlug(slideSlug);
  if (!slideNumber) {
    notFound();
  }

  // Fetch workspace by normalized slug
  const workspace = await getWorkspaceBySlugWithAuth(normalizedSlug);
  if (!workspace) {
    notFound();
  }

  // Fetch slide by workspace ID and slide number
  const slide = await getSlideByNumber(workspace.id, slideNumber);
  if (!slide) {
    notFound();
  }

  // No redirect needed - slideNumber is the identifier
  // The title part of the URL slug is purely for SEO/readability
  // Client-side will handle URL mutation if title changes (like navbar title)

  return <SlideClient slide={slide} workspace={workspace} />;
}
