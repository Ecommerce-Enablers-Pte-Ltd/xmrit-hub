"use client";

import {
  Link2,
  ListTodo,
  Loader2,
  Lock,
  LockOpen,
  MessageSquare,
  SlidersHorizontal,
  TrendingUp,
  X,
} from "lucide-react";
import { memo, useCallback, useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useSidebar } from "@/components/ui/sidebar";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useSubmetricDataPoints } from "@/lib/api/slides";
import { detectBucketType, parseTimestamp } from "@/lib/time-buckets";
import { handleCloseAutoFocus } from "@/lib/ui/focus";
import { generateChartSlug } from "@/lib/utils";
import {
  applySeasonalFactors,
  calculateLimitsWithOutlierRemoval,
  calculateRegressionStats,
  calculateSeasonalFactors,
  createTrendLines,
  type DataPoint,
  detectViolations,
  determinePeriodicity,
  generateXMRData,
  MINIMUM_XMR_DATA_POINTS,
  type SeasonalityGrouping,
  type SeasonalityPeriod,
  shouldAutoLockLimits,
  type TrendLimits,
  type XMRLimits,
} from "@/lib/xmr-calculations";
import { useDefinitionFollowUpCount } from "@/providers/follow-up-counts-provider";
import type { DataPointJson, Submetric } from "@/types/db/submetric";
import { type CommentDataPoint, SlideSheet } from "./slide-sheet";
import { SubmetricLockLimitsDialog } from "./submetric-lock-limits-dialog";
import { SubmetricMRChart } from "./submetric-mr-chart";
import { SubmetricSeasonalityDialog } from "./submetric-seasonality-dialog";
import { SubmetricTrendDialog } from "./submetric-trend-dialog";
import { SubmetricXChart } from "./submetric-x-chart";
import { TrafficLightIndicator } from "./traffic-light-indicator";

// Loading skeleton for chart - shown while dataPoints are being fetched
function ChartLoadingSkeleton({
  category,
  metricName,
}: {
  category: string | null;
  metricName: string;
}) {
  return (
    <div className="w-full border overflow-hidden rounded-2xl">
      {/* Header Section */}
      <div className="px-3 sm:px-4 md:px-6 pt-4 pb-0">
        {/* Chart Toolbar */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Skeleton className="h-8 w-8 rounded" />
          </div>
          <div className="flex items-center gap-1 sm:gap-2">
            {/* Desktop toolbar skeletons (hidden on mobile) */}
            <div className="hidden lg:flex items-center gap-2">
              <Skeleton className="h-9 w-9 xl:w-28" />
              <Skeleton className="h-9 w-9 xl:w-28" />
              <Skeleton className="h-9 w-9 xl:w-32" />
              <div className="h-6 w-px bg-border mx-1" />
            </div>
            {/* Mobile dropdown placeholder */}
            <Skeleton className="h-9 w-9 lg:hidden" />
            {/* Comments & Follow-ups - always visible */}
            <Skeleton className="h-9 w-9" />
            <Skeleton className="h-9 w-9" />
          </div>
        </div>

        {/* Title and Status Row - show actual metadata */}
        <div className="flex items-start justify-between gap-3 mt-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 md:gap-3 text-left w-full">
              {category && (
                <span className="px-2 sm:px-4 py-1.5 sm:py-2 bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 rounded-md text-xs sm:text-sm font-bold uppercase tracking-wide whitespace-nowrap overflow-hidden text-ellipsis shrink-0 max-w-[30vw] sm:max-w-[25vw] md:max-w-[20vw] lg:max-w-[15vw]">
                  {category}
                </span>
              )}
              <h2 className="text-lg sm:text-xl md:text-2xl font-semibold tracking-tight overflow-hidden text-ellipsis whitespace-nowrap min-w-0 flex-1">
                {metricName}
              </h2>
            </div>
          </div>
          {/* Traffic Light placeholder */}
          <div className="flex flex-col items-end gap-2 shrink-0">
            <Skeleton className="h-10 w-10 rounded-sm" />
          </div>
        </div>
      </div>

      {/* Content Section - Two charts side by side */}
      <div className="px-2 md:px-6 pb-4 pt-6">
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

interface SubmetricLineChartProps {
  submetric: Submetric;
  slideId: string;
  workspaceId: string;
}

// Memoize the entire component to prevent unnecessary re-renders
// Only re-render when submetric data or slideId actually changes
export const SubmetricLineChart = memo(
  function SubmetricLineChart({
    submetric,
    slideId,
    workspaceId,
  }: SubmetricLineChartProps) {
    // Get sidebar state for dynamic width calculations (desktop only)
    const { state: sidebarState } = useSidebar();

    // Get category, metricName, unit, preferredTrend from definition (new schema)
    const category = submetric.definition?.category || null;
    const metricName = submetric.definition?.metricName || "Untitled Submetric";
    const preferredTrend = submetric.definition?.preferredTrend || null;

    // Check if dataPoints are already available (from SSR/cache) or need lazy loading
    const hasInlineDataPoints =
      !!submetric.dataPoints && submetric.dataPoints.length > 0;

    // Lazy-fetch dataPoints if not inline (mobile optimization)
    // Only fetches when chart becomes visible and dataPoints weren't in initial payload
    const { dataPoints: fetchedDataPoints, isLoading: isLoadingDataPoints } =
      useSubmetricDataPoints(slideId, submetric.id, !hasInlineDataPoints);

    // Use inline dataPoints if available, otherwise use fetched ones
    const effectiveDataPoints: DataPointJson[] | null = hasInlineDataPoints
      ? submetric.dataPoints
      : fetchedDataPoints;

    // Track if still loading dataPoints (for conditional rendering at end)
    const isDataPointsLoading = !hasInlineDataPoints && isLoadingDataPoints;

    // Check if label indicates trend or seasonality
    const labelHasTrend = useMemo(
      () => /\(Trend\)/i.test(submetric.definition?.metricName || ""),
      [submetric.definition?.metricName]
    );
    const labelHasSeasonality = useMemo(
      () => /\(Seasonality\)/i.test(submetric.definition?.metricName || ""),
      [submetric.definition?.metricName]
    );

    // Lock limits state
    const [isLockLimitsDialogOpen, setIsLockLimitsDialogOpen] = useState(false);
    const [lockedLimits, setLockedLimits] = useState<XMRLimits | null>(null);
    const [isLimitsLocked, setIsLimitsLocked] = useState(false);
    const [autoLocked, setAutoLocked] = useState(false);
    const [autoLockAttempted, setAutoLockAttempted] = useState(false); // Track if auto-lock has been attempted
    const [hasEverBeenManuallyModified, setHasEverBeenManuallyModified] =
      useState(false); // Track if chart has ever been manually modified
    const [outlierIndices, setOutlierIndices] = useState<number[]>([]); // Auto-detected outliers
    const [originalAutoOutliers, setOriginalAutoOutliers] = useState<number[]>(
      []
    ); // Store original auto-detected outliers
    const [manuallyExcludedIndices, setManuallyExcludedIndices] = useState<
      number[]
    >([]); // Manually excluded points
    const [autoSuggestedLimits, setAutoSuggestedLimits] =
      useState<XMRLimits | null>(null);

    // Trend state
    const [isTrendDialogOpen, setIsTrendDialogOpen] = useState(false);
    const [trendActive, setTrendActive] = useState(false);
    const [trendGradient, setTrendGradient] = useState<number>(0);
    const [trendIntercept, setTrendIntercept] = useState<number>(0);
    const [storedTrendLines, setStoredTrendLines] =
      useState<TrendLimits | null>(null);

    // Seasonality state
    const [isSeasonalityDialogOpen, setIsSeasonalityDialogOpen] =
      useState(false);
    const [seasonalityActive, setSeasonalityActive] = useState(false);
    const [seasonalityPeriod, setSeasonalityPeriod] =
      useState<SeasonalityPeriod>("year");
    const [seasonalityGrouping, setSeasonalityGrouping] =
      useState<SeasonalityGrouping>("none");
    const [seasonalFactors, setSeasonalFactors] = useState<number[]>([]);

    // Track if auto-apply has been done
    const [autoAppliedTrend, setAutoAppliedTrend] = useState(false);
    const [autoAppliedSeasonality, setAutoAppliedSeasonality] = useState(false);

    // Comments sheet state
    const [isAllCommentsSheetOpen, setIsAllCommentsSheetOpen] = useState(false);

    // Follow-ups sheet state
    const [isFollowUpsSheetOpen, setIsFollowUpsSheetOpen] = useState(false);
    // Use batched follow-up counts from provider (1 request vs 100+ individual requests)
    const { count: followUpsCount, isLoading: isFollowUpsLoading } =
      useDefinitionFollowUpCount(submetric.definitionId ?? undefined);

    // Memoize raw data points transformation with deduplication
    // Uses effectiveDataPoints (inline from SSR or lazy-fetched)
    const rawDataPoints = useMemo<DataPoint[]>(() => {
      const points =
        effectiveDataPoints?.map((point) => ({
          timestamp: point.timestamp,
          value: Number(point.value),
          confidence: point.confidence ?? undefined,
        })) || [];

      // Filter out invalid data points and sort by timestamp
      const validPoints = points.filter((point) => {
        const date = parseTimestamp(point.timestamp);
        const isValidDate = !Number.isNaN(date.getTime());
        const isValidValue =
          !Number.isNaN(point.value) && Number.isFinite(point.value);
        return isValidDate && isValidValue;
      });

      validPoints.sort(
        (a, b) =>
          parseTimestamp(a.timestamp).getTime() -
          parseTimestamp(b.timestamp).getTime()
      );

      // Deduplicate points with same timestamp
      // Strategy: Keep the point with highest confidence, or last occurrence if no confidence
      const deduplicated = new Map<string, DataPoint>();

      for (const point of validPoints) {
        const timestampKey = parseTimestamp(point.timestamp).toISOString();
        const existing = deduplicated.get(timestampKey);

        if (!existing) {
          // First occurrence, add it
          deduplicated.set(timestampKey, point);
        } else {
          // Duplicate found - keep the one with higher confidence
          const existingConfidence = existing.confidence ?? null;
          const pointConfidence = point.confidence ?? null;

          // If both have confidence, compare them
          if (existingConfidence !== null && pointConfidence !== null) {
            if (pointConfidence > existingConfidence) {
              deduplicated.set(timestampKey, point);
            }
          } else if (pointConfidence !== null) {
            // New point has confidence but existing doesn't, prefer new one
            deduplicated.set(timestampKey, point);
          }
          // Otherwise keep existing (it either has confidence or both don't have confidence)
        }
      }

      return Array.from(deduplicated.values());
    }, [effectiveDataPoints]);

    // Prepare data for comments sheet
    const commentDataPoints = useMemo<CommentDataPoint[]>(() => {
      return rawDataPoints.map((point) => {
        const date = parseTimestamp(point.timestamp);
        const timestampFormat = date.toLocaleDateString("en-GB", {
          day: "2-digit",
          month: "short",
          year: "2-digit",
        });
        return {
          timestamp: timestampFormat,
          bucketValue: point.timestamp,
        };
      });
    }, [rawDataPoints]);

    // Detect bucket type from data
    const bucketType = useMemo(() => {
      if (rawDataPoints.length === 0) return "day";
      return detectBucketType(rawDataPoints.map((p) => p.timestamp));
    }, [rawDataPoints]);

    // Auto-apply trend based on label
    useEffect(() => {
      if (
        labelHasTrend &&
        !autoAppliedTrend &&
        !trendActive &&
        rawDataPoints.length >= 2
      ) {
        const stats = calculateRegressionStats(rawDataPoints);
        if (stats) {
          // Calculate EVERYTHING upfront before setting state
          // This prevents race conditions and ensures consistent data

          // First, get base XMR data to get avgMovement
          const baseData = generateXMRData(rawDataPoints);

          // Calculate trend lines with the stats and avgMovement
          const calculatedTrendLines = createTrendLines(
            {
              m: stats.m,
              c: stats.c,
              avgMR: baseData.limits.avgMovement,
            },
            rawDataPoints
          );

          // Now set all state atomically
          setTrendGradient(stats.m);
          setTrendIntercept(stats.c);
          setStoredTrendLines(calculatedTrendLines);
          setTrendActive(true);
          setAutoAppliedTrend(true);
          setIsLimitsLocked(false);
          setLockedLimits(null);
        }
      }
    }, [labelHasTrend, autoAppliedTrend, trendActive, rawDataPoints]);

    // Auto-apply seasonality based on label
    useEffect(() => {
      if (
        labelHasSeasonality &&
        !autoAppliedSeasonality &&
        !seasonalityActive &&
        rawDataPoints.length >= MINIMUM_XMR_DATA_POINTS
      ) {
        const detectedPeriod = determinePeriodicity(rawDataPoints);

        // Skip if detected period is "day" (not a valid seasonality period)
        if (detectedPeriod === "day") {
          return;
        }

        const { factors } = calculateSeasonalFactors(
          rawDataPoints, // xData - for initial date reference
          rawDataPoints, // seasonalData - data to calculate factors from
          detectedPeriod,
          "none" // No grouping for auto-apply
        );

        if (factors.length > 0) {
          setSeasonalityPeriod(detectedPeriod);
          setSeasonalFactors(factors);
          setSeasonalityActive(true);
          setAutoAppliedSeasonality(true);
          // Clear lock limits if active (seasonality changes the data)
          setIsLimitsLocked(false);
          setLockedLimits(null);
        }
      }
    }, [
      labelHasSeasonality,
      autoAppliedSeasonality,
      seasonalityActive,
      rawDataPoints,
    ]);

    // Auto-lock effect - automatically locks limits when outliers are detected
    // Only runs ONCE on initial load when: no trend/seasonality active, sufficient data, and not manually locked
    // Will NOT re-trigger when removing trend/seasonality - only on initial load or explicit reset
    useEffect(() => {
      if (
        !autoLockAttempted &&
        !trendActive &&
        !seasonalityActive &&
        !labelHasTrend &&
        !labelHasSeasonality &&
        !isLimitsLocked && // Don't override manual locks
        rawDataPoints.length >= MINIMUM_XMR_DATA_POINTS
      ) {
        const shouldAutoLock = shouldAutoLockLimits(rawDataPoints);
        if (shouldAutoLock) {
          const result = calculateLimitsWithOutlierRemoval(rawDataPoints);
          // Automatically lock with detected outliers excluded
          setLockedLimits(result.limits);
          setIsLimitsLocked(true);
          setAutoSuggestedLimits(result.limits);
          setOutlierIndices(result.outlierIndices);
          setOriginalAutoOutliers(result.outlierIndices); // Store original auto-detected outliers
          setAutoLocked(true);
          setAutoLockAttempted(true);
        } else {
          // Mark as attempted even if no outliers found to prevent repeated checks
          setAutoLockAttempted(true);
        }
      }
    }, [
      rawDataPoints,
      autoLockAttempted,
      trendActive,
      seasonalityActive,
      labelHasTrend,
      labelHasSeasonality,
      isLimitsLocked,
    ]);

    // Process data based on active filters (trend/seasonality)
    const processedDataPoints = useMemo<DataPoint[]>(() => {
      let processed = rawDataPoints;

      // Apply seasonality if active
      if (seasonalityActive && seasonalFactors.length > 0) {
        processed = applySeasonalFactors(
          processed,
          seasonalFactors,
          seasonalityGrouping, // grouping comes before period
          seasonalityPeriod
        );
      }

      return processed;
    }, [
      rawDataPoints,
      seasonalityActive,
      seasonalFactors,
      seasonalityPeriod,
      seasonalityGrouping,
    ]);

    // Generate base XMR data first (needed for avgMovement in trend calculations)
    const baseXmrData = useMemo(() => {
      return generateXMRData(processedDataPoints);
    }, [processedDataPoints]);

    // Calculate trend lines when trend is active (needs avgMovement from baseXmrData)
    const trendLines = useMemo<TrendLimits | null>(() => {
      if (!trendActive || processedDataPoints.length < 2) {
        return null;
      }

      // If we have stored trend lines (from auto-apply), use those
      // This ensures consistency during initial render
      if (storedTrendLines) {
        return storedTrendLines;
      }

      // Otherwise, calculate trend lines (for manual apply)
      const stats = {
        m: trendGradient,
        c: trendIntercept,
        avgMR: baseXmrData.limits.avgMovement,
      };

      return createTrendLines(stats, processedDataPoints);
    }, [
      trendActive,
      trendGradient,
      trendIntercept,
      processedDataPoints,
      baseXmrData.limits.avgMovement,
      storedTrendLines,
    ]);

    // Memoize XMR data generation with trend/locked limits support
    const xmrData = useMemo(() => {
      // If trend is active, use trend limits and recalculate violations relative to trend
      if (trendActive && trendLines) {
        // Recalculate violations relative to trend lines
        const updatedViolations = detectViolations(
          baseXmrData.dataPoints,
          baseXmrData.limits,
          trendLines
        );

        return {
          ...baseXmrData,
          violations: updatedViolations,
        };
      }

      // If limits are locked, use locked limits and recalculate violations
      if (isLimitsLocked && lockedLimits) {
        // Recalculate violations based on locked limits
        const updatedViolations = detectViolations(
          baseXmrData.dataPoints,
          lockedLimits
        );

        return {
          ...baseXmrData,
          limits: lockedLimits,
          violations: updatedViolations,
        };
      }

      return baseXmrData;
    }, [baseXmrData, isLimitsLocked, lockedLimits, trendActive, trendLines]);

    // Memoize chart data transformation
    const chartData = useMemo(() => {
      // Check if data spans multiple years
      const dates = xmrData.dataPoints.map((point) =>
        parseTimestamp(point.timestamp)
      );
      const years = new Set(dates.map((date) => date.getFullYear()));
      const spansMultipleYears = years.size > 1;

      return xmrData.dataPoints.map((point, index) => {
        const date = parseTimestamp(point.timestamp);

        // Enhanced violation detection
        const isViolation = xmrData.violations.outsideLimits.includes(index);
        const isRunningPoint = xmrData.violations.runningPoints.includes(index);
        const isFourNearLimit =
          xmrData.violations.fourNearLimit.includes(index);
        const isTwoOfThreeBeyondTwoSigma =
          xmrData.violations.twoOfThreeBeyondTwoSigma.includes(index);
        const isFifteenWithinOneSigma =
          xmrData.violations.fifteenWithinOneSigma.includes(index);

        // Check if range exceeds URL (for MR chart)
        const isRangeViolation = point.range > xmrData.limits.URL;

        // Determine highest priority violation (for tooltip and hover display)
        // Priority: Rule 1 > Rule 4 > Rule 3 > Rule 2 > Rule 5
        let highestPriorityViolation: string | null = null;
        if (isViolation) {
          highestPriorityViolation = "rule1"; // Outside Control Limits
        } else if (isTwoOfThreeBeyondTwoSigma) {
          highestPriorityViolation = "rule4"; // 2 of 3 Beyond 2σ
        } else if (isFourNearLimit) {
          highestPriorityViolation = "rule3"; // 4 Near Limit Pattern
        } else if (isRunningPoint) {
          highestPriorityViolation = "rule2"; // Running Point Pattern
        } else if (isFifteenWithinOneSigma) {
          highestPriorityViolation = "rule5"; // Low Variation
        }

        // Format timestamp with or without year depending on whether data spans multiple years
        const timestampFormat = spansMultipleYears
          ? date.toLocaleDateString("en-GB", {
              day: "2-digit",
              month: "short",
              year: "2-digit",
            })
          : date.toLocaleDateString("en-GB", {
              day: "2-digit",
              month: "short",
            });

        return {
          timestamp: timestampFormat,
          fullTimestamp: date.toLocaleDateString("en-CA"), // yyyy-mm-dd format
          value: Number(point.value.toFixed(2)),
          range: Number(point.range.toFixed(2)),
          confidence: rawDataPoints[index + 1]?.confidence, // +1 because moving range starts from second point
          fullDate: date,
          isViolation,
          isRunningPoint,
          isFourNearLimit,
          isTwoOfThreeBeyondTwoSigma,
          isFifteenWithinOneSigma,
          isRangeViolation,
          highestPriorityViolation, // Add the highest priority violation
        };
      });
    }, [
      xmrData.dataPoints,
      xmrData.violations,
      xmrData.limits.URL,
      rawDataPoints,
    ]);

    const hasData = chartData.length >= MINIMUM_XMR_DATA_POINTS;

    // Memoize Y-axis domain calculation
    const yAxisDomain = useMemo(() => {
      if (chartData.length === 0) return [0, 100];

      const values = chartData.map((d) => d.value);
      const dataMin = Math.min(...values);
      const dataMax = Math.max(...values);

      // Include control limits in the domain calculation
      const minBound = Math.min(dataMin, xmrData.limits.LNPL);
      const maxBound = Math.max(dataMax, xmrData.limits.UNPL);
      const fullRange = maxBound - minBound;

      // Use 15% padding of the full range (including control limits)
      const padding = fullRange * 0.15;

      return [minBound - padding, maxBound + padding];
    }, [chartData, xmrData.limits]);

    // Handlers
    const handleLockLimits = (
      limits: XMRLimits,
      isManuallyModified: boolean,
      excludedIndices: number[]
    ) => {
      setLockedLimits(limits);
      setIsLimitsLocked(true);

      // If user made any changes in the dialog (data edits, exclusions, or manual limit changes),
      // mark it as manual lock
      if (isManuallyModified) {
        setAutoLocked(false);
        setHasEverBeenManuallyModified(true);
        setManuallyExcludedIndices(excludedIndices); // Store manually excluded indices
        setOutlierIndices([]); // Clear auto-detected outlier indices
      } else if (hasEverBeenManuallyModified) {
        // Even if no changes this time, preserve manual state if ever modified
        setAutoLocked(false);
        setManuallyExcludedIndices(excludedIndices);
      } else if (autoLocked) {
        // Was already auto-locked, preserve auto-lock state (user just re-opened and confirmed)
        setAutoLocked(true);
        setManuallyExcludedIndices([]);
      } else {
        // User manually opened dialog and locked (not from auto-lock) → manual lock
        setAutoLocked(false);
        setHasEverBeenManuallyModified(true);
        setManuallyExcludedIndices(excludedIndices);
      }

      setAutoSuggestedLimits(null); // Clear auto-suggestions after locking
    };

    const handleUnlockLimits = () => {
      setIsLimitsLocked(false);
      setLockedLimits(null);
      setAutoSuggestedLimits(null);
      setOutlierIndices([]);
      setManuallyExcludedIndices([]);
      setAutoLocked(false); // Reset auto-locked state when unlocking
      // Don't reset autoLockAttempted - once unlocked, chart uses default calculated limits
      // To restore auto-lock, user must explicitly click "Reset to Auto Lock Limit"
    };

    const handleResetToAutoLock = () => {
      // Reset to original auto-lock state
      const result = calculateLimitsWithOutlierRemoval(rawDataPoints);
      setLockedLimits(result.limits);
      setIsLimitsLocked(true);
      setAutoSuggestedLimits(result.limits);
      setOutlierIndices(result.outlierIndices);
      setOriginalAutoOutliers(result.outlierIndices);
      setManuallyExcludedIndices([]);
      setAutoLocked(true);
      setHasEverBeenManuallyModified(false);
      setAutoLockAttempted(true);
    };

    const handleApplyTrend = (gradient: number, intercept: number) => {
      setTrendGradient(gradient);
      setTrendIntercept(intercept);
      setTrendActive(true);
      setStoredTrendLines(null); // Clear stored lines to force recalculation

      // Clear incompatible states when applying trend
      setIsLimitsLocked(false);
      setLockedLimits(null);
      setAutoLocked(false);
      setAutoSuggestedLimits(null);
    };

    const handleRemoveTrend = () => {
      setTrendActive(false);
      setTrendGradient(0);
      setTrendIntercept(0);
      setStoredTrendLines(null); // Clear stored trend lines

      // Don't reset autoLockAttempted - auto-lock should only trigger on initial load
      // or when explicitly requested via "Reset to Auto Lock Limit"
    };

    const handleApplySeasonality = (
      period: SeasonalityPeriod,
      factors: number[],
      grouping: SeasonalityGrouping
    ) => {
      setSeasonalityPeriod(period);
      setSeasonalityGrouping(grouping);
      setSeasonalFactors(factors);
      setSeasonalityActive(true);
      setStoredTrendLines(null); // Clear stored lines as data changes

      // Clear incompatible states when applying seasonality
      setIsLimitsLocked(false);
      setLockedLimits(null);
      setAutoLocked(false);
      setAutoSuggestedLimits(null);
    };

    const handleRemoveSeasonality = () => {
      setSeasonalityActive(false);
      setSeasonalFactors([]);
      setStoredTrendLines(null); // Clear stored lines as data changes

      // Don't reset autoLockAttempted - auto-lock should only trigger on initial load
      // or when explicitly requested via "Reset to Auto Lock Limit"
    };

    // Copy deep link to clipboard
    const [linkCopied, setLinkCopied] = useState(false);
    const chartSlug = generateChartSlug(category, metricName);
    const copyChartLink = useCallback(async () => {
      // Remove focus from the clicked element
      setTimeout(() => {
        if (document.activeElement instanceof HTMLElement) {
          document.activeElement.blur();
        }
      }, 0);

      const url = `${window.location.origin}${window.location.pathname}#${chartSlug}`;
      try {
        await navigator.clipboard.writeText(url);
        // Update URL hash to show current chart
        window.history.replaceState(null, "", `#${chartSlug}`);
        setLinkCopied(true);
        setTimeout(() => setLinkCopied(false), 1500);
      } catch {
        // Fallback for older browsers
        const textArea = document.createElement("textarea");
        textArea.value = url;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand("copy");
        document.body.removeChild(textArea);
        setLinkCopied(true);
        setTimeout(() => setLinkCopied(false), 1500);
      }
    }, [chartSlug]);

    // Show loading skeleton while fetching dataPoints (after all hooks are called)
    if (isDataPointsLoading) {
      return (
        <ChartLoadingSkeleton category={category} metricName={metricName} />
      );
    }

    return (
      <div className="w-full border overflow-hidden rounded-2xl ">
        {/* Header Section */}
        <div className="px-3 sm:px-4 md:px-6 pt-4 pb-0">
          {/* Chart Toolbar */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Tooltip open={linkCopied}>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={copyChartLink}
                    className="h-8 w-8 cursor-pointer"
                    title="Copy link to this chart"
                  >
                    <Link2 className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top">Copied!</TooltipContent>
              </Tooltip>
              {preferredTrend && (
                <span className="px-2.5 py-1 rounded-full text-xs font-semibold flex items-center gap-1.5 bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300">
                  <span className="hidden sm:inline">
                    {preferredTrend.toUpperCase()} PREFERRED
                  </span>
                  <span className="sm:hidden">
                    {preferredTrend.toUpperCase()}
                  </span>
                </span>
              )}
            </div>
            {hasData && (
              <div className="flex items-center gap-1 sm:gap-2">
                {/* Desktop: Full toolbar (hidden on mobile) */}
                <div className="hidden lg:flex items-center gap-2">
                  {/* Removal buttons beside the action buttons */}
                  {isLimitsLocked && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleUnlockLimits}
                      className="gap-2 text-amber-600 hover:bg-amber-50 hover:text-amber-700 dark:hover:bg-amber-950"
                    >
                      <LockOpen className="h-4 w-4" />
                      <span className="hidden xl:inline">Unlock Limits</span>
                    </Button>
                  )}
                  {trendActive && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleRemoveTrend}
                      className="gap-2 text-red-600 hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-950"
                    >
                      <X className="h-4 w-4" />
                      <span className="hidden xl:inline">Remove Trend</span>
                    </Button>
                  )}
                  {seasonalityActive && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleRemoveSeasonality}
                      className="gap-2 text-red-600 hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-950"
                    >
                      <X className="h-4 w-4" />
                      <span className="hidden xl:inline">
                        Remove Deseasonalisation
                      </span>
                    </Button>
                  )}

                  {/* Separator between removal and action buttons */}
                  {(isLimitsLocked || trendActive || seasonalityActive) && (
                    <div className="h-6 w-px bg-border mx-1" />
                  )}

                  {/* Action buttons */}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setIsLockLimitsDialogOpen(true)}
                        disabled={trendActive}
                        className={`gap-2 ${
                          isLimitsLocked
                            ? "bg-green-50 text-green-600 border-green-600 hover:bg-green-100 dark:bg-green-950 dark:hover:bg-green-900"
                            : ""
                        }`}
                      >
                        <Lock className="h-4 w-4" />
                        <span className="hidden xl:inline">
                          {isLimitsLocked
                            ? autoLocked
                              ? `Auto-Locked${
                                  outlierIndices.length > 0
                                    ? ` (${outlierIndices.length} outlier${
                                        outlierIndices.length !== 1 ? "s" : ""
                                      })`
                                    : ""
                                }`
                              : "Limits Locked"
                            : "Lock Limits"}
                        </span>
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="xl:hidden">
                      {isLimitsLocked
                        ? autoLocked
                          ? `Auto-Locked${
                              outlierIndices.length > 0
                                ? ` (${outlierIndices.length} outlier${
                                    outlierIndices.length !== 1 ? "s" : ""
                                  })`
                                : ""
                            }`
                          : "Limits Locked"
                        : "Lock Limits"}
                    </TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setIsTrendDialogOpen(true)}
                        disabled={isLimitsLocked || seasonalityActive}
                        className={`gap-2 ${
                          trendActive
                            ? "bg-green-50 text-green-600 border-green-600 hover:bg-green-100 dark:bg-green-950 dark:hover:bg-green-900"
                            : ""
                        }`}
                      >
                        <TrendingUp className="h-4 w-4" />
                        <span className="hidden xl:inline">
                          {trendActive ? "Trend Active" : "Trend Limits"}
                        </span>
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="xl:hidden">
                      {trendActive ? "Trend Active" : "Trend Limits"}
                    </TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setIsSeasonalityDialogOpen(true)}
                        disabled={trendActive}
                        className={`gap-2 ${
                          seasonalityActive
                            ? "bg-green-50 text-green-600 border-green-600 hover:bg-green-100 dark:bg-green-950 dark:hover:bg-green-900"
                            : ""
                        }`}
                      >
                        <svg
                          className="h-4 w-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <title>Deseasonalise icon</title>
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
                          />
                        </svg>
                        <span className="hidden xl:inline">
                          {seasonalityActive
                            ? "Deseasonalised"
                            : "Deseasonalise"}
                        </span>
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="xl:hidden">
                      {seasonalityActive ? "Deseasonalised" : "Deseasonalise"}
                    </TooltipContent>
                  </Tooltip>

                  {/* Separator before follow-ups/comments */}
                  <div className="h-6 w-px bg-border mx-1" />
                </div>

                {/* Mobile/Tablet: Dropdown menu for actions (shown on smaller screens) */}
                <div className="lg:hidden">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1 relative"
                      >
                        <SlidersHorizontal className="h-4 w-4" />
                        {(isLimitsLocked ||
                          trendActive ||
                          seasonalityActive) && (
                          <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-green-500" />
                        )}
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                      align="end"
                      className="w-56"
                      onCloseAutoFocus={handleCloseAutoFocus}
                    >
                      {/* Active state removal actions */}
                      {isLimitsLocked && (
                        <DropdownMenuItem
                          onClick={handleUnlockLimits}
                          className="text-amber-600 focus:text-amber-700"
                        >
                          <LockOpen className="h-4 w-4 mr-2 text-amber-600" />
                          Unlock Limits
                        </DropdownMenuItem>
                      )}
                      {trendActive && (
                        <DropdownMenuItem
                          onClick={handleRemoveTrend}
                          className="text-red-600 focus:text-red-700"
                        >
                          <X className="h-4 w-4 mr-2 text-red-600" />
                          Remove Trend
                        </DropdownMenuItem>
                      )}
                      {seasonalityActive && (
                        <DropdownMenuItem
                          onClick={handleRemoveSeasonality}
                          className="text-red-600 focus:text-red-700"
                        >
                          <X className="h-4 w-4 mr-2 text-red-600" />
                          Remove Deseasonalisation
                        </DropdownMenuItem>
                      )}
                      {(isLimitsLocked || trendActive || seasonalityActive) && (
                        <DropdownMenuSeparator />
                      )}

                      {/* Action items */}
                      <DropdownMenuItem
                        onClick={() => setIsLockLimitsDialogOpen(true)}
                        disabled={trendActive}
                        className={isLimitsLocked ? "text-green-600" : ""}
                      >
                        <Lock
                          className={`h-4 w-4 mr-2 ${
                            isLimitsLocked ? "text-green-600" : ""
                          }`}
                        />
                        {isLimitsLocked
                          ? autoLocked
                            ? `Auto-Locked${
                                outlierIndices.length > 0
                                  ? ` (${outlierIndices.length})`
                                  : ""
                              }`
                            : "Limits Locked"
                          : "Lock Limits"}
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => setIsTrendDialogOpen(true)}
                        disabled={isLimitsLocked || seasonalityActive}
                        className={trendActive ? "text-green-600" : ""}
                      >
                        <TrendingUp className="h-4 w-4 mr-2" />
                        {trendActive ? "Trend Active" : "Trend Limits"}
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => setIsSeasonalityDialogOpen(true)}
                        disabled={trendActive}
                        className={seasonalityActive ? "text-green-600" : ""}
                      >
                        <svg
                          className="h-4 w-4 mr-2"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <title>Deseasonalise icon</title>
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
                          />
                        </svg>
                        {seasonalityActive ? "Deseasonalised" : "Deseasonalise"}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                {/* Comments button - always visible */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setIsAllCommentsSheetOpen(true)}
                      className="gap-2"
                      title="View all comments on this chart"
                    >
                      <MessageSquare className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">Comments</TooltipContent>
                </Tooltip>

                {/* Follow-ups button - always visible */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setIsFollowUpsSheetOpen(true)}
                      className="gap-2 relative"
                      title="View follow-ups for this chart"
                    >
                      <ListTodo className="h-4 w-4" />
                      {isFollowUpsLoading ? (
                        <div className="absolute -top-2 -right-2 h-5 w-5 flex items-center justify-center">
                          <Loader2 className="h-3 w-3 animate-spin text-blue-600" />
                        </div>
                      ) : (
                        followUpsCount > 0 && (
                          <Badge
                            variant="default"
                            className="absolute -top-2 -right-2 h-5 min-w-5 flex items-center justify-center px-1 text-xs bg-blue-600 text-white"
                          >
                            {followUpsCount}
                          </Badge>
                        )
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">Follow-ups</TooltipContent>
                </Tooltip>
              </div>
            )}
          </div>

          {/* Title and Status Row */}
          <div className="flex items-start justify-between mt-4 gap-3">
            <div
              className="flex-1 min-w-0 overflow-hidden"
              // Dynamic max-width based on sidebar state (desktop only)
              // On mobile (no sidebar), uses 100% of container
              style={{
                maxWidth:
                  sidebarState === "expanded"
                    ? "calc(100% - 3rem)" // Account for traffic light indicator
                    : "calc(100% - 3rem)",
              }}
            >
              <button
                onClick={copyChartLink}
                className="flex items-center gap-2 md:gap-3 text-left group cursor-pointer w-full"
                type="button"
              >
                {category && (
                  <span className="px-2 sm:px-4 py-1.5 sm:py-2 bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 rounded-md text-xs sm:text-sm font-bold uppercase tracking-wide whitespace-nowrap overflow-hidden text-ellipsis shrink-0 group-hover:bg-blue-200 dark:group-hover:bg-blue-800 transition-colors max-w-[30vw] sm:max-w-[25vw] md:max-w-[20vw] lg:max-w-[15vw]">
                    {category}
                  </span>
                )}
                <h2 className="text-lg sm:text-xl md:text-2xl font-semibold tracking-tight overflow-hidden text-ellipsis whitespace-nowrap min-w-0 flex-1 transition-colors group-hover:text-primary">
                  {metricName}
                </h2>
              </button>
            </div>
            {hasData && (
              <div className="flex flex-col items-end gap-2 shrink-0">
                {/* Traffic Light Control Indicator - isolated component to prevent chart re-render */}
                <TrafficLightIndicator
                  submetricId={submetric.id}
                  slideId={slideId}
                  initialColor={submetric.trafficLightColor}
                />
              </div>
            )}
          </div>
        </div>

        {/* Content Section */}
        <div className="px-2 md:px-6 pb-4">
          {hasData ? (
            <div
              className="grid grid-cols-1 lg:grid-cols-2 transform-gpu overflow-visible"
              key={`chart-${trendActive}-${!!trendLines}-${isLimitsLocked}-${seasonalityActive}`}
            >
              {/* X Chart */}
              <SubmetricXChart
                chartData={chartData}
                xmrLimits={xmrData.limits}
                submetric={submetric}
                yAxisDomain={yAxisDomain}
                isLimitsLocked={isLimitsLocked}
                trendActive={trendActive}
                trendLines={trendLines}
                slideId={slideId}
                workspaceId={workspaceId}
              />

              {/* MR Chart */}
              <SubmetricMRChart
                chartData={chartData}
                xmrLimits={xmrData.limits}
                submetric={submetric}
                isLimitsLocked={isLimitsLocked}
              />
            </div>
          ) : (
            <div className="h-[500px] flex items-center justify-center text-muted-foreground">
              <div className="text-center max-w-md">
                <div className="text-8xl mb-6">📈</div>
                <h3 className="text-2xl font-semibold mb-3 text-foreground">
                  No XmR Chart Data Available
                </h3>
                <p className="text-lg leading-relaxed">
                  At least {MINIMUM_XMR_DATA_POINTS} data points are required
                  for XMR chart analysis.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Lock Limits Dialog */}
        <SubmetricLockLimitsDialog
          open={isLockLimitsDialogOpen}
          onOpenChange={setIsLockLimitsDialogOpen}
          dataPoints={rawDataPoints}
          currentLimits={autoSuggestedLimits || xmrData.limits}
          onLockLimits={handleLockLimits}
          submetricName={`${submetric.definition?.category} - ${submetric.definition?.metricName}`}
          outlierIndices={
            hasEverBeenManuallyModified
              ? manuallyExcludedIndices
              : outlierIndices
          }
          isCurrentLimitsManuallyLocked={hasEverBeenManuallyModified}
          autoDetectedOutliers={originalAutoOutliers}
          onResetToAutoLock={handleResetToAutoLock}
          isAutoLocked={autoLocked}
        />

        {/* Trend Dialog */}
        <SubmetricTrendDialog
          open={isTrendDialogOpen}
          onOpenChange={setIsTrendDialogOpen}
          dataPoints={rawDataPoints}
          onApplyTrend={handleApplyTrend}
        />

        {/* Seasonality Dialog */}
        <SubmetricSeasonalityDialog
          open={isSeasonalityDialogOpen}
          onOpenChange={setIsSeasonalityDialogOpen}
          dataPoints={rawDataPoints}
          onApplySeasonality={handleApplySeasonality}
          initialPeriod={seasonalityPeriod}
          initialFactors={seasonalFactors}
          initialGrouping={seasonalityGrouping}
        />

        {/* All Comments Sheet */}
        {submetric.definitionId && commentDataPoints.length > 0 && (
          <SlideSheet
            open={isAllCommentsSheetOpen}
            onOpenChange={setIsAllCommentsSheetOpen}
            definitionId={submetric.definitionId}
            bucketType={bucketType}
            bucketValue=""
            allDataPoints={commentDataPoints}
            slideId={slideId}
            initialFilterToAll={true}
            workspaceId={workspaceId}
          />
        )}

        {/* Follow-ups Sheet */}
        {submetric.definitionId && commentDataPoints.length > 0 && (
          <SlideSheet
            open={isFollowUpsSheetOpen}
            onOpenChange={setIsFollowUpsSheetOpen}
            definitionId={submetric.definitionId}
            bucketType={bucketType}
            bucketValue=""
            allDataPoints={commentDataPoints}
            slideId={slideId}
            initialFilterToAll={true}
            initialTab="follow-ups"
            workspaceId={workspaceId}
          />
        )}
      </div>
    );
  },
  (prevProps, nextProps) => {
    // Custom comparison function for memo
    // Only re-render if these specific properties change
    // Note: dataPoints are now lazily fetched, so we don't compare them here
    // The component will handle loading state internally
    return (
      prevProps.slideId === nextProps.slideId &&
      prevProps.workspaceId === nextProps.workspaceId &&
      prevProps.submetric.id === nextProps.submetric.id &&
      prevProps.submetric.definition?.category ===
        nextProps.submetric.definition?.category &&
      prevProps.submetric.definition?.metricName ===
        nextProps.submetric.definition?.metricName &&
      prevProps.submetric.definition?.preferredTrend ===
        nextProps.submetric.definition?.preferredTrend
      // Note: trafficLightColor is no longer checked here because it's handled
      // by the isolated TrafficLightIndicator component
      // Note: dataPoints comparison removed - lazy loading handles this internally
    );
  }
);
