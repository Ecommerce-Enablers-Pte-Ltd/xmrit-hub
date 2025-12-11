"use client";

import {
  ArrowDownIcon,
  ArrowUpDown,
  ArrowUpIcon,
  Circle,
  MoreVertical,
  Pencil,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useState } from "react";
import {
  getPriorityIcon,
  getStatusBadgeColor,
  getStatusIcon,
  getStatusLabel,
  PRIORITY_LABELS,
  STATUS_LABELS,
} from "@/components/config";
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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { getInitials } from "@/lib/formatting";
import { cn, generateSlideUrl } from "@/lib/utils";
import type { FollowUpWithDetails } from "@/types/db/follow-up";

type SortField = "identifier" | "title" | "status" | "priority" | "createdAt";

interface FollowUpTableProps {
  followUps: FollowUpWithDetails[];
  workspaceSlug: string;
  currentUserId?: string; // Current user's ID to highlight their assignments
  onEdit: (followUp: FollowUpWithDetails) => void;
  onDelete: (followUpId: string) => void;
  onStatusChange: (followUpId: string, status: string) => void;
  isLoading?: boolean;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
  onSort?: (field: SortField) => void;
}

// Generate URL-safe slug from category and metric name (matching slide-container.tsx)
function generateChartSlug(
  category: string | null | undefined,
  metricName: string | null | undefined,
): string {
  const parts: string[] = [];
  if (category) {
    parts.push(
      category
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, ""),
    );
  }
  if (metricName) {
    parts.push(
      metricName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, ""),
    );
  }
  return parts.join("-") || "chart";
}

// Sortable column header component - defined outside to prevent recreation on every render
interface SortableHeaderProps {
  field: SortField;
  children: React.ReactNode;
  className?: string;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
  onSort?: (field: SortField) => void;
}

function SortableHeader({
  field,
  children,
  className,
  sortBy,
  sortOrder,
  onSort,
}: SortableHeaderProps) {
  const isSorted = sortBy === field;
  const isAsc = sortOrder === "asc";

  return (
    <TableHead className={className}>
      <button
        type="button"
        onClick={() => onSort?.(field)}
        className="flex items-center gap-1.5 hover:text-foreground transition-colors group font-medium text-xs h-10 -my-2 cursor-pointer"
        disabled={!onSort}
      >
        <span>{children}</span>
        {onSort && (
          <span className="text-muted-foreground">
            {isSorted ? (
              isAsc ? (
                <ArrowUpIcon className="h-3.5 w-3.5" />
              ) : (
                <ArrowDownIcon className="h-3.5 w-3.5" />
              )
            ) : (
              <ArrowUpDown className="h-3.5 w-3.5 opacity-0 group-hover:opacity-50" />
            )}
          </span>
        )}
      </button>
    </TableHead>
  );
}

export function FollowUpTable({
  followUps,
  workspaceSlug,
  currentUserId,
  onEdit,
  onDelete,
  onStatusChange,
  isLoading = false,
  sortBy,
  sortOrder,
  onSort,
}: FollowUpTableProps) {
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [followUpToDelete, setFollowUpToDelete] =
    useState<FollowUpWithDetails | null>(null);

  const handleDeleteClick = useCallback((followUp: FollowUpWithDetails) => {
    setFollowUpToDelete(followUp);
    setDeleteDialogOpen(true);
  }, []);

  const handleDeleteConfirm = useCallback(() => {
    if (followUpToDelete) {
      onDelete(followUpToDelete.id);
      setDeleteDialogOpen(false);
      setFollowUpToDelete(null);
    }
  }, [followUpToDelete, onDelete]);

  const handleDeleteCancel = useCallback(() => {
    setDeleteDialogOpen(false);
    setFollowUpToDelete(null);
  }, []);

  if (isLoading) {
    return (
      <div className="px-0 md:px-2 flex-1 overflow-auto border-t **:data-[slot=table-container]:overflow-visible">
        <Table className="table-fixed min-w-[600px] lg:min-w-[870px]">
          <TableHeader className="sticky top-0 bg-background z-10">
            <TableRow className="hover:bg-transparent">
              <TableHead className="h-10 w-[70px] lg:w-[80px] font-medium text-xs">
                ID
              </TableHead>
              <TableHead className="h-10 w-[200px] sm:w-[280px] lg:w-[350px] font-medium text-xs">
                Title
              </TableHead>
              <TableHead className="h-10 w-[90px] lg:w-[100px] font-medium text-xs">
                Status
              </TableHead>
              <TableHead className="h-10 w-[90px] lg:w-[100px] font-medium text-xs hidden sm:table-cell">
                Priority
              </TableHead>
              <TableHead className="h-10 w-[100px] lg:w-[120px] font-medium text-xs hidden md:table-cell">
                Assignees
              </TableHead>
              <TableHead className="h-10 w-[160px] lg:w-[180px] font-medium text-xs hidden lg:table-cell">
                Submetric
              </TableHead>
              <TableHead className="h-10 w-[48px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {[0, 1, 2, 3, 4].map((rowNum) => (
              <TableRow key={`skeleton-followup-${rowNum}`}>
                <TableCell className="w-[70px] lg:w-[80px] py-3">
                  <Skeleton className="h-4 w-14" />
                </TableCell>
                <TableCell className="w-[200px] sm:w-[280px] lg:w-[350px] py-3">
                  <div className="flex flex-col gap-1">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                </TableCell>
                <TableCell className="w-[90px] lg:w-[100px] py-3">
                  <Skeleton className="h-5 w-16 rounded-full" />
                </TableCell>
                <TableCell className="w-[90px] lg:w-[100px] py-3 hidden sm:table-cell">
                  <div className="flex items-center gap-1.5">
                    <Skeleton className="h-4 w-4" />
                    <Skeleton className="h-4 w-12" />
                  </div>
                </TableCell>
                <TableCell className="w-[100px] lg:w-[120px] py-3 hidden md:table-cell">
                  <div className="flex -space-x-2">
                    <Skeleton className="h-6 w-6 rounded-full" />
                    <Skeleton className="h-6 w-6 rounded-full" />
                  </div>
                </TableCell>
                <TableCell className="w-[160px] lg:w-[180px] py-3 hidden lg:table-cell">
                  <div className="flex flex-col gap-1">
                    <Skeleton className="h-3 w-16" />
                    <Skeleton className="h-4 w-28" />
                  </div>
                </TableCell>
                <TableCell className="w-[48px] py-3">
                  <Skeleton className="h-8 w-8" />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    );
  }

  if (followUps.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 sm:py-16 px-3 sm:px-6 text-center border-t">
        <div className="rounded-full bg-muted p-3 sm:p-4 mb-3 sm:mb-4">
          <Circle className="h-6 w-6 sm:h-8 sm:w-8 text-muted-foreground" />
        </div>
        <h3 className="text-base sm:text-lg font-semibold mb-1">
          No follow-ups found
        </h3>
        <p className="text-xs sm:text-sm text-muted-foreground max-w-sm">
          Create your first follow-up to start tracking tasks and issues in your
          workspace.
        </p>
      </div>
    );
  }

  return (
    <TooltipProvider delayDuration={300}>
      <div className="px-0 md:px-2 flex-1 overflow-auto border-t **:data-[slot=table-container]:overflow-visible">
        <Table className="table-fixed min-w-[600px] lg:min-w-[870px]">
          <TableHeader className="sticky top-0 bg-background z-10">
            <TableRow className="hover:bg-transparent">
              <SortableHeader
                field="identifier"
                className="w-[70px] lg:w-[80px]"
                sortBy={sortBy}
                sortOrder={sortOrder}
                onSort={onSort}
              >
                ID
              </SortableHeader>
              <SortableHeader
                field="title"
                className="w-[200px] sm:w-[280px] lg:w-[350px]"
                sortBy={sortBy}
                sortOrder={sortOrder}
                onSort={onSort}
              >
                Title
              </SortableHeader>
              <SortableHeader
                field="status"
                className="w-[90px] lg:w-[100px]"
                sortBy={sortBy}
                sortOrder={sortOrder}
                onSort={onSort}
              >
                Status
              </SortableHeader>
              <SortableHeader
                field="priority"
                className="w-[90px] lg:w-[100px] hidden sm:table-cell"
                sortBy={sortBy}
                sortOrder={sortOrder}
                onSort={onSort}
              >
                Priority
              </SortableHeader>
              <TableHead className="h-10 w-[100px] lg:w-[120px] font-medium text-xs hidden md:table-cell">
                Assignees
              </TableHead>
              <TableHead className="h-10 w-[160px] lg:w-[180px] font-medium text-xs hidden lg:table-cell">
                Submetric
              </TableHead>
              <TableHead className="h-10 w-[48px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {followUps.map((followUp) => {
              return (
                <TableRow
                  key={followUp.id}
                  className={cn(
                    "cursor-pointer group border-b transition-colors",
                    followUp.status === "resolved"
                      ? "bg-muted/20 hover:bg-muted/30"
                      : "hover:bg-muted/50",
                  )}
                  onClick={() => onEdit(followUp)}
                  title="Click to edit"
                >
                  <TableCell className="w-[70px] lg:w-[80px] py-3 font-mono text-xs text-muted-foreground">
                    {followUp.identifier}
                  </TableCell>
                  <TableCell className="w-[200px] sm:w-[280px] lg:w-[350px] py-3">
                    <div className="flex flex-col gap-1">
                      <div className="font-medium text-sm leading-none truncate">
                        {followUp.title}
                      </div>
                      {followUp.description && (
                        <div className="text-xs text-muted-foreground truncate">
                          {followUp.description}
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="w-[90px] lg:w-[100px] py-3">
                    {followUp.status === "resolved" ? (
                      // Show non-interactive badge when resolved
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-xs font-normal opacity-60 cursor-not-allowed",
                          getStatusBadgeColor(followUp.status),
                        )}
                        title="Reopen to change status"
                      >
                        {getStatusLabel(followUp.status)}
                      </Badge>
                    ) : (
                      // Show dropdown menu for active statuses
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            type="button"
                            onClick={(e) => e.stopPropagation()}
                            className="focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 rounded transition-all hover:scale-105"
                          >
                            <Badge
                              variant="outline"
                              className={cn(
                                "text-xs font-normal cursor-pointer",
                                getStatusBadgeColor(followUp.status),
                              )}
                            >
                              {getStatusLabel(followUp.status)}
                            </Badge>
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" className="w-40">
                          {Object.entries(STATUS_LABELS)
                            .filter(([value]) => value !== "resolved")
                            .map(([value, label]) => (
                              <DropdownMenuItem
                                key={value}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onStatusChange(followUp.id, value);
                                }}
                                className={cn(
                                  followUp.status === value && "bg-accent",
                                )}
                              >
                                <div className="flex items-center gap-2">
                                  {getStatusIcon(value, "h-2 w-2")}
                                  <span className="text-xs">{label}</span>
                                </div>
                              </DropdownMenuItem>
                            ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </TableCell>
                  <TableCell className="w-[90px] lg:w-[100px] py-3 hidden sm:table-cell">
                    <div className="flex items-center gap-1.5">
                      {getPriorityIcon(followUp.priority, "h-4 w-4")}
                      <span className="text-xs text-muted-foreground">
                        {PRIORITY_LABELS[followUp.priority]}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="w-[100px] lg:w-[120px] py-3 hidden md:table-cell">
                    {followUp.assignees && followUp.assignees.length > 0 ? (
                      <div className="flex -space-x-2">
                        {followUp.assignees.slice(0, 3).map((assignee) => {
                          const isCurrentUser =
                            currentUserId && assignee.userId === currentUserId;
                          const displayName =
                            assignee.user.name ||
                            assignee.user.email ||
                            "Unknown";
                          return (
                            <Tooltip key={assignee.id}>
                              <TooltipTrigger asChild>
                                <div className="relative group/avatar cursor-help">
                                  <Avatar className="h-6 w-6 border-2 border-background">
                                    <AvatarImage
                                      src={assignee.user.image || undefined}
                                    />
                                    <AvatarFallback className="text-[10px]">
                                      {getInitials(assignee.user.name)}
                                    </AvatarFallback>
                                  </Avatar>
                                </div>
                              </TooltipTrigger>
                              <TooltipContent
                                side="bottom"
                                sideOffset={4}
                                className="px-2 py-1"
                              >
                                <p className="text-xs">
                                  {displayName}
                                  {isCurrentUser && (
                                    <span className="text-blue-500 ml-1">
                                      (You)
                                    </span>
                                  )}
                                </p>
                              </TooltipContent>
                            </Tooltip>
                          );
                        })}
                        {followUp.assignees.length > 3 && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className="flex items-center justify-center h-6 w-6 rounded-full border-2 border-background bg-muted text-[10px] text-muted-foreground font-medium cursor-help">
                                +{followUp.assignees.length - 3}
                              </div>
                            </TooltipTrigger>
                            <TooltipContent
                              side="bottom"
                              sideOffset={4}
                              className="px-2 py-1"
                            >
                              <div className="text-xs space-y-0.5">
                                {followUp.assignees.slice(3).map((assignee) => {
                                  const isCurrentUser =
                                    currentUserId &&
                                    assignee.userId === currentUserId;
                                  const displayName =
                                    assignee.user.name ||
                                    assignee.user.email ||
                                    "Unknown";
                                  return (
                                    <p key={assignee.id}>
                                      {displayName}
                                      {isCurrentUser && (
                                        <span className="text-blue-500 ml-1">
                                          (You)
                                        </span>
                                      )}
                                    </p>
                                  );
                                })}
                              </div>
                            </TooltipContent>
                          </Tooltip>
                        )}
                      </div>
                    ) : (
                      <span className="text-sm text-muted-foreground">
                        Unassigned
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="w-[160px] lg:w-[180px] py-3 hidden lg:table-cell">
                    {followUp.submetricDefinition ? (
                      <Link
                        href={
                          followUp.slide
                            ? `${generateSlideUrl(
                                workspaceSlug,
                                followUp.slide.slideNumber,
                                followUp.slide.title,
                              )}#${generateChartSlug(
                                followUp.submetricDefinition.category,
                                followUp.submetricDefinition.metricName,
                              )}`
                            : "#"
                        }
                        target="_blank"
                        className="text-sm hover:underline block"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (!followUp.slide) {
                            e.preventDefault();
                          }
                        }}
                      >
                        <div className="flex flex-col gap-0.5">
                          {followUp.submetricDefinition.category && (
                            <span className="text-xs text-muted-foreground truncate">
                              {followUp.submetricDefinition.category}
                            </span>
                          )}
                          <span className="truncate">
                            {followUp.submetricDefinition.metricName ||
                              followUp.submetricDefinition.submetricKey}
                          </span>
                        </div>
                      </Link>
                    ) : (
                      <span className="text-sm text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="w-[48px] py-3">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 hover:bg-muted"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <MoreVertical className="h-4 w-4" />
                          <span className="sr-only">Open menu</span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-44">
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.stopPropagation();
                            onEdit(followUp);
                          }}
                        >
                          <Pencil className="mr-2 h-4 w-4" />
                          Edit
                        </DropdownMenuItem>
                        {followUp.status === "resolved" && (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={(e) => {
                                e.stopPropagation();
                                onStatusChange(followUp.id, "todo");
                              }}
                            >
                              <Circle className="mr-2 h-4 w-4" />
                              Reopen
                            </DropdownMenuItem>
                          </>
                        )}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteClick(followUp);
                          }}
                          className="text-destructive focus:text-destructive"
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

        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Follow-up?</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete{" "}
                <span className="font-semibold text-foreground">
                  {followUpToDelete?.title}
                </span>
                ? This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel
                onClick={handleDeleteCancel}
                className="hidden sm:inline-flex"
              >
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDeleteConfirm}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </TooltipProvider>
  );
}
