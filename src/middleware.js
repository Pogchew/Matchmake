import { NextResponse } from "next/server";

const AUTH_ACCESS_TOKEN_COOKIE = "matchmake-access-token";

const protectedRoutes = [
  "/",
  "/org",
  "/requests",
  "/calendar",
  "/team",
  "/chat",
  "/scrims",
];

const publicAuthRoutes = ["/login", "/signup"];

function isProtectedPath(pathname) {
  if (pathname === "/") return true;
  return protectedRoutes.some((route) => route !== "/" && (pathname === route || pathname.startsWith(`${route}/`)));
}

async function hasValidSession(request) {
  const accessToken = request.cookies.get(AUTH_ACCESS_TOKEN_COOKIE)?.value;

  if (!accessToken) return false;

  try {
    const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/user`, {
      headers: {
        apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
        Authorization: `Bearer ${accessToken}`,
      },
    });

    return response.ok;
  } catch {
    return false;
  }
}

export async function middleware(request) {
  const { pathname } = request.nextUrl;
  const isAuthRoute = publicAuthRoutes.includes(pathname);
  const isAuthenticated = await hasValidSession(request);

  if (isAuthRoute && isAuthenticated) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  if (isProtectedPath(pathname) && !isAuthenticated) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
