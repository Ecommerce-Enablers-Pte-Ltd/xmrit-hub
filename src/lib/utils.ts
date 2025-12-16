import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// ============================================================================
// Slug Utilities
// ============================================================================

/**
 * Shared regex for valid slugs: lowercase letters, numbers, and hyphens only.
 * Must start with a letter, no consecutive hyphens, no leading/trailing hyphens.
 * Examples: "my-workspace", "t4", "q4-2024-report"
 */
export const SLUG_REGEX = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;

/**
 * Error thrown when slug validation fails.
 */
export class SlugValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SlugValidationError";
  }
}

/**
 * Normalizes a slug to lowercase and trims whitespace.
 * Use this for consistent storage and comparison.
 * @param slug - The slug to normalize
 * @returns Normalized lowercase slug
 */
export function normalizeSlug(slug: string): string {
  return slug.toLowerCase().trim();
}

/**
 * Validates that a slug matches the required format and normalizes it.
 * @param slug - The slug to validate and normalize
 * @returns Normalized slug if valid
 * @throws SlugValidationError if the slug is invalid
 */
export function validateAndNormalizeSlug(slug: string): string {
  const normalized = normalizeSlug(slug);

  if (!normalized) {
    throw new SlugValidationError("Slug cannot be empty");
  }

  if (!SLUG_REGEX.test(normalized)) {
    throw new SlugValidationError(
      "Slug must start with a letter and contain only lowercase letters, numbers, and hyphens (no consecutive or trailing hyphens)",
    );
  }

  return normalized;
}

/**
 * Checks if a slug is valid without throwing an error.
 * @param slug - The slug to validate
 * @returns true if valid, false otherwise
 */
export function isValidSlug(slug: string): boolean {
  const normalized = normalizeSlug(slug);
  return normalized.length > 0 && SLUG_REGEX.test(normalized);
}

/**
 * Converts a string into a URL-safe slug (lowercase).
 * Similar to how Metabase generates URL slugs.
 * Examples:
 *   "Hello World" -> "hello-world"
 *   "Q4 2024 Revenue Report" -> "q4-2024-revenue-report"
 *   "!!!" -> "" (empty, use fallback parameter if needed)
 *
 * @param text - The text to convert to a slug
 * @param fallback - Optional fallback if the result would be empty
 * @returns The slugified text, or the fallback if result is empty
 */
export function slugify(text: string, fallback?: string): string {
  const result = text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "") // Remove special characters except hyphens
    .replace(/\s+/g, "-") // Replace spaces with hyphens
    .replace(/-+/g, "-") // Replace multiple hyphens with single hyphen
    .replace(/^-|-$/g, ""); // Remove leading/trailing hyphens

  // Return fallback if result is empty and fallback is provided
  if (!result && fallback !== undefined) {
    return fallback;
  }

  return result;
}

/**
 * Generates a slide URL with a Metabase-style slug (number-title).
 * The URL format is: /workspaceSlug/slide/slideNumber-title
 * All URL components are normalized to lowercase for consistency and SEO.
 * @param workspaceSlug - The workspace slug
 * @param slideNumber - The slide's stable number within the workspace
 * @param slideTitle - The slide title (will be lowercased for URL)
 * @returns URL path like "/t4/slide/1-q4-revenue-report"
 */
export function generateSlideUrl(
  workspaceSlug: string,
  slideNumber: number,
  slideTitle: string,
): string {
  const titleSlug = slugify(slideTitle);
  const slideSlug = titleSlug
    ? `${slideNumber}-${titleSlug}`
    : `${slideNumber}`;
  return `/${normalizeSlug(workspaceSlug)}/slide/${slideSlug}`;
}

/**
 * Generates a workspace URL using its slug.
 * All URLs use normalized lowercase slugs for consistency.
 * @param workspaceSlug - The workspace slug
 * @returns URL path like "/my-workspace"
 */
export function generateWorkspaceUrl(workspaceSlug: string): string {
  return `/${normalizeSlug(workspaceSlug)}`;
}

/**
 * Generates a follow-ups page URL for a workspace.
 * All URLs use normalized lowercase slugs for consistency.
 * @param workspaceSlug - The workspace slug
 * @returns URL path like "/my-workspace/follow-ups"
 */
export function generateFollowUpsUrl(workspaceSlug: string): string {
  return `/${normalizeSlug(workspaceSlug)}/follow-ups`;
}

/**
 * Converts a workspace slug to uppercase for display purposes.
 * Workspace slugs are stored as lowercase in the database,
 * but should be displayed as uppercase in the UI.
 * @param slug - The workspace slug (lowercase)
 * @returns Uppercase version for display (e.g., "t4-wbr" -> "T4-WBR")
 */
export function displayWorkspaceSlug(slug: string): string {
  return slug.toUpperCase();
}

/**
 * Sets a cookie with the given name, value, and options.
 * Uses Cookie Store API if available, otherwise falls back to document.cookie.
 */
export function setCookie(
  name: string,
  value: string,
  options?: { path?: string; maxAge?: number },
): void {
  if (typeof window === "undefined") return;

  // Try to use Cookie Store API if available
  // TypeScript's DOM types include CookieStore, but it may not be available in all browsers
  if (
    "cookieStore" in window &&
    window.cookieStore &&
    typeof window.cookieStore.set === "function"
  ) {
    // Cookie Store API set is async, but we don't need to await it
    // CookieStore API uses 'expires' (number timestamp in milliseconds)
    const maxAge = options?.maxAge ?? 60 * 60 * 24 * 7; // 7 days default
    window.cookieStore
      .set({
        name,
        value,
        path: options?.path ?? "/",
        expires: Date.now() + maxAge * 1000,
      })
      .catch(() => {
        // Silently fall back to document.cookie if Cookie Store API fails
        const path = options?.path ?? "/";
        const maxAge = options?.maxAge ?? 60 * 60 * 24 * 7;
        // biome-ignore lint/suspicious/noDocumentCookie: Fallback for browsers without Cookie Store API
        document.cookie = `${name}=${value}; path=${path}; max-age=${maxAge}`;
      });
  } else {
    // Fallback to document.cookie for browsers that don't support Cookie Store API
    const path = options?.path ?? "/";
    const maxAge = options?.maxAge ?? 60 * 60 * 24 * 7;
    // biome-ignore lint/suspicious/noDocumentCookie: Fallback for browsers without Cookie Store API
    document.cookie = `${name}=${value}; path=${path}; max-age=${maxAge}`;
  }
}

/**
 * Gets a cookie value by name.
 */
export function getCookie(name: string): string | null {
  if (typeof window === "undefined") return null;

  const cookies = document.cookie.split("; ");
  const cookie = cookies.find((c) => c.startsWith(`${name}=`));
  return cookie ? (cookie.split("=")[1] ?? null) : null;
}

/**
 * Generates a URL-safe slug from category and metric name.
 * Used for creating anchor links to charts on slide pages.
 * @param category - The category/dimension (e.g., "Adidas", "North America")
 * @param metricName - The metric name (e.g., "% of MCB Count")
 * @returns URL-safe slug (e.g., "adidas-of-mcb-count")
 */
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

/**
 * Extracts a user-friendly error message from various error formats.
 * Handles:
 * - Error objects with message property
 * - JSON error responses like {"error": "message"} or {"message": "error"}
 * - Plain string errors
 * - Unknown error types
 */
export function getErrorMessage(
  error: unknown,
  fallback: string = "An unexpected error occurred",
): string {
  // Handle Error instances
  if (error instanceof Error) {
    const message = error.message;

    // Try to parse JSON error responses (e.g., '{"error": "message"}' or '{"message": "error"}')
    if (message.startsWith("{") || message.startsWith("[")) {
      try {
        const parsed = JSON.parse(message);
        // Check for common error response formats
        if (typeof parsed === "object" && parsed !== null) {
          return (
            parsed.error ||
            parsed.message ||
            parsed.details?.[0]?.message ||
            fallback
          );
        }
      } catch {
        // If parsing fails, fall through to return the message as-is
      }
    }

    return message || fallback;
  }

  // Handle string errors
  if (typeof error === "string") {
    // Try to parse JSON string
    if (error.startsWith("{") || error.startsWith("[")) {
      try {
        const parsed = JSON.parse(error);
        if (typeof parsed === "object" && parsed !== null) {
          return (
            parsed.error ||
            parsed.message ||
            parsed.details?.[0]?.message ||
            fallback
          );
        }
      } catch {
        // If parsing fails, return the string as-is
      }
    }
    return error || fallback;
  }

  // Handle objects with error or message properties
  if (typeof error === "object" && error !== null) {
    const errorObj = error as Record<string, unknown>;
    return (
      (typeof errorObj.error === "string" ? errorObj.error : undefined) ||
      (typeof errorObj.message === "string" ? errorObj.message : undefined) ||
      fallback
    );
  }

  return fallback;
}
