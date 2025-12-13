"use client";

import {
  ChevronLeft,
  ChevronRight,
  Filter,
  Loader2,
  Plus,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { getStatusIcon, getStatusLabel } from "@/components/config";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  useWorkspaces,
} from "@/lib/api";
import { cn, getErrorMessage, normalizeSlug } from "@/lib/utils";
import type {
  FollowUpPriority,
  FollowUpQueryParams,
  FollowUpStatus,
  FollowUpWithDetails,
} from "@/types/db/follow-up";
import { FollowUpDialog } from "./components/follow-up-dialog";
import { FollowUpTable } from "./components/follow-up-table";
import {
  type SubmetricDefinitionForSelector,
  SubmetricSelector,
} from "./components/submetric-selector";
import { UserAssigneeMultiSelector } from "./components/user-assignee-multi-selector";

export default function FollowUpsPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const workspaceSlug = params.workspaceSlug as string;
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

  // Popover states
  const [moreFiltersOpen, setMoreFiltersOpen] = useState(false);

  // Get query params from URL
  const page = Number(searchParams.get("page")) || 1;
  const limit = Number(searchParams.get("limit")) || 20;
  const statusFilter = searchParams.get("status") || undefined;
  // Support both assigneeId (singular) for API and assigneeIds for display
  const assigneeIdsParam = searchParams.get("assigneeId") || undefined;
  const assigneeIds = assigneeIdsParam
    ? assigneeIdsParam.split(",").filter(Boolean)
    : [];
  const slideFilter = searchParams.get("slideId") || undefined;
  const submetricFilter =
    searchParams.get("submetricDefinitionId") || undefined;
  const searchQuery = searchParams.get("search") || "";
  const unassignedFilter = searchParams.get("unassigned") === "true";

  // Debounce the search query for API calls
  const debouncedSearchQuery = useDebounce(localSearchQuery, 500);

  // Update URL with new search params
  const updateSearchParams = useCallback(
    (updates: Partial<FollowUpQueryParams>) => {
      const currentParams = new URLSearchParams(window.location.search);

      Object.entries(updates).forEach(([key, value]) => {
        if (
          value === undefined ||
          value === null ||
          value === "" ||
          value === false ||
          (Array.isArray(value) && value.length === 0)
        ) {
          currentParams.delete(key);
        } else if (Array.isArray(value)) {
          currentParams.set(key, value.join(","));
        } else {
          currentParams.set(key, String(value));
        }
      });

      // Reset to page 1 when filters change (except when explicitly changing page)
      if (!("page" in updates) && Object.keys(updates).length > 0) {
        currentParams.set("page", "1");
      }

      router.replace(
        `/${workspaceSlug}/follow-ups?${currentParams.toString()}`
      );
    },
    [router, workspaceSlug]
  );

  // Sync local search state with URL param on mount/change
  useEffect(() => {
    setLocalSearchQuery(searchQuery);
  }, [searchQuery]);

  // Update URL when debounced search changes
  useEffect(() => {
    // Only update if debounced value differs from URL and local state matches debounced
    if (
      debouncedSearchQuery !== searchQuery &&
      localSearchQuery === debouncedSearchQuery
    ) {
      updateSearchParams({ search: debouncedSearchQuery || undefined });
    }
  }, [debouncedSearchQuery, searchQuery, localSearchQuery, updateSearchParams]);

  // Build query params object - memoized to prevent unnecessary re-renders
  const queryParams = useMemo<FollowUpQueryParams>(
    () => ({
      page,
      limit,
      sortBy,
      sortOrder,
      ...(statusFilter && { status: statusFilter as FollowUpStatus }),
      ...(assigneeIds.length > 0 && { assigneeId: assigneeIds.join(",") }),
      ...(slideFilter && { slideId: slideFilter }),
      ...(submetricFilter && { submetricDefinitionId: submetricFilter }),
      ...(searchQuery && { search: searchQuery }),
      ...(unassignedFilter && { unassigned: true }),
    }),
    [
      page,
      limit,
      sortBy,
      sortOrder,
      statusFilter,
      assigneeIds,
      slideFilter,
      submetricFilter,
      searchQuery,
      unassignedFilter,
    ]
  );

  // Fetch workspaces list to find the current workspace by slug
  // Uses normalizeSlug for consistent case-insensitive comparison
  const { workspaces, loading: isLoadingWorkspaces } = useWorkspaces();
  const currentWorkspace = workspaces.find(
    (w) => normalizeSlug(w.slug) === normalizeSlug(workspaceSlug)
  );
  const workspaceId = currentWorkspace?.id ?? "";

  // Fetch data with React Query (using workspace ID)
  const { data, isLoading: isLoadingFollowUps } = useFollowUps(
    workspaceId,
    queryParams
  );
  const { data: users = [], isLoading: isLoadingUsers } = useUsers();
  const {
    workspace,
    loading: isLoadingWorkspace,
    refetch: refetchWorkspace,
  } = useWorkspace(workspaceId);

  const followUps = data?.followUps || [];
  const pagination = data?.pagination;
  const slides = workspace?.slides || [];
  const isLoading =
    isLoadingFollowUps ||
    isLoadingUsers ||
    isLoadingWorkspace ||
    isLoadingWorkspaces;

  // Extract unique submetric definitions from all slides for filtering
  const submetricDefinitions = useMemo<SubmetricDefinitionForSelector[]>(() => {
    if (!slides.length) return [];

    const definitions: SubmetricDefinitionForSelector[] = [];
    const seenIds = new Set<string>();

    for (const slide of slides) {
      if (!slide.metrics || !Array.isArray(slide.metrics)) continue;

      for (const metric of slide.metrics) {
        if (!metric.submetrics || !Array.isArray(metric.submetrics)) continue;

        for (const submetric of metric.submetrics) {
          if (submetric.definition && !seenIds.has(submetric.definition.id)) {
            seenIds.add(submetric.definition.id);
            definitions.push({
              ...submetric.definition,
              slideTitle: slide.title,
            });
          }
        }
      }
    }

    // Sort by category then metric name
    return definitions.sort((a, b) => {
      const catA = a.category || "";
      const catB = b.category || "";
      if (catA !== catB) return catA.localeCompare(catB);
      return (a.metricName || "").localeCompare(b.metricName || "");
    });
  }, [slides]);

  // Mutations
  const createMutation = useCreateFollowUp(workspaceId);
  const updateMutation = useUpdateFollowUp(workspaceId);
  const deleteMutation = useDeleteFollowUp(workspaceId);

  // Check if search is pending (debouncing)
  const isSearchPending = localSearchQuery !== searchQuery;

  const handleCreateClick = () => {
    setEditingFollowUp(null);
    // Trigger refetch - React Query will skip if data is fresh (within staleTime: 30s)
    // This ensures we have the latest slides with submetric definitions without blocking
    refetchWorkspace();
    setDialogOpen(true);
  };

  const handleEditClick = (followUp: FollowUpWithDetails) => {
    setEditingFollowUp(followUp);
    // Trigger refetch - React Query will skip if data is fresh (within staleTime: 30s)
    // This ensures we have the latest slides with submetric definitions without blocking
    refetchWorkspace();
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
                `/${workspaceSlug}/follow-ups?slideId=${
                  newFollowUp.slideId || ""
                }`
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
        getErrorMessage(
          error,
          editingFollowUp
            ? "Failed to update follow-up"
            : "Failed to create follow-up"
        )
      );
    }
  };

  const handleDelete = async (followUpId: string) => {
    try {
      await deleteMutation.mutateAsync(followUpId);
      toast.success("Follow-up deleted successfully");
    } catch (error) {
      console.error("Error deleting follow-up:", error);
      toast.error(getErrorMessage(error, "Failed to delete follow-up"));
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
      toast.error(getErrorMessage(error, "Failed to update status"));
    }
  };

  const handleClearFilters = useCallback(() => {
    // Clear local search state first
    setLocalSearchQuery("");

    // Reset sorting to default
    setSortBy("createdAt");
    setSortOrder("desc");

    // Close any open popovers/dialogs
    setMoreFiltersOpen(false);

    // Clear URL params - use replace to avoid adding to history
    router.replace(`/${workspaceSlug}/follow-ups`);
  }, [router, workspaceSlug]);

  // Assignee filter handlers
  const handleAssigneeChange = useCallback(
    (newAssigneeIds: string[]) => {
      updateSearchParams({
        assigneeId:
          newAssigneeIds.length > 0 ? newAssigneeIds.join(",") : undefined,
        unassigned: undefined,
      });
    },
    [updateSearchParams]
  );

  const handleUnassignedChange = useCallback(
    (newUnassigned: boolean) => {
      updateSearchParams({
        unassigned: newUnassigned || undefined,
        assigneeId: undefined,
      });
    },
    [updateSearchParams]
  );

  const handleSort = useCallback(
    (field: FollowUpQueryParams["sortBy"]) => {
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
    },
    [sortBy, sortOrder]
  );

  const hasActiveFilters = useMemo(
    () =>
      Boolean(
        statusFilter ||
          assigneeIds.length > 0 ||
          slideFilter ||
          submetricFilter ||
          searchQuery ||
          unassignedFilter
      ),
    [
      statusFilter,
      assigneeIds.length,
      slideFilter,
      submetricFilter,
      searchQuery,
      unassignedFilter,
    ]
  );

  // Count filters that are hidden on mobile (for badge)
  const mobileHiddenFiltersCount = useMemo(
    () =>
      [
        slideFilter,
        submetricFilter,
        assigneeIds.length > 0 || unassignedFilter,
      ].filter(Boolean).length,
    [slideFilter, submetricFilter, assigneeIds.length, unassignedFilter]
  );

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/60">
        <div className="flex items-center justify-between  px-0 md:px-3  py-2.5 sm:py-4">
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-semibold tracking-tight">
              Follow-ups
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground mt-0.5 hidden sm:block">
              Track and manage tasks across your workspace
            </p>
          </div>
          <Button
            onClick={handleCreateClick}
            size="sm"
            className="gap-1.5 sm:gap-2 shadow-sm shrink-0"
          >
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">New Follow-up</span>
            <span className="sm:hidden">New</span>
          </Button>
        </div>

        {/* Filters Bar */}
        <div className="px-0 md:px-3 pb-2.5 sm:pb-4">
          <div className="flex items-center gap-1.5 sm:gap-2 flex-nowrap min-w-0">
            {/* Search - always visible, responsive width */}
            <div className="relative flex-1 min-w-0 sm:flex-none sm:min-w-[200px] md:min-w-[240px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <Input
                placeholder="Search..."
                value={localSearchQuery}
                onChange={(e) => setLocalSearchQuery(e.target.value)}
                className="pl-9 pr-9 h-9 bg-background w-full text-sm"
              />
              {isSearchPending && (
                <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground animate-spin" />
              )}
            </div>

            {/* Status filter - always visible */}
            <Select
              value={statusFilter || "all"}
              onValueChange={(value) =>
                updateSearchParams({
                  status:
                    value === "all" ? undefined : (value as FollowUpStatus),
                })
              }
            >
              <SelectTrigger className="min-w-[90px] max-w-[130px] h-9 shrink-0">
                <SelectValue placeholder="Status">
                  <div className="flex items-center gap-1.5 min-w-0">
                    {statusFilter &&
                      getStatusIcon(statusFilter as FollowUpStatus)}
                    <span className="truncate">
                      {statusFilter
                        ? getStatusLabel(statusFilter as FollowUpStatus)
                        : "Status"}
                    </span>
                  </div>
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

            {/* Slide filter - hidden on mobile, visible on lg+ */}
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
                className="w-[130px] h-9 shrink-0 hidden lg:flex"
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

            {/* Submetric filter - hidden on mobile, visible on xl+ */}
            <div className="hidden xl:block shrink-0">
              <SubmetricSelector
                submetricDefinitions={submetricDefinitions}
                value={submetricFilter || null}
                onValueChange={(value) =>
                  updateSearchParams({
                    submetricDefinitionId: value || undefined,
                  })
                }
                showAllOption
                disabled={
                  isLoadingWorkspace || isLoadingWorkspaces || !workspaceId
                }
                isLoading={
                  isLoadingWorkspace || isLoadingWorkspaces || !workspaceId
                }
              />
            </div>

            {/* Assignee selector - hidden on mobile, visible on xl+ */}
            <div className="hidden xl:block shrink-0">
              <UserAssigneeMultiSelector
                users={users}
                value={assigneeIds}
                onValueChange={handleAssigneeChange}
                placeholder="Assignee"
                showUnassignedOption
                unassigned={unassignedFilter}
                onUnassignedChange={handleUnassignedChange}
                showMyTasksOption
                currentUserId={session?.user?.id}
                currentUserName={session?.user?.name ?? undefined}
                currentUserEmail={session?.user?.email ?? undefined}
                currentUserImage={session?.user?.image ?? undefined}
                triggerWidth="w-[200px]"
                showRemoveButtons={false}
                maxShownItems={1}
              />
            </div>

            {/* More Filters button - visible on mobile/tablet, hidden on xl+ */}
            <Popover open={moreFiltersOpen} onOpenChange={setMoreFiltersOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-9 px-2.5 shrink-0 xl:hidden relative"
                >
                  <SlidersHorizontal className="h-4 w-4" />
                  {mobileHiddenFiltersCount > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 h-4 w-4 rounded-full bg-primary text-[10px] font-medium text-primary-foreground flex items-center justify-center">
                      {mobileHiddenFiltersCount}
                    </span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent
                className="w-[280px] p-3"
                align="end"
                sideOffset={4}
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">More Filters</span>
                    {mobileHiddenFiltersCount > 0 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs"
                        onClick={() => {
                          updateSearchParams({
                            slideId: undefined,
                            submetricDefinitionId: undefined,
                            assigneeId: undefined,
                            unassigned: undefined,
                          });
                        }}
                      >
                        Clear
                      </Button>
                    )}
                  </div>

                  {/* Slide filter in popover - visible on mobile/tablet (lg screens hide this) */}
                  <div className="space-y-1.5 lg:hidden">
                    <Label className="text-xs text-muted-foreground font-normal">
                      Slide
                    </Label>
                    <Select
                      value={slideFilter || "all"}
                      onValueChange={(value) =>
                        updateSearchParams({
                          slideId: value === "all" ? undefined : value,
                        })
                      }
                      disabled={isLoadingWorkspace}
                    >
                      <SelectTrigger className="w-full h-9">
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
                  </div>

                  {/* Submetric filter in popover */}
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground font-normal">
                      Submetric
                    </Label>
                    <SubmetricSelector
                      submetricDefinitions={submetricDefinitions}
                      value={submetricFilter || null}
                      onValueChange={(value) =>
                        updateSearchParams({
                          submetricDefinitionId: value || undefined,
                        })
                      }
                      showAllOption
                      disabled={
                        isLoadingWorkspace ||
                        isLoadingWorkspaces ||
                        !workspaceId
                      }
                      isLoading={
                        isLoadingWorkspace ||
                        isLoadingWorkspaces ||
                        !workspaceId
                      }
                      triggerWidth="w-full"
                      triggerMaxWidth="max-w-full"
                    />
                  </div>

                  {/* Assignee selector in popover */}
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground font-normal">
                      Assignee
                    </Label>
                    <UserAssigneeMultiSelector
                      users={users}
                      value={assigneeIds}
                      onValueChange={handleAssigneeChange}
                      placeholder="Assignee"
                      showUnassignedOption
                      unassigned={unassignedFilter}
                      onUnassignedChange={handleUnassignedChange}
                      showMyTasksOption
                      currentUserId={session?.user?.id}
                      currentUserName={session?.user?.name ?? undefined}
                      currentUserEmail={session?.user?.email ?? undefined}
                      currentUserImage={session?.user?.image ?? undefined}
                      showRemoveButtons={false}
                      maxShownItems={1}
                    />
                  </div>
                </div>
              </PopoverContent>
            </Popover>

            {/* Clear filters button */}
            {hasActiveFilters && (
              <Button
                variant="ghost"
                size="sm"
                className="h-9 w-9 p-0 shrink-0"
                onClick={handleClearFilters}
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 flex flex-col min-h-0">
        <FollowUpTable
          followUps={followUps}
          workspaceSlug={workspaceSlug}
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

      {/* Footer with Pagination */}
      {(isLoading || (pagination && pagination.total > 0)) && (
        <div className="border-t bg-background px-0 md:px-3 py-2 sm:py-3">
          <div className="flex items-center justify-between gap-2 sm:gap-4">
            {/* Left side - Total count and results info */}
            <div className="flex items-center gap-2 sm:gap-4">
              <div className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm text-muted-foreground">
                {isLoading ? (
                  <Skeleton className="h-4 w-20 sm:w-32" />
                ) : (
                  <>
                    {hasActiveFilters && (
                      <>
                        <Filter className="h-3.5 w-3.5" />
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

              {/* Items per page selector - only show if we have multiple pages or enough items, hidden on mobile */}
              {pagination && pagination.total > 10 && (
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
            {pagination && pagination.totalPages > 1 && (
              <div className="flex items-center gap-1.5 sm:gap-2">
                <span className="text-sm text-muted-foreground hidden sm:inline">
                  Page {page} of {pagination.totalPages}
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
                  </Button>

                  {/* Page numbers - show on larger screens */}
                  <div className="hidden md:flex items-center gap-1">
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
                            onClick={() =>
                              updateSearchParams({ page: pageNum })
                            }
                            className={cn(
                              "h-8 w-8 p-0",
                              page === pageNum && "pointer-events-none"
                            )}
                          >
                            {pageNum}
                          </Button>
                        );
                      }
                    )}
                  </div>

                  {/* Simple page indicator for mobile */}
                  <span className="text-[10px] sm:text-xs text-muted-foreground md:hidden px-0.5 sm:px-1">
                    {page}/{pagination.totalPages}
                  </span>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => updateSearchParams({ page: page + 1 })}
                    disabled={!pagination.hasMore}
                    className="h-7 sm:h-8 px-1.5 sm:px-3"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Dialog */}
      {/* Only render dialog when workspace data is loaded to ensure slides have full nested data */}
      {!isLoadingWorkspace && (
        <FollowUpDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          followUp={editingFollowUp}
          users={users}
          slides={slides}
          onSave={handleSave}
          isLoading={createMutation.isPending || updateMutation.isPending}
        />
      )}
    </div>
  );
}
