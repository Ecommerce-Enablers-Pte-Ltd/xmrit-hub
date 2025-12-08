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
}

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
}: UserAssigneeMultiSelectorProps) {
  const [open, setOpen] = React.useState(false);
  const [expanded, setExpanded] = React.useState(false);

  const selectedUsers = React.useMemo(
    () =>
      Array.isArray(users)
        ? users.filter((user) => value.includes(user.id))
        : [],
    [users, value],
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
    [onUnassignedChange, unassigned, value, onValueChange],
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
    [onValueChange, value],
  );

  // Define maxShownItems before using visibleItems
  const maxShownItems = 2;
  const visibleUsers = React.useMemo(
    () => (expanded ? selectedUsers : selectedUsers.slice(0, maxShownItems)),
    [expanded, selectedUsers],
  );
  const hiddenCount = selectedUsers.length - visibleUsers.length;

  // Filter out current user from the main list if showMyTasksOption is enabled
  const filteredUsers = React.useMemo(
    () =>
      showMyTasksOption && currentUserId
        ? users.filter((user) => user.id !== currentUserId)
        : users,
    [showMyTasksOption, currentUserId, users],
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
              className="rounded-sm px-1.5 py-0.5 gap-1 shrink-0 max-w-[90px]"
            >
              <Avatar className="h-4 w-4 shrink-0">
                <AvatarImage src={user.image || undefined} />
                <AvatarFallback className="text-[8px]">
                  {getInitials(user.name)}
                </AvatarFallback>
              </Avatar>
              <span className="text-xs truncate">
                {user.name?.split(" ")[0] || user.email}
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
          {hiddenCount > 0 || expanded ? (
            <Badge
              variant="outline"
              onClick={(e) => {
                e.stopPropagation();
                setExpanded((prev) => !prev);
              }}
              className="rounded-sm cursor-pointer hover:bg-accent shrink-0"
            >
              {expanded ? "Show Less" : `+${hiddenCount} more`}
            </Badge>
          ) : null}
        </>
      );
    }

    return <span className="text-sm">{placeholder}</span>;
  };

  return (
    <Popover open={open} onOpenChange={setOpen} modal={true}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            "h-auto min-h-9 justify-between hover:bg-transparent font-normal",
            selectedUsers.length === 0 &&
              !unassigned &&
              "text-muted-foreground",
            triggerWidth ? triggerWidth : "w-full",
            className,
          )}
        >
          <div className="flex flex-wrap items-center gap-1 pr-2.5 overflow-hidden min-w-0">
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
