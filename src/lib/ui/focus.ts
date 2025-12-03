/**
 * Focus management utilities for UI components
 */

/**
 * Prevent Radix UI from returning focus to trigger when dropdown/dialog closes
 * This creates a better UX by removing focus completely
 *
 * @example
 * <DropdownMenuContent onCloseAutoFocus={handleCloseAutoFocus}>
 *   ...
 * </DropdownMenuContent>
 */
export function handleCloseAutoFocus(e: Event): void {
  e.preventDefault();
  // Completely remove focus by blurring any active element
  if (document.activeElement instanceof HTMLElement) {
    document.activeElement.blur();
  }
}

