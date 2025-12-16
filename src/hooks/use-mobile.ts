import * as React from "react";

const MOBILE_BREAKPOINT = 768;

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

    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    const onChange = () => {
      if (isActive) {
        const newValue = window.innerWidth < MOBILE_BREAKPOINT;
        // Use functional update to only trigger re-render if value actually changed
        setIsMobile((prev) => (prev !== newValue ? newValue : prev));
      }
    };
    mql.addEventListener("change", onChange);
    // Sync state in case it changed between SSR and hydration
    if (isActive) {
      const currentValue = window.innerWidth < MOBILE_BREAKPOINT;
      setIsMobile((prev) => (prev !== currentValue ? currentValue : prev));
    }
    return () => {
      isActive = false;
      mql.removeEventListener("change", onChange);
    };
  }, []);

  return isMobile;
}
