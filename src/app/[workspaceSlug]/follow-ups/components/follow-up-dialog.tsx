"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { format } from "date-fns";
import { AlertCircle, CalendarIcon, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { getPriorityIcon, getStatusIcon } from "@/components/config";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { handleCloseAutoFocus } from "@/lib/ui/focus";
import { cn } from "@/lib/utils";
import type {
  FollowUpPriority,
  FollowUpStatus,
  FollowUpWithDetails,
} from "@/types/db/follow-up";
import type { SlideWithMetrics } from "@/types/db/slide";
import type { User } from "@/types/db/user";
import {
  SubmetricSelector,
  type SubmetricDefinitionForSelector,
} from "./submetric-selector";
import { UserAssigneeMultiSelector } from "./user-assignee-multi-selector";

// Form validation schema
const followUpFormSchema = z.object({
  title: z
    .string()
    .min(1, "Title is required")
    .max(200, "Title must be less than 200 characters")
    .trim(),
  description: z
    .string()
    .max(2000, "Description must be less than 2000 characters")
    .optional(),
  status: z.enum(["todo", "in_progress", "done", "cancelled", "resolved"]),
  priority: z.enum(["no_priority", "urgent", "high", "medium", "low"]),
  assigneeIds: z.array(z.string()).optional(),
  slideId: z.string().nullable().optional(),
  submetricDefinitionId: z.string().nullable().optional(),
  resolvedAtSlideId: z.string().nullable().optional(),
  dueDate: z.date().nullable().optional(),
});

type FollowUpFormData = z.infer<typeof followUpFormSchema>;

interface FollowUpDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  followUp?: FollowUpWithDetails | null;
  users: User[];
  slides: SlideWithMetrics[];
  onSave: (data: {
    title: string;
    description: string;
    status: FollowUpStatus;
    priority: FollowUpPriority;
    assigneeIds?: string[];
    slideId?: string;
    submetricDefinitionId?: string;
    resolvedAtSlideId?: string | null;
    dueDate?: string;
  }) => void;
  isLoading?: boolean;
  defaultSlideId?: string | null; // Optional default slide ID to pre-select
  defaultSubmetricDefinitionId?: string | null; // Optional default submetric definition ID to pre-select
  currentSlideId?: string | null; // Current slide context for resolution tracking
}

const FormError = ({ message }: { message?: string }) => {
  if (!message) return null;
  return (
    <p className="text-sm text-destructive mt-1 flex items-center gap-1">
      <AlertCircle className="h-3 w-3" />
      {message}
    </p>
  );
};

const STATUS_OPTIONS: { value: FollowUpStatus; label: string }[] = [
  { value: "todo", label: "Todo" },
  { value: "in_progress", label: "In Progress" },
  { value: "done", label: "Done" },
  { value: "cancelled", label: "Cancelled" },
];

// Include resolved in the display-only options (for showing current status)
const STATUS_OPTIONS_WITH_RESOLVED: { value: FollowUpStatus; label: string }[] =
  [...STATUS_OPTIONS, { value: "resolved", label: "Resolved" }];

const PRIORITY_OPTIONS: { value: FollowUpPriority; label: string }[] = [
  { value: "no_priority", label: "No Priority" },
  { value: "urgent", label: "Urgent" },
  { value: "high", label: "High" },
  { value: "medium", label: "Medium" },
  { value: "low", label: "Low" },
];

export function FollowUpDialog({
  open,
  onOpenChange,
  followUp,
  users,
  slides,
  onSave,
  isLoading = false,
  defaultSlideId,
  defaultSubmetricDefinitionId,
  currentSlideId,
}: FollowUpDialogProps) {
  const [calendarOpen, setCalendarOpen] = useState(false);
  const clearingDateRef = useRef(false);
  const previousOpenRef = useRef(false);
  const followUpIdRef = useRef<string | undefined>(undefined);

  // Check if follow-up is resolved
  const isResolved = followUp?.status === "resolved";
  const {
    control,
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isDirty, isValid },
  } = useForm<FollowUpFormData>({
    resolver: zodResolver(followUpFormSchema),
    mode: "onChange",
    defaultValues: {
      title: "",
      description: "",
      status: "todo",
      priority: "no_priority",
      assigneeIds: [],
      slideId: null,
      submetricDefinitionId: null,
      resolvedAtSlideId: null,
      dueDate: null,
    },
  });

  // Watch the selected slideId to show submetric definitions
  const selectedSlideId = watch("slideId");

  // Get submetric definitions for the selected slide
  const availableSubmetricDefinitions = useMemo<
    SubmetricDefinitionForSelector[]
  >(() => {
    if (!selectedSlideId) return [];
    const slide = slides.find((s) => s.id === selectedSlideId);
    if (!slide) {
      console.warn("FollowUpDialog: Slide not found for ID:", selectedSlideId);
      return [];
    }

    // Check if slide has metrics array
    if (!slide.metrics || !Array.isArray(slide.metrics)) {
      return [];
    }

    // Extract unique submetric definitions from all metrics in the slide
    const definitions: SubmetricDefinitionForSelector[] = [];
    const seenIds = new Set<string>();

    for (const metric of slide.metrics) {
      // Safety check for submetrics array
      if (!metric.submetrics || !Array.isArray(metric.submetrics)) {
        continue;
      }

      for (const submetric of metric.submetrics) {
        if (
          submetric.definitionId &&
          submetric.definition &&
          !seenIds.has(submetric.definitionId)
        ) {
          seenIds.add(submetric.definitionId);
          // Create a SubmetricDefinition object from submetric definition
          // submetricKey should include category if available
          const category = submetric.definition.category;
          const metricName = submetric.definition.metricName || "Untitled";
          const submetricKey = category
            ? `${category}_${metricName}`
            : metricName;

          definitions.push({
            id: submetric.definitionId,
            workspaceId: slide.workspaceId,
            metricKey: metric.name,
            submetricKey: submetricKey,
            category: category,
            metricName: metricName,
            xaxis: submetric.definition.xaxis,
            yaxis: submetric.definition.yaxis,
            unit: submetric.definition.unit,
            preferredTrend: submetric.definition.preferredTrend,
            createdAt: submetric.createdAt,
            updatedAt: submetric.updatedAt,
          });
        }
      }
    }

    return definitions;
  }, [selectedSlideId, slides]);

  // Reset submetricDefinitionId when slide changes (but keep it if it's valid for the new slide)
  useEffect(() => {
    if (selectedSlideId) {
      const currentSubmetricId = watch("submetricDefinitionId");

      // Only clear if the current submetric definition is not in the available ones for this slide
      if (currentSubmetricId) {
        const isValidForSlide = availableSubmetricDefinitions.some(
          (def) => def.id === currentSubmetricId
        );

        // Clear if not valid for the new slide
        if (!isValidForSlide) {
          setValue("submetricDefinitionId", null);
        }
      }
    }
  }, [selectedSlideId, setValue, watch, availableSubmetricDefinitions]);

  // Reset form when dialog opens (transition from closed to open) or followUp changes
  useEffect(() => {
    const followUpId = followUp?.id;
    const isNewFollowUp = followUpId !== followUpIdRef.current;

    if (open) {
      // Only reset if:
      // 1. Dialog was previously closed (transition to open)
      // 2. Or we're editing a different follow-up
      if (!previousOpenRef.current || isNewFollowUp) {
        // Reset popover states
        setCalendarOpen(false);

        if (followUp) {
          // Edit mode - populate with existing data
          // Extract assignee IDs from the new assignees array
          const assigneeIds = followUp.assignees?.map((a) => a.userId) || [];

          reset({
            title: followUp.title,
            description: followUp.description || "",
            status: followUp.status,
            priority: followUp.priority,
            assigneeIds,
            slideId: followUp.slideId ?? null,
            submetricDefinitionId: followUp.submetricDefinitionId ?? null,
            resolvedAtSlideId: followUp.resolvedAtSlideId ?? null,
            dueDate: followUp.dueDate ? new Date(followUp.dueDate) : null,
          });
        } else {
          // Create mode - reset to defaults, but use defaultSlideId and defaultSubmetricDefinitionId if provided
          reset({
            title: "",
            description: "",
            status: "todo",
            priority: "no_priority",
            assigneeIds: [],
            slideId: defaultSlideId ?? null,
            submetricDefinitionId: defaultSubmetricDefinitionId ?? null,
            resolvedAtSlideId: null,
            dueDate: null,
          });
        }

        // Update tracked followUp ID
        followUpIdRef.current = followUpId;
      }
      previousOpenRef.current = true;
    } else {
      // Reset popover states when dialog closes
      setCalendarOpen(false);
      previousOpenRef.current = false;
      followUpIdRef.current = undefined;
    }
  }, [open, followUp, reset, defaultSlideId, defaultSubmetricDefinitionId]);

  const onSubmit = (data: FollowUpFormData) => {
    // Determine resolvedAtSlideId based on status change
    let resolvedAtSlideId: string | null | undefined = data.resolvedAtSlideId;

    // If status is "done" and we have a current slide context, set resolvedAtSlideId
    if (data.status === "done" && currentSlideId) {
      resolvedAtSlideId = currentSlideId;
    }
    // If status is not "done", clear resolvedAtSlideId
    else if (data.status !== "done") {
      resolvedAtSlideId = null;
    }

    onSave({
      title: data.title,
      description: data.description || "",
      status: data.status,
      priority: data.priority,
      assigneeIds:
        data.assigneeIds && data.assigneeIds.length > 0
          ? data.assigneeIds
          : undefined,
      slideId: data.slideId ?? undefined,
      submetricDefinitionId: data.submetricDefinitionId ?? undefined,
      resolvedAtSlideId: resolvedAtSlideId ?? undefined,
      dueDate: data.dueDate ? format(data.dueDate, "yyyy-MM-dd") : undefined,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="w-[calc(100vw-2rem)] sm:max-w-[560px] max-h-[60vh] sm:max-h-[75vh] flex flex-col overflow-hidden gap-0 p-0"
        onCloseAutoFocus={handleCloseAutoFocus}
      >
        <DialogHeader className="shrink-0 px-4 sm:px-6 pt-4 sm:pt-6 pb-2 sm:pb-3">
          <DialogTitle className="text-lg sm:text-xl font-semibold tracking-tight">
            {followUp ? "Edit Follow-up" : "Create Follow-up"}
          </DialogTitle>
          <DialogDescription className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
            {isResolved
              ? "This follow-up is resolved. You can edit details but cannot change the status. Reopen to change status."
              : followUp
              ? "Update the follow-up details below."
              : "Track action items, issues, and tasks."}
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={handleSubmit(onSubmit)}
          className="flex flex-col flex-1 min-h-0"
        >
          <div className="flex-1 overflow-y-auto px-4 sm:px-6 pb-4 sm:pb-6">
            <div className="space-y-4 sm:space-y-6">
              {/* Title Field */}
              <div className="grid gap-1.5 sm:gap-2">
                <Label htmlFor="title" className="text-sm">
                  Title <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="title"
                  {...register("title")}
                  placeholder="What needs to be done?"
                  className={cn(
                    "h-9 sm:h-10",
                    errors.title &&
                      "border-destructive focus-visible:ring-destructive"
                  )}
                  autoFocus
                  disabled={isLoading}
                />
                <FormError message={errors.title?.message} />
              </div>

              {/* Assignees */}
              <Controller
                name="assigneeIds"
                control={control}
                render={({ field }) => (
                  <div className="grid gap-1.5 sm:gap-2">
                    <Label htmlFor="assignees" className="text-sm">
                      Assignees
                    </Label>
                    <UserAssigneeMultiSelector
                      users={users}
                      value={field.value || []}
                      onValueChange={(newValue) => {
                        // Use setValue with shouldValidate to ensure the change persists
                        setValue("assigneeIds", newValue, {
                          shouldValidate: true,
                          shouldDirty: true,
                          shouldTouch: true,
                        });
                      }}
                      placeholder="Assign to..."
                      disabled={isLoading}
                      stackMode
                    />
                    <FormError message={errors.assigneeIds?.message} />
                  </div>
                )}
              />

              {/* Status, Priority, and Due Date Row - responsive grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
                <Controller
                  name="status"
                  control={control}
                  render={({ field }) => (
                    <div className="grid gap-1.5 sm:gap-2">
                      <Label htmlFor="status" className="text-sm">
                        Status
                      </Label>
                      <Select
                        value={field.value}
                        onValueChange={field.onChange}
                        disabled={isLoading || isResolved}
                      >
                        <SelectTrigger
                          id="status"
                          className={cn(
                            "w-full h-9 sm:h-10",
                            errors.status && "border-destructive",
                            isResolved && "opacity-60 cursor-not-allowed"
                          )}
                        >
                          <SelectValue>
                            <div className="flex items-center gap-1.5 sm:gap-2 w-full">
                              {getStatusIcon(field.value)}
                              <span className="truncate text-sm">
                                {STATUS_OPTIONS_WITH_RESOLVED.find(
                                  (opt) => opt.value === field.value
                                )?.label || field.value}
                              </span>
                            </div>
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          {STATUS_OPTIONS.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              <div className="flex items-center gap-2">
                                {getStatusIcon(option.value)}
                                <span>{option.label}</span>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormError message={errors.status?.message} />
                    </div>
                  )}
                />

                <Controller
                  name="priority"
                  control={control}
                  render={({ field }) => (
                    <div className="grid gap-1.5 sm:gap-2">
                      <Label htmlFor="priority" className="text-sm">
                        Priority
                      </Label>
                      <Select
                        value={field.value}
                        onValueChange={field.onChange}
                        disabled={isLoading}
                      >
                        <SelectTrigger
                          id="priority"
                          className={cn(
                            "w-full h-9 sm:h-10",
                            errors.priority && "border-destructive"
                          )}
                        >
                          <SelectValue>
                            <div className="flex items-center gap-1.5 sm:gap-2 w-full">
                              {getPriorityIcon(field.value, "h-4 w-4")}
                              <span className="truncate text-sm">
                                {PRIORITY_OPTIONS.find(
                                  (opt) => opt.value === field.value
                                )?.label || "No Priority"}
                              </span>
                            </div>
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          {PRIORITY_OPTIONS.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              <div className="flex items-center gap-2">
                                {getPriorityIcon(option.value, "h-4 w-4")}
                                <span>{option.label}</span>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormError message={errors.priority?.message} />
                    </div>
                  )}
                />

                <Controller
                  name="dueDate"
                  control={control}
                  render={({ field }) => (
                    <div className="grid gap-1.5 sm:gap-2 col-span-2 sm:col-span-1">
                      <Label htmlFor="dueDate" className="text-sm">
                        Due Date
                      </Label>
                      <Popover
                        open={calendarOpen}
                        onOpenChange={(newOpen) => {
                          if (clearingDateRef.current) {
                            clearingDateRef.current = false;
                            return;
                          }
                          setCalendarOpen(newOpen);
                        }}
                        modal={true}
                      >
                        <PopoverTrigger asChild>
                          <Button
                            id="dueDate"
                            variant="outline"
                            disabled={isLoading}
                            className={cn(
                              "w-full h-9 sm:h-10 justify-start text-left font-normal min-w-0",
                              !field.value && "text-muted-foreground",
                              errors.dueDate && "border-destructive"
                            )}
                          >
                            <CalendarIcon className="mr-1.5 sm:mr-2 h-4 w-4 shrink-0" />
                            <span className="truncate flex-1 text-sm">
                              {field.value
                                ? format(field.value, "PP")
                                : "Pick a date"}
                            </span>
                            {field.value && (
                              // biome-ignore lint/a11y/useSemanticElements: Cannot use <button> inside Button component (nested buttons cause hydration errors)
                              <span
                                role="button"
                                tabIndex={0}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  e.preventDefault();
                                  clearingDateRef.current = true;
                                  field.onChange(null);
                                  setCalendarOpen(false);
                                  setTimeout(() => {
                                    clearingDateRef.current = false;
                                  }, 100);
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter" || e.key === " ") {
                                    e.stopPropagation();
                                    e.preventDefault();
                                    clearingDateRef.current = true;
                                    field.onChange(null);
                                    setCalendarOpen(false);
                                    setTimeout(() => {
                                      clearingDateRef.current = false;
                                    }, 100);
                                  }
                                }}
                                className="ml-1.5 sm:ml-2 -mr-1 hover:bg-accent rounded-sm p-1 transition-colors cursor-pointer shrink-0"
                                aria-label="Clear date"
                              >
                                <X className="h-3.5 w-3.5" />
                              </span>
                            )}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent
                          className="w-auto p-0"
                          align="start"
                          sideOffset={4}
                        >
                          <Calendar
                            mode="single"
                            selected={field.value ?? undefined}
                            onSelect={(date) => {
                              field.onChange(date ?? null);
                              setCalendarOpen(false);
                            }}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                      <FormError message={errors.dueDate?.message} />
                    </div>
                  )}
                />
              </div>

              {/* Description */}
              <div className="grid gap-1.5 sm:gap-2">
                <Label htmlFor="description" className="text-sm">
                  Description
                </Label>
                <Textarea
                  id="description"
                  {...register("description")}
                  placeholder="Add more context or details..."
                  rows={3}
                  className={cn(
                    "resize-none text-sm min-h-[80px] sm:min-h-[100px]",
                    errors.description &&
                      "border-destructive focus-visible:ring-destructive"
                  )}
                  disabled={isLoading}
                />
                <FormError message={errors.description?.message} />
              </div>

              {/* Related Slide */}
              <Controller
                name="slideId"
                control={control}
                render={({ field }) => (
                  <div className="grid gap-1.5 sm:gap-2">
                    <Label htmlFor="slide" className="text-sm">
                      Related Slide
                    </Label>
                    <Select
                      value={field.value || "none"}
                      onValueChange={(v) =>
                        field.onChange(v === "none" ? null : v)
                      }
                      disabled={isLoading}
                    >
                      <SelectTrigger
                        id="slide"
                        className={cn(
                          "h-9 sm:h-10",
                          errors.slideId && "border-destructive"
                        )}
                      >
                        <SelectValue placeholder="None" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">
                          <span className="text-muted-foreground">None</span>
                        </SelectItem>
                        {slides.map((slide) => (
                          <SelectItem key={slide.id} value={slide.id}>
                            {slide.title}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormError message={errors.slideId?.message} />
                  </div>
                )}
              />

              {/* Submetric Definition - only shown when a slide is selected */}
              {selectedSlideId && availableSubmetricDefinitions.length > 0 && (
                <Controller
                  name="submetricDefinitionId"
                  control={control}
                  render={({ field }) => (
                    <div className="grid gap-1.5 sm:gap-2">
                      <Label htmlFor="submetricDefinition" className="text-sm">
                        Related Submetric
                      </Label>
                      <SubmetricSelector
                        submetricDefinitions={availableSubmetricDefinitions}
                        value={field.value}
                        onValueChange={field.onChange}
                        placeholder="None"
                        showNoneOption
                        disabled={isLoading}
                        triggerWidth="w-full"
                        triggerMaxWidth="max-w-full"
                        className={cn(
                          "h-9 sm:h-10",
                          errors.submetricDefinitionId && "border-destructive"
                        )}
                      />
                      <FormError
                        message={errors.submetricDefinitionId?.message}
                      />
                    </div>
                  )}
                />
              )}
            </div>
          </div>

          <DialogFooter className="shrink-0 border-t px-4 sm:px-6 py-3 sm:py-4 bg-muted/20">
            <div className="flex justify-end gap-2 w-full">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isLoading}
                className="h-9 sm:h-10 hidden sm:inline-flex"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isLoading || (followUp && !isDirty) || !isValid}
                className="h-9 sm:h-10 w-full sm:w-auto"
              >
                {isLoading ? "Saving..." : followUp ? "Save Changes" : "Create"}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
