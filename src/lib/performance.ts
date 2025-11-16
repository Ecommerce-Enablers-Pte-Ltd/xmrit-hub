/**
 * Performance utilities for theme switching and rendering optimization
 */

/**
 * Measure the time it takes for a theme change to complete
 */
export function measureThemeChangePerformance(callback: () => void): void {
  if (typeof window === "undefined" || !window.performance) return;

  const startTime = performance.now();

  // Execute the theme change
  callback();

  // Measure after the next paint
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      const endTime = performance.now();
      const duration = endTime - startTime;

      // Log performance in development mode
      if (process.env.NODE_ENV === "development") {
        console.log(`[Theme] Change completed in ${duration.toFixed(2)}ms`);

        // Warn if theme change is slow
        if (duration > 100) {
          console.warn(
            `[Theme] Slow theme change detected: ${duration.toFixed(
              2
            )}ms (target: <100ms)`
          );
        }
      }
    });
  });
}

/**
 * Check if the browser supports View Transitions API
 */
export function supportsViewTransitions(): boolean {
  return (
    typeof document !== "undefined" &&
    "startViewTransition" in document &&
    typeof (document as any).startViewTransition === "function"
  );
}
