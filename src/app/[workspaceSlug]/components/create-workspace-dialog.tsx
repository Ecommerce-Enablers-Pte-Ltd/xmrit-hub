"use client";

import { useRouter } from "next/navigation";
import * as React from "react";
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
import { Textarea } from "@/components/ui/textarea";
import { useCreateWorkspace } from "@/lib/api";
import {
  getErrorMessage,
  isValidSlug,
  normalizeSlug,
  slugify,
} from "@/lib/utils";
import { createWorkspaceSchema } from "@/lib/validations/workspace";

interface CreateWorkspaceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateWorkspaceDialog({
  open,
  onOpenChange,
}: CreateWorkspaceDialogProps) {
  const [name, setName] = React.useState("");
  const [slug, setSlug] = React.useState("");
  const [slugTouched, setSlugTouched] = React.useState(false);
  const [slugError, setSlugError] = React.useState<string | null>(null);
  const [description, setDescription] = React.useState("");
  const createWorkspace = useCreateWorkspace();
  const router = useRouter();

  // Reset form when dialog closes
  React.useEffect(() => {
    if (!open) {
      setName("");
      setSlug("");
      setSlugTouched(false);
      setSlugError(null);
      setDescription("");
    }
  }, [open]);

  // Auto-generate slug from name unless user has manually edited it
  // Uses lowercase slugify for URL-friendly slugs
  React.useEffect(() => {
    if (!slugTouched && name) {
      setSlug(slugify(name));
    }
  }, [name, slugTouched]);

  const handleSlugChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSlugTouched(true);
    // Normalize slug input using centralized helper
    const value = normalizeSlug(
      e.target.value.replace(/\s+/g, "-").replace(/[^\w-]/g, ""),
    );
    setSlug(value);

    // Real-time validation feedback
    if (value && !isValidSlug(value)) {
      setSlugError(
        "Slug must start with a letter and contain only lowercase letters, numbers, and hyphens",
      );
    } else {
      setSlugError(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Declare loadingToast outside try block so it's accessible in catch
    let loadingToast: string | number | undefined;

    // Validate with Zod before sending to backend
    try {
      const validatedData = createWorkspaceSchema.parse({
        name: name.trim(),
        slug: slug.trim(),
        description: description.trim() || null,
        isArchived: false,
        isPublic: true,
      });

      loadingToast = toast.loading("Creating workspace...");

      const newWorkspace = await createWorkspace.mutateAsync(validatedData);

      toast.dismiss(loadingToast);
      toast.success("Workspace created successfully", {
        description: "Redirecting to your new workspace...",
      });

      onOpenChange(false);

      // Navigate to the new workspace using the slug
      router.push(`/${newWorkspace.slug}`);
    } catch (error) {
      // Always dismiss loading toast if it was created
      if (loadingToast) {
        toast.dismiss(loadingToast);
      }

      if (error instanceof ZodError) {
        // Show validation errors to user
        const firstError = error.issues[0];
        toast.error("Validation Error", {
          description: firstError.message,
        });
        return;
      }

      // Check for slug taken error from API
      const errorMessage = getErrorMessage(error, "");
      if (
        errorMessage.toLowerCase().includes("slug") &&
        errorMessage.toLowerCase().includes("taken")
      ) {
        toast.error("Slug already taken", {
          description:
            "This URL slug is already in use. Please choose a different one.",
        });
        return;
      }

      console.error("Error creating workspace:", error);
      toast.error("Failed to create workspace", {
        description:
          errorMessage || "An unexpected error occurred. Please try again.",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Create Workspace</DialogTitle>
          <DialogDescription>
            Create a new workspace to organize your slides and metrics.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">
                Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Marketing Dashboard"
                required
                autoFocus
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="slug">
                URL Slug <span className="text-destructive">*</span>
              </Label>
              <Input
                id="slug"
                value={slug}
                onChange={handleSlugChange}
                placeholder="e.g., marketing-dashboard"
                required
                aria-invalid={!!slugError}
                className={slugError ? "border-destructive" : ""}
              />
              {slugError ? (
                <p className="text-xs text-destructive">{slugError}</p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  This will be used in the URL:{" "}
                  <code className="bg-muted px-1 rounded">
                    /{slug || "..."}
                  </code>
                  <br />
                  <span className="text-amber-600 dark:text-amber-500">
                    Cannot be changed after creation.
                  </span>
                </p>
              )}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Add a description for your workspace (optional)"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="hidden sm:inline-flex"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={
                createWorkspace.isPending ||
                !name.trim() ||
                !slug.trim() ||
                !!slugError
              }
            >
              {createWorkspace.isPending ? "Creating..." : "Create Workspace"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
