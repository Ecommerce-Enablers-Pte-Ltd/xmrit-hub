"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useUpdateSlide } from "@/lib/api/slides";
import { toast } from "sonner";
import type { SlideWithMetrics } from "@/types/db/slide";

interface EditSlideNameDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  slide: SlideWithMetrics;
  workspaceId: string;
}

export function EditSlideNameDialog({
  open,
  onOpenChange,
  slide,
  workspaceId,
}: EditSlideNameDialogProps) {
  const [titleValue, setTitleValue] = useState(slide.title);
  const updateSlide = useUpdateSlide();

  // Sync title value when dialog opens
  useEffect(() => {
    if (open) {
      setTitleValue(slide.title);
    }
  }, [open, slide.title]);

  // Handle title update
  const handleSaveTitle = async () => {
    const trimmedTitle = titleValue.trim();

    // If title hasn't changed or is empty, just close dialog
    if (!trimmedTitle || trimmedTitle === slide.title) {
      onOpenChange(false);
      return;
    }

    try {
      await updateSlide.mutateAsync({
        slideId: slide.id,
        workspaceId,
        data: { title: trimmedTitle },
      });

      toast.success("Slide title updated");
      onOpenChange(false);
    } catch (error) {
      toast.error("Failed to update slide title");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
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
            onClick={() => onOpenChange(false)}
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
  );
}

