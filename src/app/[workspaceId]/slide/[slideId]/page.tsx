import { Metadata } from "next";
import { notFound } from "next/navigation";
import { getAuthSession } from "@/lib/auth";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { slides, workspaces } from "@/lib/db/schema";
import { SlideClient } from "./components/slide-client";
import type { SlideWithMetrics } from "@/types/db/slide";
import type { Workspace } from "@/types/db/workspace";

interface SlidePageProps {
  params: Promise<{
    workspaceId: string;
    slideId: string;
  }>;
}

// Server-side data fetching - simple fetch, no caching
// React Query handles all caching on the client side
async function getSlideData(slideId: string): Promise<SlideWithMetrics | null> {
  const session = await getAuthSession();
  if (!session) return null;

  const slide = await db.query.slides.findFirst({
    where: eq(slides.id, slideId),
    with: {
      metrics: {
        orderBy: (metrics, { asc }) => [
          asc(metrics.sortOrder),
          asc(metrics.ranking),
        ],
        with: {
          submetrics: {
            orderBy: (submetrics, { asc }) => [asc(submetrics.createdAt)],
            // All fields including dataPoints are needed for chart rendering
          },
        },
      },
    },
  });

  return slide as SlideWithMetrics | null;
}

async function getWorkspaceData(
  workspaceId: string
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
