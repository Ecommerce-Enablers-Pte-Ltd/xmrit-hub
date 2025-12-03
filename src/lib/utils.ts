import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Sets a cookie with the given name, value, and options.
 * Uses Cookie Store API if available, otherwise falls back to document.cookie.
 */
export function setCookie(
  name: string,
  value: string,
  options?: { path?: string; maxAge?: number }
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
  return cookie ? cookie.split("=")[1] ?? null : null;
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
  fallback: string = "An unexpected error occurred"
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
