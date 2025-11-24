import { AlertCircle, ArrowDown, ArrowUp, Circle, Minus } from "lucide-react";
import React from "react";
import type { FollowUpPriority, FollowUpStatus } from "@/types/db/follow-up";
import { cn } from "./utils";

// Status configuration with filled circles
export const STATUS_CONFIG: Record<
  FollowUpStatus,
  {
    label: string;
    color: string;
    badgeColor: string;
    dotColor: string;
  }
> = {
  backlog: {
    label: "Backlog",
    color: "text-gray-700 dark:text-gray-300",
    badgeColor:
      "bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-900 dark:text-gray-300 dark:border-gray-800",
    dotColor: "bg-gray-400",
  },
  todo: {
    label: "Todo",
    color: "text-blue-700 dark:text-blue-400",
    badgeColor:
      "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-400 dark:border-blue-900",
    dotColor: "bg-blue-500",
  },
  in_progress: {
    label: "In Progress",
    color: "text-yellow-700 dark:text-yellow-400",
    badgeColor:
      "bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-950 dark:text-yellow-400 dark:border-yellow-900",
    dotColor: "bg-yellow-500",
  },
  done: {
    label: "Done",
    color: "text-green-700 dark:text-green-400",
    badgeColor:
      "bg-green-50 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-400 dark:border-green-900",
    dotColor: "bg-green-500",
  },
  cancelled: {
    label: "Cancelled",
    color: "text-red-700 dark:text-red-400",
    badgeColor:
      "bg-red-50 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-400 dark:border-red-900",
    dotColor: "bg-red-500",
  },
};

// Priority configuration
export const PRIORITY_CONFIG: Record<
  FollowUpPriority,
  {
    label: string;
    icon: React.ReactNode;
    iconColor: string;
  }
> = {
  urgent: {
    label: "Urgent",
    icon: <AlertCircle className="h-3.5 w-3.5" />,
    iconColor: "text-red-600 dark:text-red-400",
  },
  high: {
    label: "High",
    icon: <ArrowUp className="h-3.5 w-3.5" />,
    iconColor: "text-orange-600 dark:text-orange-400",
  },
  medium: {
    label: "Medium",
    icon: <Minus className="h-3.5 w-3.5" />,
    iconColor: "text-yellow-600 dark:text-yellow-400",
  },
  low: {
    label: "Low",
    icon: <ArrowDown className="h-3.5 w-3.5" />,
    iconColor: "text-blue-600 dark:text-blue-400",
  },
  no_priority: {
    label: "No Priority",
    icon: <Circle className="h-3.5 w-3.5" />,
    iconColor: "text-gray-400",
  },
};

// Helper functions
export function getStatusIcon(
  status: FollowUpStatus | string,
  className?: string,
) {
  const config = STATUS_CONFIG[status as FollowUpStatus];
  if (!config) return null;

  return (
    <div
      className={cn(
        "h-2 w-2 rounded-full shrink-0",
        config.dotColor,
        className,
      )}
    />
  );
}

export function getStatusLabel(status: FollowUpStatus | string): string {
  return STATUS_CONFIG[status as FollowUpStatus]?.label || status;
}

export function getStatusColor(status: FollowUpStatus | string): string {
  return STATUS_CONFIG[status as FollowUpStatus]?.color || "";
}

export function getStatusBadgeColor(status: FollowUpStatus | string): string {
  return STATUS_CONFIG[status as FollowUpStatus]?.badgeColor || "";
}

export function getStatusDotColor(status: FollowUpStatus | string): string {
  return STATUS_CONFIG[status as FollowUpStatus]?.dotColor || "";
}

export function getPriorityIcon(
  priority: FollowUpPriority | string,
  className?: string,
) {
  const config = PRIORITY_CONFIG[priority as FollowUpPriority];
  if (!config || !config.icon) return null;

  // Merge custom className with icon color
  const mergedClassName = className
    ? `${className} ${config.iconColor}`
    : `h-3.5 w-3.5 ${config.iconColor}`;

  // Clone the icon element with the merged className
  if (React.isValidElement(config.icon)) {
    return React.cloneElement(config.icon, {
      className: mergedClassName,
    } as any);
  }

  return config.icon;
}

export function getPriorityLabel(priority: FollowUpPriority | string): string {
  return PRIORITY_CONFIG[priority as FollowUpPriority]?.label || priority;
}

// Legacy exports for backward compatibility
export const STATUS_COLORS: Record<string, string> = Object.entries(
  STATUS_CONFIG,
).reduce(
  (acc, [key, value]) => {
    acc[key] = value.badgeColor;
    return acc;
  },
  {} as Record<string, string>,
);

export const STATUS_LABELS: Record<string, string> = Object.entries(
  STATUS_CONFIG,
).reduce(
  (acc, [key, value]) => {
    acc[key] = value.label;
    return acc;
  },
  {} as Record<string, string>,
);

export const PRIORITY_LABELS: Record<string, string> = Object.entries(
  PRIORITY_CONFIG,
).reduce(
  (acc, [key, value]) => {
    acc[key] = value.label;
    return acc;
  },
  {} as Record<string, string>,
);
