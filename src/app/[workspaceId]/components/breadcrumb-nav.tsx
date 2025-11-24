"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import * as React from "react";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { useIsMobile } from "@/hooks/use-mobile";
import type { Slide } from "@/types/db/slide";
import type { Workspace } from "@/types/db/workspace";

interface BreadcrumbNavProps {
  workspace: Workspace;
  slides: Slide[]; // Changed from SlideWithMetrics[] to Slide[] for lightweight loading
}

export function BreadcrumbNav({ workspace, slides }: BreadcrumbNavProps) {
  const pathname = usePathname();
  const isMobile = useIsMobile();

  // Parse the current path to determine breadcrumb items
  const pathSegments = pathname.split("/").filter(Boolean);

  // Base breadcrumb items - start with non-clickable "Workspace"
  let breadcrumbItems = [
    {
      label: "Workspace",
      href: null, // null means not clickable
      isClickable: false,
    },
    {
      label: workspace.name,
      href: `/${workspace.id}`,
      isClickable: true,
    },
  ];

  // Add follow-ups breadcrumb if we're on the follow-ups page
  if (pathSegments.length >= 2 && pathSegments[1] === "follow-ups") {
    breadcrumbItems.push({
      label: "Follow-ups",
      href: `/${workspace.id}/follow-ups`,
      isClickable: true,
    });
  }

  // Add slide-specific breadcrumb if we're on a slide page
  if (pathSegments.length >= 3 && pathSegments[1] === "slide") {
    const slideId = pathSegments[2];
    const slide = slides.find((s) => s.id === slideId);

    if (slide) {
      breadcrumbItems.push({
        label: slide.title,
        href: `/${workspace.id}/slide/${slideId}`,
        isClickable: true,
      });
    }
  }

  // Filter out "Workspace" item on mobile
  if (isMobile) {
    breadcrumbItems = breadcrumbItems.filter(
      (item) => item.label !== "Workspace",
    );
  }

  // Determine max width based on number of breadcrumb items
  const maxWidthClass =
    breadcrumbItems.length === 1 ? "max-w-[200px]" : "max-w-[100px]";

  return (
    <Breadcrumb>
      <BreadcrumbList>
        {breadcrumbItems.map((item, index) => (
          <React.Fragment key={`${item.label}-${index}`}>
            <BreadcrumbItem className={`${maxWidthClass} sm:max-w-none`}>
              {index === breadcrumbItems.length - 1 ? (
                <BreadcrumbPage className="overflow-hidden text-ellipsis whitespace-nowrap block">
                  {item.label}
                </BreadcrumbPage>
              ) : item.isClickable && item.href ? (
                <BreadcrumbLink asChild>
                  <Link
                    href={item.href}
                    className="overflow-hidden text-ellipsis whitespace-nowrap block"
                  >
                    {item.label}
                  </Link>
                </BreadcrumbLink>
              ) : (
                <span className="text-muted-foreground overflow-hidden text-ellipsis whitespace-nowrap block">
                  {item.label}
                </span>
              )}
            </BreadcrumbItem>
            {index < breadcrumbItems.length - 1 && <BreadcrumbSeparator />}
          </React.Fragment>
        ))}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
