"use client";

import { useQueryClient } from "@tanstack/react-query";
import { MonitorIcon, Pencil } from "lucide-react";
import { useRouter } from "next/navigation";
import { memo, useEffect, useMemo, useRef, useState } from "react";
import { EditSlideNameDialog } from "@/app/[workspaceId]/components/edit-slide-name-dialog";
import { Button } from "@/components/ui/button";
import { useIsMobile } from "@/hooks/use-mobile";
import { slideKeys, useSlide } from "@/lib/api/slides";
import { CommentCountsProvider } from "@/providers/comment-counts-provider";
import type { SlideWithMetrics } from "@/types/db/slide";
import type { Workspace } from "@/types/db/workspace";
import { SlideContainer } from "./slide-container";

interface SlideClientProps {
  slide: SlideWithMetrics;
  workspace: Workspace;
}

// Memoized mobile warning component
const MobileWarning = memo(() => (
  <div className="flex min-h-[80vh] items-center justify-center p-4">
    <div className="text-center max-w-md">
      <MonitorIcon className="mx-auto h-16 w-16 text-muted-foreground mb-4" />
      <h2 className="text-2xl font-semibold mb-2">Desktop View Required</h2>
      <p className="text-muted-foreground">
        Slide presentations are best viewed on a tablet or desktop for optimal
        experience. Please switch to a larger screen to view this content.
      </p>
    </div>
  </div>
));
MobileWarning.displayName = "MobileWarning";

// Memoized header component to prevent unnecessary re-renders
interface SlideHeaderProps {
  title: string;
  description?: string | null;
  slideDate?: Date | string | null;
  onEditClick: () => void;
}

const SlideHeader = memo(
  ({
    title,
    description,
    slideDate,
    onEditClick,
  }: Omit<SlideHeaderProps, "workspaceId" | "slideId">) => {
    return (
      <div className="px-6 py-4 border-b">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 opacity-50 hover:opacity-100 shrink-0"
                onClick={onEditClick}
              >
                <Pencil className="h-4 w-4" />
              </Button>
            </div>
            {description && (
              <p className="text-sm text-muted-foreground mt-1">
                {description}
              </p>
            )}
            {slideDate && (
              <p className="text-xs text-muted-foreground mt-1.5">
                Date: {new Date(slideDate).toLocaleDateString("en-CA")}
              </p>
            )}
          </div>
        </div>
      </div>
    );
  },
);
SlideHeader.displayName = "SlideHeader";

export function SlideClient({
  slide: initialSlide,
  workspace,
}: SlideClientProps) {
  const router = useRouter();
  const isMobile = useIsMobile();
  const queryClient = useQueryClient();
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);

  // Initialize React Query cache with server data on mount (only once)
  // Use ref to prevent unnecessary re-initialization
  const hasInitialized = useRef(false);
  useEffect(() => {
    if (!hasInitialized.current) {
      queryClient.setQueryData(slideKeys.detail(initialSlide.id), initialSlide);
      hasInitialized.current = true;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryClient, initialSlide]); // Depend on entire object to satisfy exhaustive-deps

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

  // Memoize callbacks to prevent unnecessary re-renders
  const handleEditClick = useMemo(() => () => setIsEditDialogOpen(true), []);

  // Show message on mobile devices
  if (isMobile) {
    return <MobileWarning />;
  }

  return (
    <div>
      <SlideHeader
        title={currentSlide.title}
        description={currentSlide.description}
        slideDate={currentSlide.slideDate}
        onEditClick={handleEditClick}
      />

      <EditSlideNameDialog
        open={isEditDialogOpen}
        onOpenChange={setIsEditDialogOpen}
        slide={currentSlide}
        workspaceId={workspace.id}
      />

      <div className="px-6 py-6">
        {/* Wrap with CommentCountsProvider to batch-fetch all comment counts in ONE request */}
        <CommentCountsProvider
          slideId={currentSlide.id}
          definitionIds={definitionIds}
        >
          <SlideContainer
            metrics={currentSlide.metrics}
            slideId={currentSlide.id}
            workspaceId={workspace.id}
          />
        </CommentCountsProvider>
      </div>
    </div>
  );
}
