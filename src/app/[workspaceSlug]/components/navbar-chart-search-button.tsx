"use client";

import { Search } from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useIsMobileDevice } from "@/hooks/use-mobile-device";
import { useChartSearchSafe } from "../../../providers/chart-search-provider";

export function NavbarChartSearchButton() {
  const pathname = usePathname();
  const context = useChartSearchSafe();
  const { isMobileDevice } = useIsMobileDevice();
  const [isMac, setIsMac] = useState<boolean | null>(null);

  // Detect OS on mount - use null initial state to avoid hydration mismatch
  useEffect(() => {
    const checkIsMac = () => {
      // Modern API (Chrome 90+, Edge 90+)
      const nav = navigator as Navigator & {
        userAgentData?: { platform: string };
      };
      if (nav.userAgentData?.platform) {
        return nav.userAgentData.platform.toLowerCase() === "macos";
      }
      // Fallback to userAgent
      return /mac/i.test(navigator.userAgent);
    };
    setIsMac(checkIsMac());
  }, []);

  // Check if we're on a slide page
  const isSlidePage = pathname?.includes("/slide/");

  // Register keyboard shortcut (Cmd+F or Ctrl+F)
  useEffect(() => {
    if (!isSlidePage || !context) return;

    const handleSearchShortcut = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "f") {
        e.preventDefault();
        context.toggle();
      }
    };

    window.addEventListener("keydown", handleSearchShortcut);
    return () => window.removeEventListener("keydown", handleSearchShortcut);
  }, [isSlidePage, context]);

  // Don't show button if not on a slide page or on mobile device
  if (!isSlidePage || !context || isMobileDevice) {
    return null;
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          size="icon"
          variant="ghost"
          className="h-9 w-9"
          onClick={context.open}
        >
          <Search className="h-4 w-4" />
          <span className="sr-only">Search charts</span>
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom">
        <span className="flex items-center gap-2">
          Search charts
          {isMac !== null && (
            <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
              <span className="text-xs">{isMac ? "⌘" : "Ctrl+"}</span>F
            </kbd>
          )}
        </span>
      </TooltipContent>
    </Tooltip>
  );
}
