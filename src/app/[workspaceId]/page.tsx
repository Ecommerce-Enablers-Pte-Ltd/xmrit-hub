import { desc, eq } from "drizzle-orm";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getAuthSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { slides, workspaces } from "@/lib/db/schema";
import type { WorkspaceWithSlides } from "@/types/db/workspace";
import { WorkspaceClient } from "./components/workspace-client";

interface WorkspacePageProps {
  params: Promise<{
    workspaceId: string;
  }>;
}

// Enable ISR caching for workspace pages
// This significantly reduces latency on subsequent visits
export const revalidate = 60; // Revalidate every 60 seconds

// Optimized workspace data fetch with reduced nesting
// Only loads what's needed for the workspace overview page
async function getWorkspaceData(
  workspaceId: string,
): Promise<WorkspaceWithSlides | null> {
  const session = await getAuthSession();
  if (!session) return null;

  const workspace = await db.query.workspaces.findFirst({
    where: eq(workspaces.id, workspaceId),
    with: {
      slides: {
        orderBy: [desc(slides.createdAt)],
        limit: 50, // Reduced from 100 to 50 for faster initial load
        with: {
          metrics: {
            orderBy: (metrics, { asc }) => [asc(metrics.ranking)],
            // Only load metrics count, not full metric data
            columns: {
              id: true,
              slideId: true,
              ranking: true,
            },
            with: {
              // Load minimal definition data
              definition: {
                columns: {
                  id: true,
                  definition: true,
                },
              },
              // Load minimal submetrics data (no dataPoints)
              submetrics: {
                orderBy: (submetrics, { asc }) => [asc(submetrics.createdAt)],
                columns: {
                  id: true,
                  metricId: true,
                  definitionId: true,
                  timezone: true,
                  aggregationType: true,
                  color: true,
                  trafficLightColor: true,
                  metadata: true,
                  createdAt: true,
                  updatedAt: true,
                  // Explicitly exclude heavy dataPoints column
                },
              },
            },
          },
        },
      },
    },
  });

  return workspace as WorkspaceWithSlides | null;
}

// Metadata generation
export async function generateMetadata({
  params,
}: WorkspacePageProps): Promise<Metadata> {
  const { workspaceId } = await params;
  const workspace = await getWorkspaceData(workspaceId);

  if (!workspace) {
    return {
      title: "Not Found - Xmrit Hub",
      description: "Statistical Process Control and XMR Chart Analysis",
    };
  }

  const title = `${workspace.name} - Xmrit Hub`;
  const description = workspace.description || `Workspace: ${workspace.name}`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "website",
    },
    twitter: {
      card: "summary",
      title,
      description,
    },
  };
}

export default async function WorkspacePage({ params }: WorkspacePageProps) {
  const { workspaceId } = await params;
  const workspace = await getWorkspaceData(workspaceId);

  if (!workspace) {
    notFound();
  }

  return <WorkspaceClient workspace={workspace} />;
}
