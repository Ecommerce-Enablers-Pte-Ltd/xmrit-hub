import * as React from "react";

const MOBILE_BREAKPOINT = 768;
const DEBOUNCE_DELAY = 150; // ms - prevents rapid state updates during resize

/**
 * Detects if the viewport is mobile-sized (< 768px width).
 *
 * This hook is STABLE during resize operations:
 * 1. Uses debouncing to prevent rapid state updates
 * 2. Uses matchMedia for efficient breakpoint detection
 * 3. Properly handles cleanup to prevent memory leaks
 *
 * For device-type detection (which should be completely stable),
 * use useIsMobileDevice instead.
 */
export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState<boolean>(() => {
    // Initialize with actual value on client, false on server
    if (typeof window !== "undefined") {
      return window.innerWidth < MOBILE_BREAKPOINT;
    }
    return false;
  });

  React.useEffect(() => {
    // Track if the effect is still active to prevent setState on unmounted component
    let isActive = true;
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;

    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);

    // Debounced handler to prevent rapid state updates during resize
    const onChange = () => {
      if (!isActive) return;

      // Clear any pending timer
      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }

      // Debounce the state update
      debounceTimer = setTimeout(() => {
        if (isActive) {
          const newValue = window.innerWidth < MOBILE_BREAKPOINT;
          // Use functional update to only trigger re-render if value actually changed
          setIsMobile((prev) => (prev !== newValue ? newValue : prev));
        }
      }, DEBOUNCE_DELAY);
    };

    mql.addEventListener("change", onChange);

    // Sync state once on mount in case it changed between SSR and hydration
    // This is immediate (no debounce) since it's only called once
    if (isActive) {
      const currentValue = window.innerWidth < MOBILE_BREAKPOINT;
      setIsMobile((prev) => (prev !== currentValue ? currentValue : prev));
    }

    return () => {
      isActive = false;
      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }
      mql.removeEventListener("change", onChange);
    };
  }, []);

  return isMobile;
}
