"use client";

import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";

interface ChartSearchContextValue {
  isOpen: boolean;
  open: () => void;
  close: () => void;
  toggle: () => void;
}

const ChartSearchContext = createContext<ChartSearchContextValue | null>(null);

export function ChartSearchProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);
  const toggle = useCallback(() => setIsOpen((prev) => !prev), []);

  // Memoize the context value to prevent unnecessary re-renders
  const value = useMemo(
    () => ({
      isOpen,
      open,
      close,
      toggle,
    }),
    [isOpen, open, close, toggle],
  );

  return (
    <ChartSearchContext.Provider value={value}>
      {children}
    </ChartSearchContext.Provider>
  );
}

export function useChartSearch() {
  const context = useContext(ChartSearchContext);
  if (!context) {
    throw new Error("useChartSearch must be used within a ChartSearchProvider");
  }
  return context;
}

export function useChartSearchSafe() {
  return useContext(ChartSearchContext);
}
