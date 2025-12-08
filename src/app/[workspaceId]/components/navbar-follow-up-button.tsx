"use client";

import { Copy, ListTodo, Plus } from "lucide-react";
import { useParams, usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useCreateFollowUp, useUsers, useWorkspace } from "@/lib/api";
import { handleCloseAutoFocus } from "@/lib/ui/focus";
import { getErrorMessage } from "@/lib/utils";
import type { FollowUpPriority, FollowUpStatus } from "@/types/db/follow-up";
import { FollowUpDialog } from "../follow-ups/components/follow-up-dialog";

interface NavbarFollowUpButtonProps {
  workspaceId: string;
}

export function NavbarFollowUpButton({
  workspaceId,
}: NavbarFollowUpButtonProps) {
  const pathname = usePathname();
  const params = useParams();
  const router = useRouter();
  const [dialogOpen, setDialogOpen] = useState(false);

  // Check if we're on a slide page
  const isSlidePage = pathname?.includes("/slide/");
  const slideId = isSlidePage ? (params?.slideId as string) : undefined;

  const { data: users = [] } = useUsers();
  const { workspace } = useWorkspace(workspaceId);
  const slides = workspace?.slides || [];
  const createMutation = useCreateFollowUp(workspaceId);

  // Don't show button if not on a slide page
  if (!isSlidePage) {
    return null;
  }

  const handleSave = async (data: {
    title: string;
    description: string;
    status: FollowUpStatus;
    priority: FollowUpPriority;
    assigneeIds?: string[];
    slideId?: string;
    submetricDefinitionId?: string;
    dueDate?: string;
  }) => {
    try {
      const newFollowUp = await createMutation.mutateAsync(data);

      toast.success("Follow-up created successfully", {
        description: "Click to view the follow-up",
        action: {
          label: "View",
          onClick: () => {
            router.push(
              `/${workspaceId}/follow-ups?slideId=${newFollowUp.slideId || ""}`,
            );
          },
        },
      });

      setDialogOpen(false);
    } catch (error) {
      console.error("Error creating follow-up:", error);
      toast.error(getErrorMessage(error, "Failed to create follow-up"));
    }
  };

  const handleViewFollowUps = () => {
    window.open(`/${workspaceId}/follow-ups?slideId=${slideId}`, "_blank");
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="icon" variant="ghost" className="h-9 w-9">
            <ListTodo className="h-4 w-4" />
            <span className="sr-only">Follow-ups menu</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          className="w-[200px]"
          onCloseAutoFocus={handleCloseAutoFocus}
        >
          <DropdownMenuItem onClick={() => setDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Create Follow-up
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={handleViewFollowUps}>
            <Copy className="h-4 w-4 mr-2" />
            View All Follow-ups
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <FollowUpDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        users={users}
        slides={slides}
        onSave={handleSave}
        isLoading={createMutation.isPending}
        defaultSlideId={slideId}
      />
    </>
  );
}
