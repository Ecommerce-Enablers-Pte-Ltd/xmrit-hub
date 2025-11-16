import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const isLoggedIn = !!req.auth;

  // Create response based on authentication logic
  let response: NextResponse;

  // Allow access to public API routes (needed for NextAuth)
  if (pathname.startsWith("/api/auth/")) {
    response = NextResponse.next();
  }
  // Allow access to ingest API (uses API key authentication instead of session)
  else if (pathname.startsWith("/api/ingest/")) {
    response = NextResponse.next();
  }
  // If user is authenticated and trying to access ANY auth page, redirect to home
  else if (isLoggedIn && pathname.startsWith("/auth/")) {
    response = NextResponse.redirect(new URL("/", req.url));
  }
  // Allow access to auth pages ONLY if not authenticated
  else if (pathname.startsWith("/auth/")) {
    response = NextResponse.next();
  }
  // Protect all other routes - require authentication
  else if (!isLoggedIn) {
    response = NextResponse.redirect(new URL("/auth/signin", req.url));
  }
  // Allow the request to continue
  else {
    response = NextResponse.next();
  }
  return response;
});

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder files
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
