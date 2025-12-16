"use client";

import { memo, useCallback, useMemo } from "react";
import {
  CartesianGrid,
  Label,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useChartTheme } from "@/hooks/use-chart-theme";
import { useIsMobile } from "@/hooks/use-mobile";
import { useIsMobileDevice } from "@/hooks/use-mobile-device";
import {
  AXIS_LINE_CONFIG,
  formatTickValue,
  getDotStroke,
  TICK_CONFIG,
  TICK_LINE_CONFIG,
  VIOLATION_COLORS,
} from "@/lib/chart-utils";
import type { XMRLimits } from "@/lib/xmr-calculations";
import type {
  ChartDataPoint,
  RechartsDotProps,
  RechartsTooltipProps,
} from "@/types/chart";
import type { Submetric } from "@/types/db/submetric";

interface SubmetricMRChartProps {
  chartData: ChartDataPoint[];
  xmrLimits: XMRLimits;
  submetric: Submetric;
  isLimitsLocked: boolean;
}

export const SubmetricMRChart = memo(
  ({
    chartData,
    xmrLimits,
    submetric,
    isLimitsLocked,
  }: SubmetricMRChartProps) => {
    // Track theme for consistent colors
    const isDark = useChartTheme();
    // Detect mobile screen width for responsive layout
    const isMobile = useIsMobile();
    // Detect mobile device to disable tooltip interactions
    const { isMobileDevice } = useIsMobileDevice();

    // Calculate Y-axis domain for MR chart
    const mrYAxisDomain = useMemo(() => {
      if (chartData.length === 0) return [0, 100];

      const ranges = chartData.map((d) => d.range ?? 0);
      const dataMax = Math.max(...ranges);
      const maxBound = Math.max(dataMax, xmrLimits.URL);
      const padding = maxBound * 0.15;

      return [0, maxBound + padding];
    }, [chartData, xmrLimits.URL]);

    // Memoize custom tooltip
    const CustomTooltip = useCallback(
      ({ active, payload }: RechartsTooltipProps) => {
        if (active && payload && payload.length) {
          const data = payload[0].payload;

          return (
            <div className="bg-popover/95 backdrop-blur-sm border border-border rounded-lg p-4 shadow-lg shadow-black/10 dark:shadow-black/50 max-w-xs text-popover-foreground">
              <div className="space-y-2">
                <p className="font-semibold text-base border-b pb-2 text-popover-foreground">
                  {data.fullTimestamp}
                </p>

                <div className="space-y-1">
                  <div>
                    <span className="text-muted-foreground text-sm">
                      Moving Range:
                    </span>
                    <p className="text-primary font-medium text-lg">
                      {Number(data.range).toFixed(2)}
                      {(submetric.definition?.unit ||
                        submetric.definition?.yaxis) && (
                        <span className="text-sm text-muted-foreground ml-1">
                          {submetric.definition.unit ||
                            submetric.definition.yaxis}
                        </span>
                      )}
                    </p>
                  </div>

                  {data.confidence && (
                    <div className="text-sm">
                      <span className="text-muted-foreground">Confidence:</span>
                      <span className="font-medium ml-1">
                        {(data.confidence * 100).toFixed(1)}%
                      </span>
                    </div>
                  )}
                </div>

                {data.isRangeViolation && (
                  <div className="pt-2 border-t">
                    <div className="flex items-start gap-2 text-red-600 font-medium text-sm">
                      <span className="text-base mt-0.5">🔴</span>
                      <div>
                        <div>Excessive Variation</div>
                        <div className="text-xs text-red-500 font-normal">
                          Range exceeds URL
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        }
        return null;
      },
      [submetric.definition?.unit, submetric.definition?.yaxis],
    );

    // Memoize dot renderer
    const renderDot = useCallback(
      (props: RechartsDotProps) => {
        const { cx, cy, payload, index } = props;
        const isRangeViolation = payload?.isRangeViolation;
        const dotStroke = getDotStroke(isDark);
        const violationConfig = VIOLATION_COLORS.rule1;

        const fillColor = isRangeViolation
          ? violationConfig.fill
          : submetric.color || "#3b82f6";
        const strokeColor = isRangeViolation
          ? violationConfig.stroke
          : dotStroke;
        const radius = isRangeViolation ? violationConfig.radius : 4;
        const strokeWidth = isRangeViolation ? violationConfig.strokeWidth : 2;

        return (
          <circle
            key={`mr-dot-${index}`}
            cx={cx}
            cy={cy}
            r={radius}
            fill={fillColor}
            stroke={strokeColor}
            strokeWidth={strokeWidth}
            style={{
              filter: isRangeViolation
                ? "drop-shadow(0 2px 4px rgba(0,0,0,0.3))"
                : "none",
            }}
          />
        );
      },
      [isDark, submetric.color],
    );

    // Memoize active dot renderer (no interactions on mobile)
    const renderActiveDot = useCallback(
      (props: RechartsDotProps) => {
        const { cx, cy, payload } = props;
        const isRangeViolation = payload?.isRangeViolation;
        const dotStroke = getDotStroke(isDark);
        const violationConfig = VIOLATION_COLORS.rule1;

        const fillColor = isRangeViolation ? violationConfig.fill : dotStroke;
        const strokeColor = isRangeViolation
          ? violationConfig.stroke
          : submetric.color || "#3b82f6";

        return (
          <circle
            cx={cx}
            cy={cy}
            r={8}
            fill={fillColor}
            stroke={strokeColor}
            strokeWidth={3}
            style={{
              filter: "drop-shadow(0 2px 6px rgba(0,0,0,0.3))",
              cursor: isMobileDevice ? "default" : "pointer",
            }}
          />
        );
      },
      [isDark, submetric.color, isMobileDevice],
    );

    // Memoize reference line labels
    const avgMovementLabel = useMemo(
      () => ({
        value: `Avg: ${xmrLimits.avgMovement.toFixed(2)}`,
        position: "insideTopRight" as const,
        style: {
          fontSize: "12px",
          fontWeight: "bold",
          fill: "#10b981",
        },
      }),
      [xmrLimits.avgMovement],
    );

    const urlLabel = useMemo(
      () => ({
        value: `URL: ${xmrLimits.URL.toFixed(2)}`,
        position: "insideTopRight" as const,
        style: {
          fontSize: "11px",
          fontWeight: "bold",
          fill: "#94a3b8",
        },
      }),
      [xmrLimits.URL],
    );

    return (
      <div className="chart-container h-[500px] w-full [&_.recharts-cartesian-grid-horizontal>line]:stroke-muted-foreground/20 [&_.recharts-cartesian-grid-vertical>line]:stroke-muted-foreground/20 [&_.recharts-tooltip-wrapper]:z-50">
        <ResponsiveContainer width="100%" height="100%" debounce={350}>
          <LineChart
            data={chartData}
            margin={
              isMobile
                ? { top: 40, right: 20, left: -10, bottom: 40 }
                : { top: 40, right: 60, left: 20, bottom: 40 }
            }
          >
            <CartesianGrid
              strokeDasharray="2 2"
              stroke="currentColor"
              opacity={0.1}
            />
            <XAxis
              dataKey="timestamp"
              className="text-sm fill-foreground"
              axisLine={AXIS_LINE_CONFIG}
              tickLine={TICK_LINE_CONFIG}
              tick={TICK_CONFIG}
              interval="preserveStartEnd"
            >
              <Label
                value={`${submetric.definition?.xaxis || "date"}${
                  submetric.timezone ? ` (${submetric.timezone})` : ""
                } - MR Plot`}
                offset={-10}
                position="insideBottom"
                style={{ fontSize: "11px", fontWeight: "600" }}
              />
            </XAxis>
            <YAxis
              className="text-sm fill-foreground"
              axisLine={AXIS_LINE_CONFIG}
              tickLine={TICK_LINE_CONFIG}
              tick={TICK_CONFIG}
              tickFormatter={formatTickValue}
              domain={mrYAxisDomain}
              width={50}
            />
            {!isMobileDevice && (
              <Tooltip
                // biome-ignore lint/suspicious/noExplicitAny: Recharts types are complex
                content={CustomTooltip as any}
              />
            )}

            {/* Average Movement Line */}
            <ReferenceLine
              y={xmrLimits.avgMovement}
              stroke="#10b981"
              strokeWidth={3}
              strokeDasharray="8 4"
              label={avgMovementLabel}
            />

            {/* Upper Range Limit */}
            <ReferenceLine
              y={xmrLimits.URL}
              stroke="#94a3b8"
              strokeWidth={isLimitsLocked ? 2.5 : 2}
              strokeDasharray={isLimitsLocked ? "" : "6 3"}
              label={urlLabel}
            />

            {/* Moving Range Line */}
            <Line
              type="linear"
              dataKey="range"
              stroke={submetric.color || "#3b82f6"}
              strokeWidth={3}
              // biome-ignore lint/suspicious/noExplicitAny: Recharts dot/activeDot types are complex
              dot={renderDot as any}
              // biome-ignore lint/suspicious/noExplicitAny: Recharts dot/activeDot types are complex
              activeDot={renderActiveDot as any}
              connectNulls={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    );
  },
);

SubmetricMRChart.displayName = "SubmetricMRChart";
