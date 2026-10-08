import { NextRequest, NextResponse } from "next/server";
import { verifyTokenEdge } from "./lib/edgeAuth";

// Lives in src/ because the app does: Next.js ignores a root middleware.ts when src/ exists.
// Routes still check the token themselves; this is the outer layer.

const protectedRoutes = [
  "/admin",
  "/api/images/upload",
  "/api/images/delete",
  "/api/audio/upload",
  "/api/audio/reorder",
];
const authRoutes = ["/login"];

function redirectToLogin(request: NextRequest, pathname: string) {
  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("redirect", pathname);
  return NextResponse.redirect(loginUrl);
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname === "/register" || pathname.startsWith("/register/")) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const token = request.cookies.get("auth-token")?.value;

  const isProtectedRoute = protectedRoutes.some((route) => pathname.startsWith(route));
  const isAuthRoute = authRoutes.some((route) => pathname.startsWith(route));

  if (isProtectedRoute) {
    if (!token) return redirectToLogin(request, pathname);

    if (!(await verifyTokenEdge(token))) {
      const response = redirectToLogin(request, pathname);
      // Clear invalid token
      response.cookies.set("auth-token", "", { maxAge: 0 });
      return response;
    }
  }

  // Already logged in: skip the login/register pages
  if (isAuthRoute && token && (await verifyTokenEdge(token))) {
    return NextResponse.redirect(new URL("/admin", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|public).*)"],
};
