"use client";

import { Settings2, Trash2, Users } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";
import { getErrorMessage } from "@/lib/utils";
import { ZodError } from "zod";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useDeleteWorkspace, useUpdateWorkspace } from "@/lib/api";
import { cn } from "@/lib/utils";
import { updateWorkspaceSchema } from "@/lib/validations/workspace";
import type { Workspace } from "@/types/db/workspace";

interface WorkspaceSettingsDialogProps {
  workspace: Workspace;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type SettingsTab = "general" | "members";

export function WorkspaceSettingsDialog({
  workspace,
  open,
  onOpenChange,
}: WorkspaceSettingsDialogProps) {
  const [activeTab, setActiveTab] = React.useState<SettingsTab>("general");
  const [name, setName] = React.useState(workspace.name);
  const [description, setDescription] = React.useState(
    workspace.description || ""
  );
  const [deleteAlertOpen, setDeleteAlertOpen] = React.useState(false);
  const updateWorkspace = useUpdateWorkspace();
  const deleteWorkspace = useDeleteWorkspace();
  const router = useRouter();

  // Reset form when dialog opens (not on every render)
  React.useEffect(() => {
    if (open) {
      setName(workspace.name);
      setDescription(workspace.description || "");
      setActiveTab("general");
    }
  }, [open, workspace.description, workspace.name]); // Only depend on open state

  // Update form if workspace changes while dialog is open
  React.useEffect(() => {
    if (open) {
      setName(workspace.name);
      setDescription(workspace.description || "");
    }
  }, [workspace.name, workspace.description, open]);

  // Check if form has changes
  const hasChanges = React.useMemo(() => {
    const nameChanged = name.trim() !== workspace.name;
    const descriptionChanged =
      description.trim() !== (workspace.description || "");
    return nameChanged || descriptionChanged;
  }, [name, description, workspace.name, workspace.description]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate with Zod before sending to backend
    try {
      const validatedData = updateWorkspaceSchema.parse({
        name: name.trim(),
        description: description.trim() || null,
      });

      const loadingToast = toast.loading("Updating workspace...");

      await updateWorkspace.mutateAsync({
        workspaceId: workspace.id,
        data: validatedData,
      });

      toast.dismiss(loadingToast);
      toast.success("Workspace updated successfully", {
        description: "Your changes have been saved.",
      });
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

      console.error("Error updating workspace:", error);
      const errorMessage = getErrorMessage(
        error,
        "An unexpected error occurred. Please try again."
      );
      toast.error("Failed to update workspace", {
        description: errorMessage,
      });
    }
  };

  const handleDeleteWorkspace = React.useCallback(async () => {
    try {
      const loadingToast = toast.loading("Deleting workspace...");

      await deleteWorkspace.mutateAsync(workspace.id);

      toast.dismiss(loadingToast);
      toast.success("Workspace deleted successfully", {
        description: "Redirecting to home page...",
      });

      onOpenChange(false);

      // Redirect to home page
      router.push("/");
    } catch (error) {
      console.error("Error deleting workspace:", error);
      const errorMessage = getErrorMessage(
        error,
        "An unexpected error occurred. Please try again."
      );
      toast.error("Failed to delete workspace", {
        description: errorMessage,
      });
    }
  }, [workspace.id, deleteWorkspace, onOpenChange, router]);

  const menuItems: {
    id: SettingsTab;
    label: string;
    icon?: React.ReactNode;
    disabled?: boolean;
  }[] = [
    {
      id: "general",
      label: "General",
      icon: <Settings2 className="h-4 w-4" />,
    },
    {
      id: "members",
      label: "Members",
      icon: <Users className="h-4 w-4" />,
      disabled: true,
    },
    // Future menu items can be added here:
    // { id: "integrations", label: "Integrations", icon: <Plug className="h-4 w-4" /> },
    // { id: "advanced", label: "Advanced", icon: <Sliders className="h-4 w-4" /> },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[800px] max-h-[85vh] p-0 gap-0 flex flex-col">
        <DialogHeader className="px-6 pt-6 pb-4 border-b shrink-0">
          <DialogTitle>Workspace Settings</DialogTitle>
          <DialogDescription>
            Manage your workspace settings and preferences.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-1 overflow-hidden min-h-0">
          {/* Side Menu */}
          <div className="w-48 border-r bg-muted/20 p-4 shrink-0">
            <nav className="space-y-1">
              {menuItems.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => !item.disabled && setActiveTab(item.id)}
                  disabled={item.disabled}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2 text-sm rounded-md transition-colors",
                    item.disabled
                      ? "opacity-50 cursor-not-allowed"
                      : activeTab === item.id
                      ? ""
                      : "hover:bg-muted",
                    activeTab === item.id
                      ? "bg-background text-foreground font-medium"
                      : "text-muted-foreground"
                  )}
                >
                  {item.icon}
                  {item.label}
                </button>
              ))}
            </nav>
          </div>

          {/* Content Area */}
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="flex-1 p-6 overflow-y-auto">
              {activeTab === "general" && (
                <form onSubmit={handleSubmit} id="general-settings-form">
                  <div className="space-y-6 max-w-xl">
                    <div>
                      <h3 className="text-lg font-semibold mb-4">
                        General Settings
                      </h3>
                      <p className="text-sm text-muted-foreground mb-6">
                        Update your workspace name and description.
                      </p>
                    </div>

                    <div className="space-y-4">
                      <div className="grid gap-2">
                        <Label htmlFor="name">
                          Workspace Name{" "}
                          <span className="text-destructive">*</span>
                        </Label>
                        <Input
                          id="name"
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          placeholder="e.g., Marketing Dashboard"
                          required
                        />
                        <p className="text-xs text-muted-foreground">
                          This is the display name for your workspace.
                        </p>
                      </div>

                      <div className="grid gap-2">
                        <Label htmlFor="description">Description</Label>
                        <Textarea
                          id="description"
                          value={description}
                          onChange={(e) => setDescription(e.target.value)}
                          placeholder="Add a description for your workspace (optional)"
                          rows={4}
                        />
                        <p className="text-xs text-muted-foreground">
                          Briefly describe what this workspace is used for.
                        </p>
                      </div>
                    </div>

                    {/* Danger Zone */}
                    <div className="pt-8 mt-8 border-t">
                      <div>
                        <h4 className="text-base font-semibold mb-2 text-destructive">
                          Danger Zone
                        </h4>
                        <p className="text-sm text-muted-foreground mb-6">
                          Irreversible and destructive actions.
                        </p>
                      </div>

                      <div className="border border-destructive/50 rounded-lg p-6 bg-destructive/5">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <h5 className="font-semibold text-foreground mb-2">
                              Delete Workspace
                            </h5>
                            <p className="text-sm text-muted-foreground mb-4">
                              Once you delete a workspace, there is no going
                              back. This will permanently delete all slides,
                              metrics, and data. Please be certain.
                            </p>
                          </div>
                        </div>
                        <Button
                          type="button"
                          variant="destructive"
                          onClick={() => setDeleteAlertOpen(true)}
                          disabled={true}
                          className="mt-2"
                        >
                          <Trash2 className="h-4 w-4 mr-1" />
                          Delete Workspace
                        </Button>
                      </div>
                    </div>
                  </div>
                </form>
              )}

              {activeTab === "members" && (
                <div className="space-y-6 max-w-xl">
                  <div>
                    <h3 className="text-lg font-semibold mb-4">Members</h3>
                    <p className="text-sm text-muted-foreground mb-6">
                      Manage workspace members and permissions.
                    </p>
                  </div>
                  <div className="text-center py-12 text-muted-foreground">
                    <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>Member management coming soon.</p>
                  </div>
                </div>
              )}

              {/* Future tabs can be added here */}
            </div>

            {/* Footer with action buttons */}
            <div className="border-t p-4 bg-muted/20 flex-shrink-0">
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  form="general-settings-form"
                  disabled={updateWorkspace.isPending || !hasChanges}
                >
                  {updateWorkspace.isPending ? "Saving..." : "Save Changes"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>

      <AlertDialog open={deleteAlertOpen} onOpenChange={setDeleteAlertOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the{" "}
              <span className="font-semibold text-foreground">
                {workspace.name}
              </span>{" "}
              workspace and remove all associated slides, metrics, and data from
              our servers.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteWorkspace}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              {deleteWorkspace.isPending ? "Deleting..." : "Delete Workspace"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}
