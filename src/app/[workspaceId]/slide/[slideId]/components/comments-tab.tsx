"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ChevronLeft,
  ChevronRight,
  CornerDownRight,
  MessageSquare,
  MoreVertical,
  Pencil,
  Send,
  Trash2,
  X,
} from "lucide-react";
import Image from "next/image";
import { useSession } from "next-auth/react";
import { useCallback, useEffect, useRef, useState } from "react";
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
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import type { TimeBucket } from "@/lib/time-buckets";
import { getBucketLabel } from "@/lib/time-buckets";
import { cn } from "@/lib/utils";
import { useInvalidateCommentCounts } from "@/providers/comment-counts-provider";
import type {
  CommentThreadResponse,
  CommentWithUser,
} from "@/types/db/comment";

export interface DataPoint {
  timestamp: string;
  bucketValue: string;
}

interface CommentsTabProps {
  definitionId: string;
  bucketType: TimeBucket;
  bucketValue: string;
  allDataPoints?: DataPoint[];
  onCommentAdded?: (bucketValue: string) => void;
  slideId: string;
  initialFilterToAll?: boolean;
}

export function CommentsTab({
  definitionId,
  bucketType,
  bucketValue: initialBucketValue,
  allDataPoints,
  onCommentAdded,
  slideId,
  initialFilterToAll = false,
}: CommentsTabProps) {
  const { data: session } = useSession();
  const queryClient = useQueryClient();
  const { invalidateCounts } = useInvalidateCommentCounts();
  const [newCommentBody, setNewCommentBody] = useState("");
  const [replyToId, setReplyToId] = useState<string | null>(null);
  const [replyToThreadId, setReplyToThreadId] = useState<string | null>(null);
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editingBody, setEditingBody] = useState("");
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [expandedReplies, setExpandedReplies] = useState<Set<string>>(
    new Set(),
  );
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const editTextareaRef = useRef<HTMLTextAreaElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  // Filter state: "all" means show all comments, otherwise filter to specific date
  const [selectedFilter, setSelectedFilter] = useState<string>(
    initialFilterToAll ? "all" : initialBucketValue,
  );

  // Determine what to display based on filter
  const isShowingAll = selectedFilter === "all";
  const bucketValue = isShowingAll ? initialBucketValue : selectedFilter;
  const displayLabel = isShowingAll
    ? "All Comments"
    : allDataPoints?.find((p) => p.bucketValue === selectedFilter)?.timestamp ||
      getBucketLabel(selectedFilter, bucketType);

  // Fetch point-specific comments using React Query
  const { data: threadData, isLoading: isLoadingPoint } = useQuery({
    queryKey: ["comments", "point", definitionId, bucketType, bucketValue],
    queryFn: async () => {
      const params = new URLSearchParams({
        bucketType,
        bucketValue,
      });

      const response = await fetch(
        `/api/submetrics/definitions/${definitionId}/points?${params}`,
      );

      if (!response.ok) {
        throw new Error("Failed to fetch point comments");
      }

      return response.json() as Promise<CommentThreadResponse>;
    },
    enabled: !!definitionId && !isShowingAll && !!bucketValue,
    staleTime: 1 * 60 * 1000, // 1 minute - comments update frequently when active
    gcTime: 5 * 60 * 1000, // 5 minutes cache
    refetchOnWindowFocus: false, // Don't auto-refetch on focus
  });

  // Fetch all comments for the chart using React Query
  const { data: allCommentsData, isLoading: isLoadingAll } = useQuery({
    queryKey: ["comments", "all", definitionId],
    queryFn: async () => {
      const response = await fetch(
        `/api/submetrics/definitions/${definitionId}/points`,
      );

      if (!response.ok) {
        throw new Error("Failed to fetch all comments");
      }

      return response.json() as Promise<{ threads: CommentThreadResponse[] }>;
    },
    enabled: !!definitionId,
    staleTime: 1 * 60 * 1000, // 1 minute - comments update frequently when active
    gcTime: 5 * 60 * 1000, // 5 minutes cache
    refetchOnWindowFocus: false, // Don't auto-refetch on focus
  });

  const loading = isShowingAll ? isLoadingAll : isLoadingPoint;

  // Scroll to bottom of comments
  const scrollToBottom = useCallback(() => {
    if (scrollAreaRef.current) {
      const scrollContainer = scrollAreaRef.current.querySelector(
        "[data-radix-scroll-area-viewport]",
      );
      if (scrollContainer) {
        setTimeout(() => {
          scrollContainer.scrollTop = scrollContainer.scrollHeight;
        }, 100);
      }
    }
  }, []);

  // Mutation for creating comments
  const createCommentMutation = useMutation({
    mutationFn: async (data: {
      body: string;
      parentId: string | null;
      bucketType: TimeBucket;
      bucketValue: string;
    }) => {
      const response = await fetch(
        `/api/submetrics/definitions/${definitionId}/points`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            bucketType: data.bucketType,
            bucketValue: data.bucketValue,
            body: data.body,
            parentId: data.parentId,
          }),
        },
      );

      if (!response.ok) {
        throw new Error("Failed to post comment");
      }

      return response.json();
    },
    onSuccess: (_, variables) => {
      // Only invalidate the specific point query for the bucket we commented on
      queryClient.invalidateQueries({
        queryKey: [
          "comments",
          "point",
          definitionId,
          variables.bucketType,
          variables.bucketValue,
        ],
      });

      // If we're viewing "all comments", also invalidate that
      if (isShowingAll) {
        queryClient.invalidateQueries({
          queryKey: ["comments", "all", definitionId],
        });
      }

      // Invalidate comment counts to update indicators on charts
      invalidateCounts(slideId);

      // Clear form
      setNewCommentBody("");
      setReplyToId(null);
      setReplyToThreadId(null);

      // Reset textarea height
      if (textareaRef.current) {
        textareaRef.current.style.height = "32px";
      }

      // Scroll to show the new comment
      scrollToBottom();

      // Show success toast
      toast.success(replyToId ? "Reply posted" : "Comment posted");

      // Notify parent component to invalidate cache
      if (onCommentAdded) {
        onCommentAdded(bucketValue);
      }
    },
    onError: (error) => {
      console.error("Error submitting comment:", error);
      toast.error("Failed to post comment");
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!newCommentBody.trim() || createCommentMutation.isPending) return;

    // Determine which bucket to post to
    let targetBucketType = bucketType;
    let targetBucketValue = bucketValue;

    // If replying in "All Comments" view, use the thread's bucket info
    if (isShowingAll && replyToThreadId) {
      const thread = allThreads.find((t) => t.thread.id === replyToThreadId);
      if (thread?.thread.bucketType && thread?.thread.bucketValue) {
        targetBucketType = thread.thread.bucketType;
        targetBucketValue = thread.thread.bucketValue;
      }
    }

    createCommentMutation.mutate({
      body: newCommentBody.trim(),
      parentId: replyToId,
      bucketType: targetBucketType,
      bucketValue: targetBucketValue,
    });
  };

  // Auto-focus textarea when sheet opens (but not when replying, that's handled below)
  useEffect(() => {
    if (!isShowingAll && !replyToId && session) {
      // Delay to ensure the sheet animation and DOM rendering complete
      const timer = setTimeout(() => {
        textareaRef.current?.focus();
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [isShowingAll, session, replyToId]);

  // Auto-focus textarea when replying
  useEffect(() => {
    if (replyToId && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [replyToId]);

  // Auto-resize textarea as content changes
  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setNewCommentBody(e.target.value);

    // Auto-resize
    const textarea = e.target;
    textarea.style.height = "auto";
    const newHeight = Math.max(32, Math.min(textarea.scrollHeight, 200)); // Min 32px, Max height of 200px
    textarea.style.height = `${newHeight}px`;
  };

  const handleReply = (commentId: string, threadId?: string) => {
    setReplyToId(commentId);
    if (threadId) {
      setReplyToThreadId(threadId);
    }
  };

  const cancelReply = () => {
    setReplyToId(null);
    setReplyToThreadId(null);
    // Optionally clear the comment body and reset height when canceling reply
    if (textareaRef.current) {
      textareaRef.current.style.height = "32px";
    }
  };

  const handleEditStart = (comment: CommentWithUser) => {
    setEditingCommentId(comment.id);
    setEditingBody(comment.body);
    // Auto-resize will happen in the useEffect below
  };

  const handleEditCancel = () => {
    setEditingCommentId(null);
    setEditingBody("");
  };

  // Auto-resize edit textarea when editing starts
  useEffect(() => {
    if (editingCommentId && editTextareaRef.current) {
      const textarea = editTextareaRef.current;
      textarea.style.height = "auto";
      const newHeight = Math.min(textarea.scrollHeight, 200);
      textarea.style.height = `${newHeight}px`;
      textarea.focus();
    }
  }, [editingCommentId]);

  const handleEditTextareaChange = (
    e: React.ChangeEvent<HTMLTextAreaElement>,
  ) => {
    setEditingBody(e.target.value);

    // Auto-resize
    const textarea = e.target;
    textarea.style.height = "auto";
    const newHeight = Math.min(textarea.scrollHeight, 200);
    textarea.style.height = `${newHeight}px`;
  };

  // Mutation for editing comments
  const editCommentMutation = useMutation({
    mutationFn: async (data: { commentId: string; body: string }) => {
      const response = await fetch(
        `/api/submetrics/definitions/${definitionId}/points/comments/${data.commentId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            body: data.body,
          }),
        },
      );

      if (!response.ok) {
        throw new Error("Failed to update comment");
      }

      return response.json();
    },
    onSuccess: () => {
      // Only invalidate the specific point query for the bucket we're viewing
      queryClient.invalidateQueries({
        queryKey: ["comments", "point", definitionId, bucketType, bucketValue],
      });

      // If we're viewing "all comments", also invalidate that
      if (isShowingAll) {
        queryClient.invalidateQueries({
          queryKey: ["comments", "all", definitionId],
        });
      }

      // Invalidate comment counts (in case edited comment was deleted/restored)
      invalidateCounts(slideId);

      setEditingCommentId(null);
      setEditingBody("");

      toast.success("Comment updated");
    },
    onError: (error) => {
      console.error("Error updating comment:", error);
      toast.error("Failed to update comment");
    },
  });

  const handleEditSave = async (commentId: string) => {
    if (!editingBody.trim() || editCommentMutation.isPending) return;

    editCommentMutation.mutate({
      commentId,
      body: editingBody.trim(),
    });
  };

  // Mutation for deleting comments
  const deleteCommentMutation = useMutation({
    mutationFn: async (commentId: string) => {
      const response = await fetch(
        `/api/submetrics/definitions/${definitionId}/points/comments/${commentId}`,
        {
          method: "DELETE",
        },
      );

      if (!response.ok) {
        throw new Error("Failed to delete comment");
      }

      return response.json();
    },
    onSuccess: (result) => {
      const deletedIds = result.deletedIds || [deleteConfirmId];
      const deletedCount = deletedIds.length;

      // Only invalidate the specific point query for the bucket we're viewing
      queryClient.invalidateQueries({
        queryKey: ["comments", "point", definitionId, bucketType, bucketValue],
      });

      // If we're viewing "all comments", also invalidate that
      if (isShowingAll) {
        queryClient.invalidateQueries({
          queryKey: ["comments", "all", definitionId],
        });
      }

      // Invalidate comment counts to update indicators on charts
      invalidateCounts(slideId);

      setDeleteConfirmId(null);

      // Show success toast
      toast.success(
        deletedCount > 1
          ? `Comment and ${deletedCount - 1} ${
              deletedCount - 1 === 1 ? "reply" : "replies"
            } deleted`
          : "Comment deleted",
      );

      // Notify parent to invalidate cache
      if (onCommentAdded) {
        onCommentAdded(bucketValue);
      }
    },
    onError: (error) => {
      console.error("Error deleting comment:", error);
      toast.error("Failed to delete comment");
    },
  });

  const handleDeleteConfirm = async () => {
    if (!deleteConfirmId || deleteCommentMutation.isPending) return;

    deleteCommentMutation.mutate(deleteConfirmId);
  };

  // Build comment tree for nested display
  const buildCommentTree = (
    comments: CommentWithUser[],
  ): Map<string | null, CommentWithUser[]> => {
    const tree = new Map<string | null, CommentWithUser[]>();

    for (const comment of comments) {
      const parentId = comment.parentId;
      if (!tree.has(parentId)) {
        tree.set(parentId, []);
      }
      tree.get(parentId)?.push(comment);
    }

    return tree;
  };

  const renderComment = (
    comment: CommentWithUser,
    tree: Map<string | null, CommentWithUser[]>,
    depth: number = 0,
    threadId?: string,
  ) => {
    const replies = tree.get(comment.id) || [];
    const isReplyingTo = replyToId === comment.id;
    const isEditing = editingCommentId === comment.id;
    const isOwnComment = session?.user?.id === comment.userId;
    const MAX_VISIBLE_DEPTH = 1;
    const shouldCollapseDepth =
      depth >= MAX_VISIBLE_DEPTH && replies.length > 0;
    const isDepthExpanded = expandedReplies.has(`depth-${comment.id}`);

    return (
      <div key={comment.id} className={cn(depth > 0 && "ml-6 mt-3")}>
        <div className="group relative flex gap-3">
          {depth > 0 && (
            <CornerDownRight className="absolute -left-6 top-2 h-4 w-4 text-muted-foreground/30" />
          )}

          <Avatar className="h-9 w-9 shrink-0 border-2 border-background shadow-sm">
            {comment.user.image ? (
              <Image
                src={comment.user.image}
                alt={comment.user.name || "User"}
                width={36}
                height={36}
                className="h-full w-full object-cover"
                unoptimized
              />
            ) : (
              <div className="h-full w-full bg-linear-to-br from-primary/20 to-primary/10 flex items-center justify-center text-sm font-semibold text-primary">
                {(comment.user.name ||
                  comment.user.email ||
                  "U")[0].toUpperCase()}
              </div>
            )}
          </Avatar>

          <div className="flex-1 min-w-0 rounded-lg bg-muted/30 p-3">
            <div className="flex items-center gap-2 mb-1.5">
              <span className="font-semibold text-sm truncate">
                {comment.user.name || comment.user.email || "Anonymous"}
              </span>
              <span className="text-xs text-muted-foreground shrink-0">•</span>
              <span className="text-xs text-muted-foreground whitespace-nowrap">
                {formatRelativeTime(comment.createdAt)}
              </span>
              {new Date(comment.updatedAt).getTime() !==
                new Date(comment.createdAt).getTime() && (
                <>
                  <span className="text-xs text-muted-foreground shrink-0">
                    •
                  </span>
                  <span className="text-xs text-muted-foreground italic whitespace-nowrap">
                    edited
                  </span>
                </>
              )}
              {isOwnComment && !isEditing && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0 ml-auto shrink-0"
                    >
                      <MoreVertical className="h-3.5 w-3.5" />
                      <span className="sr-only">More options</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => handleEditStart(comment)}>
                      <Pencil className="mr-2 h-4 w-4" />
                      Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => setDeleteConfirmId(comment.id)}
                      className="text-destructive focus:text-destructive"
                    >
                      <Trash2 className="mr-2 h-4 w-4 text-destructive" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>

            {isEditing ? (
              <div className="space-y-2">
                <textarea
                  ref={editTextareaRef}
                  value={editingBody}
                  onChange={handleEditTextareaChange}
                  className="w-full px-3 py-2 text-sm bg-background border border-input rounded-md resize-none focus:outline-none focus:ring-2 focus:ring-ring overflow-hidden"
                  style={{
                    minHeight: "60px",
                    maxHeight: "200px",
                  }}
                />
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={() => handleEditSave(comment.id)}
                    disabled={
                      !editingBody.trim() || editCommentMutation.isPending
                    }
                    className="h-7 px-3 text-xs"
                  >
                    Save
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={handleEditCancel}
                    disabled={editCommentMutation.isPending}
                    className="h-7 px-3 text-xs"
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <p className="text-sm leading-relaxed whitespace-pre-wrap wrap-break-word text-foreground/90">
                  {linkifyText(comment.body)}
                </p>

                <div className="flex gap-1 mt-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleReply(comment.id, threadId)}
                    className="h-6 px-2 text-xs font-medium hover:bg-background/50"
                    disabled={isReplyingTo}
                  >
                    {isReplyingTo ? "Replying..." : "Reply"}
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Render nested replies */}
        {replies.length > 0 && (
          <div className="mt-3">
            {(() => {
              // Handle depth-based collapsing (like Reddit)
              if (shouldCollapseDepth && !isDepthExpanded) {
                return (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setExpandedReplies((prev) => {
                        const next = new Set(prev);
                        next.add(`depth-${comment.id}`);
                        return next;
                      });
                    }}
                    className={cn(
                      "mt-2 h-8 text-xs text-primary hover:text-primary hover:bg-primary/10",
                      "ml-6",
                    )}
                  >
                    Show more →
                  </Button>
                );
              }

              // Handle count-based collapsing (when > 2 replies at same level)
              const isExpanded = expandedReplies.has(comment.id);
              const visibleReplies = isExpanded ? replies : replies.slice(0, 2);
              const hiddenCount = replies.length - 2;

              return (
                <>
                  {visibleReplies.map((reply) =>
                    renderComment(reply, tree, depth + 1, threadId),
                  )}
                  {!isExpanded && hiddenCount > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setExpandedReplies((prev) => {
                          const next = new Set(prev);
                          next.add(comment.id);
                          return next;
                        });
                      }}
                      className={cn(
                        "mt-2 h-8 text-xs text-primary hover:text-primary hover:bg-primary/10",
                        depth === 0 ? "ml-6" : "ml-12",
                      )}
                    >
                      Show {hiddenCount} more{" "}
                      {hiddenCount === 1 ? "reply" : "replies"}
                    </Button>
                  )}
                  {isExpanded && replies.length > 2 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setExpandedReplies((prev) => {
                          const next = new Set(prev);
                          next.delete(comment.id);
                          return next;
                        });
                      }}
                      className={cn(
                        "mt-2 h-8 text-xs text-muted-foreground hover:text-foreground hover:bg-muted",
                        depth === 0 ? "ml-6" : "ml-12",
                      )}
                    >
                      Show less
                    </Button>
                  )}
                  {/* Show less button for depth-based expansion */}
                  {shouldCollapseDepth && isDepthExpanded && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setExpandedReplies((prev) => {
                          const next = new Set(prev);
                          next.delete(`depth-${comment.id}`);
                          return next;
                        });
                      }}
                      className={cn(
                        "mt-2 h-8 text-xs text-muted-foreground hover:text-foreground hover:bg-muted",
                        "ml-6",
                      )}
                    >
                      Show less
                    </Button>
                  )}
                </>
              );
            })()}
          </div>
        )}
      </div>
    );
  };

  // Format relative time helper
  const formatRelativeTime = (date: Date) => {
    const now = new Date();
    const seconds = Math.floor(
      (now.getTime() - new Date(date).getTime()) / 1000,
    );

    if (seconds < 60) return "just now";
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;

    return new Date(date).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year:
        now.getFullYear() !== new Date(date).getFullYear()
          ? "numeric"
          : undefined,
    });
  };

  // Linkify text helper - converts URLs to clickable links
  const linkifyText = (text: string) => {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const parts = text.split(urlRegex);

    return parts.map((part, index) => {
      if (part.match(urlRegex)) {
        return (
          <a
            key={`url-${index}-${part.slice(0, 20)}`}
            href={part}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline break-all"
            onClick={(e) => e.stopPropagation()}
          >
            {part}
          </a>
        );
      }
      return part;
    });
  };

  // Get the current data based on filter
  const currentData = !isShowingAll ? threadData : null;
  const commentTree = currentData?.comments
    ? buildCommentTree(currentData.comments)
    : null;
  const topLevelComments = commentTree?.get(null) || [];

  // For "All Comments" view, we have multiple threads
  const allThreads = isShowingAll ? allCommentsData?.threads || [] : [];
  const hasAnyComments = !isShowingAll
    ? topLevelComments.length > 0
    : allThreads.some((t) => t.comments.length > 0);

  // Find the comment being replied to
  const replyingToComment = replyToId
    ? (() => {
        // First try to find in point-specific comments
        const pointComment = threadData?.comments.find(
          (c) => c.id === replyToId,
        );
        if (pointComment) return pointComment;

        // If in "all" view, search across all threads
        if (isShowingAll) {
          for (const threadResponse of allThreads) {
            const comment = threadResponse.comments.find(
              (c) => c.id === replyToId,
            );
            if (comment) return comment;
          }
        }

        return null;
      })()
    : null;

  // Navigation helpers for data points
  const currentPointIndex =
    allDataPoints?.findIndex((dp) => dp.bucketValue === selectedFilter) ?? -1;
  const canGoPrev = !isShowingAll && allDataPoints && currentPointIndex > 0;
  const canGoNext =
    !isShowingAll &&
    allDataPoints &&
    currentPointIndex < allDataPoints.length - 1;

  const navigateToPrevPoint = useCallback(() => {
    if (!canGoPrev || !allDataPoints) return;
    const prevPoint = allDataPoints[currentPointIndex - 1];
    setSelectedFilter(prevPoint.bucketValue);
    // Clear reply state when navigating
    setReplyToId(null);
    setReplyToThreadId(null);
    setExpandedReplies(new Set());
  }, [canGoPrev, allDataPoints, currentPointIndex]);

  const navigateToNextPoint = useCallback(() => {
    if (!canGoNext || !allDataPoints) return;
    const nextPoint = allDataPoints[currentPointIndex + 1];
    setSelectedFilter(nextPoint.bucketValue);
    // Clear reply state when navigating
    setReplyToId(null);
    setReplyToThreadId(null);
    setExpandedReplies(new Set());
  }, [canGoNext, allDataPoints, currentPointIndex]);

  const handleFilterChange = (value: string) => {
    setSelectedFilter(value);
    // Clear reply state when changing filter
    setReplyToId(null);
    setReplyToThreadId(null);
    setExpandedReplies(new Set());
  };

  // Keyboard shortcuts for navigation (only when viewing a specific date)
  useEffect(() => {
    if (isShowingAll || !allDataPoints) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Only handle if not typing in a textarea or input
      if (
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLInputElement
      ) {
        return;
      }

      if (e.key === "ArrowLeft" && canGoPrev) {
        e.preventDefault();
        navigateToPrevPoint();
      } else if (e.key === "ArrowRight" && canGoNext) {
        e.preventDefault();
        navigateToNextPoint();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    isShowingAll,
    allDataPoints,
    canGoPrev,
    canGoNext,
    navigateToNextPoint,
    navigateToPrevPoint,
  ]);

  return (
    <>
      <div className="flex-1 flex flex-col min-h-0">
        {/* Filter Bar */}
        <div className="px-6 pb-4 border-b shrink-0">
          {/* Unified filter bar with navigation */}
          <div className="flex items-center gap-1.5 w-full h-10 bg-muted rounded-lg p-1">
            {/* Navigation arrows - only visible when not showing all */}
            {!isShowingAll && allDataPoints && allDataPoints.length > 1 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={navigateToPrevPoint}
                disabled={!canGoPrev}
                className="h-8 w-8 p-0 shrink-0 hover:bg-background disabled:opacity-50"
                title="Previous data point"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </Button>
            )}

            {/* Date filter selector */}
            {allDataPoints && allDataPoints.length > 0 ? (
              <Select value={selectedFilter} onValueChange={handleFilterChange}>
                <SelectTrigger className="h-8 text-sm border-0 shadow-none focus:ring-0 flex-1 hover:bg-background transition-colors bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="max-h-[300px]">
                  <SelectItem value="all" className="text-sm">
                    All Comments
                  </SelectItem>
                  {allDataPoints.map((point) => (
                    <SelectItem
                      key={point.bucketValue}
                      value={point.bucketValue}
                      className="text-sm"
                    >
                      {point.timestamp}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <div className="h-8 flex-1 text-sm px-3 flex items-center bg-background rounded-md">
                {displayLabel}
              </div>
            )}

            {/* Navigation arrows - only visible when not showing all */}
            {!isShowingAll && allDataPoints && allDataPoints.length > 1 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={navigateToNextPoint}
                disabled={!canGoNext}
                className="h-8 w-8 p-0 shrink-0 hover:bg-background disabled:opacity-50"
                title="Next data point"
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </div>

        {/* Comments Area */}
        <div className="flex-1 min-h-0 overflow-hidden">
          <ScrollArea ref={scrollAreaRef} className="h-full">
            {loading ? (
              <div className="space-y-6 px-6 py-4">
                {[1, 2, 3].map((i) => (
                  <div key={`skeleton-${i}`} className="flex gap-3">
                    <Skeleton className="h-9 w-9 rounded-full shrink-0" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-40" />
                      <Skeleton className="h-20 w-full rounded-lg" />
                    </div>
                  </div>
                ))}
              </div>
            ) : !hasAnyComments ? (
              <div className="h-[calc(100vh-20rem)] flex flex-col items-center justify-center text-center text-muted-foreground px-6">
                <div className="flex items-center justify-center h-20 w-20 rounded-full bg-muted/30 mb-4">
                  <MessageSquare className="h-10 w-10 opacity-40" />
                </div>
                <p className="text-lg font-medium mb-1">No comments yet</p>
                <p className="text-sm">
                  {isShowingAll
                    ? "No comments on this chart yet"
                    : "Be the first to comment on this data point"}
                </p>
              </div>
            ) : !isShowingAll ? (
              <div className="space-y-4 pb-2 px-6 py-4">
                {topLevelComments.map((comment) =>
                  commentTree ? renderComment(comment, commentTree, 0) : null,
                )}
              </div>
            ) : (
              <div className="space-y-6 pb-2 px-6 py-4">
                {allThreads.map((threadResponse) => {
                  if (threadResponse.comments.length === 0) return null;

                  const thread = threadResponse.thread;
                  const threadCommentTree = buildCommentTree(
                    threadResponse.comments,
                  );
                  const threadTopLevelComments =
                    threadCommentTree.get(null) || [];
                  const pointLabel =
                    thread.bucketValue && thread.bucketType
                      ? getBucketLabel(thread.bucketValue, thread.bucketType)
                      : "Unknown Date";

                  return (
                    <div key={thread.id} className="space-y-3">
                      {/* Data Point Header */}
                      <div className="flex items-center gap-2 pb-2 border-b">
                        <h3 className="font-semibold text-sm text-foreground">
                          {pointLabel}
                        </h3>
                        <span className="text-xs text-muted-foreground">
                          {threadResponse.comments.length}{" "}
                          {threadResponse.comments.length === 1
                            ? "comment"
                            : "comments"}
                        </span>
                      </div>

                      {/* Comments for this data point */}
                      <div className="space-y-4">
                        {threadTopLevelComments.map((comment) =>
                          renderComment(
                            comment,
                            threadCommentTree,
                            0,
                            thread.id,
                          ),
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </ScrollArea>
        </div>

        {/* Comment Composer - Show when viewing specific date or when replying in "all" view */}
        {(!isShowingAll || replyToId) && (
          <div className="px-6 pb-6 pt-4 border-t shrink-0 bg-muted/20">
            {replyingToComment && (
              <div className="mb-3 p-2.5 bg-background border border-border/50 rounded-lg text-sm flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <CornerDownRight className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="font-medium text-foreground text-xs">
                      Replying to {replyingToComment.user.name || "Anonymous"}
                    </span>
                  </div>
                  <div className="text-muted-foreground line-clamp-2 pl-5 text-xs break-all">
                    {linkifyText(replyingToComment.body)}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={cancelReply}
                  className="h-7 w-7 p-0 shrink-0 hover:bg-muted"
                >
                  <X className="h-3.5 w-3.5" />
                  <span className="sr-only">Cancel reply</span>
                </Button>
              </div>
            )}

            <form onSubmit={handleSubmit} className="relative">
              <div className="flex items-end gap-2 bg-background border border-input rounded-xl p-1.5 transition-shadow focus-within:ring-2 focus-within:ring-ring focus-within:border-transparent">
                <textarea
                  ref={textareaRef}
                  value={newCommentBody}
                  onChange={handleTextareaChange}
                  placeholder={
                    replyingToComment
                      ? "Write a reply..."
                      : "Write a comment..."
                  }
                  rows={1}
                  className="flex-1 max-h-[200px] px-2.5 py-1.5 text-sm bg-transparent border-0 resize-none focus:outline-none focus:ring-0 disabled:cursor-not-allowed disabled:opacity-50 placeholder:text-muted-foreground"
                  disabled={createCommentMutation.isPending || !session}
                  style={{
                    minHeight: "32px",
                    height: "32px",
                    overflow: "hidden",
                  }}
                  onKeyDown={(e) => {
                    // Submit on Cmd/Ctrl + Enter
                    if (
                      (e.metaKey || e.ctrlKey) &&
                      e.key === "Enter" &&
                      !e.shiftKey
                    ) {
                      e.preventDefault();
                      handleSubmit(e);
                    }
                  }}
                />
                <Button
                  type="submit"
                  disabled={
                    !newCommentBody.trim() ||
                    createCommentMutation.isPending ||
                    !session
                  }
                  className="h-8 w-8 p-0 shrink-0 rounded-lg"
                  size="icon"
                >
                  <Send className="h-3.5 w-3.5" />
                  <span className="sr-only">Send</span>
                </Button>
              </div>
            </form>

            <div className="flex items-center justify-between mt-2 px-1">
              {!session ? (
                <p className="text-xs text-muted-foreground">
                  Sign in to comment
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Press{" "}
                  <kbd className="px-1.5 py-0.5 rounded bg-muted border border-border font-mono text-[10px]">
                    ⌘
                  </kbd>{" "}
                  +{" "}
                  <kbd className="px-1.5 py-0.5 rounded bg-muted border border-border font-mono text-[10px]">
                    Enter
                  </kbd>{" "}
                  to comment
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog
        open={!!deleteConfirmId}
        onOpenChange={(open) => !open && setDeleteConfirmId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete comment?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete your
              comment
              {threadData?.comments.some((c) => c.parentId === deleteConfirmId)
                ? " and all of its replies"
                : ""}
              .
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteCommentMutation.isPending}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              disabled={deleteCommentMutation.isPending}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              {deleteCommentMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
