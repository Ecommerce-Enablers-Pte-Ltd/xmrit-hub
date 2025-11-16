"use client";

import { useRouter } from "next/navigation";
import type { Session } from "next-auth";
import * as React from "react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import type { SlideWithMetrics } from "@/types/db/slide";
import type { Workspace } from "@/types/db/workspace";
import { BreadcrumbNav } from "./breadcrumb-nav";
import { DashboardSidebar } from "./dashboard-sidebar";
import { UserNav } from "./user-nav";
import { CreateWorkspaceDialog } from "./create-workspace-dialog";

interface DashboardLayoutProps {
  children: React.ReactNode;
  session: Session | null;
  workspaces: Workspace[];
  currentWorkspace: Workspace;
  slides: SlideWithMetrics[];
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

  const handleWorkspaceChange = React.useCallback(
    (workspace: Workspace) => {
      // Navigate to the new workspace
      router.push(`/${workspace.id}`);
    },
    [router]
  );

  const handleCreateWorkspace = React.useCallback(() => {
    setCreateWorkspaceOpen(true);
  }, []);

  const handleCreateSlide = React.useCallback(() => {
    // TODO: Implement slide creation
    console.log("Creating new slide");
  }, []);

  const handleCreateMetric = React.useCallback((slideId: string) => {
    // TODO: Implement metric creation
    console.log("Creating new metric for slide:", slideId);
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
    <SidebarProvider>
      <div className="flex h-screen w-full">
        <DashboardSidebar
          workspaces={workspaces}
          currentWorkspace={currentWorkspace}
          slides={slides}
          onWorkspaceChange={handleWorkspaceChange}
          onCreateWorkspace={handleCreateWorkspace}
          onCreateSlide={handleCreateSlide}
          onCreateMetric={handleCreateMetric}
        />
        <div className="flex-1 flex flex-col overflow-hidden">
          <header className="flex h-12 items-center gap-4 border-b bg-background px-6">
            <div onClick={handleSidebarTriggerClick}>
              <SidebarTrigger />
            </div>
            <BreadcrumbNav workspace={currentWorkspace} slides={slides} />
            <div className="flex-1" />
            <UserNav session={session} />
          </header>
          <main className="flex-1 overflow-auto p-6">{children}</main>
        </div>
      </div>
      <CreateWorkspaceDialog
        open={createWorkspaceOpen}
        onOpenChange={setCreateWorkspaceOpen}
      />
    </SidebarProvider>
  );
}
