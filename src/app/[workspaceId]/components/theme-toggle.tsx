"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { memo, useCallback, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { handleCloseAutoFocus } from "@/lib/ui/focus";
import {
  measureThemeChangePerformance,
  supportsViewTransitions,
} from "@/lib/ui/theme";

export const ThemeToggle = memo(function ThemeToggle() {
  const { setTheme } = useTheme();
  const [open, setOpen] = useState(false);

  const handleThemeChange = useCallback(
    (theme: string) => {
      measureThemeChangePerformance(() => {
        // Use View Transitions API if available for smooth theme changes
        if (supportsViewTransitions()) {
          (document as any).startViewTransition(() => {
            setTheme(theme);
          });
        } else {
          // No need to disable transitions - CSS handles smooth color changes
          setTheme(theme);
        }
      });
      // Close dropdown
      setOpen(false);
    },
    [setTheme],
  );

  // Handle dropdown state changes
  const handleOpenChange = useCallback((newOpen: boolean) => {
    setOpen(newOpen);
  }, []);

  return (
    <DropdownMenu open={open} onOpenChange={handleOpenChange} modal={false}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8">
          <Sun className="h-4 w-4 rotate-0 scale-100 transition-[transform,opacity] duration-200 dark:-rotate-90 dark:scale-0" />
          <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-[transform,opacity] duration-200 dark:rotate-0 dark:scale-100" />
          <span className="sr-only">Toggle theme</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="animate-in fade-in-0 zoom-in-95 duration-150"
        onCloseAutoFocus={handleCloseAutoFocus}
      >
        <DropdownMenuItem onClick={() => handleThemeChange("light")}>
          Light
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleThemeChange("dark")}>
          Dark
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleThemeChange("system")}>
          System
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
});
