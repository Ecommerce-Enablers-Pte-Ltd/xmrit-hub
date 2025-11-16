import { Metadata } from "next";
import { notFound } from "next/navigation";
import { getAuthSession } from "@/lib/auth";
import { eq, desc } from "drizzle-orm";
import { db } from "@/lib/db";
import { workspaces, slides } from "@/lib/db/schema";
import { WorkspaceClient } from "./components/workspace-client";
import type { WorkspaceWithSlides } from "@/types/db/workspace";

interface WorkspacePageProps {
  params: Promise<{
    workspaceId: string;
  }>;
}

// Server-side data fetching - simple fetch, no caching
// React Query handles all caching on the client side
async function getWorkspaceData(
  workspaceId: string
): Promise<WorkspaceWithSlides | null> {
  const session = await getAuthSession();
  if (!session) return null;

  const workspace = await db.query.workspaces.findFirst({
    where: eq(workspaces.id, workspaceId),
    with: {
      slides: {
        orderBy: [desc(slides.createdAt)],
        limit: 100, // Limit to most recent 100 slides
        with: {
          metrics: {
            orderBy: (metrics, { asc }) => [
              asc(metrics.sortOrder),
              asc(metrics.ranking),
            ],
            with: {
              submetrics: {
                orderBy: (submetrics, { asc }) => [asc(submetrics.createdAt)],
                columns: {
                  // Exclude heavy dataPoints column on the workspace overview
                  // Individual slide pages will load full data
                  id: true,
                  label: true,
                  category: true,
                  metricId: true,
                  definitionId: true,
                  xAxis: true,
                  timezone: true,
                  preferredTrend: true,
                  unit: true,
                  aggregationType: true,
                  color: true,
                  metadata: true,
                  createdAt: true,
                  updatedAt: true,
                  // dataPoints: false - exclude the large JSON array
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
