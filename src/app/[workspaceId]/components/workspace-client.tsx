"use client";

import { Settings } from "lucide-react";
import { useParams } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useDeleteSlide, useWorkspace } from "@/lib/api";
import type { SlideWithMetrics } from "@/types/db/slide";
import type { WorkspaceWithSlides } from "@/types/db/workspace";
import { EditSlideNameDialog } from "./edit-slide-name-dialog";
import { SlideTable } from "./slide-table";
import { WorkspaceSettingsDialog } from "./workspace-settings-dialog";

interface WorkspaceClientProps {
  workspace: WorkspaceWithSlides;
}

export function WorkspaceClient({
  workspace: initialWorkspace,
}: WorkspaceClientProps) {
  const params = useParams();
  const workspaceId = params.workspaceId as string;

  // Hybrid approach: hydrate React Query with server data, then use client cache
  const { workspace, loading } = useWorkspace(workspaceId, initialWorkspace);
  const deleteSlide = useDeleteSlide();

  // Use the live workspace data from React Query (hydrated with SSR data)
  const currentWorkspace = workspace || initialWorkspace;

  // Alert dialog state
  const [alertOpen, setAlertOpen] = React.useState(false);
  const [slideToDelete, setSlideToDelete] = React.useState<string | null>(null);

  // Edit slide dialog state
  const [editDialogOpen, setEditDialogOpen] = React.useState(false);
  const [slideToEdit, setSlideToEdit] = React.useState<SlideWithMetrics | null>(
    null,
  );

  // Workspace settings dialog state
  const [settingsOpen, setSettingsOpen] = React.useState(false);

  const handleEditSlide = React.useCallback((slide: SlideWithMetrics) => {
    setSlideToEdit(slide);
    setEditDialogOpen(true);
  }, []);

  const handleDeleteSlide = React.useCallback((slideId: string) => {
    setSlideToDelete(slideId);
    setAlertOpen(true);
  }, []);

  const confirmDelete = React.useCallback(async () => {
    if (!slideToDelete) return;

    try {
      // Show loading toast
      const loadingToast = toast.loading("Deleting slide...");

      // Call the mutation - React Query will automatically invalidate the cache
      // and update both the page and sidebar!
      await deleteSlide.mutateAsync({
        slideId: slideToDelete,
        workspaceId: currentWorkspace.id,
      });

      // Dismiss loading toast and show success
      toast.dismiss(loadingToast);
      toast.success("Slide deleted successfully", {
        description: "All metrics and data points have been removed.",
      });
    } catch (error) {
      console.error("Error deleting slide:", error);
      toast.error("Failed to delete slide", {
        description:
          error instanceof Error
            ? error.message
            : "An unexpected error occurred. Please try again.",
      });
    } finally {
      setAlertOpen(false);
      setSlideToDelete(null);
    }
  }, [slideToDelete, deleteSlide, currentWorkspace.id]);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/60">
        <div className="flex items-center justify-between px-6 py-4">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <div className="flex-1 min-w-0">
              {loading ? (
                <>
                  <Skeleton className="h-8 w-64" />
                  <Skeleton className="h-4 w-96 mt-1" />
                </>
              ) : (
                <>
                  <h1 className="text-2xl font-semibold tracking-tight">
                    {currentWorkspace.name}
                  </h1>
                  {currentWorkspace.description && (
                    <p className="text-sm text-muted-foreground mt-0.5">
                      {currentWorkspace.description}
                    </p>
                  )}
                </>
              )}
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSettingsOpen(true)}
              title="Workspace settings"
              className="shrink-0"
            >
              <Settings className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <SlideTable
          currentWorkspace={currentWorkspace}
          slides={currentWorkspace.slides}
          onEditSlide={handleEditSlide}
          onDeleteSlide={handleDeleteSlide}
          isLoading={loading}
        />
      </div>

      {/* Total Count - Below Table (only show if there are slides or loading) */}
      {(loading || currentWorkspace.slides.length > 0) && (
        <div className="border-t bg-muted/30 px-6 py-3">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {loading ? (
              <Skeleton className="h-4 w-32" />
            ) : (
              <span>
                {currentWorkspace.slides.length} total slide
                {currentWorkspace.slides.length !== 1 ? "s" : ""}
              </span>
            )}
          </div>
        </div>
      )}

      {slideToEdit && (
        <EditSlideNameDialog
          open={editDialogOpen}
          onOpenChange={(open) => {
            setEditDialogOpen(open);
            if (!open) {
              setSlideToEdit(null);
            }
          }}
          slide={slideToEdit}
          workspaceId={currentWorkspace.id}
        />
      )}

      <WorkspaceSettingsDialog
        workspace={currentWorkspace}
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
      />

      <AlertDialog open={alertOpen} onOpenChange={setAlertOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this slide and all its associated
              metrics and data points. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
