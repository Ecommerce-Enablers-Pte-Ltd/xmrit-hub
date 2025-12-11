"use client";

import { LoaderCircle } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { use, useEffect, useMemo, useRef } from "react";
import { useWorkspaceSlidesList, useWorkspaces } from "@/lib/api";
import { normalizeSlug } from "@/lib/utils";
import { DashboardLayout } from "./components/dashboard-layout";

interface WorkspaceLayoutProps {
  children: React.ReactNode;
  params: Promise<{
    workspaceSlug: string;
  }>;
}

export default function WorkspaceLayout({
  children,
  params,
}: WorkspaceLayoutProps) {
  const { workspaceSlug } = use(params);
  const { data: session, status } = useSession();
  const router = useRouter();
  const pathname = usePathname();

  // Track if workspace was ever found - used to distinguish between
  // "workspace doesn't exist" (404) vs "workspace was deleted" (no 404)
  const wasWorkspaceFoundRef = useRef(false);

  // Fetch lightweight data for layout
  const {
    workspaces,
    loading: workspacesLoading,
    error: workspacesError,
  } = useWorkspaces();

  // URL Normalization: Check synchronously
  const normalizedSlug = normalizeSlug(workspaceSlug);
  const needsNormalization = workspaceSlug !== normalizedSlug;

  // Find current workspace from the workspaces list by slug
  // Uses normalizeSlug for consistent case-insensitive comparison
  const workspace = useMemo(
    () =>
      workspaces.find(
        (w) => normalizeSlug(w.slug) === normalizeSlug(workspaceSlug),
      ),
    [workspaces, workspaceSlug],
  );

  // Use lightweight endpoint that only loads slide metadata (no metrics/submetrics)
  // Only fetch slides if we found the workspace
  const {
    slides,
    loading: slidesLoading,
    error: slidesError,
  } = useWorkspaceSlidesList(workspace?.id ?? "");

  const loading = workspacesLoading || (workspace && slidesLoading);
  const error = workspacesError || slidesError;

  // URL Normalization redirect
  useEffect(() => {
    if (needsNormalization) {
      const normalizedPath = pathname.replace(
        `/${workspaceSlug}`,
        `/${normalizedSlug}`,
      );
      router.replace(normalizedPath);
    }
  }, [needsNormalization, workspaceSlug, normalizedSlug, pathname, router]);

  // Track if workspace was ever found
  useEffect(() => {
    if (workspace) {
      wasWorkspaceFoundRef.current = true;
    }
  }, [workspace]);

  useEffect(() => {
    // If not authenticated, redirect to sign-in
    if (status === "unauthenticated") {
      router.push("/auth/signin");
      return;
    }
  }, [status, router]);

  useEffect(() => {
    // Only redirect to 404 if:
    // 1. Not loading
    // 2. Workspace not found
    // 3. Other workspaces exist (so it's not just an empty state)
    // 4. Workspace was NEVER found (i.e., it's a bad URL, not a deletion)
    if (
      !workspacesLoading &&
      !workspace &&
      workspaces.length > 0 &&
      !wasWorkspaceFoundRef.current
    ) {
      router.push("/404");
    }
  }, [workspacesLoading, workspace, workspaces, router]);

  // Return null immediately if URL needs normalization
  if (needsNormalization) {
    return null;
  }

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
