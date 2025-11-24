/**
 * Time Bucket Normalization Utilities
 *
 * Provides consistent time bucket keys for comment threading across slides.
 * Each bucket type normalizes timestamps to a stable key (e.g., ISO week start).
 */

export type TimeBucket = "day" | "week" | "month" | "quarter" | "year";

/**
 * Parse timestamp in various formats to Date
 * Supports: YYYYMM, YYYYMMDD, ISO strings
 */
export function parseTimestamp(timestamp: string): Date {
  // Check if timestamp is in YYYYMM format (e.g., "202301", "202412")
  if (/^\d{6}$/.test(timestamp)) {
    const year = timestamp.substring(0, 4);
    const month = timestamp.substring(4, 6);
    return new Date(`${year}-${month}-01T00:00:00.000Z`);
  }

  // Check if timestamp is in YYYYMMDD format (e.g., "20230115")
  if (/^\d{8}$/.test(timestamp)) {
    const year = timestamp.substring(0, 4);
    const month = timestamp.substring(4, 6);
    const day = timestamp.substring(6, 8);
    return new Date(`${year}-${month}-${day}T00:00:00.000Z`);
  }

  // Otherwise, use standard Date constructor for ISO strings and other formats
  return new Date(timestamp);
}

/**
 * Get ISO week start date (Monday) for a given date
 */
function getISOWeekStart(date: Date): Date {
  const d = new Date(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()),
  );
  const dayOfWeek = d.getUTCDay();
  // Calculate days to subtract to get to Monday (1 = Monday, 0 = Sunday)
  const diff = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  d.setUTCDate(d.getUTCDate() - diff);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

/**
 * Get first day of month
 */
function getMonthStart(date: Date): Date {
  return new Date(Date.UTC(date.getFullYear(), date.getMonth(), 1, 0, 0, 0, 0));
}

/**
 * Get first day of quarter
 */
function getQuarterStart(date: Date): Date {
  const quarter = Math.floor(date.getMonth() / 3);
  return new Date(Date.UTC(date.getFullYear(), quarter * 3, 1, 0, 0, 0, 0));
}

/**
 * Get first day of year
 */
function getYearStart(date: Date): Date {
  return new Date(Date.UTC(date.getFullYear(), 0, 1, 0, 0, 0, 0));
}

/**
 * Format date as YYYY-MM-DD (UTC)
 */
function formatDateKey(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Normalize a timestamp to a stable bucket key
 *
 * @param timestamp - ISO date string or YYYYMM/YYYYMMDD format
 * @param bucketType - Type of time bucket
 * @returns Normalized key as YYYY-MM-DD string
 */
export function normalizeToBucket(
  timestamp: string,
  bucketType: TimeBucket,
): string {
  const date = parseTimestamp(timestamp);

  switch (bucketType) {
    case "day":
      // For day, just use the date itself (UTC midnight)
      return formatDateKey(
        new Date(
          Date.UTC(
            date.getFullYear(),
            date.getMonth(),
            date.getDate(),
            0,
            0,
            0,
            0,
          ),
        ),
      );

    case "week":
      // ISO week start (Monday)
      return formatDateKey(getISOWeekStart(date));

    case "month":
      // First day of month
      return formatDateKey(getMonthStart(date));

    case "quarter":
      // First day of quarter
      return formatDateKey(getQuarterStart(date));

    case "year":
      // First day of year
      return formatDateKey(getYearStart(date));

    default:
      throw new Error(`Unknown bucket type: ${bucketType}`);
  }
}

/**
 * Detect the appropriate bucket type based on data granularity
 * Uses the same logic as determinePeriodicity from xmr-calculations
 *
 * @param timestamps - Array of timestamp strings
 * @returns Detected bucket type
 */
export function detectBucketType(timestamps: string[]): TimeBucket {
  if (timestamps.length < 2) return "day";

  // Calculate time deltas between consecutive points (in days)
  const deltas: number[] = [];
  for (let i = 1; i < timestamps.length; i++) {
    const date1 = parseTimestamp(timestamps[i - 1]);
    const date2 = parseTimestamp(timestamps[i]);
    const diffTime = Math.abs(date2.getTime() - date1.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    deltas.push(diffDays);
  }

  // Count frequency of each delta
  const diffCounts: { [key: number]: number } = {};
  deltas.forEach((diff) => {
    diffCounts[diff] = (diffCounts[diff] || 0) + 1;
  });

  // Find most common interval
  const mostCommonDiff = Object.keys(diffCounts).reduce((a, b) =>
    diffCounts[Number(a)] > diffCounts[Number(b)] ? a : b,
  );

  const interval = Number(mostCommonDiff);

  // Map intervals to bucket types
  if (interval < 7) {
    return "day";
  } else if (interval < 28) {
    return "week";
  } else if (interval < 90) {
    return "month";
  } else if (interval < 365) {
    return "quarter";
  } else {
    return "year";
  }
}

/**
 * Get a human-readable label for a bucket key
 *
 * @param bucketValue - Normalized bucket key (YYYY-MM-DD)
 * @param bucketType - Type of bucket
 * @returns Human-readable label
 */
export function getBucketLabel(
  bucketValue: string,
  bucketType: TimeBucket,
): string {
  const date = new Date(`${bucketValue}T00:00:00.000Z`);

  switch (bucketType) {
    case "day":
      return date.toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });

    case "week":
      return `Week of ${date.toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })}`;

    case "month":
      return date.toLocaleDateString("en-GB", {
        month: "long",
        year: "numeric",
      });

    case "quarter": {
      const quarter = Math.floor(date.getUTCMonth() / 3) + 1;
      return `Q${quarter} ${date.getUTCFullYear()}`;
    }

    case "year":
      return date.getUTCFullYear().toString();

    default:
      return bucketValue;
  }
}
