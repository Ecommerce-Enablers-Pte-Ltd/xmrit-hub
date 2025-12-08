"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useDeleteSlide, useWorkspace } from "@/lib/api";
import { cn, getErrorMessage } from "@/lib/utils";
import type { SlideWithMetrics } from "@/types/db/slide";
import type { WorkspaceWithSlides } from "@/types/db/workspace";
import { EditSlideNameDialog } from "./edit-slide-name-dialog";
import { SlideTable } from "./slide-table";

interface WorkspaceClientProps {
  workspace: WorkspaceWithSlides;
}

export function WorkspaceClient({
  workspace: initialWorkspace,
}: WorkspaceClientProps) {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const workspaceId = params.workspaceId as string;

  // Hybrid approach: hydrate React Query with server data, then use client cache
  const { workspace, loading } = useWorkspace(workspaceId, initialWorkspace);
  const deleteSlide = useDeleteSlide();

  // Use the live workspace data from React Query (hydrated with SSR data)
  const currentWorkspace = workspace || initialWorkspace;

  // Pagination state from URL
  const page = Number(searchParams.get("page")) || 1;
  const limit = Number(searchParams.get("limit")) || 20;

  // Alert dialog state
  const [alertOpen, setAlertOpen] = React.useState(false);
  const [slideToDelete, setSlideToDelete] = React.useState<string | null>(null);

  // Edit slide dialog state
  const [editDialogOpen, setEditDialogOpen] = React.useState(false);
  const [slideToEdit, setSlideToEdit] = React.useState<SlideWithMetrics | null>(
    null,
  );

  // Update URL with pagination params
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

      router.replace(`/${workspaceId}?${newParams.toString()}`);
    },
    [searchParams, router, workspaceId],
  );

  // Calculate pagination
  const totalSlides = currentWorkspace.slides.length;
  const totalPages = Math.ceil(totalSlides / limit);
  const startIndex = (page - 1) * limit;
  const endIndex = startIndex + limit;
  const paginatedSlides = currentWorkspace.slides.slice(startIndex, endIndex);
  const hasMore = endIndex < totalSlides;

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
  }, [slideToDelete, deleteSlide, currentWorkspace.id]);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/60">
        <div className="flex items-center justify-between px-0 md:px-3 py-2.5 sm:py-4">
          <div className="flex-1 min-w-0">
            {loading ? (
              <>
                <Skeleton className="h-7 sm:h-8 w-48 sm:w-64" />
                <Skeleton className="h-4 w-64 sm:w-96 mt-1 hidden sm:block" />
              </>
            ) : (
              <>
                <h1 className="text-xl sm:text-2xl font-semibold tracking-tight">
                  {currentWorkspace.name}
                </h1>
                {currentWorkspace.description && (
                  <p className="text-xs sm:text-sm text-muted-foreground mt-0.5 hidden sm:block">
                    {currentWorkspace.description}
                  </p>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 flex flex-col min-h-0">
        <SlideTable
          currentWorkspace={currentWorkspace}
          slides={paginatedSlides}
          onEditSlide={handleEditSlide}
          onDeleteSlide={handleDeleteSlide}
          isLoading={loading}
        />
      </div>

      {/* Footer with Pagination */}
      {(loading || totalSlides > 0) && (
        <div className="border-t bg-background px-0 md:px-3 py-2 sm:py-3">
          <div className="flex items-center justify-between gap-2 sm:gap-4">
            {/* Left side - Total count and results info */}
            <div className="flex items-center gap-2 sm:gap-4">
              <div className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm text-muted-foreground">
                {loading ? (
                  <Skeleton className="h-4 w-20 sm:w-32" />
                ) : (
                  <span>
                    {totalSlides} total slide
                    {totalSlides !== 1 ? "s" : ""}
                  </span>
                )}
              </div>

              {/* Items per page selector - only show if we have multiple pages or enough items, hidden on mobile */}
              {totalSlides > 10 && !loading && (
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
            {totalPages > 1 && !loading && (
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
    </div>
  );
}
