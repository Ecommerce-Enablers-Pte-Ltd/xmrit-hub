/**
 * Focus management utilities for UI components
 */

/**
 * Prevent Radix UI from returning focus to trigger when dropdown/dialog closes
 * This creates a better UX by removing focus completely
 *
 * Note: The blur is delayed to allow close animations to complete smoothly.
 * Without the delay, the blur can interrupt CSS animations (fade-out, zoom-out).
 * We also check that the user hasn't focused a new element (like an input) to avoid
 * interfering with intentional focus changes.
 *
 * @example
 * <DropdownMenuContent onCloseAutoFocus={handleCloseAutoFocus}>
 *   ...
 * </DropdownMenuContent>
 */
export function handleCloseAutoFocus(e: Event): void {
  e.preventDefault();

  // Capture the element that would receive focus (the trigger button)
  const triggerElement = document.activeElement;

  // Delay blur to allow close animation to complete (animation is ~150ms)
  // This prevents the blur from interrupting the dropdown close animation
  setTimeout(() => {
    const currentActive = document.activeElement;

    // Only blur if focus is still on the original trigger element
    // If user has clicked on an input or other element, don't interfere
    if (
      currentActive instanceof HTMLElement &&
      currentActive === triggerElement
    ) {
      currentActive.blur();
    }
  }, 150);
}
