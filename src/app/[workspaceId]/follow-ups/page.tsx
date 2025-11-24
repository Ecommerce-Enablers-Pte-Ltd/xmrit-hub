"use client";

import {
  Check,
  ChevronLeft,
  ChevronRight,
  ChevronsUpDown,
  Filter,
  Loader2,
  Plus,
  Search,
} from "lucide-react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useDebounce } from "@/hooks/use-debounce";
import {
  useCreateFollowUp,
  useDeleteFollowUp,
  useFollowUps,
  useUpdateFollowUp,
  useUsers,
  useWorkspace,
} from "@/lib/api";
import {
  getPriorityIcon,
  getPriorityLabel,
  getStatusIcon,
  getStatusLabel,
} from "@/lib/follow-up-utils";
import { cn } from "@/lib/utils";
import type {
  FollowUpPriority,
  FollowUpQueryParams,
  FollowUpStatus,
  FollowUpWithDetails,
} from "@/types/db/follow-up";
import { FollowUpDialog } from "./components/follow-up-dialog";
import { FollowUpTable } from "./components/follow-up-table";

export default function FollowUpsPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const workspaceId = params.workspaceId as string;
  const { data: session } = useSession();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingFollowUp, setEditingFollowUp] =
    useState<FollowUpWithDetails | null>(null);

  // Local search state for immediate UI feedback
  const [localSearchQuery, setLocalSearchQuery] = useState("");

  // Local sorting state (not in URL)
  const [sortBy, setSortBy] =
    useState<FollowUpQueryParams["sortBy"]>("createdAt");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  // Get query params from URL
  const page = Number(searchParams.get("page")) || 1;
  const limit = Number(searchParams.get("limit")) || 20;
  const statusFilter = searchParams.get("status") || undefined;
  const priorityFilter = searchParams.get("priority") || undefined;
  // Support both assigneeId (singular) for API and assigneeIds for display
  const assigneeIdsParam = searchParams.get("assigneeId") || undefined;
  const assigneeIds = assigneeIdsParam
    ? assigneeIdsParam.split(",").filter(Boolean)
    : [];
  const slideFilter = searchParams.get("slideId") || undefined;
  const searchQuery = searchParams.get("search") || "";
  const unassignedFilter = searchParams.get("unassigned") === "true";

  // Debounce the search query for API calls
  const debouncedSearchQuery = useDebounce(localSearchQuery, 500);

  // Update URL with new search params
  const updateSearchParams = useCallback(
    (updates: Partial<FollowUpQueryParams>) => {
      const newParams = new URLSearchParams(searchParams.toString());

      Object.entries(updates).forEach(([key, value]) => {
        if (
          value === undefined ||
          value === null ||
          value === "" ||
          value === false ||
          (Array.isArray(value) && value.length === 0)
        ) {
          newParams.delete(key);
        } else if (Array.isArray(value)) {
          newParams.set(key, value.join(","));
        } else {
          newParams.set(key, String(value));
        }
      });

      // Reset to page 1 when filters change (except when explicitly changing page)
      if (!("page" in updates) && Object.keys(updates).length > 0) {
        newParams.set("page", "1");
      }

      router.replace(`/${workspaceId}/follow-ups?${newParams.toString()}`);
    },
    [searchParams, router, workspaceId],
  );

  // Sync local search state with URL param on mount
  useEffect(() => {
    setLocalSearchQuery(searchQuery);
  }, [searchQuery]);

  // Update URL when debounced search changes
  useEffect(() => {
    if (debouncedSearchQuery !== searchQuery) {
      updateSearchParams({ search: debouncedSearchQuery || undefined });
    }
  }, [debouncedSearchQuery, searchQuery, updateSearchParams]);

  // Build query params object
  const queryParams: FollowUpQueryParams = {
    page,
    limit,
    sortBy,
    sortOrder,
    ...(statusFilter && { status: statusFilter as FollowUpStatus }),
    ...(priorityFilter && { priority: priorityFilter as FollowUpPriority }),
    ...(assigneeIds.length > 0 && { assigneeId: assigneeIds.join(",") }),
    ...(slideFilter && { slideId: slideFilter }),
    ...(searchQuery && { search: searchQuery }),
    ...(unassignedFilter && { unassigned: true }),
  };

  // Fetch data with React Query
  const { data, isLoading: isLoadingFollowUps } = useFollowUps(
    workspaceId,
    queryParams,
  );
  const { data: users = [], isLoading: isLoadingUsers } = useUsers();
  const { workspace, loading: isLoadingWorkspace } = useWorkspace(workspaceId);

  const followUps = data?.followUps || [];
  const pagination = data?.pagination;
  const slides = workspace?.slides || [];
  const isLoading = isLoadingFollowUps || isLoadingUsers || isLoadingWorkspace;

  // Debug logging
  console.log("Follow-ups page debug:", {
    workspace,
    slides,
    slidesLength: slides.length,
    isLoadingWorkspace,
    slideFilter,
  });

  // Mutations
  const createMutation = useCreateFollowUp(workspaceId);
  const updateMutation = useUpdateFollowUp(workspaceId);
  const deleteMutation = useDeleteFollowUp(workspaceId);

  // Check if search is pending (debouncing)
  const isSearchPending = localSearchQuery !== searchQuery;

  const handleCreateClick = () => {
    setEditingFollowUp(null);
    setDialogOpen(true);
  };

  const handleEditClick = (followUp: FollowUpWithDetails) => {
    setEditingFollowUp(followUp);
    setDialogOpen(true);
  };

  const handleSave = async (data: {
    title: string;
    description: string;
    status: FollowUpStatus;
    priority: FollowUpPriority;
    assigneeIds?: string[];
    slideId?: string;
    submetricDefinitionId?: string;
    dueDate?: string;
  }) => {
    try {
      if (editingFollowUp) {
        // Update existing follow-up
        await updateMutation.mutateAsync({
          followUpId: editingFollowUp.id,
          data,
        });
        toast.success("Follow-up updated successfully");
      } else {
        // Create new follow-up
        const newFollowUp = await createMutation.mutateAsync(data);
        toast.success("Follow-up created successfully", {
          description: "Click to view the follow-up",
          action: {
            label: "View",
            onClick: () => {
              router.push(
                `/${workspaceId}/follow-ups?slideId=${
                  newFollowUp.slideId || ""
                }`,
              );
            },
          },
        });
      }
      setDialogOpen(false);
      setEditingFollowUp(null);
    } catch (error) {
      console.error("Error saving follow-up:", error);
      toast.error(
        editingFollowUp
          ? "Failed to update follow-up"
          : "Failed to create follow-up",
      );
    }
  };

  const handleDelete = async (followUpId: string) => {
    try {
      await deleteMutation.mutateAsync(followUpId);
      toast.success("Follow-up deleted successfully");
    } catch (error) {
      console.error("Error deleting follow-up:", error);
      toast.error("Failed to delete follow-up");
    }
  };

  const handleStatusChange = async (followUpId: string, status: string) => {
    try {
      await updateMutation.mutateAsync({
        followUpId,
        data: { status: status as FollowUpStatus },
      });
      toast.success("Status updated");
    } catch (error) {
      console.error("Error updating status:", error);
      toast.error("Failed to update status");
    }
  };

  const handleClearFilters = () => {
    // Clear local search state
    setLocalSearchQuery("");

    // Reset sorting to default
    setSortBy("createdAt");
    setSortOrder("desc");

    // Clear URL params
    router.push(`/${workspaceId}/follow-ups`);
  };

  // Assignee multi-select state
  const [assigneePopoverOpen, setAssigneePopoverOpen] = useState(false);
  const selectedUsers = users.filter((user) => assigneeIds.includes(user.id));

  const toggleAssignee = (userId: string) => {
    const newAssigneeIds = assigneeIds.includes(userId)
      ? assigneeIds.filter((id) => id !== userId)
      : [...assigneeIds, userId];

    updateSearchParams({
      assigneeId:
        newAssigneeIds.length > 0 ? newAssigneeIds.join(",") : undefined,
      unassigned: undefined,
    });
  };

  const handleUnassignedFilter = () => {
    updateSearchParams({
      unassigned: !unassignedFilter,
      assigneeId: undefined,
    });
  };

  const handleSort = (field: FollowUpQueryParams["sortBy"]) => {
    if (sortBy === field) {
      // Cycle through: desc -> asc -> default (no sort)
      if (sortOrder === "desc") {
        setSortOrder("asc");
      } else {
        // Reset to default sort (createdAt desc)
        setSortBy("createdAt");
        setSortOrder("desc");
      }
    } else {
      // Default to desc for new field
      setSortBy(field);
      setSortOrder("desc");
    }
  };

  const hasActiveFilters =
    statusFilter ||
    priorityFilter ||
    assigneeIds.length > 0 ||
    slideFilter ||
    searchQuery ||
    unassignedFilter;

  // Helper to get user initials
  const getInitials = (name: string | null | undefined): string => {
    if (!name) return "?";
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/60">
        <div className="flex items-center justify-between px-6 py-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              Follow-ups
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Track and manage tasks across your workspace
            </p>
          </div>
          <Button
            onClick={handleCreateClick}
            size="sm"
            className="gap-2 shadow-sm"
          >
            <Plus className="h-4 w-4" />
            New Follow-up
          </Button>
        </div>

        {/* Filters Bar */}
        <div className="px-6 pb-4">
          <div className="flex items-center gap-2 overflow-x-auto">
            <div className="relative w-[240px] shrink-0">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <Input
                placeholder="Search..."
                value={localSearchQuery}
                onChange={(e) => setLocalSearchQuery(e.target.value)}
                className="pl-9 pr-9 h-9 bg-background w-full"
              />
              {isSearchPending && (
                <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground animate-spin" />
              )}
            </div>

            <Select
              value={statusFilter || "all"}
              onValueChange={(value) =>
                updateSearchParams({
                  status:
                    value === "all" ? undefined : (value as FollowUpStatus),
                })
              }
            >
              <SelectTrigger className="w-[140px] h-9 shrink-0">
                <SelectValue placeholder="Status">
                  {statusFilter ? (
                    <div className="flex items-center gap-2">
                      {getStatusIcon(statusFilter as FollowUpStatus)}
                      <span>
                        {getStatusLabel(statusFilter as FollowUpStatus)}
                      </span>
                    </div>
                  ) : (
                    "All statuses"
                  )}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="todo">
                  <div className="flex items-center gap-2.5">
                    {getStatusIcon("todo")}
                    Todo
                  </div>
                </SelectItem>
                <SelectItem value="in_progress">
                  <div className="flex items-center gap-2.5">
                    {getStatusIcon("in_progress")}
                    In Progress
                  </div>
                </SelectItem>
                <SelectItem value="done">
                  <div className="flex items-center gap-2.5">
                    {getStatusIcon("done")}
                    Done
                  </div>
                </SelectItem>
                <SelectItem value="cancelled">
                  <div className="flex items-center gap-2.5">
                    {getStatusIcon("cancelled")}
                    Cancelled
                  </div>
                </SelectItem>
                <SelectItem value="resolved">
                  <div className="flex items-center gap-2.5">
                    {getStatusIcon("resolved")}
                    Resolved
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>

            <Select
              value={priorityFilter || "all"}
              onValueChange={(value) =>
                updateSearchParams({
                  priority:
                    value === "all" ? undefined : (value as FollowUpPriority),
                })
              }
            >
              <SelectTrigger className="w-[140px] h-9 shrink-0">
                <SelectValue placeholder="Priority">
                  {priorityFilter ? (
                    <div className="flex items-center gap-2">
                      {getPriorityIcon(priorityFilter as FollowUpPriority)}
                      <span>
                        {getPriorityLabel(priorityFilter as FollowUpPriority)}
                      </span>
                    </div>
                  ) : (
                    "All priorities"
                  )}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All priorities</SelectItem>
                <SelectItem value="no_priority">
                  <div className="flex items-center gap-2.5">
                    {getPriorityIcon("no_priority")}
                    No Priority
                  </div>
                </SelectItem>
                <SelectItem value="urgent">
                  <div className="flex items-center gap-2.5">
                    {getPriorityIcon("urgent")}
                    Urgent
                  </div>
                </SelectItem>
                <SelectItem value="high">
                  <div className="flex items-center gap-2.5">
                    {getPriorityIcon("high")}
                    High
                  </div>
                </SelectItem>
                <SelectItem value="medium">
                  <div className="flex items-center gap-2.5">
                    {getPriorityIcon("medium")}
                    Medium
                  </div>
                </SelectItem>
                <SelectItem value="low">
                  <div className="flex items-center gap-2.5">
                    {getPriorityIcon("low")}
                    Low
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>

            <Select
              value={slideFilter || "all"}
              onValueChange={(value) =>
                updateSearchParams({
                  slideId: value === "all" ? undefined : value,
                })
              }
              disabled={isLoadingWorkspace}
            >
              <SelectTrigger
                className="w-[140px] h-9 shrink-0"
                data-testid="slide-filter"
              >
                <SelectValue placeholder="All slides">
                  {slideFilter
                    ? slides.find((s) => s.id === slideFilter)?.title ||
                      "Loading..."
                    : "All slides"}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All slides</SelectItem>
                {isLoadingWorkspace ? (
                  <SelectItem value="loading" disabled>
                    Loading...
                  </SelectItem>
                ) : slides.length > 0 ? (
                  slides.map((slide) => (
                    <SelectItem key={slide.id} value={slide.id}>
                      {slide.title}
                    </SelectItem>
                  ))
                ) : (
                  <SelectItem value="no-slides" disabled>
                    No slides
                  </SelectItem>
                )}
              </SelectContent>
            </Select>

            <Popover
              open={assigneePopoverOpen}
              onOpenChange={setAssigneePopoverOpen}
            >
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={assigneePopoverOpen}
                  className={cn(
                    "h-9 w-[280px] justify-between hover:bg-transparent font-normal shrink-0",
                    selectedUsers.length === 0 &&
                      !unassignedFilter &&
                      "text-muted-foreground",
                  )}
                >
                  <div className="flex items-center gap-1 overflow-hidden min-w-0">
                    {unassignedFilter ? (
                      <Badge
                        variant="outline"
                        className="rounded-sm px-1.5 py-0.5 gap-1 shrink-0"
                      >
                        <span className="text-xs">Unassigned</span>
                      </Badge>
                    ) : selectedUsers.length > 0 ? (
                      <>
                        {selectedUsers.slice(0, 2).map((user) => (
                          <Badge
                            key={user.id}
                            variant="outline"
                            className="rounded-sm px-1.5 py-0.5 gap-1 shrink-0 max-w-[90px]"
                          >
                            <Avatar className="h-4 w-4 shrink-0">
                              <AvatarImage src={user.image || undefined} />
                              <AvatarFallback className="text-[8px]">
                                {getInitials(user.name)}
                              </AvatarFallback>
                            </Avatar>
                            <span className="text-xs truncate">
                              {user.name?.split(" ")[0] || user.email}
                            </span>
                          </Badge>
                        ))}
                        {selectedUsers.length > 2 && (
                          <Badge
                            variant="outline"
                            className="rounded-sm shrink-0"
                          >
                            +{selectedUsers.length - 2}
                          </Badge>
                        )}
                      </>
                    ) : (
                      <span className="text-sm">Assignee</span>
                    )}
                  </div>
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent
                className="w-[300px] p-0"
                align="start"
                sideOffset={4}
              >
                <Command>
                  <CommandInput placeholder="Search users..." className="h-9" />
                  <CommandList className="max-h-[300px]">
                    <CommandEmpty>No users found.</CommandEmpty>
                    <CommandGroup>
                      <CommandItem
                        onSelect={handleUnassignedFilter}
                        className="cursor-pointer"
                      >
                        <div className="flex items-center gap-2 flex-1">
                          <div className="h-6 w-6 rounded-full bg-muted flex items-center justify-center">
                            <span className="text-xs text-muted-foreground">
                              —
                            </span>
                          </div>
                          <span className="text-sm font-medium">
                            Unassigned
                          </span>
                        </div>
                        {unassignedFilter && (
                          <Check className="h-4 w-4 ml-auto" />
                        )}
                      </CommandItem>
                      {session?.user?.id && (
                        <CommandItem
                          onSelect={() => toggleAssignee(session.user.id)}
                          className="cursor-pointer"
                        >
                          <div className="flex items-center gap-2 flex-1">
                            <Avatar className="h-6 w-6">
                              <AvatarImage
                                src={session.user.image || undefined}
                              />
                              <AvatarFallback className="text-xs">
                                {getInitials(session.user.name)}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex flex-col">
                              <span className="text-sm font-medium">
                                My Tasks
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {session.user.name || session.user.email}
                              </span>
                            </div>
                          </div>
                          {assigneeIds.includes(session.user.id) && (
                            <Check className="h-4 w-4 ml-auto" />
                          )}
                        </CommandItem>
                      )}
                      {users
                        .filter((user) => user.id !== session?.user?.id)
                        .map((user) => (
                          <CommandItem
                            key={user.id}
                            value={`${user.name || ""} ${user.email || ""}`}
                            keywords={[user.name || "", user.email || ""]}
                            onSelect={() => toggleAssignee(user.id)}
                            className="cursor-pointer"
                          >
                            <div className="flex items-center gap-2 flex-1">
                              <Avatar className="h-6 w-6">
                                <AvatarImage src={user.image || undefined} />
                                <AvatarFallback className="text-xs">
                                  {getInitials(user.name)}
                                </AvatarFallback>
                              </Avatar>
                              <div className="flex flex-col">
                                <span className="text-sm font-medium">
                                  {user.name || "Unnamed"}
                                </span>
                                {user.email && (
                                  <span className="text-xs text-muted-foreground">
                                    {user.email}
                                  </span>
                                )}
                              </div>
                            </div>
                            {assigneeIds.includes(user.id) && (
                              <Check className="h-4 w-4 ml-auto" />
                            )}
                          </CommandItem>
                        ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>

            {hasActiveFilters && (
              <Button
                variant="ghost"
                size="sm"
                className="h-9 px-3 shrink-0"
                onClick={handleClearFilters}
              >
                Clear
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <FollowUpTable
          followUps={followUps}
          workspaceId={workspaceId}
          currentUserId={session?.user?.id}
          onEdit={handleEditClick}
          onDelete={handleDelete}
          onStatusChange={handleStatusChange}
          isLoading={isLoading}
          sortBy={sortBy}
          sortOrder={sortOrder}
          onSort={handleSort}
        />
      </div>

      {/* Total Count - Below Table (only show if there are follow-ups or loading) */}
      {(isLoading || (pagination && pagination.total > 0)) && (
        <div className="border-t bg-muted/30 px-6 py-3">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {isLoading ? (
              <Skeleton className="h-4 w-32" />
            ) : (
              <>
                {hasActiveFilters && (
                  <>
                    <Filter className="h-3 w-3" />
                    <span>
                      {pagination?.total || 0} result
                      {pagination?.total !== 1 ? "s" : ""}
                    </span>
                  </>
                )}
                {!hasActiveFilters && pagination && (
                  <span>
                    {pagination.total} total follow-up
                    {pagination.total !== 1 ? "s" : ""}
                  </span>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* Pagination Controls */}
      {pagination && pagination.totalPages > 1 && (
        <div className="border-t bg-background px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Select
                value={String(limit)}
                onValueChange={(value) =>
                  updateSearchParams({ limit: Number(value), page: 1 })
                }
              >
                <SelectTrigger className="w-[140px] h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">10 per page</SelectItem>
                  <SelectItem value="20">20 per page</SelectItem>
                  <SelectItem value="50">50 per page</SelectItem>
                  <SelectItem value="100">100 per page</SelectItem>
                </SelectContent>
              </Select>
              <span className="text-sm text-muted-foreground">
                Showing {Math.min((page - 1) * limit + 1, pagination.total)} to{" "}
                {Math.min(page * limit, pagination.total)} of {pagination.total}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => updateSearchParams({ page: page - 1 })}
                disabled={page <= 1}
                className="h-9"
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                Previous
              </Button>

              {/* Page numbers */}
              <div className="hidden sm:flex items-center gap-1">
                {Array.from(
                  { length: Math.min(5, pagination.totalPages) },
                  (_, i) => {
                    let pageNum: number;

                    if (pagination.totalPages <= 5) {
                      pageNum = i + 1;
                    } else if (page <= 3) {
                      pageNum = i + 1;
                    } else if (page >= pagination.totalPages - 2) {
                      pageNum = pagination.totalPages - 4 + i;
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
                          "h-9 w-9 p-0",
                          page === pageNum && "pointer-events-none",
                        )}
                      >
                        {pageNum}
                      </Button>
                    );
                  },
                )}
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={() => updateSearchParams({ page: page + 1 })}
                disabled={!pagination.hasMore}
                className="h-9"
              >
                Next
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Dialog */}
      <FollowUpDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        followUp={editingFollowUp}
        users={users}
        slides={slides}
        onSave={handleSave}
        isLoading={createMutation.isPending || updateMutation.isPending}
      />
    </div>
  );
}
