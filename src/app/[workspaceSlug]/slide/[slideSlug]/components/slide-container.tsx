"use client";

import { BookOpen, ChevronDown, ChevronUp } from "lucide-react";
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
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { ChartInfo } from "@/lib/api/slides";
import type { MetricWithSubmetrics } from "@/types/db/metric";
import { useChartSearch } from "../../../../../providers/chart-search-provider";
import { EditMetricDefinitionDialog } from "./edit-metric-definition-dialog";

// Lazy load the SubmetricLineChart component for better performance
const SubmetricLineChart = lazy(() =>
  import("./submetric-card").then((mod) => ({
    default: mod.SubmetricLineChart,
  })),
);

// Lazy load ChartSearchDialog to improve initial load performance
const ChartSearchDialog = lazy(() =>
  import("./chart-search-dialog").then((mod) => ({
    default: mod.ChartSearchDialog,
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

// Skeleton loader for charts - hides chart info until reached
function ChartSkeleton() {
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

        {/* Title and Status Row - always show skeleton placeholders until reached */}
        <div className="flex items-start justify-between mt-4">
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <Skeleton className="h-9 w-24 rounded-md" />
              <Skeleton className="h-8 w-64" />
            </div>
          </div>
          {/* Traffic Light placeholder */}
          <div className="flex flex-col items-end gap-2">
            <Skeleton className="h-10 w-10 rounded-sm" />
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

  // Chart search context
  const {
    isOpen: isSearchOpen,
    open: openSearch,
    close: closeSearch,
  } = useChartSearch();

  // Track if dialog has been loaded to keep it mounted for close animation
  const [hasDialogLoaded, setHasDialogLoaded] = useState(false);

  // Mark dialog as loaded when first opened
  if (isSearchOpen && !hasDialogLoaded) {
    setHasDialogLoaded(true);
  }

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

  // Derive chart info for search dialog directly from allCharts
  const chartInfoList: ChartInfo[] = useMemo(() => {
    return allCharts.map((chart) => ({
      id: chart.submetric.id,
      metricId: chart.metricId,
      metricName: chart.metricName || "",
      category: chart.submetric.definition?.category || "",
      name: chart.submetric.definition?.metricName || "Untitled",
      slug: chart.slug,
    }));
  }, [allCharts]);

  const totalCharts = allCharts.length;

  // Scroll to chart with robust handling for lazy-loaded charts
  // behavior: "smooth" for navigation (gives sense of direction), "instant" for hash links
  const scrollToChart = useCallback(
    (index: number, behavior: "smooth" | "instant" = "smooth") => {
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
        if (behavior === "instant") {
          // Instant jump for hash links - no sense of direction needed
          element.scrollIntoView({
            behavior: "instant",
            block: "center",
          });

          // Add highlight effect immediately
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
        } else {
          // Smooth scroll for navigation - gives sense of direction
          element.scrollIntoView({
            behavior: "smooth",
            block: "center",
          });

          // Add highlight effect after scroll completes
          setTimeout(() => {
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
          }, 300);
        }
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
      // Clear URL hash when navigating to prevent stale deep links
      if (window.location.hash) {
        window.history.replaceState(null, "", window.location.pathname);
      }
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
      // Clear URL hash when navigating to prevent stale deep links
      if (window.location.hash) {
        window.history.replaceState(null, "", window.location.pathname);
      }
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

  // Scroll to chart from URL hash (for deep linking)
  // Uses "instant" behavior - direct jump without scroll animation
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
        scrollToChart(chartIndex, "instant");
      }
      return;
    }

    // Handle legacy #metric-<id> format for backwards compatibility
    if (slug.startsWith("metric-")) {
      const metricId = slug.replace("metric-", "");
      const chartIndex = allCharts.findIndex((c) => c.metricId === metricId);
      if (chartIndex !== -1) {
        currentIndexRef.current = chartIndex;
        scrollToChart(chartIndex, "instant");
      }
      return;
    }

    // Handle new #{category}-{metricName} slug format
    const chartIndex = allCharts.findIndex((c) => c.slug === slug);
    if (chartIndex !== -1) {
      currentIndexRef.current = chartIndex;
      scrollToChart(chartIndex, "instant");
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

  // Handle chart selection from search - must be before early returns
  // Uses "instant" behavior - direct jump for deliberate selection
  const handleSearchSelect = useCallback(
    (index: number) => {
      currentIndexRef.current = index;
      scrollToChart(index, "instant");
    },
    [scrollToChart],
  );

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
      {/* Chart Search Dialog - Lazy loaded, kept mounted after first open for close animation */}
      {hasDialogLoaded && (
        <Suspense fallback={null}>
          <ChartSearchDialog
            open={isSearchOpen}
            onOpenChange={(open) => (open ? openSearch() : closeSearch())}
            charts={chartInfoList}
            onChartSelect={handleSearchSelect}
          />
        </Suspense>
      )}

      {/* Floating Navigation Controls */}
      {totalCharts > 1 && (
        <div
          ref={navigationRef}
          className="fixed right-18 top-1/2 -translate-y-1/2 z-50 flex flex-col gap-2 opacity-40 hover:opacity-100 transition-opacity duration-300"
        >
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                onClick={navigatePrevious}
                size="icon"
                variant="ghost"
                className="h-8 w-8 rounded-full bg-background/80 backdrop-blur-sm border border-border/50 hover:border-border hover:bg-background/90 transition-all shadow-2xl"
              >
                <ChevronUp className="h-5 w-5" />
                <span className="sr-only">Previous chart</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent side="left">
              <span className="flex items-center gap-2">
                Previous chart
                <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
                  ↑
                </kbd>
                <span className="text-muted-foreground">or</span>
                <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
                  K
                </kbd>
              </span>
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                onClick={navigateNext}
                size="icon"
                variant="ghost"
                className="h-8 w-8 rounded-full bg-background/80 backdrop-blur-sm border border-border/50 hover:border-border hover:bg-background/90 transition-all shadow-2xl"
              >
                <ChevronDown className="h-5 w-5" />
                <span className="sr-only">Next chart</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent side="left">
              <span className="flex items-center gap-2">
                Next chart
                <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
                  ↓
                </kbd>
                <span className="text-muted-foreground">or</span>
                <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
                  J
                </kbd>
              </span>
            </TooltipContent>
          </Tooltip>
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
                        <Suspense fallback={<ChartSkeleton />}>
                          <SubmetricLineChart
                            submetric={submetric}
                            slideId={slideId}
                            workspaceId={workspaceId}
                          />
                        </Suspense>
                      ) : (
                        <ChartSkeleton />
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
