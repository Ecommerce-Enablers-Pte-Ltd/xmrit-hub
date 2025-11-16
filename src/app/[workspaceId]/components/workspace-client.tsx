"use client";

import { useRouter, useParams } from "next/navigation";
import { useDeleteSlide, useWorkspace } from "@/lib/api";
import { SlideTable } from "./slide-table";
import { EditSlideNameDialog } from "./edit-slide-name-dialog";
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
import { toast } from "sonner";
import * as React from "react";
import type { WorkspaceWithSlides } from "@/types/db/workspace";
import type { SlideWithMetrics } from "@/types/db/slide";

interface WorkspaceClientProps {
  workspace: WorkspaceWithSlides;
}

export function WorkspaceClient({
  workspace: initialWorkspace,
}: WorkspaceClientProps) {
  const router = useRouter();
  const params = useParams();
  const workspaceId = params.workspaceId as string;

  // Hybrid approach: hydrate React Query with server data, then use client cache
  const { workspace, loading, isFetching } = useWorkspace(
    workspaceId,
    initialWorkspace
  );
  const deleteSlide = useDeleteSlide();

  // Use the live workspace data from React Query (hydrated with SSR data)
  const currentWorkspace = workspace || initialWorkspace;

  // Alert dialog state
  const [alertOpen, setAlertOpen] = React.useState(false);
  const [slideToDelete, setSlideToDelete] = React.useState<string | null>(null);

  // Edit slide dialog state
  const [editDialogOpen, setEditDialogOpen] = React.useState(false);
  const [slideToEdit, setSlideToEdit] = React.useState<SlideWithMetrics | null>(null);

  const handleCreateSlide = React.useCallback(() => {
    // TODO: Implement slide creation
    console.log("Creating new slide");
  }, []);

  const handleCreateMetric = React.useCallback((slideId: string) => {
    // TODO: Implement metric creation
    console.log("Creating new metric for slide:", slideId);
  }, []);

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

  const handleViewSlide = React.useCallback(
    (slideId: string) => {
      router.push(`/${currentWorkspace.id}/slide/${slideId}`);
    },
    [router, currentWorkspace.id]
  );

  return (
    <>
      <SlideTable
        currentWorkspace={currentWorkspace}
        slides={currentWorkspace.slides}
        onCreateSlide={handleCreateSlide}
        onEditSlide={handleEditSlide}
        onDeleteSlide={handleDeleteSlide}
        isLoading={loading}
      />
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
    </>
  );
}
