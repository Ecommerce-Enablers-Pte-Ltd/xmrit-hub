"use client";

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
import { Textarea } from "@/components/ui/textarea";
import { useUpdateMetricDefinition } from "@/lib/api/metric-definitions";
import { getErrorMessage } from "@/lib/utils";
import { updateMetricDefinitionSchema } from "@/lib/validations/metric";
import type { MetricWithSubmetrics } from "@/types/db/metric";

interface EditMetricDefinitionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  metric: MetricWithSubmetrics;
}

export function EditMetricDefinitionDialog({
  open,
  onOpenChange,
  metric,
}: EditMetricDefinitionDialogProps) {
  const [definitionValue, setDefinitionValue] = useState(
    metric.definition?.definition || "",
  );
  const updateMetricDefinition = useUpdateMetricDefinition();

  // Check if definition has changed
  const hasChanges = definitionValue !== (metric.definition?.definition || "");

  // Sync definition value when dialog opens
  useEffect(() => {
    if (open) {
      setDefinitionValue(metric.definition?.definition || "");
    }
  }, [open, metric.definition?.definition]);

  // Handle definition update
  const handleSaveDefinition = async () => {
    // Check if metric has a definition
    if (!metric.definitionId) {
      toast.error("Metric definition not found", {
        description:
          "Please run the backfill script or re-ingest this metric to create its definition.",
      });
      return;
    }

    // Validate with Zod before sending to backend
    try {
      const validatedData = updateMetricDefinitionSchema.parse({
        definition: definitionValue || null,
      });

      // If definition hasn't changed, just close dialog
      if (validatedData.definition === metric.definition?.definition) {
        onOpenChange(false);
        return;
      }

      await updateMetricDefinition.mutateAsync({
        definitionId: metric.definitionId,
        data: validatedData,
      });

      toast.success("Metric definition updated");
      onOpenChange(false);
    } catch (error) {
      if (error instanceof ZodError) {
        // Show validation errors to user
        const firstError = error.issues[0];
        toast.error("Validation Error", {
          description: firstError.message,
        });
        return;
      }

      console.error("Error updating metric definition:", error);
      toast.error(getErrorMessage(error, "Failed to update metric definition"));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Edit Metric Definition</DialogTitle>
          <DialogDescription>
            Update the definition for <strong>{metric.name}</strong>
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Textarea
              id="definition"
              value={definitionValue}
              onChange={(e) => setDefinitionValue(e.target.value)}
              placeholder="Enter metric definition (optional)"
              disabled={updateMetricDefinition.isPending}
              rows={8}
              className="resize-none"
            />
            <p className="text-xs text-muted-foreground">
              {definitionValue.length} / 5000 characters
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={updateMetricDefinition.isPending}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSaveDefinition}
            disabled={updateMetricDefinition.isPending || !hasChanges}
          >
            {updateMetricDefinition.isPending ? "Saving..." : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
