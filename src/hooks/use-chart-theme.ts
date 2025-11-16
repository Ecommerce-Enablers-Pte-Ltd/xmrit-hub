"use client";

import { useSyncExternalStore } from "react";

/**
 * Lightweight theme tracker for chart colors
 * Uses a singleton observer shared across all chart instances
 */
class ChartThemeStore {
  private listeners = new Set<() => void>();
  private observer: MutationObserver | null = null;
  private isDark = false;

  constructor() {
    if (typeof window !== "undefined") {
      // Initialize
      this.isDark = document.documentElement.classList.contains("dark");

      // Watch for theme changes
      this.observer = new MutationObserver(() => {
        const newIsDark = document.documentElement.classList.contains("dark");
        if (newIsDark !== this.isDark) {
          this.isDark = newIsDark;
          this.notifyListeners();
        }
      });

      this.observer.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ["class"],
      });
    }
  }

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
      if (this.listeners.size === 0 && this.observer) {
        this.observer.disconnect();
        this.observer = null;
      }
    };
  };

  getSnapshot = () => {
    return this.isDark;
  };

  getServerSnapshot = () => {
    return false; // Default to light theme on server
  };

  private notifyListeners() {
    this.listeners.forEach((listener) => listener());
  }
}

// Single global instance
const themeStore = new ChartThemeStore();

/**
 * Hook to track dark/light mode for chart colors
 * Returns true if dark mode, false if light mode
 * Automatically triggers re-render when theme changes
 */
export function useChartTheme(): boolean {
  return useSyncExternalStore(
    themeStore.subscribe,
    themeStore.getSnapshot,
    themeStore.getServerSnapshot
  );
}

