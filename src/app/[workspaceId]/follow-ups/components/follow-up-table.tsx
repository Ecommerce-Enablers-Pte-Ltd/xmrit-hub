"use client";

import {
  ArrowDownIcon,
  ArrowUpDown,
  ArrowUpIcon,
  Calendar,
  Circle,
  MoreVertical,
  Pencil,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
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
import {
  getPriorityIcon,
  getStatusBadgeColor,
  getStatusIcon,
  getStatusLabel,
  PRIORITY_LABELS,
  STATUS_COLORS,
  STATUS_LABELS,
} from "@/lib/follow-up-utils";
import { cn } from "@/lib/utils";
import type { FollowUpWithDetails } from "@/types/db/follow-up";

type SortField =
  | "identifier"
  | "title"
  | "status"
  | "priority"
  | "dueDate"
  | "createdAt";

interface FollowUpTableProps {
  followUps: FollowUpWithDetails[];
  workspaceId: string;
  currentUserId?: string; // Current user's ID to highlight their assignments
  onEdit: (followUp: FollowUpWithDetails) => void;
  onDelete: (followUpId: string) => void;
  onStatusChange: (followUpId: string, status: string) => void;
  isLoading?: boolean;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
  onSort?: (field: SortField) => void;
}

function getInitials(name: string | null | undefined): string {
  if (!name) return "?";
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function isOverdue(dueDate: string | null): boolean {
  if (!dueDate) return false;
  return new Date(dueDate) < new Date();
}

export function FollowUpTable({
  followUps,
  workspaceId,
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

  // Sortable column header component
  const SortableHeader = ({
    field,
    children,
    className,
  }: {
    field: SortField;
    children: React.ReactNode;
    className?: string;
  }) => {
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
  };

  const handleDeleteClick = (followUp: FollowUpWithDetails) => {
    setFollowUpToDelete(followUp);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = () => {
    if (followUpToDelete) {
      onDelete(followUpToDelete.id);
      setDeleteDialogOpen(false);
      setFollowUpToDelete(null);
    }
  };

  const handleDeleteCancel = () => {
    setDeleteDialogOpen(false);
    setFollowUpToDelete(null);
  };

  if (isLoading) {
    return (
      <div className="px-6 pb-6">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent border-t">
              <TableHead className="h-10 w-[100px] font-medium text-xs">
                ID
              </TableHead>
              <TableHead className="h-10 w-[300px] font-medium text-xs">
                Title
              </TableHead>
              <TableHead className="h-10 w-[120px] font-medium text-xs">
                Status
              </TableHead>
              <TableHead className="h-10 w-[120px] font-medium text-xs">
                Priority
              </TableHead>
              <TableHead className="h-10 w-[150px] font-medium text-xs">
                Assignees
              </TableHead>
              <TableHead className="h-10 w-[120px] font-medium text-xs">
                Due Date
              </TableHead>
              <TableHead className="h-10 w-[150px] font-medium text-xs">
                Slide
              </TableHead>
              <TableHead className="h-10 w-[60px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {[0, 1, 2, 3, 4].map((rowNum) => (
              <TableRow key={`skeleton-followup-${rowNum}`}>
                <TableCell>
                  <Skeleton className="h-4 w-[5vw]" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-4 w-[20vw]" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-5 w-[6vw]" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-5 w-[6vw]" />
                </TableCell>
                <TableCell>
                  <div className="flex -space-x-2">
                    <Skeleton className="h-6 w-6 rounded-full" />
                    <Skeleton className="h-6 w-6 rounded-full" />
                    <Skeleton className="h-6 w-6 rounded-full" />
                  </div>
                </TableCell>
                <TableCell>
                  <Skeleton className="h-4 w-[6vw]" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-4 w-[10vw]" />
                </TableCell>
                <TableCell>
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
      <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
        <div className="rounded-full bg-muted p-4 mb-4">
          <Circle className="h-8 w-8 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-semibold mb-1">No follow-ups found</h3>
        <p className="text-sm text-muted-foreground max-w-sm">
          Create your first follow-up to start tracking tasks and issues in your
          workspace.
        </p>
      </div>
    );
  }

  return (
    <div className="px-6 pb-6">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent border-t">
            <SortableHeader field="identifier" className="w-[100px]">
              ID
            </SortableHeader>
            <SortableHeader field="title" className="w-[300px]">
              Title
            </SortableHeader>
            <SortableHeader field="status" className="w-[120px]">
              Status
            </SortableHeader>
            <SortableHeader field="priority" className="w-[120px]">
              Priority
            </SortableHeader>
            <TableHead className="h-10 w-[150px] font-medium text-xs">
              Assignees
            </TableHead>
            <SortableHeader field="dueDate" className="w-[120px]">
              Due Date
            </SortableHeader>
            <TableHead className="h-10 w-[150px] font-medium text-xs">
              Slide
            </TableHead>
            <TableHead className="h-10 w-[60px]"></TableHead>
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
                <TableCell className="py-3 font-mono text-xs text-muted-foreground">
                  {followUp.identifier}
                </TableCell>
                <TableCell className="py-3">
                  <div className="flex flex-col gap-1">
                    <div className="font-medium text-sm leading-none max-w-[20vw] truncate">
                      {followUp.title}
                    </div>
                    {followUp.description && (
                      <div className="text-xs text-muted-foreground line-clamp-1">
                        {followUp.description}
                      </div>
                    )}
                  </div>
                </TableCell>
                <TableCell className="py-3">
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
                <TableCell className="py-3">
                  <div className="flex items-center gap-1.5">
                    {getPriorityIcon(followUp.priority, "h-4 w-4")}
                    <span className="text-xs text-muted-foreground">
                      {PRIORITY_LABELS[followUp.priority]}
                    </span>
                  </div>
                </TableCell>
                <TableCell className="py-3">
                  {followUp.assignees && followUp.assignees.length > 0 ? (
                    <TooltipProvider delayDuration={300}>
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
                    </TooltipProvider>
                  ) : (
                    <span className="text-sm text-muted-foreground">
                      Unassigned
                    </span>
                  )}
                </TableCell>
                <TableCell className="py-3">
                  {followUp.dueDate ? (
                    <div
                      className={cn(
                        "flex items-center gap-1.5 text-sm",
                        isOverdue(followUp.dueDate) &&
                          followUp.status !== "done" &&
                          followUp.status !== "cancelled" &&
                          followUp.status !== "resolved" &&
                          "text-red-600 dark:text-red-400",
                      )}
                    >
                      <Calendar className="h-3.5 w-3.5" />
                      <span>
                        {new Date(followUp.dueDate).toLocaleDateString(
                          "en-US",
                          {
                            month: "short",
                            day: "numeric",
                          },
                        )}
                      </span>
                    </div>
                  ) : (
                    <span className="text-sm text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell className="py-3">
                  {followUp.slide ? (
                    <Link
                      href={`/${workspaceId}/slide/${followUp.slideId}`}
                      target="_blank"
                      className="text-sm hover:underline truncate max-w-[140px] block"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {followUp.slide.title}
                    </Link>
                  ) : (
                    <span className="text-sm text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell className="py-3">
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
            <AlertDialogCancel onClick={handleDeleteCancel}>
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
  );
}
