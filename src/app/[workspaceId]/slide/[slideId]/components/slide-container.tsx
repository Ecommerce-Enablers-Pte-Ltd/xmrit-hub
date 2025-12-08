"use client";

import { BookOpen, ChevronDown, ChevronUp, Link2, Search } from "lucide-react";
import {
  lazy,
  memo,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Button } from "@/components/ui/button";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { MetricWithSubmetrics } from "@/types/db/metric";
import { EditMetricDefinitionDialog } from "./edit-metric-definition-dialog";

// Lazy load the SubmetricLineChart component for better performance
const SubmetricLineChart = lazy(() =>
  import("./submetric-card").then((mod) => ({
    default: mod.SubmetricLineChart,
  })),
);

// Generate URL-safe slug from category and metric name
export function generateChartSlug(
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

// Skeleton loader for charts - shows chart info even when lazy loaded
function ChartSkeleton({
  category,
  metricName,
}: {
  category?: string;
  metricName?: string;
}) {
  return (
    <div className="w-full border rounded-lg overflow-visible">
      {/* Header Section */}
      <div className="px-6 py-4">
        {/* Chart Toolbar */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Skeleton className="h-8 w-8 rounded" />
          </div>
          <div className="flex items-center gap-2">
            <Skeleton className="h-9 w-28" />
            <Skeleton className="h-9 w-28" />
            <Skeleton className="h-9 w-32" />
            <div className="h-6 w-px bg-border mx-1" />
            <Skeleton className="h-9 w-9" />
            <Skeleton className="h-9 w-9" />
          </div>
        </div>

        {/* Title and Status Row */}
        <div className="flex items-start justify-between mt-4">
          <div className="flex-1">
            <div className="flex items-center gap-3">
              {category || metricName ? (
                <>
                  {category && (
                    <span className="px-4 py-2 bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 rounded-md text-sm font-bold uppercase tracking-wide whitespace-nowrap shrink-0">
                      {category}
                    </span>
                  )}
                  <h2 className="text-2xl font-semibold tracking-tight overflow-hidden text-ellipsis whitespace-nowrap">
                    {metricName || "Untitled"}
                  </h2>
                </>
              ) : (
                <>
                  <Skeleton className="h-9 w-24 rounded-md" />
                  <Skeleton className="h-8 w-64" />
                </>
              )}
            </div>
          </div>
          {/* Traffic Light placeholder */}
          <div className="flex flex-col items-end gap-2 mr-1">
            <Skeleton className="h-10 w-10 rounded-full" />
          </div>
        </div>
      </div>

      {/* Content Section - Two charts side by side */}
      <div className="px-6 pb-6 pt-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* X Chart skeleton */}
          <div className="space-y-2">
            <Skeleton className="h-[350px] w-full" />
          </div>
          {/* MR Chart skeleton */}
          <div className="space-y-2">
            <Skeleton className="h-[350px] w-full" />
          </div>
        </div>
      </div>
    </div>
  );
}

interface SlideContainerProps {
  metrics: MetricWithSubmetrics[];
  slideId: string;
  workspaceId: string;
}

// Custom comparison function for memo to prevent unnecessary re-renders
function arePropsEqual(
  prevProps: SlideContainerProps,
  nextProps: SlideContainerProps,
): boolean {
  // Only re-render if slideId, workspaceId or metrics data actually changes
  if (prevProps.slideId !== nextProps.slideId) return false;
  if (prevProps.workspaceId !== nextProps.workspaceId) return false;
  if (prevProps.metrics.length !== nextProps.metrics.length) return false;

  // Deep compare metrics - check if any metric or submetric data changed
  for (let i = 0; i < prevProps.metrics.length; i++) {
    const prevMetric = prevProps.metrics[i];
    const nextMetric = nextProps.metrics[i];

    if (
      prevMetric.id !== nextMetric.id ||
      prevMetric.name !== nextMetric.name ||
      prevMetric.definitionId !== nextMetric.definitionId ||
      prevMetric.submetrics.length !== nextMetric.submetrics.length
    ) {
      return false;
    }

    // Check if submetrics data changed
    for (let j = 0; j < prevMetric.submetrics.length; j++) {
      const prevSub = prevMetric.submetrics[j];
      const nextSub = nextMetric.submetrics[j];

      if (
        prevSub.id !== nextSub.id ||
        prevSub.definition?.metricName !== nextSub.definition?.metricName ||
        prevSub.definition?.category !== nextSub.definition?.category ||
        prevSub.trafficLightColor !== nextSub.trafficLightColor ||
        (prevSub.dataPoints?.length ?? 0) !== (nextSub.dataPoints?.length ?? 0)
      ) {
        return false;
      }
    }
  }

  return true;
}

// Memoize the component to prevent unnecessary re-renders
export const SlideContainer = memo(function SlideContainer({
  metrics,
  slideId,
  workspaceId,
}: SlideContainerProps) {
  const chartRefs = useRef<(HTMLDivElement | null)[]>([]);
  const navigationRef = useRef<HTMLDivElement>(null);
  // Use ref to track current index for instant navigation without re-renders
  const currentIndexRef = useRef<number>(0);
  const [editingMetric, setEditingMetric] =
    useState<MetricWithSubmetrics | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);

  // Track which charts should be rendered (visible + nearby)
  const [visibleCharts, setVisibleCharts] = useState<Set<number>>(
    () => new Set([0, 1, 2]), // Initially render first 3 charts
  );

  // Search dialog state
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const commandListRef = useRef<HTMLDivElement>(null);
  const [copiedSlug, setCopiedSlug] = useState<string | null>(null);

  // Flatten all submetrics into a single array for easier navigation
  const allCharts = useMemo(() => {
    return metrics.flatMap((metric) =>
      metric.submetrics.map((submetric) => ({
        metricId: metric.id,
        metricName: metric.name,
        submetric,
        slug: generateChartSlug(
          submetric.definition?.category,
          submetric.definition?.metricName,
        ),
      })),
    );
  }, [metrics]);

  const totalCharts = allCharts.length;

  // Scroll to chart with robust handling for lazy-loaded charts
  const scrollToChart = useCallback(
    (index: number) => {
      // Add more charts to visibleCharts for smoother experience
      setVisibleCharts((prev) => {
        const next = new Set(prev);
        // Add target chart and a wider range of adjacent ones
        for (
          let i = Math.max(0, index - 2);
          i <= Math.min(totalCharts - 1, index + 2);
          i++
        ) {
          next.add(i);
        }
        return next;
      });

      // Helper to perform scroll with highlight effect
      const performScroll = (element: HTMLDivElement) => {
        // Use instant scroll first to get close, then smooth scroll for polish
        element.scrollIntoView({
          behavior: "instant",
          block: "center",
        });

        // Small delay then smooth scroll for final positioning
        setTimeout(() => {
          element.scrollIntoView({
            behavior: "smooth",
            block: "center",
          });

          // Add highlight effect
          element.classList.add(
            "ring-2",
            "ring-primary/40",
            "ring-offset-2",
            "ring-offset-background",
          );
          setTimeout(() => {
            element.classList.remove(
              "ring-2",
              "ring-primary/40",
              "ring-offset-2",
              "ring-offset-background",
            );
          }, 1500);
        }, 50);
      };

      // Try to scroll with longer delays for far-away charts
      const tryScroll = (attempts = 0) => {
        const chartElement = chartRefs.current[index];
        if (chartElement) {
          performScroll(chartElement);
        } else if (attempts < 20) {
          // Use setTimeout with increasing delays for more reliability
          const delay = attempts < 5 ? 16 : attempts < 10 ? 50 : 100;
          setTimeout(() => tryScroll(attempts + 1), delay);
        }
      };

      // Start trying after a brief delay for React to process state update
      setTimeout(() => tryScroll(), 10);
    },
    [totalCharts],
  );

  // Navigate to previous chart - INSTANT, NO RE-RENDERS
  const navigatePrevious = useCallback(() => {
    const currentIndex = currentIndexRef.current;
    if (currentIndex > 0) {
      const newIndex = currentIndex - 1;
      currentIndexRef.current = newIndex;
      // Scroll happens IMMEDIATELY - no state updates, no re-renders
      scrollToChart(newIndex);
    }
    // Remove focus to allow arrow key navigation
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
  }, [scrollToChart]);

  // Navigate to next chart - INSTANT, NO RE-RENDERS
  const navigateNext = useCallback(() => {
    const currentIndex = currentIndexRef.current;
    if (currentIndex < totalCharts - 1) {
      const newIndex = currentIndex + 1;
      currentIndexRef.current = newIndex;
      // Scroll happens IMMEDIATELY - no state updates, no re-renders
      scrollToChart(newIndex);
    }
    // Remove focus to allow arrow key navigation
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
  }, [scrollToChart, totalCharts]);

  // Auto-track which chart is in view and manage virtualization
  useEffect(() => {
    if (chartRefs.current.length === 0) return;

    // Observer for tracking current chart (center of viewport)
    const trackingObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const element = entry.target as HTMLDivElement;
            const index = chartRefs.current.indexOf(element);
            if (index !== -1) {
              // Update current index WITHOUT triggering re-render
              currentIndexRef.current = index;
            }
          }
        });
      },
      {
        root: null,
        rootMargin: "-40% 0px -40% 0px", // Middle 20% of viewport
        threshold: 0,
      },
    );

    // Observer for managing which charts should render (virtualization)
    const virtualizationObserver = new IntersectionObserver(
      (entries) => {
        setVisibleCharts((prev) => {
          const next = new Set(prev);
          entries.forEach((entry) => {
            const element = entry.target as HTMLDivElement;
            const index = chartRefs.current.indexOf(element);
            if (index !== -1) {
              if (entry.isIntersecting) {
                // Add visible chart and adjacent ones
                next.add(index);
                if (index > 0) next.add(index - 1);
                if (index < totalCharts - 1) next.add(index + 1);
              } else {
                // Keep charts in memory if they're adjacent to visible ones
                const isAdjacent = Array.from(next).some(
                  (visibleIndex) => Math.abs(visibleIndex - index) <= 1,
                );
                if (!isAdjacent) {
                  next.delete(index);
                }
              }
            }
          });
          return next;
        });
      },
      {
        root: null,
        rootMargin: "400px", // Load charts 400px before they enter viewport
        threshold: 0,
      },
    );

    // Observe all chart elements
    chartRefs.current.forEach((chartElement) => {
      if (chartElement) {
        trackingObserver.observe(chartElement);
        virtualizationObserver.observe(chartElement);
      }
    });

    return () => {
      trackingObserver.disconnect();
      virtualizationObserver.disconnect();
    };
  }, [totalCharts]); // Re-run when number of charts changes

  // Handle chart selection from search
  const handleChartSelect = useCallback(
    (chartIndex: number) => {
      setIsSearchOpen(false);
      setSearchQuery("");
      currentIndexRef.current = chartIndex;
      scrollToChart(chartIndex);
    },
    [scrollToChart],
  );

  // Handle search dialog open/close
  const handleSearchOpenChange = useCallback((open: boolean) => {
    setIsSearchOpen(open);
    if (open) {
      setSearchQuery("");
      // Reset scroll position when opening
      requestAnimationFrame(() => {
        if (commandListRef.current) {
          commandListRef.current.scrollTop = 0;
        }
      });
    }
  }, []);

  // Handle search query change - reset scroll to top
  const handleSearchChange = useCallback((value: string) => {
    setSearchQuery(value);
    // Reset scroll to top when filtering
    requestAnimationFrame(() => {
      if (commandListRef.current) {
        commandListRef.current.scrollTop = 0;
      }
    });
  }, []);

  // Copy chart link from search dialog
  const copyChartLink = useCallback(
    async (slug: string, e: React.MouseEvent) => {
      e.stopPropagation();
      const url = `${window.location.origin}${window.location.pathname}#${slug}`;
      try {
        await navigator.clipboard.writeText(url);
        setCopiedSlug(slug);
        setTimeout(() => setCopiedSlug(null), 1500);
      } catch {
        // Fallback for older browsers
        const textArea = document.createElement("textarea");
        textArea.value = url;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand("copy");
        document.body.removeChild(textArea);
        setCopiedSlug(slug);
        setTimeout(() => setCopiedSlug(null), 1500);
      }
    },
    [],
  );

  // Search dialog keyboard shortcut (Cmd+F or Ctrl+F) - replaces browser find
  useEffect(() => {
    const handleSearchShortcut = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "f") {
        e.preventDefault();
        setIsSearchOpen((prev) => !prev);
      }
    };

    window.addEventListener("keydown", handleSearchShortcut);
    return () => window.removeEventListener("keydown", handleSearchShortcut);
  }, []);

  // Scroll to chart from URL hash (for deep linking)
  const scrollToHashTarget = useCallback(() => {
    const hash = window.location.hash;
    if (!hash) return;

    const slug = hash.slice(1); // Remove the # prefix

    // Handle legacy #submetric-<id> format for backwards compatibility
    if (slug.startsWith("submetric-")) {
      const submetricId = slug.replace("submetric-", "");
      const chartIndex = allCharts.findIndex(
        (c) => c.submetric.id === submetricId,
      );
      if (chartIndex !== -1) {
        currentIndexRef.current = chartIndex;
        scrollToChart(chartIndex);
      }
      return;
    }

    // Handle legacy #metric-<id> format for backwards compatibility
    if (slug.startsWith("metric-")) {
      const metricId = slug.replace("metric-", "");
      const chartIndex = allCharts.findIndex((c) => c.metricId === metricId);
      if (chartIndex !== -1) {
        currentIndexRef.current = chartIndex;
        scrollToChart(chartIndex);
      }
      return;
    }

    // Handle new #{category}-{metricName} slug format
    const chartIndex = allCharts.findIndex((c) => c.slug === slug);
    if (chartIndex !== -1) {
      currentIndexRef.current = chartIndex;
      scrollToChart(chartIndex);
    }
  }, [allCharts, scrollToChart]);

  // Scroll to hash target on initial load and when metrics change
  useEffect(() => {
    // Longer delay to ensure lazy-loaded charts are ready
    const timeoutId = setTimeout(() => {
      scrollToHashTarget();
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [scrollToHashTarget]);

  // Listen for hash changes while on the page
  useEffect(() => {
    const handleHashChange = () => {
      scrollToHashTarget();
    };

    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, [scrollToHashTarget]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Check if user is typing in an input field or interacting with a button/dropdown
      const target = e.target as HTMLElement;
      const isInteractiveElement =
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.tagName === "BUTTON" ||
        target.tagName === "SELECT" ||
        target.isContentEditable ||
        target.closest('[role="menu"]') !== null ||
        target.closest('[role="dialog"]') !== null ||
        target.closest('[role="combobox"]') !== null ||
        target.getAttribute("role") === "button" ||
        target.hasAttribute("data-slot"); // Radix UI components use data-slot

      // Don't handle navigation if focus is on interactive elements
      if (isInteractiveElement) {
        return;
      }

      if (e.key === "ArrowUp" || e.key === "k" || e.key === "K") {
        e.preventDefault();
        navigatePrevious();
      } else if (e.key === "ArrowDown" || e.key === "j" || e.key === "J") {
        e.preventDefault();
        navigateNext();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [navigatePrevious, navigateNext]);

  if (metrics.length === 0) {
    return (
      <div className="text-center py-12">
        <h3 className="text-lg font-medium text-muted-foreground">
          No metrics found
        </h3>
        <p className="text-sm text-muted-foreground mt-2">
          This slide doesn't have any metrics yet.
        </p>
      </div>
    );
  }

  if (totalCharts === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <div className="max-w-md mx-auto">
          <div className="text-6xl mb-4">📊</div>
          <h3 className="text-xl font-semibold mb-2">No submetrics found</h3>
          <p className="text-sm">
            These metrics don't have any submetrics configured yet.
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Search Dialog */}
      <CommandDialog
        open={isSearchOpen}
        onOpenChange={handleSearchOpenChange}
        title="Search Charts"
        description="Search and jump to any chart by category or metric name"
        className="sm:max-w-2xl"
      >
        <CommandInput
          placeholder="Type chart # or search by category/metric name..."
          value={searchQuery}
          onValueChange={handleSearchChange}
        />
        <CommandList ref={commandListRef} className="max-h-[60vh]">
          <CommandEmpty>No charts found.</CommandEmpty>
          <CommandGroup heading="Charts">
            {allCharts.map((chart, index) => {
              const category = chart.submetric.definition?.category || "";
              const metricName =
                chart.submetric.definition?.metricName || "Untitled";
              const parentMetric = chart.metricName || "";
              // Combine all searchable text for better matching
              const searchValue = `${
                index + 1
              } ${category} ${metricName} ${parentMetric}`;

              return (
                <CommandItem
                  key={chart.submetric.id}
                  value={searchValue}
                  keywords={[
                    category,
                    metricName,
                    parentMetric,
                    String(index + 1),
                  ].filter(Boolean)}
                  onSelect={() => handleChartSelect(index)}
                  className="flex items-center gap-3 py-3 cursor-pointer"
                >
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium">
                    {index + 1}
                  </span>
                  <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                    {category && (
                      <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                        {category}
                      </span>
                    )}
                    <span className="text-sm font-medium truncate">
                      {metricName}
                    </span>
                  </div>
                  <Tooltip open={copiedSlug === chart.slug}>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => copyChartLink(chart.slug, e)}
                        className="h-7 w-7 shrink-0 cursor-pointer"
                        title="Copy link to this chart"
                      >
                        <Link2 className="h-3.5 w-3.5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="left">Copied!</TooltipContent>
                  </Tooltip>
                </CommandItem>
              );
            })}
          </CommandGroup>
        </CommandList>
      </CommandDialog>

      {/* Floating Navigation Controls */}
      {totalCharts > 1 && (
        <div
          ref={navigationRef}
          className="fixed right-18 top-1/2 -translate-y-1/2 z-50 flex flex-col gap-2 opacity-40 hover:opacity-100 transition-opacity duration-300"
        >
          <Button
            onClick={() => setIsSearchOpen(true)}
            size="icon"
            variant="ghost"
            className="h-8 w-8 rounded-full bg-background/80 backdrop-blur-sm border border-border/50 hover:border-border hover:bg-background/90 transition-all shadow-2xl"
            title="Search charts (⌘F)"
          >
            <Search className="h-4 w-4" />
          </Button>

          <Button
            onClick={navigatePrevious}
            size="icon"
            variant="ghost"
            className="h-8 w-8 rounded-full bg-background/80 backdrop-blur-sm border border-border/50 hover:border-border hover:bg-background/90 transition-all shadow-2xl"
            title="Previous chart (↑ or K)"
          >
            <ChevronUp className="h-5 w-5" />
          </Button>

          <Button
            onClick={navigateNext}
            size="icon"
            variant="ghost"
            className="h-8 w-8 rounded-full bg-background/80 backdrop-blur-sm border border-border/50 hover:border-border hover:bg-background/90 transition-all shadow-2xl"
            title="Next chart (↓ or J)"
          >
            <ChevronDown className="h-5 w-5" />
          </Button>
        </div>
      )}

      {/* Charts Grid */}
      <div className="space-y-12">
        {metrics.map((metric) => (
          <div key={metric.id} id={`metric-${metric.id}`} className="space-y-8">
            <div>
              <div className="flex items-center gap-2 mb-0.5">
                <h2 className="text-3xl font-bold text-foreground">
                  {metric.name}
                </h2>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 opacity-50 hover:opacity-100 shrink-0"
                  onClick={() => {
                    setEditingMetric(metric);
                    setIsEditDialogOpen(true);
                  }}
                  title={
                    metric.definitionId
                      ? "Edit metric definition"
                      : "Cannot edit - metric definition not linked. Run backfill script."
                  }
                  disabled={!metric.definitionId}
                >
                  <BookOpen className="h-4 w-4" />
                </Button>
              </div>
              {metric.definition?.definition ? (
                <p className="text-muted-foreground mt-3 text-sm leading-relaxed">
                  {metric.definition.definition}
                </p>
              ) : (
                <p className="text-muted-foreground/60 mt-3 text-sm italic">
                  No definition provided. Click the book icon to add one.
                </p>
              )}
            </div>

            {metric.submetrics.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <div className="max-w-md mx-auto">
                  <div className="text-6xl mb-4">📊</div>
                  <h3 className="text-xl font-semibold mb-2">
                    No submetrics found
                  </h3>
                  <p className="text-sm">
                    This metric doesn't have any submetrics configured yet.
                  </p>
                </div>
              </div>
            ) : (
              <div className="grid gap-8 grid-cols-1">
                {metric.submetrics.map((submetric) => {
                  // Find the global index and chart data for this chart
                  const chartIndex = allCharts.findIndex(
                    (c) => c.submetric.id === submetric.id,
                  );
                  const chartData = allCharts[chartIndex];

                  const shouldRender = visibleCharts.has(chartIndex);

                  return (
                    <div
                      key={submetric.id}
                      id={chartData?.slug}
                      ref={(el) => {
                        chartRefs.current[chartIndex] = el;
                      }}
                      className="transition-all duration-300 rounded-lg relative"
                      style={{
                        // Reserve minimum height to prevent layout shift
                        minHeight: shouldRender ? undefined : "500px",
                      }}
                    >
                      {shouldRender ? (
                        <Suspense
                          fallback={
                            <ChartSkeleton
                              category={
                                submetric.definition?.category ?? undefined
                              }
                              metricName={
                                submetric.definition?.metricName ?? undefined
                              }
                            />
                          }
                        >
                          <SubmetricLineChart
                            submetric={submetric}
                            slideId={slideId}
                            workspaceId={workspaceId}
                          />
                        </Suspense>
                      ) : (
                        <ChartSkeleton
                          category={submetric.definition?.category ?? undefined}
                          metricName={
                            submetric.definition?.metricName ?? undefined
                          }
                        />
                      )}
                      {totalCharts > 1 && (
                        <div className="absolute bottom-4 right-4 bg-background/80 backdrop-blur-sm border border-border/50 rounded-full px-3 py-1.5 text-xs font-semibold opacity-60">
                          <span className="text-foreground">
                            {chartIndex + 1}
                          </span>
                          <span className="text-muted-foreground">
                            {" "}
                            / {totalCharts}
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Edit Metric Definition Dialog */}
      {editingMetric && (
        <EditMetricDefinitionDialog
          open={isEditDialogOpen}
          onOpenChange={(open) => {
            setIsEditDialogOpen(open);
            if (!open) {
              // Delay clearing the metric to allow exit animation to complete
              setTimeout(() => setEditingMetric(null), 200);
            }
          }}
          metric={editingMetric}
        />
      )}
    </>
  );
}, arePropsEqual);
