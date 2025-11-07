"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { SlideContainer } from "./slide-container";
import { useIsMobile } from "@/hooks/use-mobile";
import type { SlideWithMetrics } from "@/types/db/slide";
import type { Workspace } from "@/types/db/workspace";
import { MonitorIcon, Pencil } from "lucide-react";
import { useSlide, useUpdateSlide, slideKeys } from "@/lib/api/slides";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface SlideClientProps {
  slide: SlideWithMetrics;
  workspace: Workspace;
}

export function SlideClient({
  slide: initialSlide,
  workspace,
}: SlideClientProps) {
  const router = useRouter();
  const isMobile = useIsMobile();
  const queryClient = useQueryClient();
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [titleValue, setTitleValue] = useState(initialSlide.title);
  const updateSlide = useUpdateSlide();

  // Initialize React Query cache with server data on mount
  useEffect(() => {
    queryClient.setQueryData(slideKeys.detail(initialSlide.id), initialSlide);
  }, [queryClient, initialSlide]);

  // Subscribe to React Query cache for live updates
  const { slide } = useSlide(initialSlide.id);

  // Use the cached slide data if available, otherwise fall back to initial prop
  const currentSlide = slide || initialSlide;

  // Verify slide belongs to the workspace
  useEffect(() => {
    if (
      currentSlide &&
      workspace &&
      currentSlide.workspaceId !== workspace.id
    ) {
      router.push("/404");
    }
  }, [currentSlide, workspace, router]);

  // Sync title value when dialog opens
  useEffect(() => {
    if (isEditDialogOpen) {
      setTitleValue(currentSlide.title);
    }
  }, [isEditDialogOpen, currentSlide.title]);

  // Handle title update
  const handleSaveTitle = async () => {
    const trimmedTitle = titleValue.trim();

    // If title hasn't changed or is empty, just close dialog
    if (!trimmedTitle || trimmedTitle === currentSlide.title) {
      setIsEditDialogOpen(false);
      return;
    }

    try {
      await updateSlide.mutateAsync({
        slideId: currentSlide.id,
        workspaceId: workspace.id,
        data: { title: trimmedTitle },
      });

      toast.success("Slide title updated");
      setIsEditDialogOpen(false);
    } catch (error) {
      toast.error("Failed to update slide title");
    }
  };

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
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold">{currentSlide.title}</h1>
              <Dialog
                open={isEditDialogOpen}
                onOpenChange={setIsEditDialogOpen}
              >
                <DialogTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 opacity-60 hover:opacity-100"
                    disabled={updateSlide.isPending}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Edit Slide Title</DialogTitle>
                    <DialogDescription>
                      Update the title for this slide.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                      <Label htmlFor="title">Title</Label>
                      <Input
                        id="title"
                        value={titleValue}
                        onChange={(e) => setTitleValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            handleSaveTitle();
                          }
                        }}
                        placeholder="Enter slide title"
                        disabled={updateSlide.isPending}
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button
                      variant="outline"
                      onClick={() => setIsEditDialogOpen(false)}
                      disabled={updateSlide.isPending}
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={handleSaveTitle}
                      disabled={updateSlide.isPending}
                    >
                      {updateSlide.isPending ? "Saving..." : "Save"}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
            {currentSlide.description && (
              <p className="text-muted-foreground mt-2">
                {currentSlide.description}
              </p>
            )}
            {currentSlide.slideDate && (
              <p className="text-sm text-muted-foreground mt-1">
                Date:{" "}
                {new Date(currentSlide.slideDate).toLocaleDateString("en-CA")}
              </p>
            )}
          </div>
        </div>
      </div>

      <SlideContainer metrics={currentSlide.metrics} />
    </div>
  );
}
