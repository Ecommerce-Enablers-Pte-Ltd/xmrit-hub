import * as React from "react";

/**
 * Detects if the user is on a mobile device (phone/tablet)
 * regardless of screen orientation (portrait or landscape).
 *
 * Uses a combination of:
 * 1. User agent detection for mobile device identifiers
 * 2. Touch capability detection
 * 3. Screen size heuristics (max dimension check for phones)
 *
 * This detection is STABLE - once determined, it doesn't change during resize/rotation
 * because a device doesn't stop being a mobile device when rotated.
 */
export function useIsMobileDevice() {
  // Use lazy initialization to compute once on mount
  // Mobile device detection should be stable - a device doesn't change type during resize
  const [isMobileDevice, setIsMobileDevice] = React.useState<
    boolean | undefined
  >(() => {
    // Return undefined for SSR, will be computed on client in useEffect
    if (typeof window === "undefined") return undefined;

    // Compute immediately on client for initial render
    return checkMobileDevice();
  });

  React.useEffect(() => {
    // On mount, ensure we have the correct value (handles SSR hydration)
    const result = checkMobileDevice();
    setIsMobileDevice((prev) => {
      // Only update if actually different to prevent unnecessary re-renders
      if (prev !== result) return result;
      return prev;
    });

    // Note: We intentionally do NOT listen for resize/orientation changes
    // because mobile device detection should be stable - a phone doesn't
    // become a desktop when rotated, it's still the same device.
    // This prevents infinite loops and unnecessary re-renders during rotation.
  }, []);

  return {
    isMobileDevice: !!isMobileDevice,
    isLoading: isMobileDevice === undefined,
  };
}

/**
 * Pure function to check if the current device is a mobile device.
 * Separated from the hook for reusability and testing.
 */
function checkMobileDevice(): boolean {
  if (typeof window === "undefined") return false;

  // 1. User agent detection - most reliable for actual device type
  const userAgent = navigator.userAgent || navigator.vendor || "";
  const mobileRegex =
    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile|mobile|CriOS/i;
  const isMobileUserAgent = mobileRegex.test(userAgent);

  // 2. Check for touch-primary device (excludes laptops with touchscreen)
  // matchMedia with pointer: coarse detects touch-primary devices
  const isTouchPrimary =
    window.matchMedia("(pointer: coarse)").matches &&
    window.matchMedia("(hover: none)").matches;

  // 3. Screen size check - use the smaller dimension to account for rotation
  // Phones typically have screens where the smaller dimension is < 600px
  const smallerDimension = Math.min(window.screen.width, window.screen.height);
  const isSmallScreen = smallerDimension < 600;

  // Consider it a mobile device if:
  // - User agent indicates mobile, OR
  // - It's a touch-primary device with a small screen
  return isMobileUserAgent || (isTouchPrimary && isSmallScreen);
}
