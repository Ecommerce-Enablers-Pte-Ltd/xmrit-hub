"use client";

import { LoaderCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { use, useEffect, useMemo } from "react";
import { useWorkspaceSlidesList, useWorkspaces } from "@/lib/api";
import { DashboardLayout } from "./components/dashboard-layout";

interface WorkspaceLayoutProps {
  children: React.ReactNode;
  params: Promise<{
    workspaceId: string;
  }>;
}

export default function WorkspaceLayout({
  children,
  params,
}: WorkspaceLayoutProps) {
  const { workspaceId } = use(params);
  const { data: session, status } = useSession();
  const router = useRouter();

  // Fetch lightweight data for layout
  const {
    workspaces,
    loading: workspacesLoading,
    error: workspacesError,
  } = useWorkspaces();

  // Use lightweight endpoint that only loads slide metadata (no metrics/submetrics)
  const {
    slides,
    loading: slidesLoading,
    error: slidesError,
  } = useWorkspaceSlidesList(workspaceId);

  // Find current workspace from the workspaces list
  const workspace = useMemo(
    () => workspaces.find((w) => w.id === workspaceId),
    [workspaces, workspaceId],
  );

  const loading = workspacesLoading || slidesLoading;
  const error = workspacesError || slidesError;

  useEffect(() => {
    // If not authenticated, redirect to sign-in
    if (status === "unauthenticated") {
      router.push("/auth/signin");
      return;
    }
  }, [status, router]);

  useEffect(() => {
    if (!loading && !workspace && workspaces.length > 0) {
      // Workspace not found in the list, redirect to 404
      router.push("/404");
    }
  }, [loading, workspace, workspaces, router]);

  if (status === "loading") {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <LoaderCircle className="h-8 w-8 mx-auto mb-4 text-foreground animate-spin" />
          <p className="text-muted-foreground">Checking authentication...</p>
        </div>
      </div>
    );
  }

  if (status === "unauthenticated") {
    return null; // Will redirect to sign-in
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <LoaderCircle className="h-8 w-8 mx-auto mb-4 text-foreground animate-spin" />
          <p className="text-muted-foreground">Loading workspace...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-600 mb-4">Error</h1>
          <p className="text-muted-foreground">{error}</p>
        </div>
      </div>
    );
  }

  if (!workspace) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Workspace Not Found</h1>
          <p className="text-muted-foreground">
            The requested workspace could not be found.
          </p>
        </div>
      </div>
    );
  }

  return (
    <DashboardLayout
      session={session}
      workspaces={workspaces}
      currentWorkspace={workspace}
      slides={slides}
    >
      {children}
    </DashboardLayout>
  );
}
