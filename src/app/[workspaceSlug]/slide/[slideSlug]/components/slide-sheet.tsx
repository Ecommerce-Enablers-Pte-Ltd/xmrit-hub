"use client";

import { ListTodo, MessageSquare } from "lucide-react";
import { useEffect, useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { TimeBucket } from "@/lib/time-buckets";
import { type CommentDataPoint, CommentsTab } from "./comments-sheet-tab";
import { FollowUpTab } from "./follow-up-sheet-tab";

export type { CommentDataPoint };

interface SlideSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  definitionId: string;
  bucketType: TimeBucket;
  bucketValue: string;
  bucketLabel?: string;
  allDataPoints?: CommentDataPoint[];
  onCommentAdded?: (bucketValue: string) => void;
  slideId: string;
  initialFilterToAll?: boolean;
  initialTab?: "comments" | "follow-ups";
  workspaceId: string;
}

export function SlideSheet({
  open,
  onOpenChange,
  definitionId,
  bucketType,
  bucketValue: initialBucketValue,
  allDataPoints,
  onCommentAdded,
  slideId,
  initialFilterToAll = false,
  initialTab = "comments",
  workspaceId,
}: SlideSheetProps) {
  const [activeTab, setActiveTab] = useState<string>(initialTab);

  // Update tab when props change (e.g., when opening for a new point)
  useEffect(() => {
    if (open) {
      setActiveTab(initialTab);
    }
  }, [open, initialTab]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[600px] sm:w-[600px] max-w-[90vw] flex flex-col p-0 gap-0">
        <Tabs
          value={activeTab}
          onValueChange={setActiveTab}
          className="flex flex-col h-full"
        >
          {/* Header */}
          <SheetHeader className="px-6 pt-5 pb-0 shrink-0">
            <SheetTitle className="flex items-center gap-2.5 text-lg mb-3">
              <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-primary/10">
                {activeTab === "follow-ups" ? (
                  <ListTodo className="h-4 w-4 text-primary" />
                ) : (
                  <MessageSquare className="h-4 w-4 text-primary" />
                )}
              </div>
              <span>
                {activeTab === "follow-ups" ? "Follow-ups" : "Comments"}
              </span>
            </SheetTitle>

            {/* Tabs */}
            <TabsList className="w-full grid grid-cols-2 mb-2">
              <TabsTrigger value="comments">Comments</TabsTrigger>
              <TabsTrigger value="follow-ups">Follow-ups</TabsTrigger>
            </TabsList>
          </SheetHeader>

          {/* Comments Tab */}
          <TabsContent
            value="comments"
            className="flex-1 flex flex-col min-h-0 m-0"
          >
            <CommentsTab
              definitionId={definitionId}
              bucketType={bucketType}
              bucketValue={initialBucketValue}
              allDataPoints={allDataPoints}
              onCommentAdded={onCommentAdded}
              slideId={slideId}
              initialFilterToAll={initialFilterToAll}
            />
          </TabsContent>

          {/* Follow-ups Tab */}
          <TabsContent
            value="follow-ups"
            className="flex-1 flex flex-col min-h-0 m-0"
          >
            <FollowUpTab
              definitionId={definitionId}
              slideId={slideId}
              workspaceId={workspaceId}
            />
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}
