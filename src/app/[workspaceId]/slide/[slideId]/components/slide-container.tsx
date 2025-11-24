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
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { MetricWithSubmetrics } from "@/types/db/metric";
import { EditMetricDefinitionDialog } from "./edit-metric-definition-dialog";

// Lazy load the SubmetricLineChart component for better performance
const SubmetricLineChart = lazy(() =>
  import("./submetric-card").then((mod) => ({
    default: mod.SubmetricLineChart,
  })),
);

// Skeleton loader for charts
function ChartSkeleton() {
  return (
    <Card className="p-6">
      <div className="space-y-4">
        <div className="flex items-start justify-between">
          <div className="space-y-2 flex-1">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-96" />
          </div>
          <Skeleton className="h-8 w-8 rounded" />
        </div>
        <Skeleton className="h-[400px] w-full" />
        <div className="flex gap-2">
          <Skeleton className="h-9 w-24" />
          <Skeleton className="h-9 w-24" />
          <Skeleton className="h-9 w-24" />
        </div>
      </div>
    </Card>
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
        prevSub.label !== nextSub.label ||
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

  // Flatten all submetrics into a single array for easier navigation
  const allCharts = useMemo(() => {
    return metrics.flatMap((metric) =>
      metric.submetrics.map((submetric) => ({
        metricId: metric.id,
        metricName: metric.name,
        submetric,
      })),
    );
  }, [metrics]);

  const totalCharts = allCharts.length;

  // Smooth scroll to the focused chart - INSTANT, no delay, no re-renders
  const scrollToChart = useCallback(
    (index: number) => {
      // Ensure the chart is visible before scrolling
      setVisibleCharts((prev) => {
        const next = new Set(prev);
        // Add the target chart and adjacent ones
        next.add(index);
        if (index > 0) next.add(index - 1);
        if (index < totalCharts - 1) next.add(index + 1);
        return next;
      });

      const chartElement = chartRefs.current[index];
      if (chartElement) {
        // Immediate scroll - no callbacks, no async, no delays
        chartElement.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });

        // Add a subtle gray animation effect
        chartElement.classList.add(
          "ring-2",
          "ring-muted-foreground/30",
          "ring-offset-2",
          "ring-offset-background",
        );
        setTimeout(() => {
          chartElement.classList.remove(
            "ring-2",
            "ring-muted-foreground/30",
            "ring-offset-2",
            "ring-offset-background",
          );
        }, 1000);
      }
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
      {/* Floating Navigation Controls */}
      {totalCharts > 1 && (
        <div
          ref={navigationRef}
          className="fixed right-18 top-1/2 -translate-y-1/2 z-50 flex flex-col gap-2 opacity-40 hover:opacity-100 transition-opacity duration-300"
        >
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
          <div key={metric.id} className="space-y-8">
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
                  // Find the global index for this chart
                  const chartIndex = allCharts.findIndex(
                    (c) => c.submetric.id === submetric.id,
                  );

                  const shouldRender = visibleCharts.has(chartIndex);

                  return (
                    <div
                      key={submetric.id}
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
