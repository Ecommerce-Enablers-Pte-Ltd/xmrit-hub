"use client";

import {
  ThemeProvider as NextThemesProvider,
  type ThemeProviderProps,
} from "next-themes";
import { memo, useEffect } from "react";

const ThemeProviderComponent = ({ children, ...props }: ThemeProviderProps) => {
  // Touch blur: prevent sticky focus rings on touch devices
  useEffect(() => {
    const isTouchDevice = () =>
      window.matchMedia("(hover: none) and (pointer: coarse)").matches;

    const handleTouchEnd = (event: TouchEvent | MouseEvent) => {
      if (!isTouchDevice()) return;

      const target = event.target as HTMLElement;
      const interactiveElement = target.closest(
        'button, [role="button"], a, input, textarea, select, [tabindex], [data-slot="button"]',
      );

      if (interactiveElement instanceof HTMLElement) {
        requestAnimationFrame(() => {
          interactiveElement.blur();
        });
      }
    };

    document.addEventListener("touchend", handleTouchEnd, { passive: true });
    document.addEventListener("mouseup", handleTouchEnd, { passive: true });

    return () => {
      document.removeEventListener("touchend", handleTouchEnd);
      document.removeEventListener("mouseup", handleTouchEnd);
    };
  }, []);

  return <NextThemesProvider {...props}>{children}</NextThemesProvider>;
};

export const ThemeProvider = memo(ThemeProviderComponent);
