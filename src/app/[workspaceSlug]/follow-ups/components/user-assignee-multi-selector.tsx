"use client";

import { Check, ChevronsUpDown, XIcon } from "lucide-react";
import * as React from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
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
import { getInitials } from "@/lib/formatting";
import { cn } from "@/lib/utils";
import type { User } from "@/types/db/user";

interface UserAssigneeMultiSelectorProps {
  users: User[];
  value?: string[];
  onValueChange: (value: string[]) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  // Filter mode props - for use in filter contexts
  showUnassignedOption?: boolean;
  unassigned?: boolean;
  onUnassignedChange?: (unassigned: boolean) => void;
  showMyTasksOption?: boolean;
  currentUserId?: string;
  currentUserName?: string;
  currentUserEmail?: string;
  currentUserImage?: string;
  /** Width of the trigger button */
  triggerWidth?: string;
  /** Width of the popover content */
  popoverWidth?: string;
  /** Whether to show remove buttons on badges */
  showRemoveButtons?: boolean;
  /** Maximum number of items to show before "+n more" (default: 3) */
  maxShownItems?: number;
  /** Stack mode: allows wrapping and shows full names (for dialogs/forms) */
  stackMode?: boolean;
}

// Estimated width for each badge (avatar + name + gap) in pixels
const BADGE_WIDTH_ESTIMATE = 85;
// Estimated width for "+n more" badge in pixels
const MORE_BADGE_WIDTH = 65;
// Minimum padding/margin for chevron icon and spacing
const TRIGGER_PADDING = 40;

export function UserAssigneeMultiSelector({
  users,
  value = [],
  onValueChange,
  placeholder = "Assign to...",
  className,
  disabled = false,
  showUnassignedOption = false,
  unassigned = false,
  onUnassignedChange,
  showMyTasksOption = false,
  currentUserId,
  currentUserName,
  currentUserEmail,
  currentUserImage,
  triggerWidth,
  popoverWidth = "300px",
  showRemoveButtons = true,
  maxShownItems = 3,
  stackMode = false,
}: UserAssigneeMultiSelectorProps) {
  const [open, setOpen] = React.useState(false);
  const [containerWidth, setContainerWidth] = React.useState(0);
  const triggerRef = React.useRef<HTMLButtonElement>(null);

  // Measure container width on mount and resize
  React.useEffect(() => {
    const element = triggerRef.current;
    if (!element) return;

    const updateWidth = () => {
      setContainerWidth(element.offsetWidth);
    };

    updateWidth();

    const resizeObserver = new ResizeObserver(updateWidth);
    resizeObserver.observe(element);

    return () => resizeObserver.disconnect();
  }, []);

  const selectedUsers = React.useMemo(
    () =>
      Array.isArray(users)
        ? users.filter((user) => value.includes(user.id))
        : [],
    [users, value]
  );

  const toggleSelection = React.useCallback(
    (userId: string) => {
      // If selecting a user, clear unassigned filter
      if (onUnassignedChange && unassigned) {
        onUnassignedChange(false);
      }
      const newValue = value.includes(userId)
        ? value.filter((id) => id !== userId)
        : [...value, userId];
      onValueChange(newValue);
    },
    [onUnassignedChange, unassigned, value, onValueChange]
  );

  const handleUnassignedToggle = React.useCallback(() => {
    if (onUnassignedChange) {
      const newUnassigned = !unassigned;
      onUnassignedChange(newUnassigned);
      // Clear selected users when selecting unassigned
      if (newUnassigned && value.length > 0) {
        onValueChange([]);
      }
    }
  }, [onUnassignedChange, unassigned, value.length, onValueChange]);

  const removeSelection = React.useCallback(
    (userId: string, e?: React.MouseEvent) => {
      if (e) {
        e.stopPropagation();
      }
      onValueChange(value.filter((id) => id !== userId));
    },
    [onValueChange, value]
  );

  // Calculate max items that can fit based on container width (only used when not in stackMode)
  const calculatedMaxItems = React.useMemo(() => {
    if (stackMode) return selectedUsers.length; // In stack mode, show all
    if (containerWidth === 0) return maxShownItems;

    const availableWidth = containerWidth - TRIGGER_PADDING - MORE_BADGE_WIDTH;
    const fittingItems = Math.floor(availableWidth / BADGE_WIDTH_ESTIMATE);

    // Use the smaller of calculated items or maxShownItems prop
    return Math.max(1, Math.min(fittingItems, maxShownItems));
  }, [containerWidth, maxShownItems, stackMode, selectedUsers.length]);

  // Show calculatedMaxItems - 1 to leave room for the "+n more" badge (not in stackMode)
  // Always show at least 1 user when there are selections
  const actualMaxShown = React.useMemo(() => {
    if (stackMode) return selectedUsers.length;
    if (selectedUsers.length > calculatedMaxItems) {
      // Leave room for "+n more" badge, but always show at least 1
      return Math.max(1, calculatedMaxItems - 1);
    }
    return calculatedMaxItems;
  }, [stackMode, selectedUsers.length, calculatedMaxItems]);

  // In stackMode: show all users
  // In non-stackMode: show limited users based on available space
  const visibleUsers = React.useMemo(
    () => (stackMode ? selectedUsers : selectedUsers.slice(0, actualMaxShown)),
    [stackMode, selectedUsers, actualMaxShown]
  );
  const hiddenCount = selectedUsers.length - visibleUsers.length;

  // Filter out current user from the main list if showMyTasksOption is enabled
  const filteredUsers = React.useMemo(
    () =>
      showMyTasksOption && currentUserId
        ? users.filter((user) => user.id !== currentUserId)
        : users,
    [showMyTasksOption, currentUserId, users]
  );

  // Render trigger content based on selection state
  const renderTriggerContent = () => {
    if (unassigned) {
      return (
        <Badge
          variant="outline"
          className="rounded-sm px-1.5 py-0.5 gap-1 shrink-0"
        >
          <span className="text-xs">Unassigned</span>
        </Badge>
      );
    }

    if (selectedUsers.length > 0) {
      return (
        <>
          {visibleUsers.map((user) => (
            <Badge
              key={user.id}
              variant="outline"
              className={cn(
                "rounded-sm px-1.5 py-0.5 gap-1 shrink-0",
                !stackMode && "max-w-[90px]"
              )}
            >
              <Avatar className="h-4 w-4 shrink-0">
                <AvatarImage src={user.image || undefined} />
                <AvatarFallback className="text-[8px]">
                  {getInitials(user.name)}
                </AvatarFallback>
              </Avatar>
              <span className={cn("text-xs", !stackMode && "truncate")}>
                {stackMode
                  ? user.name || user.email
                  : user.name?.split(" ")[0] || user.email}
              </span>
              {showRemoveButtons && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-3.5 w-3.5 p-0 hover:bg-accent rounded-sm ml-0.5"
                  onClick={(e) => {
                    e.stopPropagation();
                    removeSelection(user.id);
                  }}
                  asChild
                >
                  <span>
                    <XIcon className="h-3 w-3" />
                  </span>
                </Button>
              )}
            </Badge>
          ))}
          {/* In non-stackMode, show a static "+n more" badge (not clickable) */}
          {!stackMode && hiddenCount > 0 && (
            <Badge
              variant="outline"
              className="rounded-sm shrink-0 text-muted-foreground"
            >
              +{hiddenCount} more
            </Badge>
          )}
        </>
      );
    }

    return <span className="text-sm">{placeholder}</span>;
  };

  return (
    <Popover open={open} onOpenChange={setOpen} modal={true}>
      <PopoverTrigger asChild>
        <Button
          ref={triggerRef}
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            "justify-between hover:bg-transparent font-normal",
            // stackMode: auto height for wrapping; non-stackMode: fixed h-9 to match selects
            stackMode ? "h-auto min-h-9" : "h-9",
            selectedUsers.length === 0 &&
              !unassigned &&
              "text-muted-foreground",
            triggerWidth ? triggerWidth : "w-full",
            className
          )}
        >
          <div
            className={cn(
              "flex items-center gap-1 pr-2.5 overflow-hidden min-w-0",
              stackMode ? "flex-wrap" : "flex-wrap sm:flex-nowrap"
            )}
          >
            {renderTriggerContent()}
          </div>
          <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="p-0"
        style={{ width: popoverWidth }}
        align="start"
        sideOffset={4}
      >
        <Command>
          <CommandInput placeholder="Search users..." className="h-9" />
          <CommandList className="max-h-[300px]">
            <CommandEmpty>No users found.</CommandEmpty>
            <CommandGroup>
              {/* Unassigned option */}
              {showUnassignedOption && (
                <CommandItem
                  onSelect={handleUnassignedToggle}
                  className="cursor-pointer"
                >
                  <div className="flex items-center gap-2 flex-1">
                    <div className="h-6 w-6 rounded-full bg-muted flex items-center justify-center">
                      <span className="text-xs text-muted-foreground">—</span>
                    </div>
                    <span className="text-sm font-medium">Unassigned</span>
                  </div>
                  {unassigned && <Check className="h-4 w-4 ml-auto" />}
                </CommandItem>
              )}

              {/* My Tasks option */}
              {showMyTasksOption && currentUserId && (
                <CommandItem
                  onSelect={() => toggleSelection(currentUserId)}
                  className="cursor-pointer"
                >
                  <div className="flex items-center gap-2 flex-1">
                    <Avatar className="h-6 w-6">
                      <AvatarImage src={currentUserImage || undefined} />
                      <AvatarFallback className="text-xs">
                        {getInitials(currentUserName)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col">
                      <span className="text-sm font-medium">My Tasks</span>
                      <span className="text-xs text-muted-foreground">
                        {currentUserName || currentUserEmail}
                      </span>
                    </div>
                  </div>
                  {value.includes(currentUserId) && (
                    <Check className="h-4 w-4 ml-auto" />
                  )}
                </CommandItem>
              )}

              {/* Regular users list */}
              {Array.isArray(filteredUsers) &&
                filteredUsers.map((user) => {
                  const isSelected = value.includes(user.id);
                  return (
                    <CommandItem
                      key={user.id}
                      value={`${user.name || ""} ${user.email || ""}`}
                      keywords={[user.name || "", user.email || ""]}
                      onSelect={() => toggleSelection(user.id)}
                      className="cursor-pointer"
                    >
                      <div className="flex items-center gap-2 flex-1">
                        <Avatar className="h-6 w-6">
                          <AvatarImage src={user.image || undefined} />
                          <AvatarFallback className="text-xs">
                            {getInitials(user.name)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex flex-col">
                          <span className="text-sm font-medium">
                            {user.name || "Unnamed"}
                          </span>
                          {user.email && (
                            <span className="text-xs text-muted-foreground">
                              {user.email}
                            </span>
                          )}
                        </div>
                      </div>
                      {isSelected && <Check className="h-4 w-4 ml-auto" />}
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
