import { eq } from "drizzle-orm";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getAuthSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { slides, workspaces } from "@/lib/db/schema";
import type { SlideWithMetrics } from "@/types/db/slide";
import type { Workspace } from "@/types/db/workspace";
import { SlideClient } from "./components/slide-client";

interface SlidePageProps {
  params: Promise<{
    workspaceId: string;
    slideId: string;
  }>;
}

// Enable Next.js caching for frequently accessed slides
export const revalidate = 300; // Revalidate cached data every 5 minutes (ISR)
// Note: We use ISR instead of full static generation due to auth requirements

// Server-side data fetching with optimized caching
// This data is cached server-side (ISR) + client-side (React Query)
async function getSlideData(slideId: string): Promise<SlideWithMetrics | null> {
  const session = await getAuthSession();
  if (!session) return null;

  const slide = await db.query.slides.findFirst({
    where: eq(slides.id, slideId),
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
            // Limit columns to reduce data transfer (especially important for dataPoints JSONB)
            columns: {
              id: true,
              metricId: true,
              definitionId: true,
              label: true,
              category: true,
              xAxis: true,
              yAxis: true,
              timezone: true,
              preferredTrend: true,
              unit: true,
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

async function getWorkspaceData(
  workspaceId: string,
): Promise<Workspace | null> {
  const session = await getAuthSession();
  if (!session) return null;

  const workspace = await db.query.workspaces.findFirst({
    where: eq(workspaces.id, workspaceId),
  });

  return workspace || null;
}

// Metadata generation
export async function generateMetadata({
  params,
}: SlidePageProps): Promise<Metadata> {
  const { workspaceId, slideId } = await params;

  const [slide, workspace] = await Promise.all([
    getSlideData(slideId),
    getWorkspaceData(workspaceId),
  ]);

  if (!slide || !workspace) {
    return {
      title: "Not Found - Xmrit Hub",
      description: "Statistical Process Control and XMR Chart Analysis",
    };
  }

  // Verify slide belongs to workspace
  if (slide.workspaceId !== workspace.id) {
    return {
      title: "Not Found - Xmrit Hub",
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
  const { workspaceId, slideId } = await params;

  // Parallel data fetching for maximum speed
  const [slide, workspace] = await Promise.all([
    getSlideData(slideId),
    getWorkspaceData(workspaceId),
  ]);

  if (!slide || !workspace) {
    notFound();
  }

  // Verify slide belongs to workspace
  if (slide.workspaceId !== workspace.id) {
    notFound();
  }

  return <SlideClient slide={slide} workspace={workspace} />;
}
