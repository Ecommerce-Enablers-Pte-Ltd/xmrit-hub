"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { SlideContainer } from "./slide-container";
import { useIsMobile } from "@/hooks/use-mobile";
import type { SlideWithMetrics } from "@/types/db/slide";
import type { Workspace } from "@/types/db/workspace";
import { MonitorIcon } from "lucide-react";

interface SlideClientProps {
  slide: SlideWithMetrics;
  workspace: Workspace;
}

export function SlideClient({ slide, workspace }: SlideClientProps) {
  const router = useRouter();
  const isMobile = useIsMobile();

  // Verify slide belongs to the workspace
  useEffect(() => {
    if (slide && workspace && slide.workspaceId !== workspace.id) {
      router.push("/404");
    }
  }, [slide, workspace, router]);

  // Show message on mobile devices
  if (isMobile) {
    return (
      <div className="flex min-h-[80vh] items-center justify-center p-4">
        <div className="text-center max-w-md">
          <MonitorIcon className="mx-auto h-16 w-16 text-muted-foreground mb-4" />
          <h2 className="text-2xl font-semibold mb-2">Desktop View Required</h2>
          <p className="text-muted-foreground">
            Slide presentations are best viewed on a tablet or desktop for
            optimal experience. Please switch to a larger screen to view this
            content.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">{slide.title}</h1>
            {slide.description && (
              <p className="text-muted-foreground mt-2">{slide.description}</p>
            )}
            {slide.slideDate && (
              <p className="text-sm text-muted-foreground mt-1">
                Date: {new Date(slide.slideDate).toLocaleDateString("en-CA")}
              </p>
            )}
          </div>
        </div>
      </div>

      <SlideContainer metrics={slide.metrics} />
    </div>
  );
}
