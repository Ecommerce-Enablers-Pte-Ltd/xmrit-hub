"use client";

import { useRouter, useParams } from "next/navigation";
import { useDeleteSlide, useWorkspace } from "@/lib/api";
import { SlideTable } from "./slide-table";
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

interface WorkspaceClientProps {
  workspace: WorkspaceWithSlides;
}

export function WorkspaceClient({
  workspace: initialWorkspace,
}: WorkspaceClientProps) {
  const router = useRouter();
  const params = useParams();
  const workspaceId = params.workspaceId as string;

  // Use React Query hook to get live data that updates when cache is invalidated
  const { workspace, loading } = useWorkspace(workspaceId);
  const deleteSlide = useDeleteSlide();

  // Use the live workspace data from React Query, fallback to initial server data
  const currentWorkspace = workspace || initialWorkspace;

  // Alert dialog state
  const [alertOpen, setAlertOpen] = React.useState(false);
  const [slideToDelete, setSlideToDelete] = React.useState<string | null>(null);

  const handleCreateSlide = React.useCallback(() => {
    // TODO: Implement slide creation
    console.log("Creating new slide");
  }, []);

  const handleCreateMetric = React.useCallback((slideId: string) => {
    // TODO: Implement metric creation
    console.log("Creating new metric for slide:", slideId);
  }, []);

  const handleEditSlide = React.useCallback((slide: any) => {
    // TODO: Implement slide editing
    console.log("Editing slide:", slide.title);
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
