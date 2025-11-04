import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sign in - Xmrit Hub",
  description: "Sign in to access your account",
};

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
