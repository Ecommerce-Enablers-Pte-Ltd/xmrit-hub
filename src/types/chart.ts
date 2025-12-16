/**
 * Shared chart-related types for Recharts components
 */

import type { TimeBucket } from "@/lib/time-buckets";

/**
 * Violation rule types
 */
export type ViolationRule =
  | "rule1"
  | "rule2"
  | "rule3"
  | "rule4"
  | "rule5"
  | null;

/**
 * Data point shape for XMR charts
 * This is the shape of each data point in the chartData array
 */
export interface ChartDataPoint {
  timestamp: string;
  fullTimestamp: string;
  value: number;
  range?: number;
  confidence?: number | null;
  source?: string | null;
  // Violation flags
  isRangeViolation?: boolean;
  highestPriorityViolation?: string | null;
  rule1Violation?: boolean;
  rule2Start?: boolean;
  rule2Violation?: boolean;
  rule3Violation?: boolean;
  rule4Violation?: boolean;
  rule5Violation?: boolean;
  // Trend line values (optional)
  trendCentre?: number;
  trendUNPL?: number;
  trendLNPL?: number;
  trendUpperQuartile?: number;
  trendLowerQuartile?: number;
  // Additional metadata
  [key: string]: unknown;
}

/**
 * Payload item in Recharts tooltip
 */
export interface RechartsPayloadItem {
  dataKey?: string;
  value?: number;
  payload: ChartDataPoint;
  name?: string;
  color?: string;
  [key: string]: unknown;
}

/**
 * Props for Recharts tooltip renderer callback
 */
export interface RechartsTooltipProps {
  active?: boolean;
  payload?: RechartsPayloadItem[];
  label?: string | number;
}

/**
 * Props for Recharts dot renderer callback
 */
export interface RechartsDotProps {
  cx?: number;
  cy?: number;
  index?: number;
  payload?: ChartDataPoint;
  dataKey?: string | number | ((obj: ChartDataPoint) => unknown);
  key?: string;
  [key: string]: unknown;
}

/**
 * Props for Recharts label renderer callback
 */
export interface RechartsLabelProps {
  x?: number | string;
  y?: number | string;
  value?: number | string;
  index?: number;
  viewBox?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

/**
 * Props for custom label with chartData context
 */
export interface CustomLabelProps extends RechartsLabelProps {
  chartData?: ChartDataPoint[];
}

/**
 * Props for custom X-axis tick
 */
export interface XAxisTickProps {
  x: number;
  y: number;
  payload: {
    value: string;
    index?: number;
    [key: string]: unknown;
  };
}

/**
 * Props for comment indicator dot
 */
export interface CommentIndicatorDotProps {
  cx: number;
  payload?: ChartDataPoint;
  bucketType: TimeBucket;
  bucketsWithComments: Record<string, number>;
}

/**
 * Comment data cache entry
 */
export interface CommentCacheEntry {
  comments: Array<{
    id: string;
    body: string;
    createdAt: string | Date;
    user: {
      id: string;
      name: string | null;
      email: string | null;
      image: string | null;
    };
  }>;
  [key: string]: unknown;
}
