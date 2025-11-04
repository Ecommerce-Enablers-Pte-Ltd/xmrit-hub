import { Metadata } from "next";
import { notFound } from "next/navigation";
import { getAuthSession } from "@/lib/auth";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { workspaces } from "@/lib/db/schema";
import { WorkspaceClient } from "./components/workspace-client";
import type { WorkspaceWithSlides } from "@/types/db/workspace";

interface WorkspacePageProps {
  params: Promise<{
    workspaceId: string;
  }>;
}

// Server-side data fetching
async function getWorkspaceData(
  workspaceId: string
): Promise<WorkspaceWithSlides | null> {
  const session = await getAuthSession();
  if (!session) return null;

  const workspace = await db.query.workspaces.findFirst({
    where: eq(workspaces.id, workspaceId),
    with: {
      slides: {
        with: {
          metrics: {
            with: {
              submetrics: true,
            },
          },
        },
      },
    },
  });

  return workspace || null;
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
