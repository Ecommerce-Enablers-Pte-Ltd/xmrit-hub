/**
 * Formatting utilities for numbers, strings, and display values
 */

/**
 * Get initials from a user name
 * Used in user avatar displays
 *
 * @example
 * getInitials("John Doe") // "JD"
 * getInitials("Jane") // "JA"
 * getInitials(null) // "?"
 */
export function getInitials(name: string | null | undefined): string {
  if (!name) return "?";
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

/**
 * Smart number formatter - removes .00 for integers, keeps necessary decimals
 *
 * @example
 * formatNumber(100) // "100"
 * formatNumber(100.5) // "100.5"
 * formatNumber(100.50) // "100.5"
 * formatNumber(null) // "N/A"
 */
export function formatNumber(value: number | null | undefined): string {
  if (value == null) return "N/A";

  // Check if it's a whole number
  if (Number.isInteger(value)) {
    return value.toString();
  }

  // For decimals, use toFixed(2) but remove trailing zeros
  const formatted = value.toFixed(2);
  // Remove trailing zeros and decimal point if not needed
  return formatted.replace(/\.?0+$/, "");
}
