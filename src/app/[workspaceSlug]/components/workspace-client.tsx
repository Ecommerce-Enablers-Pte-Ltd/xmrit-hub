"use client";

import { useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import * as React from "react";
import { useEffect, useRef } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useDeleteSlide, workspaceKeys } from "@/lib/api";
import { cn, getErrorMessage } from "@/lib/utils";
import { EditSlideNameDialog } from "./edit-slide-name-dialog";
import { SlideTable } from "./slide-table";

// Lightweight slide type for listing (matches server query)
export interface SlideListItem {
  id: string;
  title: string;
  slideNumber: number;
  description: string | null;
  workspaceId: string;
  slideDate: string | null;
  createdAt: Date;
  updatedAt: Date;
  metricsCount: number;
  submetricsCount: number;
}

export interface WorkspaceListData {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  settings: unknown;
  isArchived: boolean | null;
  isPublic: boolean | null;
  createdAt: Date;
  updatedAt: Date;
  slides: SlideListItem[];
  totalSlides: number;
}

interface WorkspaceClientProps {
  workspace: WorkspaceListData;
  pagination: {
    page: number;
    limit: number;
    totalSlides: number;
  };
}

export function WorkspaceClient({
  workspace: initialWorkspace,
  pagination,
}: WorkspaceClientProps) {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const workspaceSlug = params.workspaceSlug as string;

  // Initialize React Query cache with server data on mount (only once)
  // This follows the same pattern as slide-client.tsx
  const hasInitialized = useRef(false);

  useEffect(() => {
    if (!hasInitialized.current) {
      // Seed the cache with server-rendered data (use ID for cache key)
      queryClient.setQueryData(
        workspaceKeys.detail(initialWorkspace.id),
        initialWorkspace,
      );
      hasInitialized.current = true;
    }
  }, [queryClient, initialWorkspace]);

  // Use server data directly - React Query cache is seeded for mutations/invalidations
  const workspace = initialWorkspace;

  const deleteSlide = useDeleteSlide();

  // Pagination from server
  const { page, limit, totalSlides } = pagination;
  const totalPages = Math.ceil(totalSlides / limit);
  const hasMore = page < totalPages;

  // Alert dialog state
  const [alertOpen, setAlertOpen] = React.useState(false);
  const [slideToDelete, setSlideToDelete] = React.useState<string | null>(null);

  // Edit slide dialog state
  const [editDialogOpen, setEditDialogOpen] = React.useState(false);
  const [slideToEdit, setSlideToEdit] = React.useState<SlideListItem | null>(
    null,
  );

  // Update URL with pagination params - triggers server navigation for new data
  const updateSearchParams = React.useCallback(
    (updates: { page?: number; limit?: number }) => {
      const newParams = new URLSearchParams(searchParams.toString());

      Object.entries(updates).forEach(([key, value]) => {
        if (value === undefined) {
          newParams.delete(key);
        } else {
          newParams.set(key, String(value));
        }
      });

      router.push(`/${workspaceSlug}?${newParams.toString()}`);
    },
    [searchParams, router, workspaceSlug],
  );

  const handleEditSlide = React.useCallback((slide: SlideListItem) => {
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

      // Call the mutation - React Query will invalidate caches automatically
      await deleteSlide.mutateAsync({
        slideId: slideToDelete,
        workspaceId: workspace.id,
      });

      // Dismiss loading toast and show success
      toast.dismiss(loadingToast);
      toast.success("Slide deleted successfully", {
        description: "All metrics and data points have been removed.",
      });

      // Invalidate workspace cache so sidebar updates
      queryClient.invalidateQueries({
        queryKey: workspaceKeys.detail(workspace.id),
      });
      queryClient.invalidateQueries({
        queryKey: workspaceKeys.slidesList(workspace.id),
      });

      // Refresh the page to get updated server data
      router.refresh();
    } catch (error) {
      console.error("Error deleting slide:", error);
      const errorMessage = getErrorMessage(
        error,
        "An unexpected error occurred. Please try again.",
      );
      toast.error("Failed to delete slide", {
        description: errorMessage,
      });
    } finally {
      setAlertOpen(false);
      setSlideToDelete(null);
    }
  }, [slideToDelete, deleteSlide, workspace.id, router, queryClient]);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/60">
        <div className="flex items-center justify-between px-0 md:px-3 py-2.5 sm:py-4">
          <div className="flex-1 min-w-0">
            <h1 className="text-xl sm:text-2xl font-semibold tracking-tight">
              {workspace.name}
            </h1>
            {workspace.description && (
              <p className="text-xs sm:text-sm text-muted-foreground mt-0.5 hidden sm:block">
                {workspace.description}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 flex flex-col min-h-0">
        <SlideTable
          currentWorkspace={workspace}
          slides={workspace.slides}
          onEditSlide={handleEditSlide}
          onDeleteSlide={handleDeleteSlide}
        />
      </div>

      {/* Footer with Pagination */}
      {totalSlides > 0 && (
        <div className="border-t bg-background px-0 md:px-3 py-2 sm:py-3">
          <div className="flex items-center justify-between gap-2 sm:gap-4">
            {/* Left side - Total count and results info */}
            <div className="flex items-center gap-2 sm:gap-4">
              <div className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm text-muted-foreground">
                <span>
                  {totalSlides} total slide
                  {totalSlides !== 1 ? "s" : ""}
                </span>
              </div>

              {/* Items per page selector - only show if we have multiple pages or enough items, hidden on mobile */}
              {totalSlides > 10 && (
                <Select
                  value={String(limit)}
                  onValueChange={(value) =>
                    updateSearchParams({ limit: Number(value), page: 1 })
                  }
                >
                  <SelectTrigger className="w-[100px] sm:w-[130px] h-8 hidden sm:flex">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="10">10 per page</SelectItem>
                    <SelectItem value="20">20 per page</SelectItem>
                    <SelectItem value="50">50 per page</SelectItem>
                    <SelectItem value="100">100 per page</SelectItem>
                  </SelectContent>
                </Select>
              )}
            </div>

            {/* Right side - Pagination controls */}
            {totalPages > 1 && (
              <div className="flex items-center gap-1.5 sm:gap-2">
                <span className="text-sm text-muted-foreground hidden sm:inline">
                  Page {page} of {totalPages}
                </span>

                <div className="flex items-center gap-0.5 sm:gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => updateSearchParams({ page: page - 1 })}
                    disabled={page <= 1}
                    className="h-7 sm:h-8 px-1.5 sm:px-3"
                  >
                    <ChevronLeft className="h-4 w-4" />
                    <span className="hidden sm:inline ml-1">Previous</span>
                  </Button>

                  {/* Page numbers - show on larger screens */}
                  <div className="hidden md:flex items-center gap-1">
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      let pageNum: number;

                      if (totalPages <= 5) {
                        pageNum = i + 1;
                      } else if (page <= 3) {
                        pageNum = i + 1;
                      } else if (page >= totalPages - 2) {
                        pageNum = totalPages - 4 + i;
                      } else {
                        pageNum = page - 2 + i;
                      }

                      return (
                        <Button
                          key={pageNum}
                          variant={page === pageNum ? "default" : "outline"}
                          size="sm"
                          onClick={() => updateSearchParams({ page: pageNum })}
                          className={cn(
                            "h-8 w-8 p-0",
                            page === pageNum && "pointer-events-none",
                          )}
                        >
                          {pageNum}
                        </Button>
                      );
                    })}
                  </div>

                  {/* Simple page indicator for mobile */}
                  <span className="text-[10px] sm:text-xs text-muted-foreground md:hidden px-0.5 sm:px-1">
                    {page}/{totalPages}
                  </span>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => updateSearchParams({ page: page + 1 })}
                    disabled={!hasMore}
                    className="h-7 sm:h-8 px-1.5 sm:px-3"
                  >
                    <span className="hidden sm:inline mr-1">Next</span>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
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
          workspaceId={workspace.id}
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
            <AlertDialogCancel className="hidden sm:inline-flex">
              Cancel
            </AlertDialogCancel>
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
