import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { workspaces } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default async function Home() {
  // Middleware already handles authentication, but we check again for session data
  const session = await auth();

  if (!session?.user) {
    redirect("/auth/signin");
  }

  // Fetch workspaces server-side
  let allWorkspaces;
  try {
    allWorkspaces = await db
      .select()
      .from(workspaces)
      .where(eq(workspaces.isArchived, false))
      .orderBy(workspaces.updatedAt);
  } catch (error) {
    console.error("Error fetching workspaces:", error);
    return (
      <div className="flex items-center justify-center min-h-screen p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-red-600">Error</CardTitle>
            <CardDescription>
              Failed to load workspaces. Please try again later.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (allWorkspaces.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-screen p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>No Workspaces Found</CardTitle>
            <CardDescription>
              Please create a workspace to get started.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }
  //
  // If only one workspace, redirect directly to it
  if (allWorkspaces.length === 1) {
    redirect(`/${allWorkspaces[0].id}`);
  }

  // Show workspace selector for multiple workspaces
  return (
    <div className="flex items-center justify-center min-h-screen p-8 md:p-4">
      <Card className="w-full max-w-2xl overflow-y-auto max-h-[calc(100vh-16rem)]">
        <CardHeader>
          <CardTitle>Welcome, {session.user.name}!</CardTitle>
          <CardDescription>
            Select a workspace to view your metrics and charts
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-3">
            {allWorkspaces.map((workspace) => (
              <Link
                key={workspace.id}
                href={`/${workspace.id}`}
                className="block"
              >
                <Button
                  variant="outline"
                  className="w-full h-auto py-4 px-6 justify-start text-left hover:bg-accent"
                >
                  <div className="flex flex-col gap-1 w-full">
                    <div className="font-semibold text-base">
                      {workspace.name}
                    </div>
                    {workspace.description && (
                      <div className="text-sm text-muted-foreground font-normal whitespace-nowrap overflow-hidden text-ellipsis">
                        {workspace.description}
                      </div>
                    )}
                  </div>
                </Button>
              </Link>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
