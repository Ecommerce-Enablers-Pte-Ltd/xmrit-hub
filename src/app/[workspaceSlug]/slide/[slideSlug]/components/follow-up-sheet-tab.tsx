"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  CheckCircle2,
  Circle,
  MoreVertical,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { useState } from "react";
import { toast } from "sonner";
import { FollowUpDialog } from "@/app/[workspaceSlug]/follow-ups/components/follow-up-dialog";
import {
  getPriorityIcon,
  getPriorityLabel,
  getStatusBadgeColor,
  getStatusIcon,
  getStatusLabel,
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
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useSubmetricFollowUps } from "@/lib/api/follow-ups";
import { useUsers } from "@/lib/api/users";
import { useWorkspace } from "@/lib/api/workspaces";
import { cn, generateSlideUrl, getErrorMessage } from "@/lib/utils";
import type {
  FollowUpPriority,
  FollowUpStatus,
  FollowUpWithDetails,
} from "@/types/db/follow-up";
import type { Slide } from "@/types/db/slide";

function getInitials(name: string | null | undefined): string {
  if (!name) return "?";
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

interface FollowUpTabProps {
  definitionId: string;
  slideId: string;
  workspaceId: string;
}

export function FollowUpTab({
  definitionId,
  slideId,
  workspaceId,
}: FollowUpTabProps) {
  const { data: session } = useSession();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingFollowUp, setEditingFollowUp] =
    useState<FollowUpWithDetails | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [followUpToDelete, setFollowUpToDelete] =
    useState<FollowUpWithDetails | null>(null);
  const { data, isLoading } = useSubmetricFollowUps(definitionId, slideId);

  // Fetch users for assignees using centralized hook
  const { data: usersData = [], isLoading: isLoadingUsers } = useUsers();

  // Fetch workspace with slides using centralized hook
  const { workspace, loading: isLoadingWorkspace } = useWorkspace(workspaceId);

  // Ensure users and slides are always arrays
  const users = usersData;
  const slides = workspace?.slides ?? [];
  const isLoadingSlides = isLoadingWorkspace;

  // Get current slide for date comparison
  const currentSlide = slides.find((s) => s.id === slideId);

  // Create follow-up mutation
  const createFollowUpMutation = useMutation({
    mutationFn: async (data: {
      title: string;
      description: string;
      status: FollowUpStatus;
      priority: FollowUpPriority;
      assigneeIds?: string[];
      slideId?: string;
      submetricDefinitionId?: string;
      resolvedAtSlideId?: string | null;
      dueDate?: string;
    }) => {
      const response = await fetch(
        `/api/workspaces/${workspaceId}/follow-ups`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        },
      );

      if (!response.ok) {
        let errorMessage = "Failed to create follow-up";
        try {
          const errorData = await response.json();
          errorMessage =
            errorData.error ||
            errorData.message ||
            errorData.details?.[0]?.message ||
            errorMessage;
        } catch {
          // If response is not JSON, use status text
          errorMessage = response.statusText || errorMessage;
        }
        throw new Error(errorMessage);
      }

      return response.json();
    },
    onSuccess: () => {
      // Invalidate and refetch the specific submetric follow-ups query immediately
      queryClient.invalidateQueries({
        queryKey: ["follow-ups", "submetric-definition", definitionId, slideId],
        refetchType: "active",
      });

      // Invalidate workspace follow-ups (will refetch if user is viewing that page)
      queryClient.invalidateQueries({
        queryKey: ["follow-ups", "workspace", workspaceId],
        refetchType: "active",
      });

      setDialogOpen(false);
      setEditingFollowUp(null);
      toast.success("Follow-up created successfully");
    },
    onError: (error: Error) => {
      console.error("Error creating follow-up:", error);
      toast.error(getErrorMessage(error, "Failed to create follow-up"));
    },
  });

  // Update follow-up mutation
  const updateFollowUpMutation = useMutation({
    mutationFn: async ({
      followUpId,
      data,
    }: {
      followUpId: string;
      data: {
        title: string;
        description: string;
        status: FollowUpStatus;
        priority: FollowUpPriority;
        assigneeIds?: string[];
        slideId?: string;
        submetricDefinitionId?: string;
        resolvedAtSlideId?: string | null;
        dueDate?: string;
      };
    }) => {
      const response = await fetch(`/api/follow-ups/${followUpId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        let errorMessage = "Failed to update follow-up";
        try {
          const errorData = await response.json();
          errorMessage =
            errorData.error ||
            errorData.message ||
            errorData.details?.[0]?.message ||
            errorMessage;
        } catch {
          // If response is not JSON, use status text
          errorMessage = response.statusText || errorMessage;
        }
        throw new Error(errorMessage);
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["follow-ups", "submetric-definition", definitionId, slideId],
        refetchType: "active",
      });

      queryClient.invalidateQueries({
        queryKey: ["follow-ups", "workspace", workspaceId],
        refetchType: "active",
      });

      setDialogOpen(false);
      setEditingFollowUp(null);
      toast.success("Follow-up updated successfully");
    },
    onError: (error: Error) => {
      console.error("Error updating follow-up:", error);
      toast.error(getErrorMessage(error, "Failed to update follow-up"));
    },
  });

  // Delete follow-up mutation
  const deleteFollowUpMutation = useMutation({
    mutationFn: async (followUpId: string) => {
      const response = await fetch(`/api/follow-ups/${followUpId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        let errorMessage = "Failed to delete follow-up";
        try {
          const errorData = await response.json();
          errorMessage =
            errorData.error ||
            errorData.message ||
            errorData.details?.[0]?.message ||
            errorMessage;
        } catch {
          // If response is not JSON, use status text
          errorMessage = response.statusText || errorMessage;
        }
        throw new Error(errorMessage);
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["follow-ups", "submetric-definition", definitionId, slideId],
        refetchType: "active",
      });

      queryClient.invalidateQueries({
        queryKey: ["follow-ups", "workspace", workspaceId],
        refetchType: "active",
      });

      setDeleteDialogOpen(false);
      setFollowUpToDelete(null);
      toast.success("Follow-up deleted successfully");
    },
    onError: (error: Error) => {
      console.error("Error deleting follow-up:", error);
      toast.error(getErrorMessage(error, "Failed to delete follow-up"));
    },
  });

  const handleSaveFollowUp = (data: {
    title: string;
    description: string;
    status: FollowUpStatus;
    priority: FollowUpPriority;
    assigneeIds?: string[];
    slideId?: string;
    submetricDefinitionId?: string;
    resolvedAtSlideId?: string | null;
    dueDate?: string;
  }) => {
    if (editingFollowUp) {
      // Update existing follow-up
      updateFollowUpMutation.mutate({
        followUpId: editingFollowUp.id,
        data,
      });
    } else {
      // Create new follow-up
      // Pre-fill submetricDefinitionId if not already set and we have a definitionId
      const followUpData = {
        ...data,
        submetricDefinitionId: data.submetricDefinitionId || definitionId,
      };
      createFollowUpMutation.mutate(followUpData);
    }
  };

  const handleEditFollowUp = (followUp: FollowUpWithDetails) => {
    setEditingFollowUp(followUp);
    setDialogOpen(true);
  };

  const handleDeleteClick = (followUp: FollowUpWithDetails) => {
    setFollowUpToDelete(followUp);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = () => {
    if (followUpToDelete) {
      deleteFollowUpMutation.mutate(followUpToDelete.id);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4 px-6 py-4">
        {[1, 2, 3].map((i) => (
          <div key={`skeleton-${i}`} className="space-y-2">
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-20 w-full rounded-lg" />
          </div>
        ))}
      </div>
    );
  }

  // Split follow-ups based on status
  const resolved = data?.resolved || [];
  const unresolved = data?.unresolved || [];

  return (
    <>
      <div className="flex-1 flex flex-col min-h-0">
        {/* New Follow-up Button */}
        <div className="px-6 pb-4 border-b shrink-0">
          <Button
            className="w-full"
            size="sm"
            onClick={() => setDialogOpen(true)}
            disabled={isLoadingUsers || isLoadingSlides}
          >
            <Plus className="h-4 w-4 mr-1" />
            {isLoadingUsers || isLoadingSlides ? "Loading..." : "New Follow-up"}
          </Button>
        </div>

        {/* Follow-ups List */}
        <div className="flex-1 min-h-0 overflow-hidden">
          <ScrollArea className="h-full">
            <div className="px-6 py-4 space-y-6">
              {/* Active Section */}
              {unresolved.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 pb-2">
                    <h3 className="font-semibold text-sm text-foreground">
                      Active
                    </h3>
                    <Badge
                      variant="secondary"
                      className="text-xs bg-blue-600 dark:bg-blue-700 text-white"
                    >
                      {unresolved.length}
                    </Badge>
                  </div>
                  <div className="space-y-3">
                    {unresolved.map((followUp) => (
                      <FollowUpCard
                        key={followUp.id}
                        followUp={followUp}
                        slideId={slideId}
                        workspaceId={workspaceId}
                        workspaceSlug={workspace?.slug ?? ""}
                        isResolved={false}
                        currentUserId={session?.user?.id}
                        currentSlide={currentSlide}
                        onEdit={handleEditFollowUp}
                        onDelete={handleDeleteClick}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Resolved Section */}
              {resolved.length > 0 && (
                <div className="space-y-3">
                  <div
                    className={cn(
                      "flex items-center gap-2 pb-2",
                      unresolved.length > 0 && "border-t pt-4",
                    )}
                  >
                    <h3 className="font-semibold text-sm text-muted-foreground">
                      Resolved
                    </h3>
                    <Badge
                      variant="outline"
                      className="text-xs text-muted-foreground"
                    >
                      {resolved.length}
                    </Badge>
                  </div>
                  <div className="space-y-3">
                    {resolved.map((followUp) => (
                      <FollowUpCard
                        key={followUp.id}
                        followUp={followUp}
                        slideId={slideId}
                        workspaceId={workspaceId}
                        workspaceSlug={workspace?.slug ?? ""}
                        isResolved={true}
                        currentUserId={session?.user?.id}
                        currentSlide={currentSlide}
                        onEdit={handleEditFollowUp}
                        onDelete={handleDeleteClick}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Empty State */}
              {unresolved.length === 0 && resolved.length === 0 && (
                <div className="h-[calc(100vh-20rem)] flex flex-col items-center justify-center text-center text-muted-foreground">
                  <div className="flex items-center justify-center h-20 w-20 rounded-full bg-muted/30 mb-4">
                    <Plus className="h-10 w-10 opacity-40" />
                  </div>
                  <p className="text-lg font-medium mb-1">No follow-ups yet</p>
                  <p className="text-sm">
                    Create a follow-up to track action items
                  </p>
                </div>
              )}
            </div>
          </ScrollArea>
        </div>
      </div>

      {/* Follow-up Dialog - Always render, let open prop control visibility */}
      <FollowUpDialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) {
            setEditingFollowUp(null);
          }
        }}
        followUp={editingFollowUp}
        users={users}
        slides={slides}
        onSave={handleSaveFollowUp}
        isLoading={
          createFollowUpMutation.isPending || updateFollowUpMutation.isPending
        }
        defaultSlideId={slideId}
        defaultSubmetricDefinitionId={definitionId}
        currentSlideId={slideId}
      />

      {/* Delete Confirmation Dialog */}
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
              onClick={() => {
                setDeleteDialogOpen(false);
                setFollowUpToDelete(null);
              }}
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
    </>
  );
}

// Follow-up card component
interface FollowUpCardProps {
  followUp: FollowUpWithDetails;
  slideId: string;
  workspaceId: string;
  workspaceSlug: string;
  isResolved: boolean;
  currentUserId?: string;
  currentSlide?: Slide;
  onEdit: (followUp: FollowUpWithDetails) => void;
  onDelete: (followUp: FollowUpWithDetails) => void;
}

function FollowUpCard({
  followUp,
  slideId,
  workspaceId,
  workspaceSlug,
  isResolved,
  currentUserId,
  currentSlide,
  onEdit,
  onDelete,
}: FollowUpCardProps) {
  const queryClient = useQueryClient();
  const priorityIcon = getPriorityIcon(followUp.priority);

  // Check if current slide is before the slide where follow-up was created
  const isCurrentSlideBeforeCreation = (() => {
    if (!currentSlide?.slideDate || !followUp.slide?.slideDate) {
      return false; // If either date is missing, allow resolution
    }
    const currentDate = new Date(currentSlide.slideDate);
    const creationDate = new Date(followUp.slide.slideDate);

    // Validate dates
    if (
      Number.isNaN(currentDate.getTime()) ||
      Number.isNaN(creationDate.getTime())
    ) {
      return false; // If either date is invalid, allow resolution
    }

    return currentDate < creationDate;
  })();

  // Mutation to update follow-up status
  const updateStatusMutation = useMutation({
    mutationFn: async (newStatus: FollowUpStatus) => {
      const response = await fetch(`/api/follow-ups/${followUp.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });

      if (!response.ok) {
        let errorMessage = "Failed to update status";
        try {
          const errorData = await response.json();
          errorMessage =
            errorData.error ||
            errorData.message ||
            errorData.details?.[0]?.message ||
            errorMessage;
        } catch {
          // If response is not JSON, use status text
          errorMessage = response.statusText || errorMessage;
        }
        throw new Error(errorMessage);
      }

      return response.json();
    },
    onSuccess: () => {
      // Invalidate the submetric follow-ups query to refetch immediately
      queryClient.invalidateQueries({
        queryKey: [
          "follow-ups",
          "submetric-definition",
          followUp.submetricDefinitionId,
          slideId,
        ],
        refetchType: "active",
      });

      // Invalidate workspace follow-ups
      queryClient.invalidateQueries({
        queryKey: ["follow-ups", "workspace", workspaceId],
        refetchType: "active",
      });

      toast.success("Status updated");
    },
    onError: (error: Error) => {
      console.error("Error updating status:", error);
      toast.error(getErrorMessage(error, "Failed to update status"));
    },
  });

  // Mutation to resolve/unresolve follow-up
  const updateFollowUpMutation = useMutation({
    mutationFn: async (data: {
      status: FollowUpStatus;
      resolvedAtSlideId: string | null;
    }) => {
      const response = await fetch(`/api/follow-ups/${followUp.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        let errorMessage = "Failed to update follow-up";
        try {
          const errorData = await response.json();
          errorMessage =
            errorData.error ||
            errorData.message ||
            errorData.details?.[0]?.message ||
            errorMessage;
        } catch {
          // If response is not JSON, use status text
          errorMessage = response.statusText || errorMessage;
        }
        throw new Error(errorMessage);
      }

      return response.json();
    },
    onSuccess: () => {
      // Invalidate the submetric follow-ups query to refetch immediately
      queryClient.invalidateQueries({
        queryKey: [
          "follow-ups",
          "submetric-definition",
          followUp.submetricDefinitionId,
          slideId,
        ],
        refetchType: "active",
      });

      // Invalidate workspace follow-ups
      queryClient.invalidateQueries({
        queryKey: ["follow-ups", "workspace", workspaceId],
        refetchType: "active",
      });

      toast.success(isResolved ? "Moved to Todo" : "Follow-up resolved");
    },
    onError: (error: Error) => {
      console.error("Error updating follow-up:", error);
      toast.error(getErrorMessage(error, "Failed to update follow-up"));
    },
  });

  const handleToggleResolve = () => {
    if (isResolved) {
      // Unresolve: Move back to todo and clear resolvedAtSlideId
      updateFollowUpMutation.mutate({
        status: "todo",
        resolvedAtSlideId: null,
      });
    } else {
      // Resolve: Change status to resolved and set resolvedAtSlideId
      updateFollowUpMutation.mutate({
        status: "resolved",
        resolvedAtSlideId: slideId,
      });
    }
  };

  // Can show resolve button if status is done or cancelled (to move to resolved)
  const canShowResolveButton =
    followUp.status === "done" || followUp.status === "cancelled";

  // Can only resolve if current slide is not before creation
  const canResolve = !isCurrentSlideBeforeCreation;

  // Tooltip message
  const resolveTooltipMessage = (() => {
    if (isCurrentSlideBeforeCreation) {
      return "Cannot resolve on a slide before it was created";
    }
    if (followUp.status === "done") {
      return "Mark as resolved (final state)";
    }
    if (followUp.status === "cancelled") {
      return "Mark as resolved (final state)";
    }
    return "Mark as resolved";
  })();

  return (
    <div
      className={cn(
        "rounded-lg border p-4 space-y-3 transition-all bg-card hover:shadow-sm",
      )}
    >
      {/* Header with identifier and status */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <Link
            href={`/${workspaceSlug}/follow-ups`}
            className="text-xs font-mono text-muted-foreground hover:text-primary"
          >
            {followUp.identifier}
          </Link>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                disabled={isResolved}
                className={cn(
                  "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 rounded transition-all",
                  !isResolved && "hover:scale-105",
                )}
              >
                <Badge
                  variant="outline"
                  className={cn(
                    "text-xs gap-1.5",
                    !isResolved && "cursor-pointer",
                    isResolved && "opacity-60 cursor-not-allowed",
                    getStatusBadgeColor(followUp.status),
                  )}
                >
                  {getStatusLabel(followUp.status)}
                </Badge>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-40">
              {Object.entries(STATUS_LABELS)
                .filter(([value]) => value !== "resolved") // Don't show resolved in dropdown
                .map(([value, label]) => (
                  <DropdownMenuItem
                    key={value}
                    onClick={() =>
                      updateStatusMutation.mutate(value as FollowUpStatus)
                    }
                    className={cn(followUp.status === value && "bg-accent")}
                  >
                    <div className="flex items-center gap-2">
                      {getStatusIcon(value as FollowUpStatus, "h-2 w-2")}
                      <span className="text-xs">{label}</span>
                    </div>
                  </DropdownMenuItem>
                ))}
            </DropdownMenuContent>
          </DropdownMenu>
          {followUp.priority !== "no_priority" && (
            <Badge variant="outline" className="text-xs gap-1">
              {priorityIcon}
              {getPriorityLabel(followUp.priority)}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {/* Resolve Button - Only shown for done/cancelled status */}
          {canShowResolveButton && !isResolved && (
            <TooltipProvider delayDuration={300}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0"
                    onClick={handleToggleResolve}
                    disabled={updateFollowUpMutation.isPending || !canResolve}
                  >
                    <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top">
                  <p className="text-xs">{resolveTooltipMessage}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}

          {/* More Actions Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0"
                onClick={(e) => e.stopPropagation()}
              >
                <MoreVertical className="h-4 w-4" />
                <span className="sr-only">More actions</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuItem onClick={() => onEdit(followUp)}>
                <Pencil className="mr-2 h-4 w-4" />
                Edit
              </DropdownMenuItem>
              {isResolved && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={handleToggleResolve}
                    disabled={updateFollowUpMutation.isPending}
                  >
                    <Circle className="mr-2 h-4 w-4" />
                    Reopen
                  </DropdownMenuItem>
                </>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => onDelete(followUp)}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="mr-2 h-4 w-4 text-destructive" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Title */}
      <h4 className="font-semibold text-sm leading-snug">{followUp.title}</h4>

      {/* Description */}
      {followUp.description && (
        <p className="text-sm text-muted-foreground line-clamp-2">
          {followUp.description}
        </p>
      )}

      {/* Metadata */}
      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        {followUp.slide && (
          <span>
            Created on{" "}
            <button
              type="button"
              onClick={() =>
                followUp.slide &&
                window.open(
                  generateSlideUrl(
                    workspaceSlug,
                    followUp.slide.slideNumber,
                    followUp.slide.title,
                  ),
                  "_blank",
                )
              }
              className="text-primary hover:underline cursor-pointer"
            >
              {followUp.slide.title}
            </button>
          </span>
        )}
        {/* Show resolution info if resolved */}
        {followUp.resolvedAtSlide && isResolved && (
          <span>
            Resolved on{" "}
            <button
              type="button"
              onClick={() =>
                followUp.resolvedAtSlide &&
                window.open(
                  generateSlideUrl(
                    workspaceSlug,
                    followUp.resolvedAtSlide.slideNumber,
                    followUp.resolvedAtSlide.title,
                  ),
                  "_blank",
                )
              }
              className="text-primary hover:underline cursor-pointer"
            >
              {followUp.resolvedAtSlide.title}
            </button>
          </span>
        )}
      </div>

      {/* Assignees */}
      {followUp.assignees && followUp.assignees.length > 0 && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Assigned to:</span>
          <TooltipProvider delayDuration={300}>
            <div className="flex -space-x-2">
              {followUp.assignees.slice(0, 3).map((assignee) => {
                const isCurrentUser =
                  currentUserId && assignee.userId === currentUserId;
                const displayName =
                  assignee.user.name || assignee.user.email || "Unknown";
                return (
                  <Tooltip key={assignee.id}>
                    <TooltipTrigger asChild>
                      <div className="cursor-help">
                        <Avatar className="h-6 w-6 border-2 border-background">
                          <AvatarImage src={assignee.user.image || undefined} />
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
                          <span className="text-blue-500 ml-1">(You)</span>
                        )}
                      </p>
                    </TooltipContent>
                  </Tooltip>
                );
              })}
              {followUp.assignees.length > 3 && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="h-6 w-6 rounded-full border-2 border-background bg-muted flex items-center justify-center text-xs cursor-help">
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
                          currentUserId && assignee.userId === currentUserId;
                        const displayName =
                          assignee.user.name ||
                          assignee.user.email ||
                          "Unknown";
                        return (
                          <p key={assignee.id}>
                            {displayName}
                            {isCurrentUser && (
                              <span className="text-blue-500 ml-1">(You)</span>
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
        </div>
      )}
    </div>
  );
}
