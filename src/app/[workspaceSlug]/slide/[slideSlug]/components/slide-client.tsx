"use client";

import { useQueryClient } from "@tanstack/react-query";
import { MonitorIcon, Pencil } from "lucide-react";
import { useRouter } from "next/navigation";
import { memo, useEffect, useMemo, useRef, useState } from "react";
import { EditSlideNameDialog } from "@/app/[workspaceSlug]/components/edit-slide-name-dialog";
import { Button } from "@/components/ui/button";
import { useSidebar } from "@/components/ui/sidebar";
import { slideKeys, useSlide } from "@/lib/api/slides";
import { generateSlideUrl } from "@/lib/utils";
import { CommentCountsProvider } from "@/providers/comment-counts-provider";
import { FollowUpCountsProvider } from "@/providers/follow-up-counts-provider";
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
      <h2 className="text-2xl font-semibold mb-2">Desktop Only</h2>
      <p className="text-muted-foreground">
        This page is not available on mobile devices. Please access it from a
        desktop or laptop computer for the full experience.
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
      <div className="px-2 py-4 border-b">
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
  // Temporarily disabled mobile device check
  // const { isMobileDevice, isLoading: isMobileLoading } = useIsMobileDevice();
  const queryClient = useQueryClient();
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const { open, setOpen, isMobile: isSidebarMobile } = useSidebar();

  // Initialize React Query cache with server data on mount (only once)
  // Use ref to prevent unnecessary re-initialization
  const hasInitialized = useRef(false);
  // Track if we've already collapsed the sidebar on mount
  const hasCollapsedSidebar = useRef(false);

  useEffect(() => {
    if (!hasInitialized.current) {
      queryClient.setQueryData(slideKeys.detail(initialSlide.id), initialSlide);
      hasInitialized.current = true;
    }
  }, [queryClient, initialSlide]);

  // Auto-minimize sidebar when on slide page (desktop only)
  // This effect runs once on mount to collapse the sidebar if expanded
  useEffect(() => {
    if (!hasCollapsedSidebar.current) {
      hasCollapsedSidebar.current = true;
      if (!isSidebarMobile && open) {
        setOpen(false);
      }
    }
  }, [isSidebarMobile, open, setOpen]);

  // Subscribe to React Query cache for live updates (only for title changes)
  const { slide } = useSlide(initialSlide.id);

  // Only extract reactive values from slide (title) - avoid changing object references
  // Use initialSlide for static data (metrics) to prevent chart re-renders
  const slideTitle = slide?.title ?? initialSlide.title;
  const slideDescription = slide?.description ?? initialSlide.description;
  const slideDate = slide?.slideDate ?? initialSlide.slideDate;

  // Static values from initialSlide - these don't change and won't cause re-renders
  const slideId = initialSlide.id;
  const slideNumber = initialSlide.slideNumber;
  const workspaceSlug = workspace.slug;
  const workspaceId = workspace.id;

  // Use initialSlide.metrics directly - this reference is stable and won't cause chart re-renders
  const metrics = initialSlide.metrics;

  // Extract all definition IDs for the CommentCountsProvider
  // This allows ONE batch query instead of N individual queries (100+ submetrics = 100+ requests!)
  const definitionIds = useMemo(() => {
    const ids: string[] = [];
    for (const metric of metrics) {
      for (const submetric of metric.submetrics) {
        if (submetric.definitionId) {
          ids.push(submetric.definitionId);
        }
      }
    }
    return ids;
  }, [metrics]);

  // Verify slide belongs to the workspace
  useEffect(() => {
    if (initialSlide.workspaceId !== workspaceId) {
      router.push("/404");
    }
  }, [initialSlide.workspaceId, workspaceId, router]);

  // Update URL slug when slide title changes (without re-render)
  // Uses History API directly - reads current path from window to avoid reactive dependencies

  useEffect(() => {
    if (!slideTitle || !slideNumber || !workspaceSlug) return;

    const expectedPath = generateSlideUrl(
      workspaceSlug,
      slideNumber,
      slideTitle,
    );

    // Read current path from window (non-reactive) instead of usePathname
    const currentPath = window.location.pathname;

    // Only update if the path is different (avoids unnecessary history entries)
    if (currentPath !== expectedPath) {
      window.history.replaceState(null, "", expectedPath);
    }
  }, [slideTitle, slideNumber, workspaceSlug]);

  // Memoize callbacks to prevent unnecessary re-renders
  const handleEditClick = useMemo(() => () => setIsEditDialogOpen(true), []);

  return (
    <div>
      <SlideHeader
        title={slideTitle}
        description={slideDescription}
        slideDate={slideDate}
        onEditClick={handleEditClick}
      />

      <EditSlideNameDialog
        open={isEditDialogOpen}
        onOpenChange={setIsEditDialogOpen}
        slide={{ id: slideId, title: slideTitle }}
        workspaceId={workspaceId}
      />

      <div className="px-2 py-6">
        {/* Wrap with providers to batch-fetch all counts in ONE request each instead of 100+ individual requests */}
        <CommentCountsProvider slideId={slideId} definitionIds={definitionIds}>
          <FollowUpCountsProvider
            slideId={slideId}
            definitionIds={definitionIds}
          >
            <SlideContainer
              metrics={metrics}
              slideId={slideId}
              workspaceId={workspaceId}
            />
          </FollowUpCountsProvider>
        </CommentCountsProvider>
      </div>
    </div>
  );
}
