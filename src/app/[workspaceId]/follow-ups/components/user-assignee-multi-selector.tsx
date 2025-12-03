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
}

export function UserAssigneeMultiSelector({
  users,
  value = [],
  onValueChange,
  placeholder = "Assign to...",
  className,
  disabled = false,
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

  const toggleSelection = (userId: string) => {
    const newValue = value.includes(userId)
      ? value.filter((id) => id !== userId)
      : [...value, userId];
    onValueChange(newValue);
  };

  const removeSelection = (userId: string, e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
    }
    onValueChange(value.filter((id) => id !== userId));
  };

  // Define maxShownItems before using visibleItems
  const maxShownItems = 2;
  const visibleUsers = expanded
    ? selectedUsers
    : selectedUsers.slice(0, maxShownItems);
  const hiddenCount = selectedUsers.length - visibleUsers.length;

  return (
    <Popover open={open} onOpenChange={setOpen} modal={true}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            "h-auto min-h-9 w-full justify-between hover:bg-transparent font-normal",
            selectedUsers.length === 0 && "text-muted-foreground",
            className,
          )}
        >
          <div className="flex flex-wrap items-center gap-1 pr-2.5">
            {selectedUsers.length > 0 ? (
              <>
                {visibleUsers.map((user) => (
                  <Badge
                    key={user.id}
                    variant="outline"
                    className="rounded-sm px-1.5 py-0.5 gap-1"
                  >
                    <Avatar className="h-4 w-4 shrink-0">
                      <AvatarImage src={user.image || undefined} />
                      <AvatarFallback className="text-[8px]">
                        {getInitials(user.name)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-xs">{user.name || user.email}</span>
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
                  </Badge>
                ))}
                {hiddenCount > 0 || expanded ? (
                  <Badge
                    variant="outline"
                    onClick={(e) => {
                      e.stopPropagation();
                      setExpanded((prev) => !prev);
                    }}
                    className="rounded-sm cursor-pointer hover:bg-accent"
                  >
                    {expanded ? "Show Less" : `+${hiddenCount} more`}
                  </Badge>
                ) : null}
              </>
            ) : (
              <span>{placeholder}</span>
            )}
          </div>
          <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[300px] p-0" align="start" sideOffset={4}>
        <Command>
          <CommandInput placeholder="Search users..." className="h-9" />
          <CommandList className="max-h-[300px]">
            <CommandEmpty>No users found.</CommandEmpty>
            <CommandGroup>
              {Array.isArray(users) &&
                users.map((user) => {
                  const isSelected = value.includes(user.id);
                  return (
                    <CommandItem
                      key={user.id}
                      value={`${user.name || ""} ${user.email || ""}`}
                      keywords={[user.name || "", user.email || ""]}
                      onSelect={() => toggleSelection(user.id)}
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
                      {isSelected && <Check className="h-4 w-4" />}
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
