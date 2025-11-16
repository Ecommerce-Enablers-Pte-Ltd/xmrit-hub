"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { SlideContainer } from "./slide-container";
import { useIsMobile } from "@/hooks/use-mobile";
import type { SlideWithMetrics } from "@/types/db/slide";
import type { Workspace } from "@/types/db/workspace";
import { MonitorIcon, Pencil } from "lucide-react";
import { useSlide, slideKeys } from "@/lib/api/slides";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { EditSlideNameDialog } from "@/app/[workspaceId]/components/edit-slide-name-dialog";
import { CommentCountsProvider } from "./comment-counts-provider";

interface SlideClientProps {
  slide: SlideWithMetrics;
  workspace: Workspace;
}

export function SlideClient({
  slide: initialSlide,
  workspace,
}: SlideClientProps) {
  const router = useRouter();
  const isMobile = useIsMobile();
  const queryClient = useQueryClient();
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);

  // Initialize React Query cache with server data on mount
  useEffect(() => {
    queryClient.setQueryData(slideKeys.detail(initialSlide.id), initialSlide);
  }, [queryClient, initialSlide]);

  // Subscribe to React Query cache for live updates
  const { slide } = useSlide(initialSlide.id);

  // Use the cached slide data if available, otherwise fall back to initial prop
  const currentSlide = slide || initialSlide;

  // Extract all definition IDs for the CommentCountsProvider
  // This allows ONE batch query instead of N individual queries (100+ submetrics = 100+ requests!)
  const definitionIds = useMemo(() => {
    const ids: string[] = [];
    for (const metric of currentSlide.metrics) {
      for (const submetric of metric.submetrics) {
        if (submetric.definitionId) {
          ids.push(submetric.definitionId);
        }
      }
    }
    return ids;
  }, [currentSlide.metrics]);

  // Verify slide belongs to the workspace
  useEffect(() => {
    if (
      currentSlide &&
      workspace &&
      currentSlide.workspaceId !== workspace.id
    ) {
      router.push("/404");
    }
  }, [currentSlide, workspace, router]);

  // Show message on mobile devices
  if (isMobile) {
    return (
      <div className="flex min-h-[80vh] items-center justify-center p-4">
        <div className="text-center max-w-md">
          <MonitorIcon className="mx-auto h-16 w-16 text-muted-foreground mb-4" />
          <h2 className="text-2xl font-semibold mb-2">Desktop View Required</h2>
          <p className="text-muted-foreground">
            Slide presentations are best viewed on a tablet or desktop for
            optimal experience. Please switch to a larger screen to view this
            content.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold">{currentSlide.title}</h1>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 opacity-60 hover:opacity-100"
                onClick={() => setIsEditDialogOpen(true)}
              >
                <Pencil className="h-4 w-4" />
              </Button>
              <EditSlideNameDialog
                open={isEditDialogOpen}
                onOpenChange={setIsEditDialogOpen}
                slide={currentSlide}
                workspaceId={workspace.id}
              />
            </div>
            {currentSlide.description && (
              <p className="text-muted-foreground mt-2">
                {currentSlide.description}
              </p>
            )}
            {currentSlide.slideDate && (
              <p className="text-sm text-muted-foreground mt-1">
                Date:{" "}
                {new Date(currentSlide.slideDate).toLocaleDateString("en-CA")}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Wrap with CommentCountsProvider to batch-fetch all comment counts in ONE request */}
      <CommentCountsProvider
        slideId={currentSlide.id}
        definitionIds={definitionIds}
      >
        <SlideContainer metrics={currentSlide.metrics} slideId={currentSlide.id} />
      </CommentCountsProvider>
    </div>
  );
}
