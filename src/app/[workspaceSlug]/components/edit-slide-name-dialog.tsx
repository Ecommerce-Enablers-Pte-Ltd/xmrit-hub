"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ZodError } from "zod";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { workspaceKeys } from "@/lib/api";
import { useUpdateSlide } from "@/lib/api/slides";
import { getErrorMessage } from "@/lib/utils";
import { updateSlideTitleSchema } from "@/lib/validations/slide";

// Minimal slide type needed for editing
interface SlideForEdit {
  id: string;
  title: string;
}

interface EditSlideNameDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  slide: SlideForEdit;
  workspaceId: string;
}

export function EditSlideNameDialog({
  open,
  onOpenChange,
  slide,
  workspaceId,
}: EditSlideNameDialogProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
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
    // Validate with Zod before sending to backend
    try {
      const validatedData = updateSlideTitleSchema.parse({
        title: titleValue,
      });

      // If title hasn't changed, just close dialog
      if (validatedData.title === slide.title) {
        onOpenChange(false);
        return;
      }

      await updateSlide.mutateAsync({
        slideId: slide.id,
        workspaceId,
        data: validatedData,
      });

      toast.success("Slide title updated");
      onOpenChange(false);

      // Invalidate workspace cache so sidebar updates
      queryClient.invalidateQueries({
        queryKey: workspaceKeys.detail(workspaceId),
      });
      queryClient.invalidateQueries({
        queryKey: workspaceKeys.slidesList(workspaceId),
      });

      // Refresh the page to get updated data from server
      router.refresh();
    } catch (error) {
      if (error instanceof ZodError) {
        // Show validation errors to user
        const firstError = error.issues[0];
        toast.error("Validation Error", {
          description: firstError.message,
        });
        return;
      }

      console.error("Error updating slide title:", error);
      toast.error(getErrorMessage(error, "Failed to update slide title"));
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
            className="hidden sm:inline-flex"
          >
            Cancel
          </Button>
          <Button onClick={handleSaveTitle} disabled={updateSlide.isPending}>
            {updateSlide.isPending ? "Saving..." : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
