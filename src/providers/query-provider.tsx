"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type * as React from "react";

// Create a client outside of the component to avoid recreating on every render
// Development: Instant updates, no caching
// Production: Optimized performance with aggressive caching
const isDevelopment = process.env.NODE_ENV === "development";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: isDevelopment ? 0 : 1000 * 60 * 10, // 0 in dev, 10 minutes in prod
      gcTime: isDevelopment ? 0 : 1000 * 60 * 30, // 0 in dev, 30 minutes in prod
      refetchOnWindowFocus: !!isDevelopment, // Refetch in dev for instant updates
      refetchOnReconnect: !!isDevelopment, // Refetch in dev for instant updates
      retry: 1, // Reduce retries for faster failure feedback
      networkMode: "online",
    },
    mutations: {
      retry: 1,
      networkMode: "online",
    },
  },
});

export function QueryProvider({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}
