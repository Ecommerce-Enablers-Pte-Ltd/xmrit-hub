"use client";

import { useRouter } from "next/navigation";
import type { Session } from "next-auth";
import * as React from "react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import type { Slide } from "@/types/db/slide";
import type { Workspace } from "@/types/db/workspace";
import { ChartSearchProvider } from "../../../providers/chart-search-provider";
import { BreadcrumbNav } from "./breadcrumb-nav";
import { CreateWorkspaceDialog } from "./create-workspace-dialog";
import { DashboardSidebar } from "./dashboard-sidebar";
import { NavbarChartSearchButton } from "./navbar-chart-search-button";
import { NavbarFollowUpButton } from "./navbar-follow-up-button";
import { UserNav } from "./user-nav";
import { WorkspaceSettingsDialog } from "./workspace-settings-dialog";

interface DashboardLayoutProps {
  children: React.ReactNode;
  session: Session | null;
  workspaces: Workspace[];
  currentWorkspace: Workspace;
  slides: Slide[]; // Changed from SlideWithMetrics[] to Slide[] for lightweight loading
}

export function DashboardLayout({
  children,
  session,
  workspaces,
  currentWorkspace,
  slides,
}: DashboardLayoutProps) {
  const router = useRouter();
  const [createWorkspaceOpen, setCreateWorkspaceOpen] = React.useState(false);
  const [settingsOpen, setSettingsOpen] = React.useState(false);

  const handleWorkspaceChange = React.useCallback(
    (workspace: Workspace) => {
      // Navigate to the new workspace using its slug
      router.push(`/${workspace.slug}`);
    },
    [router],
  );

  const handleCreateWorkspace = React.useCallback(() => {
    setCreateWorkspaceOpen(true);
  }, []);

  const handleOpenSettings = React.useCallback(() => {
    setSettingsOpen(true);
  }, []);

  const handleSidebarTriggerClick = React.useCallback(() => {
    // Remove focus from sidebar trigger to allow arrow key navigation
    setTimeout(() => {
      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }
    }, 0);
  }, []);

  return (
    <ChartSearchProvider>
      <SidebarProvider>
        <div className="flex h-screen w-full">
          <DashboardSidebar
            workspaces={workspaces}
            currentWorkspace={currentWorkspace}
            slides={slides}
            onWorkspaceChange={handleWorkspaceChange}
            onCreateWorkspace={handleCreateWorkspace}
            onOpenSettings={handleOpenSettings}
          />
          <div className="flex-1 flex flex-col overflow-hidden">
            <header className="flex h-14 items-center gap-4 border-b bg-background px-4 md:px-6">
              <SidebarTrigger
                onClick={handleSidebarTriggerClick}
                className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded"
              />
              <BreadcrumbNav workspace={currentWorkspace} slides={slides} />
              <div className="flex-1" />
              <div className="flex items-center gap-0.5">
                <NavbarChartSearchButton />
                <NavbarFollowUpButton
                  workspaceId={currentWorkspace.id}
                  workspaceSlug={currentWorkspace.slug}
                />
              </div>
              <UserNav session={session} />
            </header>
            <main className="flex-1 overflow-auto px-4 pt-2 pb-6 md:p-6">
              {children}
            </main>
          </div>
        </div>
        <CreateWorkspaceDialog
          open={createWorkspaceOpen}
          onOpenChange={setCreateWorkspaceOpen}
        />
        <WorkspaceSettingsDialog
          workspace={currentWorkspace}
          open={settingsOpen}
          onOpenChange={setSettingsOpen}
        />
      </SidebarProvider>
    </ChartSearchProvider>
  );
}
