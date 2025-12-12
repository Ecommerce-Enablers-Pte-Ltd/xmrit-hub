import * as React from "react";

/**
 * Hook that returns event handlers to blur interactive elements
 * after touch/click on mobile devices to prevent sticky hover/focus states.
 *
 * Usage:
 * const touchBlurProps = useTouchBlur();
 * <Button {...touchBlurProps} onClick={handleClick}>Click me</Button>
 */
export function useTouchBlur() {
  const isTouchDevice = React.useRef<boolean | null>(null);

  // Detect touch device on first interaction
  const checkTouchDevice = React.useCallback(() => {
    if (isTouchDevice.current === null) {
      isTouchDevice.current = window.matchMedia(
        "(hover: none) and (pointer: coarse)",
      ).matches;
    }
    return isTouchDevice.current;
  }, []);

  const handleInteraction = React.useCallback(
    (event: React.MouseEvent | React.TouchEvent) => {
      if (checkTouchDevice()) {
        const target = event.currentTarget as HTMLElement;
        // Use requestAnimationFrame to blur after the click is processed
        requestAnimationFrame(() => {
          target.blur();
        });
      }
    },
    [checkTouchDevice],
  );

  return {
    onMouseUp: handleInteraction,
    onTouchEnd: handleInteraction,
  };
}

/**
 * Higher-order function to wrap onClick handlers with touch blur behavior.
 * Automatically blurs the element after click on touch devices.
 *
 * Usage:
 * <Button onClick={withTouchBlur(handleClick)}>Click me</Button>
 */
export function withTouchBlur<E extends HTMLElement>(
  handler?: (event: React.MouseEvent<E>) => void,
): (event: React.MouseEvent<E>) => void {
  return (event: React.MouseEvent<E>) => {
    // Check if it's a touch device
    const isTouchDevice = window.matchMedia(
      "(hover: none) and (pointer: coarse)",
    ).matches;

    // Call the original handler
    handler?.(event);

    // Blur on touch devices after the click is processed
    if (isTouchDevice) {
      requestAnimationFrame(() => {
        (event.currentTarget as HTMLElement).blur();
      });
    }
  };
}

/**
 * Utility to blur the currently focused element on touch devices.
 * Useful for programmatically clearing focus after operations.
 */
export function blurOnTouch() {
  if (typeof window === "undefined") return;

  const isTouchDevice = window.matchMedia(
    "(hover: none) and (pointer: coarse)",
  ).matches;

  if (isTouchDevice && document.activeElement instanceof HTMLElement) {
    document.activeElement.blur();
  }
}
