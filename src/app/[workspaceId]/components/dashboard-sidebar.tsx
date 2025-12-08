"use client";

import {
  ExternalLink,
  Github,
  Home,
  ListTodo,
  type LucideIcon,
  Settings,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { usePrefetchSlide } from "@/lib/api";
import type { Slide } from "@/types/db/slide";
import type { Workspace } from "@/types/db/workspace";
import { ThemeToggle } from "./theme-toggle";
import { WorkspaceSelector } from "./workspace-selector";

interface DashboardSidebarProps {
  workspaces: Workspace[];
  currentWorkspace: Workspace;
  slides: Slide[]; // Changed from SlideWithMetrics[] to Slide[] for lightweight loading
  onWorkspaceChange: (workspace: Workspace) => void;
  onCreateWorkspace: () => void;
  onOpenSettings: () => void;
}

interface NavigationItem {
  icon: LucideIcon;
  label: string;
  href?: string;
  onClick?: () => void;
}

export function DashboardSidebar({
  workspaces,
  currentWorkspace,
  slides,
  onWorkspaceChange,
  onCreateWorkspace,
  onOpenSettings,
}: DashboardSidebarProps) {
  const pathname = usePathname();
  const prefetchSlide = usePrefetchSlide();
  const { isMobile, setOpenMobile } = useSidebar();

  // Close sidebar on mobile when navigating
  const handleNavClick = () => {
    if (isMobile) {
      setOpenMobile(false);
    }
  };

  const navigationItems: NavigationItem[] = [
    {
      icon: Home,
      label: "Home",
      href: `/${currentWorkspace.id}`,
    },
    {
      icon: ListTodo,
      label: "Follow-ups",
      href: `/${currentWorkspace.id}/follow-ups`,
    },
    {
      icon: Settings,
      label: "Settings",
      onClick: onOpenSettings,
    },
  ];

  return (
    <Sidebar>
      <SidebarHeader className="p-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Xmrit Hub</h2>
          <ThemeToggle />
        </div>
        <WorkspaceSelector
          workspaces={workspaces}
          currentWorkspace={currentWorkspace}
          onWorkspaceChange={onWorkspaceChange}
          onCreateWorkspace={onCreateWorkspace}
        />
      </SidebarHeader>
      <SidebarContent>
        <SidebarMenu>
          {navigationItems.map((item) => (
            <SidebarMenuItem key={item.label} className="px-3">
              <SidebarMenuButton
                asChild={!!item.href}
                isActive={item.href ? pathname === item.href : false}
                onClick={
                  !item.href
                    ? () => {
                        handleNavClick();
                        item.onClick?.();
                      }
                    : undefined
                }
                className="cursor-pointer"
              >
                {item.href ? (
                  <Link href={item.href} onClick={handleNavClick}>
                    <item.icon className="h-4 w-4" />
                    <span>{item.label}</span>
                  </Link>
                ) : (
                  <>
                    <item.icon className="h-4 w-4" />
                    <span>{item.label}</span>
                  </>
                )}
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>

        <Separator className="my-2" />

        <div className="px-3">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-muted-foreground">
              Slides
            </h3>
          </div>
        </div>

        <ScrollArea className="flex-1 px-3">
          <SidebarMenu>
            {slides.map((slide) => (
              <SidebarMenuItem key={slide.id} className="group/item">
                <SidebarMenuButton
                  asChild
                  isActive={pathname.includes(`/slide/${slide.id}`)}
                >
                  <Link
                    href={`/${currentWorkspace.id}/slide/${slide.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    onMouseEnter={() => prefetchSlide(slide.id)}
                    className="flex items-center gap-2"
                  >
                    <span className="truncate flex-1">{slide.title}</span>
                    <ExternalLink className="h-3 w-3 shrink-0 opacity-0 group-hover/item:opacity-50 transition-opacity" />
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </ScrollArea>
      </SidebarContent>
      <SidebarFooter className="p-3">
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <span>© 2025 by</span>
          <a
            href="https://github.com/ng-jayson"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 hover:text-foreground transition-colors"
          >
            <Github className="h-3 w-3" />
            <span>ng-jayson</span>
          </a>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
