"use client";

import {
  BarChart3,
  FolderOpen,
  MoreVertical,
  Pencil,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { usePrefetchSlide } from "@/lib/api";
import type { SlideWithMetrics } from "@/types/db/slide";
import type { Workspace } from "@/types/db/workspace";

interface SlideTableProps {
  currentWorkspace: Workspace;
  slides: SlideWithMetrics[];
  onEditSlide: (slide: SlideWithMetrics) => void;
  onDeleteSlide: (slideId: string) => void;
  isLoading?: boolean;
}

export function SlideTable({
  currentWorkspace,
  slides,
  onEditSlide,
  onDeleteSlide,
  isLoading = false,
}: SlideTableProps) {
  const prefetchSlide = usePrefetchSlide();

  const handleRowClick = (slideId: string) => {
    window.open(`/${currentWorkspace.id}/slide/${slideId}`, "_blank");
  };

  if (isLoading) {
    return (
      <div className="px-0 md:px-2 pb-6 flex-1 overflow-auto border-t **:data-[slot=table-container]:overflow-visible">
        <Table>
          <TableHeader className="sticky top-0 bg-background z-10">
            <TableRow className="hover:bg-transparent">
              <TableHead className="h-10 w-[40%] font-medium text-xs">
                Name
              </TableHead>
              <TableHead className="h-10 w-[35%] font-medium text-xs">
                Details
              </TableHead>
              <TableHead className="h-10 w-[20%] font-medium text-xs">
                Location
              </TableHead>
              <TableHead className="h-10 w-[5%]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {[0, 1, 2, 3, 4].map((rowNum) => (
              <TableRow key={`skeleton-slide-${rowNum}`}>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <Skeleton className="h-5 w-5 rounded" />
                    <Skeleton className="h-5 w-48" />
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-4 w-24" />
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-4 w-4 rounded" />
                    <Skeleton className="h-4 w-32" />
                  </div>
                </TableCell>
                <TableCell>
                  <Skeleton className="h-8 w-8 rounded" />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    );
  }

  return (
    <div className="px-0 md:px-2 pb-6 flex-1 overflow-auto border-t **:data-[slot=table-container]:overflow-visible">
      {slides.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 sm:py-16 px-3 sm:px-6 text-center">
          <div className="rounded-full bg-muted p-3 sm:p-4 mb-3 sm:mb-4">
            <BarChart3 className="h-6 w-6 sm:h-8 sm:w-8 text-muted-foreground" />
          </div>
          <h3 className="text-base sm:text-lg font-semibold mb-1">
            No slides found
          </h3>
          <p className="text-xs sm:text-sm text-muted-foreground max-w-sm">
            Create your first slide to start building your metrics dashboard and
            tracking performance.
          </p>
        </div>
      ) : (
        <Table>
          <TableHeader className="sticky top-0 bg-background z-10">
            <TableRow className="hover:bg-transparent">
              <TableHead className="h-10 w-[40%] font-medium text-xs">
                Name
              </TableHead>
              <TableHead className="h-10 w-[35%] font-medium text-xs">
                Details
              </TableHead>
              <TableHead className="h-10 w-[20%] font-medium text-xs">
                Location
              </TableHead>
              <TableHead className="h-10 w-[5%]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {slides.map((slide) => {
              const totalSubmetrics = slide.metrics.reduce(
                (sum, metric) => sum + metric.submetrics.length,
                0,
              );

              return (
                <TableRow
                  key={slide.id}
                  className="cursor-pointer"
                  onClick={() => handleRowClick(slide.id)}
                  onMouseEnter={() => prefetchSlide(slide.id)}
                >
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="shrink-0">
                        <BarChart3 className="h-5 w-5 text-yellow-500" />
                      </div>
                      <span className="font-normal">{slide.title}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <span>
                        {slide.metrics.length} metric
                        {slide.metrics.length !== 1 ? "s" : ""}
                      </span>
                      <span>•</span>
                      <span>
                        {totalSubmetrics} submetric
                        {totalSubmetrics !== 1 ? "s" : ""}
                      </span>
                      {slide.createdAt && (
                        <>
                          <span>•</span>
                          <span>
                            {new Date(slide.createdAt).toLocaleDateString(
                              "en-US",
                              {
                                month: "short",
                                day: "numeric",
                                year: "numeric",
                              },
                            )}
                          </span>
                        </>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <FolderOpen className="h-4 w-4" />
                      <span>{currentWorkspace.name}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48">
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.stopPropagation();
                            onEditSlide(slide);
                          }}
                        >
                          <Pencil className="mr-2 h-4 w-4" />
                          Rename
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeleteSlide(slide.id);
                          }}
                          className="text-destructive focus:text-destructive"
                          disabled
                        >
                          <Trash2 className="mr-2 h-4 w-4 text-destructive" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
