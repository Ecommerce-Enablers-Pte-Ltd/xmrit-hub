"use client";

import { useRouter } from "next/navigation";
import { useDeleteSlide } from "@/lib/api";
import { SlideTable } from "./slide-table";
import * as React from "react";
import type { WorkspaceWithSlides } from "@/types/db/workspace";

interface WorkspaceClientProps {
  workspace: WorkspaceWithSlides;
}

export function WorkspaceClient({ workspace }: WorkspaceClientProps) {
  const router = useRouter();
  const deleteSlide = useDeleteSlide();

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

  const handleDeleteSlide = React.useCallback(
    async (slideId: string) => {
      try {
        // Show confirmation dialog
        if (
          !confirm(
            "Are you sure you want to delete this slide? This will also delete all metrics and data points associated with it. This action cannot be undone."
          )
        ) {
          return;
        }

        // Call the mutation - React Query will automatically invalidate the cache
        // and update both the page and sidebar!
        await deleteSlide.mutateAsync({ slideId, workspaceId: workspace.id });

        console.log("Slide deleted successfully:", slideId);
      } catch (error) {
        console.error("Error deleting slide:", error);
        alert("Failed to delete slide. Please try again.");
      }
    },
    [deleteSlide, workspace.id]
  );

  const handleViewSlide = React.useCallback(
    (slideId: string) => {
      router.push(`/${workspace.id}/slide/${slideId}`);
    },
    [router, workspace.id]
  );

  return (
    <SlideTable
      currentWorkspace={workspace}
      slides={workspace.slides}
      onCreateSlide={handleCreateSlide}
      onEditSlide={handleEditSlide}
      onDeleteSlide={handleDeleteSlide}
      isLoading={false}
    />
  );
}
