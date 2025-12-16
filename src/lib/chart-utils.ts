/**
 * Shared chart utilities and configurations for Recharts components
 */

/**
 * Standard axis line configuration
 */
export const AXIS_LINE_CONFIG = { stroke: "currentColor", strokeWidth: 1 };

/**
 * Standard tick line configuration
 */
export const TICK_LINE_CONFIG = { stroke: "currentColor", strokeWidth: 1 };

/**
 * Standard tick font configuration
 */
export const TICK_CONFIG = { fontSize: 12 };

/**
 * Get theme-based dot stroke color
 * @param isDark - Whether dark theme is active
 */
export function getDotStroke(isDark: boolean): string {
  return isDark ? "#2a2a2a" : "#ffffff";
}

/**
 * Format tick value to one decimal place
 */
export function formatTickValue(value: number): string {
  return Number(value).toFixed(1);
}

/**
 * Violation color configuration
 * Maps violation rules to their display colors
 */
export const VIOLATION_COLORS = {
  rule1: {
    fill: "#ef4444", // red
    stroke: "#dc2626",
    text: "text-red-600",
    lightText: "text-red-500",
    radius: 6,
    strokeWidth: 3,
  },
  rule4: {
    fill: "#f97316", // orange
    stroke: "#ea580c",
    text: "text-orange-600",
    lightText: "text-orange-500",
    radius: 5.5,
    strokeWidth: 2.5,
  },
  rule3: {
    fill: "#f59e0b", // amber
    stroke: "#d97706",
    text: "text-amber-600",
    lightText: "text-amber-500",
    radius: 5,
    strokeWidth: 2.5,
  },
  rule2: {
    fill: "#3b82f6", // blue
    stroke: "#2563eb",
    text: "text-blue-600",
    lightText: "text-blue-500",
    radius: 5,
    strokeWidth: 2.5,
  },
  rule5: {
    fill: "#10b981", // green
    stroke: "#059669",
    text: "text-green-600",
    lightText: "text-green-500",
    radius: 4.5,
    strokeWidth: 2,
  },
} as const;

/**
 * Default dot configuration (no violation)
 */
export const DEFAULT_DOT_CONFIG = {
  radius: 4,
  strokeWidth: 2,
};

/**
 * Violation display metadata for tooltips
 */
export const VIOLATION_METADATA = {
  rule1: {
    emoji: "🔴",
    title: "Outside Control Limits",
    description: "Rule 1: Point beyond 3σ",
  },
  rule4: {
    emoji: "🟠",
    title: "2 of 3 Beyond 2σ",
    description: "Rule 4: Clustering near limits",
  },
  rule3: {
    emoji: "🟡",
    title: "4 Near Limit Pattern",
    description: "Rule 3: 3 of 4 in extreme quartiles",
  },
  rule2: {
    emoji: "🔵",
    title: "Running Point Pattern",
    description: "Rule 2: 8+ points on one side",
  },
  rule5: {
    emoji: "🟢",
    title: "Low Variation",
    description: "Rule 5: 15+ points within 1σ",
  },
} as const;

/**
 * Get text color for violation label
 */
export function getViolationTextColor(
  violation: string | null | undefined,
): string {
  if (!violation) return "currentColor";

  switch (violation) {
    case "rule1":
      return "#ef4444";
    case "rule4":
      return "#f97316";
    case "rule3":
      return "#f59e0b";
    case "rule2":
      return "#3b82f6";
    case "rule5":
      return "#10b981";
    default:
      return "currentColor";
  }
}

/**
 * Get dot styling based on violation type
 */
export function getDotStyling(
  highestPriorityViolation: string | null | undefined,
  defaultColor: string,
  isDark: boolean,
): {
  fillColor: string;
  strokeColor: string;
  radius: number;
  strokeWidth: number;
  hasViolation: boolean;
} {
  const dotStroke = getDotStroke(isDark);

  if (!highestPriorityViolation) {
    return {
      fillColor: defaultColor,
      strokeColor: dotStroke,
      radius: DEFAULT_DOT_CONFIG.radius,
      strokeWidth: DEFAULT_DOT_CONFIG.strokeWidth,
      hasViolation: false,
    };
  }

  const violationKey =
    highestPriorityViolation as keyof typeof VIOLATION_COLORS;
  const config = VIOLATION_COLORS[violationKey];

  if (!config) {
    return {
      fillColor: defaultColor,
      strokeColor: dotStroke,
      radius: DEFAULT_DOT_CONFIG.radius,
      strokeWidth: DEFAULT_DOT_CONFIG.strokeWidth,
      hasViolation: false,
    };
  }

  return {
    fillColor: config.fill,
    strokeColor: config.stroke,
    radius: config.radius,
    strokeWidth: config.strokeWidth,
    hasViolation: true,
  };
}

/**
 * Get active dot styling based on violation type
 */
export function getActiveDotStyling(
  highestPriorityViolation: string | null | undefined,
  defaultColor: string,
  isDark: boolean,
): {
  fillColor: string;
  strokeColor: string;
} {
  const dotStroke = getDotStroke(isDark);

  if (!highestPriorityViolation) {
    return {
      fillColor: dotStroke,
      strokeColor: defaultColor,
    };
  }

  const violationKey =
    highestPriorityViolation as keyof typeof VIOLATION_COLORS;
  const config = VIOLATION_COLORS[violationKey];

  if (!config) {
    return {
      fillColor: dotStroke,
      strokeColor: defaultColor,
    };
  }

  return {
    fillColor: config.fill,
    strokeColor: config.stroke,
  };
}
