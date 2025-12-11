"use client";

import { Check, Link2, Search } from "lucide-react";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import type { ChartInfo } from "@/lib/api/slides";
import { cn } from "@/lib/utils";

interface ChartSearchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  charts: ChartInfo[];
  onChartSelect: (index: number) => void;
}

// Maximum items to render at once for performance
const MAX_VISIBLE_ITEMS = 50;

// Simple fuzzy match function
function fuzzyMatch(text: string, query: string): boolean {
  const lowerText = text.toLowerCase();
  const lowerQuery = query.toLowerCase();

  // Check if query is a number (chart index)
  if (/^\d+$/.test(query)) {
    return lowerText.startsWith(query);
  }

  // Simple contains match for each word
  const words = lowerQuery.split(/\s+/).filter(Boolean);
  return words.every((word) => lowerText.includes(word));
}

// Lightweight chart item - minimal DOM, no heavy components
const ChartItem = memo(function ChartItem({
  chart,
  originalIndex,
  isSelected,
  onSelect,
  isCopied,
  onCopyLink,
}: {
  chart: ChartInfo;
  originalIndex: number;
  isSelected: boolean;
  onSelect: () => void;
  isCopied: boolean;
  onCopyLink: (slug: string, e: React.MouseEvent) => void;
}) {
  const category = chart.category || "";
  const metricName = chart.name || "Untitled";

  return (
    <div
      role="option"
      aria-selected={isSelected}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          onSelect();
        }
      }}
      tabIndex={0}
      className={cn(
        "flex items-center gap-3 py-2.5 px-2 cursor-pointer rounded-sm group outline-none",
        isSelected ? "bg-accent text-accent-foreground" : "hover:bg-accent/50",
      )}
    >
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium">
        {originalIndex + 1}
      </span>
      <div className="flex flex-col gap-0.5 min-w-0 flex-1">
        {category && (
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            {category}
          </span>
        )}
        <span className="text-sm font-medium truncate">{metricName}</span>
      </div>
      <button
        type="button"
        onClick={(e) => onCopyLink(chart.slug, e)}
        className="h-7 w-7 shrink-0 flex items-center justify-center rounded-md opacity-0 group-hover:opacity-100 hover:bg-background/50 cursor-pointer"
        title={isCopied ? "Copied!" : "Copy link"}
      >
        {isCopied ? (
          <Check className="h-3.5 w-3.5 text-green-500" />
        ) : (
          <Link2 className="h-3.5 w-3.5" />
        )}
      </button>
    </div>
  );
});

export const ChartSearchDialog = memo(function ChartSearchDialog({
  open,
  onOpenChange,
  charts,
  onChartSelect,
}: ChartSearchDialogProps) {
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [search, setSearch] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [copiedSlug, setCopiedSlug] = useState<string | null>(null);

  // Filter charts based on search - only when search changes
  const filteredCharts = useMemo(() => {
    if (!search.trim()) {
      return charts.map((chart, index) => ({ chart, originalIndex: index }));
    }

    return charts
      .map((chart, index) => ({ chart, originalIndex: index }))
      .filter(({ chart, originalIndex }) => {
        const searchText = `${originalIndex + 1} ${chart.category || ""} ${
          chart.name || ""
        } ${chart.metricName || ""}`;
        return fuzzyMatch(searchText, search);
      });
  }, [charts, search]);

  // Limit rendered items for performance
  const visibleCharts = useMemo(() => {
    return filteredCharts.slice(0, MAX_VISIBLE_ITEMS);
  }, [filteredCharts]);

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setSearch("");
      setSelectedIndex(0);
      // Focus input after dialog opens
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  // Reset selection when filter changes
  const searchRef = useRef(search);
  if (searchRef.current !== search) {
    searchRef.current = search;
    setSelectedIndex(0);
  }

  // Keyboard navigation
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setSelectedIndex((prev) =>
            Math.min(prev + 1, visibleCharts.length - 1),
          );
          break;
        case "ArrowUp":
          e.preventDefault();
          setSelectedIndex((prev) => Math.max(prev - 1, 0));
          break;
        case "Enter":
          e.preventDefault();
          if (visibleCharts[selectedIndex]) {
            onChartSelect(visibleCharts[selectedIndex].originalIndex);
            onOpenChange(false);
          }
          break;
        case "Escape":
          e.preventDefault();
          onOpenChange(false);
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, selectedIndex, visibleCharts, onChartSelect, onOpenChange]);

  // Scroll selected item into view
  useEffect(() => {
    if (!listRef.current) return;
    // Query for the selected element using the current index
    const selectedEl = listRef.current.children[selectedIndex + 1] as
      | HTMLElement
      | undefined;
    if (selectedEl) {
      selectedEl.scrollIntoView({ block: "nearest" });
    }
  }, [selectedIndex]);

  const handleSelect = useCallback(
    (originalIndex: number) => {
      onChartSelect(originalIndex);
      onOpenChange(false);
    },
    [onChartSelect, onOpenChange],
  );

  const copyChartLink = useCallback(
    async (slug: string, e: React.MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();
      const url = `${window.location.origin}${window.location.pathname}#${slug}`;
      try {
        await navigator.clipboard.writeText(url);
      } catch {
        const textArea = document.createElement("textarea");
        textArea.value = url;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand("copy");
        document.body.removeChild(textArea);
      }
      setCopiedSlug(slug);
      setTimeout(() => setCopiedSlug(null), 1500);
    },
    [],
  );

  if (charts.length === 0) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="overflow-hidden p-0 shadow-2xl border-border/50 sm:max-w-2xl">
        <DialogTitle className="sr-only">Search Charts</DialogTitle>
        <DialogDescription className="sr-only">
          Search and jump to any chart by category or metric name
        </DialogDescription>

        {/* Search Input */}
        <div className="flex items-center border-b px-3">
          <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Type chart # or search by category/metric name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex h-12 w-full bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground"
          />
        </div>

        {/* Results List */}
        <div
          ref={listRef}
          className="max-h-[60vh] overflow-y-auto overflow-x-hidden p-2"
          role="listbox"
        >
          {visibleCharts.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No charts found.
            </p>
          ) : (
            <>
              <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
                Charts ({filteredCharts.length})
                {filteredCharts.length > MAX_VISIBLE_ITEMS && (
                  <span className="ml-1">
                    — showing first {MAX_VISIBLE_ITEMS}
                  </span>
                )}
              </div>
              {visibleCharts.map(({ chart, originalIndex }, displayIndex) => (
                <ChartItem
                  key={chart.id}
                  chart={chart}
                  originalIndex={originalIndex}
                  isSelected={displayIndex === selectedIndex}
                  onSelect={() => handleSelect(originalIndex)}
                  isCopied={copiedSlug === chart.slug}
                  onCopyLink={copyChartLink}
                />
              ))}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
});
