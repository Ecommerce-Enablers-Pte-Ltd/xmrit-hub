"use client";

import { Check, ChevronsUpDown } from "lucide-react";
import * as React from "react";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import type { SubmetricDefinition } from "@/types/db/submetric";

// Extended type to include optional category and slideTitle for display
export type SubmetricDefinitionForSelector = SubmetricDefinition & {
  category?: string | null;
  slideTitle?: string;
};

interface SubmetricSelectorProps {
  /** List of submetric definitions to display */
  submetricDefinitions: SubmetricDefinitionForSelector[];
  /** Currently selected submetric definition ID (or null/undefined for no selection) */
  value?: string | null;
  /** Callback when selection changes. Passes null when "None" or "All" is selected */
  onValueChange: (value: string | null) => void;
  /** Placeholder text when nothing is selected */
  placeholder?: string;
  /** Whether the component is disabled */
  disabled?: boolean;
  /** Additional CSS classes for the trigger button */
  className?: string;
  /** Width of the trigger button (e.g., "w-full", "w-[160px]") */
  triggerWidth?: string;
  /** Max width of the trigger button for truncation. Defaults to vw-based calc if not provided. Use "max-w-full" to disable. */
  triggerMaxWidth?: string;
  /** Width of the popover content */
  popoverWidth?: string;
  /** Show "All submetrics" option (for filter mode) - selecting clears the filter */
  showAllOption?: boolean;
  /** Show "None" option (for dialog/form mode) - selecting sets value to null */
  showNoneOption?: boolean;
  /** Loading state */
  isLoading?: boolean;
}

/**
 * Helper function to format submetric display label
 */
function getSubmetricLabel(definition: SubmetricDefinitionForSelector): string {
  if (definition.category) {
    return `${definition.category} - ${definition.metricName || "Untitled"}`;
  }
  return definition.metricName || "Untitled";
}

export function SubmetricSelector({
  submetricDefinitions,
  value,
  onValueChange,
  placeholder = "Select submetric",
  disabled = false,
  className,
  triggerWidth,
  triggerMaxWidth,
  popoverWidth,
  showAllOption = false,
  showNoneOption = false,
  isLoading = false,
}: SubmetricSelectorProps) {
  const [open, setOpen] = React.useState(false);

  // Find the selected definition
  const selectedDefinition = React.useMemo(
    () => submetricDefinitions.find((def) => def.id === value),
    [submetricDefinitions, value],
  );

  // Get display text for trigger
  const displayText = React.useMemo(() => {
    if (isLoading) return "Loading...";
    if (!value) {
      return showAllOption
        ? "All submetrics"
        : showNoneOption
          ? "None"
          : placeholder;
    }
    if (!selectedDefinition) {
      // Value exists but definition not found - show placeholder or "Unknown"
      // This can happen when the selected submetric is filtered out or deleted
      return showAllOption ? "All submetrics" : placeholder;
    }
    return getSubmetricLabel(selectedDefinition);
  }, [
    value,
    selectedDefinition,
    showAllOption,
    showNoneOption,
    placeholder,
    isLoading,
  ]);

  const handleSelect = React.useCallback(
    (definitionId: string | null) => {
      onValueChange(definitionId);
      setOpen(false);
    },
    [onValueChange],
  );

  return (
    <Popover open={open} onOpenChange={setOpen} modal={true}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled || isLoading}
          className={cn(
            "h-9 justify-between font-normal overflow-hidden",
            !value && "text-muted-foreground",
            triggerWidth,
            triggerMaxWidth,
            className,
          )}
          style={{
            maxWidth: triggerMaxWidth
              ? undefined
              : "min(calc(40vw - 1rem), 200px)",
          }}
        >
          <span className="truncate overflow-hidden text-ellipsis whitespace-nowrap block flex-1 text-left text-sm">
            {displayText}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="p-0"
        align="start"
        style={{
          width: popoverWidth || "min(calc(80vw - 1rem), 400px)",
          minWidth: "var(--radix-popover-trigger-width)",
        }}
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <Command className="overflow-hidden" shouldFilter={true}>
          <CommandInput placeholder="Search submetrics..." />
          <CommandList className="max-h-[300px] overflow-y-auto">
            <CommandEmpty>No submetric found.</CommandEmpty>
            <CommandGroup>
              {/* "All submetrics" option for filter mode */}
              {showAllOption && (
                <CommandItem
                  value="all"
                  onSelect={() => handleSelect(null)}
                  className="overflow-hidden"
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4 shrink-0",
                      !value ? "opacity-100" : "opacity-0",
                    )}
                  />
                  <span className="text-muted-foreground truncate block flex-1 min-w-0">
                    All submetrics
                  </span>
                </CommandItem>
              )}

              {/* "None" option for dialog/form mode */}
              {showNoneOption && (
                <CommandItem
                  value="none"
                  onSelect={() => handleSelect(null)}
                  className="overflow-hidden"
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4 shrink-0",
                      !value ? "opacity-100" : "opacity-0",
                    )}
                  />
                  <span className="text-muted-foreground truncate block flex-1 min-w-0">
                    None
                  </span>
                </CommandItem>
              )}

              {/* Loading state */}
              {isLoading && (
                <CommandItem
                  value="loading"
                  disabled
                  className="overflow-hidden"
                >
                  <span className="text-muted-foreground truncate block flex-1 min-w-0">
                    Loading...
                  </span>
                </CommandItem>
              )}

              {/* No submetrics message */}
              {!isLoading && submetricDefinitions.length === 0 && (
                <CommandItem
                  value="no-submetrics"
                  disabled
                  className="overflow-hidden"
                >
                  <span className="text-muted-foreground truncate block flex-1 min-w-0">
                    No submetrics
                  </span>
                </CommandItem>
              )}

              {/* Submetric definitions list */}
              {!isLoading &&
                submetricDefinitions.map((definition) => {
                  const label = getSubmetricLabel(definition);
                  return (
                    <CommandItem
                      key={definition.id}
                      value={label}
                      onSelect={() => handleSelect(definition.id)}
                      className="overflow-hidden"
                    >
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4 shrink-0",
                          value === definition.id ? "opacity-100" : "opacity-0",
                        )}
                      />
                      <span className="truncate block flex-1 min-w-0">
                        {label}
                      </span>
                    </CommandItem>
                  );
                })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
