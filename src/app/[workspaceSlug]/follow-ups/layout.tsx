import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Follow-ups - Xmrit Hub",
  description: "Track and manage tasks across your workspace",
};

export default function FollowUpsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
