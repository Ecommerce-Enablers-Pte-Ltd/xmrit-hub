import * as React from "react";

/**
 * Detects if the user is on a mobile device (phone/tablet)
 * regardless of screen orientation (portrait or landscape).
 *
 * Uses a combination of:
 * 1. User agent detection for mobile device identifiers
 * 2. Touch capability detection
 * 3. Screen size heuristics (max dimension check for phones)
 */
export function useIsMobileDevice() {
  const [isMobileDevice, setIsMobileDevice] = React.useState<
    boolean | undefined
  >(undefined);

  React.useEffect(() => {
    const checkMobileDevice = (): boolean => {
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
      const smallerDimension = Math.min(
        window.screen.width,
        window.screen.height,
      );
      const isSmallScreen = smallerDimension < 600;

      // Consider it a mobile device if:
      // - User agent indicates mobile, OR
      // - It's a touch-primary device with a small screen
      return isMobileUserAgent || (isTouchPrimary && isSmallScreen);
    };

    setIsMobileDevice(checkMobileDevice());

    // Re-check on orientation change (some devices report different values)
    const handleOrientationChange = () => {
      setIsMobileDevice(checkMobileDevice());
    };

    window.addEventListener("orientationchange", handleOrientationChange);
    // Also listen for resize as a fallback
    window.addEventListener("resize", handleOrientationChange);

    return () => {
      window.removeEventListener("orientationchange", handleOrientationChange);
      window.removeEventListener("resize", handleOrientationChange);
    };
  }, []);

  return {
    isMobileDevice: !!isMobileDevice,
    isLoading: isMobileDevice === undefined,
  };
}
