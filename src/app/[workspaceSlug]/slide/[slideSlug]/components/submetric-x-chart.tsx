"use client";

import { MessageSquare } from "lucide-react";
import {
  forwardRef,
  memo,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  CartesianGrid,
  Label,
  LabelList,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useChartTheme } from "@/hooks/use-chart-theme";
import { formatNumber } from "@/lib/formatting";
import {
  detectBucketType,
  normalizeToBucket,
  type TimeBucket,
} from "@/lib/time-buckets";
import type { TrendLimits, XMRLimits } from "@/lib/xmr-calculations";
import { useDefinitionCommentCounts } from "@/providers/comment-counts-provider";
import type { Submetric } from "@/types/db/submetric";
import { type DataPoint, SlideSheet } from "./slide-sheet";

// Separate component for dialog management to prevent chart re-renders
interface DialogManagerProps {
  isOpen: boolean;
  selectedPoint: { timestamp: string; bucketValue: string } | null;
  definitionId: string | undefined | null;
  bucketType: TimeBucket;
  allDataPoints: DataPoint[];
  slideId: string;
  workspaceId: string;
  onOpenChange: (open: boolean) => void;
  onCommentAdded: (bucketValue: string) => void;
}

const DialogManager = memo(
  ({
    isOpen,
    selectedPoint,
    definitionId,
    bucketType,
    allDataPoints,
    slideId,
    workspaceId,
    onOpenChange,
    onCommentAdded,
  }: DialogManagerProps) => {
    if (!definitionId || !selectedPoint) return null;

    return (
      <SlideSheet
        open={isOpen}
        onOpenChange={onOpenChange}
        definitionId={definitionId}
        bucketType={bucketType}
        bucketValue={selectedPoint.bucketValue}
        bucketLabel={selectedPoint.timestamp}
        allDataPoints={allDataPoints}
        slideId={slideId}
        workspaceId={workspaceId}
        onCommentAdded={onCommentAdded}
      />
    );
  },
);

DialogManager.displayName = "DialogManager";

interface SubmetricXChartProps {
  chartData: any[];
  xmrLimits: XMRLimits;
  submetric: Submetric;
  yAxisDomain: number[];
  isLimitsLocked: boolean;
  trendActive: boolean;
  trendLines: TrendLimits | null;
  slideId: string; // Required for comment count invalidation
  workspaceId: string; // Required for follow-ups functionality
  onCommentAdded?: (bucketValue: string) => void;
  batchIndex?: number; // Index for batch rendering (0-based)
  batchSize?: number; // Number of charts per batch (default: 10, renders instantly)
}

// Imperative handle for chart methods
export interface SubmetricXChartHandle {
  invalidateCommentCache: (bucketValue: string) => void;
}

// Memoized custom label component
const CustomLabel = memo((props: any) => {
  const { x, y, value, index, chartData } = props;

  // Use the index to look up the data point from chartData
  const dataPoint = chartData?.[index];
  const highestPriorityViolation = dataPoint?.highestPriorityViolation;

  // Determine color based on highest priority violation
  // Default to foreground color if no violation
  let textColor = "currentColor";

  if (highestPriorityViolation === "rule1") {
    textColor = "#ef4444"; // red
  } else if (highestPriorityViolation === "rule4") {
    textColor = "#f97316"; // orange
  } else if (highestPriorityViolation === "rule3") {
    textColor = "#f59e0b"; // amber
  } else if (highestPriorityViolation === "rule2") {
    textColor = "#3b82f6"; // blue
  } else if (highestPriorityViolation === "rule5") {
    textColor = "#10b981"; // green
  }

  const text = formatNumber(value);

  return (
    <text
      x={x}
      y={y - 16}
      textAnchor="middle"
      dominantBaseline="middle"
      className="recharts-label"
      style={{
        fontSize: "11px",
        fontWeight: "bold",
        fill: textColor,
      }}
    >
      {text}
    </text>
  );
});

CustomLabel.displayName = "CustomLabel";

// Custom Y-axis label component that properly rotates text
const YAxisLabel = memo((props: any) => {
  const { value, x, y, viewBox } = props;

  // Recharts provides x, y coordinates and viewBox
  // For Y-axis labels, we want to center vertically and rotate -90 degrees
  let labelX = x;
  let labelY = y;

  // If viewBox is available, use it to center vertically
  if (viewBox?.height) {
    labelY = viewBox.y + viewBox.height / 2;
  }

  // Ensure we have valid coordinates
  if (labelX == null || labelY == null) {
    // Fallback: use provided coordinates or defaults
    labelX = x || 0;
    labelY = y || 250; // Approximate center for 500px height chart
  }

  // Offset to the right (increase X) to position the rotated label better
  // Reduced offset to bring it closer to the Y-axis
  labelX = labelX + 10;

  return (
    <text
      x={labelX}
      y={labelY}
      fontSize="11px"
      fontWeight={600}
      textAnchor="middle"
      dominantBaseline="middle"
      className="recharts-label fill-foreground/50"
      transform={`rotate(-90, ${labelX}, ${labelY})`}
    >
      {value}
    </text>
  );
});

YAxisLabel.displayName = "YAxisLabel";

// Custom X-axis tick component (simplified - comment indicators are rendered separately)
const XAxisTick = memo(
  ({
    x,
    y,
    payload,
    chartData,
  }: {
    x: number;
    y: number;
    payload: any;
    chartData?: any[];
  }) => {
    // Try to get fullTimestamp from the chart data using payload.index
    const dataPoint = chartData?.[payload?.index];
    const fullTimestamp = dataPoint?.fullTimestamp;

    if (!fullTimestamp) {
      // Fallback: render just the label without indicator
      return (
        <text
          x={x}
          y={y + 16}
          textAnchor="middle"
          style={{ fontSize: "12px", fill: "#888" }}
        >
          {payload.value}
        </text>
      );
    }

    // Just render the tick label - comment indicators are rendered separately
    return (
      <text
        x={x}
        y={y + 16}
        textAnchor="middle"
        style={{ fontSize: "12px", fill: "#888" }}
      >
        {payload.value}
      </text>
    );
  },
  (prevProps, nextProps) => {
    // Custom comparison function for memo - only re-render if these change
    return (
      prevProps.payload.value === nextProps.payload.value &&
      prevProps.x === nextProps.x &&
      prevProps.y === nextProps.y
    );
  },
);

XAxisTick.displayName = "XAxisTick";

// Custom component to render comment indicators below the X-axis
// This renders for ALL data points, independent of tick visibility
const CommentIndicatorDot = memo(
  ({
    cx,
    cy: _cy,
    payload,
    bucketType,
    bucketsWithComments,
  }: {
    cx: number;
    cy: number;
    payload: any;
    bucketType: TimeBucket;
    bucketsWithComments: Record<string, number>;
  }) => {
    const fullTimestamp = payload?.fullTimestamp;

    if (!fullTimestamp) return null;

    const bucketValue = normalizeToBucket(fullTimestamp, bucketType);
    const hasComments = (bucketsWithComments[bucketValue] || 0) > 0;

    if (!hasComments) return null;

    const xAxisTickY = 440;
    const iconSize = 14;
    const iconX = cx - iconSize / 2;
    const iconY = xAxisTickY - iconSize / 2;

    return (
      <foreignObject
        x={iconX}
        y={iconY}
        width={iconSize}
        height={iconSize}
        style={{
          filter: "drop-shadow(0 1px 2px rgba(168, 85, 247, 0.5))",
        }}
      >
        <MessageSquare
          className="w-full h-full"
          style={{
            stroke: "#a855f7",
            fill: "#a855f7",
            strokeWidth: 2,
          }}
        />
      </foreignObject>
    );
  },
);

CommentIndicatorDot.displayName = "CommentIndicatorDot";

// Separate tooltip component that can re-render independently
const ChartTooltip = memo(
  ({
    active,
    payload,
    submetric,
    bucketType,
    commentsDataRef,
    fetchingRef,
    onFetchComments,
  }: {
    active: boolean;
    payload: any;
    submetric: Submetric;
    bucketType: TimeBucket;
    commentsDataRef: React.MutableRefObject<{ [key: string]: any }>;
    fetchingRef: React.MutableRefObject<Set<string>>;
    onFetchComments: (timestamp: string) => void;
  }) => {
    // Local state to trigger re-renders when comments load
    const [_refreshKey, setRefreshKey] = useState(0);
    const prevCacheKeyRef = useRef<string | null>(null);

    // Check if comments have loaded for the current point
    useEffect(() => {
      if (!active || !payload || !payload.length) {
        prevCacheKeyRef.current = null;
        return;
      }

      const valuePayload =
        payload.find((p: any) => p.dataKey === "value") || payload[0];
      if (!valuePayload) return;

      const data = valuePayload.payload;
      const timestamp = data?.fullTimestamp;
      if (!timestamp) return;

      const bucketValue = normalizeToBucket(timestamp, bucketType);
      const cacheKey = `${timestamp}-${bucketValue}`;

      // If cache key changed, reset
      if (prevCacheKeyRef.current !== cacheKey) {
        prevCacheKeyRef.current = cacheKey;
        setRefreshKey(0);
        return;
      }

      // Poll for comment updates (check every 100ms)
      const interval = setInterval(() => {
        const hasComments = commentsDataRef.current[cacheKey];
        const isLoading = fetchingRef.current.has(cacheKey);

        if (hasComments && !isLoading) {
          setRefreshKey((prev) => prev + 1);
          clearInterval(interval);
        }
      }, 100);

      return () => clearInterval(interval);
    }, [active, payload, bucketType, commentsDataRef, fetchingRef]);

    if (!active || !payload || !payload.length) {
      return null;
    }

    const valuePayload =
      payload.find((p: any) => p.dataKey === "value") || payload[0];
    if (!valuePayload) return null;

    const data = valuePayload.payload;
    const highestPriorityViolation = data?.highestPriorityViolation;
    const timestamp = data?.fullTimestamp;

    if (!timestamp) return null;

    const bucketValue = normalizeToBucket(timestamp, bucketType);
    const cacheKey = `${timestamp}-${bucketValue}`;

    // Use ref to get current comments
    const pointComments = commentsDataRef.current[cacheKey];
    const isLoading = fetchingRef.current.has(cacheKey);

    // Trigger fetch if not cached and not already fetching
    if (submetric.definitionId && !pointComments && !isLoading) {
      onFetchComments(timestamp);
    }

    // Get the actual value
    const displayValue = valuePayload.value ?? data?.value;

    // Violation display configuration
    const violationConfig: Record<
      string,
      {
        color: string;
        lightColor: string;
        emoji: string;
        title: string;
        description: string;
      }
    > = {
      rule1: {
        color: "text-red-600",
        lightColor: "text-red-500",
        emoji: "🔴",
        title: "Outside Control Limits",
        description: "Rule 1: Point beyond 3σ",
      },
      rule4: {
        color: "text-orange-600",
        lightColor: "text-orange-500",
        emoji: "🟠",
        title: "2 of 3 Beyond 2σ",
        description: "Rule 4: Clustering near limits",
      },
      rule3: {
        color: "text-amber-600",
        lightColor: "text-amber-500",
        emoji: "🟡",
        title: "4 Near Limit Pattern",
        description: "Rule 3: 3 of 4 in extreme quartiles",
      },
      rule2: {
        color: "text-blue-600",
        lightColor: "text-blue-500",
        emoji: "🔵",
        title: "Running Point Pattern",
        description: "Rule 2: 8+ points on one side",
      },
      rule5: {
        color: "text-green-600",
        lightColor: "text-green-500",
        emoji: "🟢",
        title: "Low Variation",
        description: "Rule 5: 15+ points within 1σ",
      },
    };

    const violation = highestPriorityViolation
      ? violationConfig[highestPriorityViolation]
      : null;

    return (
      <div className="bg-popover/95 backdrop-blur-sm border border-border rounded-lg p-4 shadow-lg shadow-black/10 dark:shadow-black/50 max-w-xs text-popover-foreground">
        <div className="space-y-2">
          <p className="font-semibold text-base border-b pb-2 text-popover-foreground">
            {data.fullTimestamp}
          </p>

          <div className="space-y-1">
            <p className="text-primary font-medium text-lg">
              {formatNumber(displayValue)}
              {(submetric.definition?.unit || submetric.definition?.yaxis) && (
                <span className="text-sm text-muted-foreground ml-1">
                  {submetric.definition.unit || submetric.definition.yaxis}
                </span>
              )}
            </p>

            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <span className="text-muted-foreground">Range:</span>
                <span className="font-medium ml-1">
                  {formatNumber(data?.range)}
                </span>
              </div>
              {data?.confidence != null && (
                <div>
                  <span className="text-muted-foreground">Confidence:</span>
                  <span className="font-medium ml-1">
                    {(data.confidence * 100).toFixed(1)}%
                  </span>
                </div>
              )}
            </div>
          </div>

          {violation && (
            <div className="pt-2 border-t">
              <p className="text-xs font-semibold text-muted-foreground mb-1.5">
                Highest Priority Violation:
              </p>
              <div
                className={`flex items-start gap-2 ${violation.color} font-medium text-sm`}
              >
                <span className="text-base mt-0.5">{violation.emoji}</span>
                <div>
                  <div>{violation.title}</div>
                  <div
                    className={`text-xs ${violation.lightColor} font-normal`}
                  >
                    {violation.description}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Comments section */}
          <div className="pt-2 border-t">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
                <MessageSquare className="h-3 w-3" />
                Comments
              </p>
              {pointComments?.comments && pointComments.comments.length > 0 && (
                <span className="text-xs text-muted-foreground">
                  {pointComments.comments.length}{" "}
                  {pointComments.comments.length === 1 ? "comment" : "comments"}
                </span>
              )}
            </div>
            {isLoading ? (
              <div className="space-y-2">
                <div className="rounded p-2 bg-muted/30 space-y-2 animate-pulse">
                  <div className="h-3 w-24 bg-muted rounded" />
                  <div className="h-2 w-full bg-muted rounded" />
                  <div className="h-2 w-3/4 bg-muted rounded" />
                </div>
                <div className="rounded p-2 bg-muted/30 space-y-2 animate-pulse">
                  <div className="h-3 w-20 bg-muted rounded" />
                  <div className="h-2 w-full bg-muted rounded" />
                </div>
              </div>
            ) : pointComments?.comments && pointComments.comments.length > 0 ? (
              <div className="space-y-2 max-w-[14vw]">
                {pointComments.comments.slice(0, 2).map((comment: any) => (
                  <div
                    key={comment.id}
                    className="text-xs bg-muted/50 rounded p-2"
                  >
                    <div className="font-medium text-foreground">
                      {comment.user.name || comment.user.email || "Anonymous"}
                    </div>
                    <div className="text-muted-foreground mt-1 line-clamp-2">
                      {comment.body}
                    </div>
                    <div className="text-muted-foreground/70 text-[10px] mt-1">
                      {new Date(comment.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                ))}
                {pointComments.comments.length > 2 && (
                  <p className="text-xs text-muted-foreground italic text-center py-1">
                    +{pointComments.comments.length - 2} more{" "}
                    {pointComments.comments.length - 2 === 1
                      ? "comment"
                      : "comments"}
                  </p>
                )}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground italic">
                No comments yet
              </p>
            )}
            <p className="text-xs text-muted-foreground mt-2 pt-2 border-t">
              Click point to add/reply
            </p>
          </div>
        </div>
      </div>
    );
  },
);

ChartTooltip.displayName = "ChartTooltip";

// Internal chart component without dialog state - prevents re-renders when dialog opens/closes
const SubmetricXChartInternal = memo(
  forwardRef<
    SubmetricXChartHandle,
    Omit<SubmetricXChartProps, "onCommentAdded"> & {
      onPointClick?: (data: { timestamp: string; bucketValue: string }) => void;
    }
  >(
    (
      {
        chartData,
        xmrLimits,
        submetric,
        yAxisDomain,
        isLimitsLocked,
        trendActive,
        trendLines,
        onPointClick,
        batchIndex = 0,
        batchSize,
      },
      ref,
    ) => {
      // Track theme for dots (lightweight, singleton observer)
      const isDark = useChartTheme();

      // Comments cache for hover tooltips - using refs to avoid parent re-renders
      const commentsDataRef = useRef<{ [key: string]: any }>({});
      const fetchingRef = useRef<Set<string>>(new Set());

      // Simple batch size - render many charts immediately for instant display
      const calculatedBatchSize = useMemo(() => {
        if (batchSize) return batchSize;
        return 10; // First 10 charts render instantly - covers most use cases
      }, [batchSize]);

      // Batch rendering with viewport detection
      const chartContainerRef = useRef<HTMLDivElement>(null);
      const [isVisible, setIsVisible] = useState(false);

      // Expose cache invalidation for external use (e.g., when comments are added)
      const invalidateCommentCache = useCallback((bucketValue: string) => {
        // Clear from fetching refs
        Array.from(fetchingRef.current).forEach((key) => {
          if (key.includes(bucketValue)) {
            fetchingRef.current.delete(key);
          }
        });

        // Clear from cache
        Object.keys(commentsDataRef.current).forEach((key) => {
          if (key.includes(bucketValue)) {
            delete commentsDataRef.current[key];
          }
        });
      }, []);

      // Expose methods via ref
      useImperativeHandle(
        ref,
        () => ({
          invalidateCommentCache,
        }),
        [invalidateCommentCache],
      );

      // Detect bucket type from data
      const bucketType = useMemo(() => {
        if (chartData.length === 0) return "day";
        // Use the fullTimestamp field which is in YYYY-MM-DD format
        const timestamps = chartData.map((d) => d.fullTimestamp);
        return detectBucketType(timestamps);
      }, [chartData]);

      // Smart batch rendering with always-ready next batch
      useEffect(() => {
        const batchNumber = Math.floor(batchIndex / calculatedBatchSize);
        const isFirstBatch = batchNumber === 0;
        const isSecondBatch = batchNumber === 1;

        // First batch (0-9): render immediately (NO delay, NO waiting)
        if (isFirstBatch) {
          setIsVisible(true);
          return;
        }

        // Second batch (10-19): preload after short delay so it's ready when user scrolls
        if (isSecondBatch) {
          // Start rendering after 300ms - enough time for first batch to paint
          // This ensures charts 10-19 are ready before user reaches them
          const timer = setTimeout(() => setIsVisible(true), 300);
          return () => clearTimeout(timer);
        }

        // Rest (20+): EXTREMELY aggressive preloading
        // This ensures the next 10 charts are ALWAYS ready
        if (!chartContainerRef.current) return;

        const observer = new IntersectionObserver(
          ([entry]) => {
            if (entry.isIntersecting) {
              setIsVisible(true);
              observer.disconnect(); // Render once, no need to observe again
            }
          },
          {
            threshold: 0.01,
            // EXTREMELY aggressive preload - 10 chart heights ahead (~5000px)
            // This means: viewing charts 0-9 → charts 0-19 rendered
            //            viewing charts 10-19 → charts 10-29 rendered
            //            viewing charts 20-29 → charts 20-39 rendered, etc.
            rootMargin: "5000px",
          },
        );

        observer.observe(chartContainerRef.current);
        return () => observer.disconnect();
      }, [batchIndex, calculatedBatchSize]);

      // Get comment counts from the shared provider (already batch-fetched)
      // Uses useDefinitionCommentCounts which only triggers re-renders when
      // this specific chart's comment counts change (not all charts)
      // Returns { counts, isReady } - we wait for isReady before showing chart to avoid double render
      const { counts: bucketsWithComments, isReady: commentCountsReady } =
        useDefinitionCommentCounts(
          isVisible ? (submetric.definitionId ?? undefined) : undefined,
          bucketType,
        );

      // Merge trend line data with chart data if trend is active
      const mergedChartData = useMemo(() => {
        if (!trendActive || !trendLines) {
          return chartData;
        }

        return chartData.map((point, index) => {
          return {
            ...point,
            trendCentre: trendLines.centreLine[index]?.value,
            trendUNPL: trendLines.unpl[index]?.value,
            trendLNPL: trendLines.lnpl[index]?.value,
            trendUpperQuartile: trendLines.upperQuartile[index]?.value,
            trendLowerQuartile: trendLines.lowerQuartile[index]?.value,
          };
        });
      }, [chartData, trendActive, trendLines]);

      // Memoize custom label wrapper - pass chartData for violation lookup
      const renderCustomLabel = useCallback(
        (props: any) => {
          return <CustomLabel {...props} chartData={chartData} />;
        },
        [chartData], // Re-render when chartData changes to get latest violations
      );

      // Fetch comments for a point when hovering
      const fetchCommentsForPoint = useCallback(
        (timestamp: string) => {
          if (!submetric.definitionId) return;

          const bucketValue = normalizeToBucket(timestamp, bucketType);
          const cacheKey = `${timestamp}-${bucketValue}`;

          // Check if already fetching or loaded
          if (
            fetchingRef.current.has(cacheKey) ||
            commentsDataRef.current[cacheKey]
          )
            return;

          // Mark as fetching
          fetchingRef.current.add(cacheKey);

          // Perform the fetch
          (async () => {
            try {
              const params = new URLSearchParams({
                bucketType,
                bucketValue,
                limit: "20", // Load more comments for tooltip preview (dialog will show all)
              });

              const response = await fetch(
                `/api/submetrics/definitions/${submetric.definitionId}/points?${params}`,
              );

              if (response.ok) {
                const data = await response.json();
                // Store in ref (tooltip will poll and detect this)
                commentsDataRef.current[cacheKey] = data;
              }
            } catch (error) {
              console.error("Error fetching comments:", error);
            } finally {
              // Remove from fetching set
              fetchingRef.current.delete(cacheKey);
            }
          })();
        },
        [submetric.definitionId, bucketType],
      );

      // Tooltip wrapper that uses the separate ChartTooltip component
      // This prevents parent re-renders from affecting the chart labels
      const CustomTooltip = useCallback(
        (props: any) => (
          <ChartTooltip
            {...props}
            submetric={submetric}
            bucketType={bucketType}
            commentsDataRef={commentsDataRef}
            fetchingRef={fetchingRef}
            onFetchComments={fetchCommentsForPoint}
          />
        ),
        [submetric, bucketType, fetchCommentsForPoint],
      );

      // Memoize dot renderer
      const renderDot = useCallback(
        (props: any) => {
          const { cx, cy, payload, index } = props;
          const highestPriorityViolation = payload?.highestPriorityViolation;
          // Use theme-based colors
          const dotStroke = isDark ? "#2a2a2a" : "#ffffff";

          // Determine color and size based on highest priority violation
          let fillColor = submetric.color || "#3b82f6";
          let strokeColor = dotStroke;
          let radius = 4;
          let strokeWidth = 2;
          let hasViolation = false;

          // Map violation to colors and sizes (matching priority system)
          if (highestPriorityViolation === "rule1") {
            fillColor = "#ef4444"; // red
            strokeColor = "#dc2626";
            radius = 6;
            strokeWidth = 3;
            hasViolation = true;
          } else if (highestPriorityViolation === "rule4") {
            fillColor = "#f97316"; // orange
            strokeColor = "#ea580c";
            radius = 5.5;
            strokeWidth = 2.5;
            hasViolation = true;
          } else if (highestPriorityViolation === "rule3") {
            fillColor = "#f59e0b"; // amber
            strokeColor = "#d97706";
            radius = 5;
            strokeWidth = 2.5;
            hasViolation = true;
          } else if (highestPriorityViolation === "rule2") {
            fillColor = "#3b82f6"; // blue
            strokeColor = "#2563eb";
            radius = 5;
            strokeWidth = 2.5;
            hasViolation = true;
          } else if (highestPriorityViolation === "rule5") {
            fillColor = "#10b981"; // green
            strokeColor = "#059669";
            radius = 4.5;
            strokeWidth = 2;
            hasViolation = true;
          }

          return (
            <circle
              key={`dot-${index}`}
              cx={cx}
              cy={cy}
              r={radius}
              fill={fillColor}
              stroke={strokeColor}
              strokeWidth={strokeWidth}
              style={{
                filter: hasViolation
                  ? "drop-shadow(0 2px 4px rgba(0,0,0,0.3))"
                  : "none",
              }}
            />
          );
        },
        [isDark, submetric.color], // Depends on theme and submetric color
      );

      // Handle point click
      const handlePointClick = useCallback(
        (data: any) => {
          if (!submetric.definitionId || !onPointClick) return;

          const timestamp = data.fullTimestamp; // YYYY-MM-DD format
          const bucketValue = normalizeToBucket(timestamp, bucketType);

          onPointClick({
            timestamp,
            bucketValue,
          });
        },
        [submetric.definitionId, bucketType, onPointClick],
      );

      // Memoize active dot renderer
      const renderActiveDot = useCallback(
        (props: any) => {
          const { cx, cy, payload } = props;
          const highestPriorityViolation = payload?.highestPriorityViolation;

          // Use theme-based colors
          const dotStroke = isDark ? "#2a2a2a" : "#ffffff";

          // Determine colors based on highest priority violation
          let fillColor = dotStroke;
          let strokeColor = submetric.color || "#3b82f6";

          // Map violation to colors (matching priority system)
          if (highestPriorityViolation === "rule1") {
            fillColor = "#ef4444"; // red
            strokeColor = "#dc2626"; // darker red
          } else if (highestPriorityViolation === "rule4") {
            fillColor = "#f97316"; // orange
            strokeColor = "#ea580c"; // darker orange
          } else if (highestPriorityViolation === "rule3") {
            fillColor = "#f59e0b"; // amber
            strokeColor = "#d97706"; // darker amber
          } else if (highestPriorityViolation === "rule2") {
            fillColor = "#3b82f6"; // blue
            strokeColor = "#2563eb"; // darker blue
          } else if (highestPriorityViolation === "rule5") {
            fillColor = "#10b981"; // green
            strokeColor = "#059669"; // darker green
          }

          return (
            // biome-ignore lint/a11y/useSemanticElements: Chart library requires SVG circle element for rendering
            <circle
              cx={cx}
              cy={cy}
              r={8}
              fill={fillColor}
              stroke={strokeColor}
              strokeWidth={3}
              role="button"
              tabIndex={0}
              style={{
                filter: "drop-shadow(0 2px 6px rgba(0,0,0,0.3))",
                cursor: "pointer",
              }}
              onClick={() => handlePointClick(payload)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  handlePointClick(payload);
                }
              }}
            />
          );
        },
        [isDark, submetric.color, handlePointClick], // Depends on theme, color, and click handler
      );

      // Memoize tick formatter
      const tickFormatter = useCallback(
        (value: number) => Number(value).toFixed(1),
        [],
      );

      // Memoize custom X-axis tick renderer (simplified - no comment indicators)
      // Use chartData instead of mergedChartData to avoid unnecessary re-renders from trend changes
      const renderXAxisTick = useCallback(
        (props: any) => <XAxisTick {...props} chartData={chartData} />,
        [chartData],
      );

      // Memoize comment indicator dot renderer - renders for ALL data points
      const renderCommentIndicator = useCallback(
        (props: any) => {
          // Extract key to avoid React warning about spreading key prop
          const { key, ...rest } = props;
          return (
            <CommentIndicatorDot
              key={key}
              {...rest}
              bucketType={bucketType}
              bucketsWithComments={bucketsWithComments}
            />
          );
        },
        [bucketType, bucketsWithComments],
      );

      // Memoize static axis configurations
      const axisLineConfig = useMemo(
        () => ({ stroke: "currentColor", strokeWidth: 1 }),
        [],
      );
      const tickLineConfig = useMemo(
        () => ({ stroke: "currentColor", strokeWidth: 1 }),
        [],
      );
      const tickConfig = useMemo(() => ({ fontSize: 12 }), []);

      // Memoize reference line labels
      const avgLabel = useMemo(
        () => ({
          value: `Avg: ${formatNumber(xmrLimits.avgX)}`,
          position: "insideTopRight" as const,
          style: {
            fontSize: "12px",
            fontWeight: "bold",
            fill: "#10b981",
          },
        }),
        [xmrLimits.avgX],
      );

      const unplLabel = useMemo(
        () => ({
          value: `UNPL: ${formatNumber(xmrLimits.UNPL)}`,
          position: "insideTopRight" as const,
          style: {
            fontSize: "11px",
            fontWeight: "bold",
            fill: "#94a3b8",
          },
        }),
        [xmrLimits.UNPL],
      );

      const lnplLabel = useMemo(
        () => ({
          value: `LNPL: ${formatNumber(xmrLimits.LNPL)}`,
          position: "insideBottomRight" as const,
          style: {
            fontSize: "11px",
            fontWeight: "bold",
            fill: "#94a3b8",
          },
        }),
        [xmrLimits.LNPL],
      );

      // Only render chart when both visible AND comment counts are ready
      // This prevents double render: first with empty counts, then with loaded counts
      const shouldRenderChart = isVisible && commentCountsReady;

      return (
        <div
          ref={chartContainerRef}
          className="chart-container h-[500px] w-full overflow-visible [&_.recharts-cartesian-grid-horizontal>line]:stroke-muted-foreground/20 [&_.recharts-cartesian-grid-vertical>line]:stroke-muted-foreground/20 [&_.recharts-tooltip-wrapper]:z-50 [&_.recharts-label-list]:z-50 [&_.recharts-wrapper]:overflow-visible [&_.recharts-surface]:overflow-visible"
          style={{ contentVisibility: "auto" }}
        >
          {shouldRenderChart ? (
            <ResponsiveContainer width="100%" height="100%" debounce={350}>
              <LineChart
                data={mergedChartData}
                margin={{ top: 40, right: 60, left: 0, bottom: 40 }}
              >
                <CartesianGrid
                  strokeDasharray="2 2"
                  stroke="currentColor"
                  opacity={0.1}
                />
                <XAxis
                  dataKey="timestamp"
                  className="text-sm fill-foreground"
                  axisLine={axisLineConfig}
                  tickLine={tickLineConfig}
                  tick={renderXAxisTick}
                  height={60}
                >
                  <Label
                    value={`${submetric.definition?.xaxis || "date"}${
                      submetric.timezone ? ` (${submetric.timezone})` : ""
                    } - X Plot`}
                    offset={-10}
                    position="insideBottom"
                    style={{ fontSize: "11px", fontWeight: "600" }}
                  />
                </XAxis>
                <YAxis
                  className="text-sm fill-foreground"
                  axisLine={axisLineConfig}
                  tickLine={tickLineConfig}
                  tick={tickConfig}
                  tickFormatter={tickFormatter}
                  domain={yAxisDomain}
                  width={60}
                >
                  {submetric.definition?.yaxis && (
                    <Label
                      content={(props: any) => (
                        <YAxisLabel
                          {...props}
                          value={submetric.definition?.yaxis || ""}
                        />
                      )}
                      position="left"
                    />
                  )}
                </YAxis>

                <Tooltip content={CustomTooltip} />

                {/* Control Limit Lines - Use trend lines if active, otherwise use reference lines */}
                {trendActive && trendLines ? (
                  <>
                    {/* Trend Centre Line */}
                    <Line
                      type="linear"
                      dataKey="trendCentre"
                      stroke="#10b981"
                      strokeWidth={3}
                      strokeDasharray="8 4"
                      dot={false}
                      activeDot={false}
                      connectNulls={false}
                      name="Trend Centre"
                    />
                    {/* Standard Trend Limits */}
                    <Line
                      type="linear"
                      dataKey="trendUNPL"
                      stroke="#94a3b8"
                      strokeWidth={2.5}
                      strokeDasharray=""
                      dot={false}
                      activeDot={false}
                      connectNulls={false}
                      name="Upper Limit"
                    />
                    <Line
                      type="linear"
                      dataKey="trendLNPL"
                      stroke="#94a3b8"
                      strokeWidth={2.5}
                      strokeDasharray=""
                      dot={false}
                      activeDot={false}
                      connectNulls={false}
                      name="Lower Limit"
                    />
                    <Line
                      type="linear"
                      dataKey="trendUpperQuartile"
                      stroke="#9ca3af"
                      strokeWidth={1.5}
                      strokeDasharray="3 2"
                      dot={false}
                      activeDot={false}
                      connectNulls={false}
                      name="Upper Quartile"
                    />
                    <Line
                      type="linear"
                      dataKey="trendLowerQuartile"
                      stroke="#9ca3af"
                      strokeWidth={1.5}
                      strokeDasharray="3 2"
                      dot={false}
                      activeDot={false}
                      connectNulls={false}
                      name="Lower Quartile"
                    />
                  </>
                ) : (
                  <>
                    {/* Standard Reference Lines */}
                    <ReferenceLine
                      y={xmrLimits.avgX}
                      stroke="#10b981"
                      strokeWidth={3}
                      strokeDasharray="8 4"
                      label={avgLabel}
                    />
                    <ReferenceLine
                      y={xmrLimits.UNPL}
                      stroke="#94a3b8"
                      strokeWidth={isLimitsLocked ? 2.5 : 2}
                      strokeDasharray={isLimitsLocked ? "" : "6 3"}
                      label={unplLabel}
                    />
                    <ReferenceLine
                      y={xmrLimits.LNPL}
                      stroke="#94a3b8"
                      strokeWidth={isLimitsLocked ? 2.5 : 2}
                      strokeDasharray={isLimitsLocked ? "" : "6 3"}
                      label={lnplLabel}
                    />
                    {/* Quartile Lines (without labels) */}
                    <ReferenceLine
                      y={xmrLimits.upperQuartile}
                      stroke="#9ca3af"
                      strokeWidth={1.5}
                      strokeDasharray="3 2"
                    />
                    <ReferenceLine
                      y={xmrLimits.lowerQuartile}
                      stroke="#9ca3af"
                      strokeWidth={1.5}
                      strokeDasharray="3 2"
                    />
                  </>
                )}

                <Line
                  type="linear"
                  dataKey="value"
                  stroke={submetric.color || "#3b82f6"}
                  strokeWidth={3}
                  dot={renderDot}
                  activeDot={renderActiveDot}
                  connectNulls={false}
                />

                {/* Render labels after the line to ensure they appear on top */}
                <Line
                  type="linear"
                  dataKey="value"
                  stroke="transparent"
                  strokeWidth={0}
                  dot={false}
                  activeDot={false}
                  connectNulls={false}
                >
                  <LabelList content={renderCustomLabel} />
                </Line>

                {/* Render comment indicators for ALL data points (independent of tick visibility) */}
                <Line
                  type="linear"
                  dataKey="value"
                  stroke="transparent"
                  strokeWidth={0}
                  dot={renderCommentIndicator}
                  activeDot={false}
                  connectNulls={false}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            // Empty placeholder - no skeleton, browser will optimize with content-visibility
            <div className="h-full w-full" />
          )}
        </div>
      );
    },
  ),
);

SubmetricXChartInternal.displayName = "SubmetricXChartInternal";

// Wrapper component that manages dialog state separately from chart
export const SubmetricXChart = memo((props: SubmetricXChartProps) => {
  const chartRef = useRef<SubmetricXChartHandle>(null);
  const [commentsDialogOpen, setCommentsDialogOpen] = useState(false);
  const [selectedPoint, setSelectedPoint] = useState<{
    timestamp: string;
    bucketValue: string;
  } | null>(null);

  // Detect bucket type from data
  const bucketType = useMemo(() => {
    if (props.chartData.length === 0) return "day" as TimeBucket;
    const timestamps = props.chartData.map((d) => d.fullTimestamp);
    return detectBucketType(timestamps);
  }, [props.chartData]);

  // Create array of all data points for navigation
  const allDataPoints = useMemo<DataPoint[]>(() => {
    return props.chartData.map((point) => ({
      timestamp: point.fullTimestamp,
      bucketValue: normalizeToBucket(point.fullTimestamp, bucketType),
    }));
  }, [props.chartData, bucketType]);

  // Handle point click from chart
  const handlePointClick = useCallback(
    (data: { timestamp: string; bucketValue: string }) => {
      setSelectedPoint(data);
      setCommentsDialogOpen(true);
    },
    [],
  );

  // Handle dialog close
  const handleDialogOpenChange = useCallback((open: boolean) => {
    setCommentsDialogOpen(open);
    if (!open) {
      // Delay clearing selected point to allow exit animation to complete
      setTimeout(() => setSelectedPoint(null), 350); // Sheet animation is 300ms
    }
  }, []);

  // Handle comment added - invalidate cache and call parent callback
  const handleCommentAdded = useCallback(
    (bucketValue: string) => {
      // Invalidate the chart's comment cache for tooltips
      chartRef.current?.invalidateCommentCache(bucketValue);
      // Call parent callback if provided
      props.onCommentAdded?.(bucketValue);
      // Note: Comment counts will be automatically refetched by React Query
      // when the mutations in SlideSheet invalidate the query
    },
    [props.onCommentAdded],
  );

  return (
    <>
      <SubmetricXChartInternal
        ref={chartRef}
        {...props}
        onPointClick={handlePointClick}
      />
      <DialogManager
        isOpen={commentsDialogOpen}
        selectedPoint={selectedPoint}
        definitionId={props.submetric.definitionId}
        bucketType={bucketType}
        allDataPoints={allDataPoints}
        slideId={props.slideId}
        workspaceId={props.workspaceId}
        onOpenChange={handleDialogOpenChange}
        onCommentAdded={handleCommentAdded}
      />
    </>
  );
});

SubmetricXChart.displayName = "SubmetricXChart";
