import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Only protect /admin routes (except /admin/login)
  if (pathname.startsWith("/admin") && pathname !== "/admin/login") {
    const session = request.cookies.get("admin_session")?.value;
    if (!session) {
      return NextResponse.redirect(new URL("/admin/login", request.url));
    }
    // JWT verification can't reliably use jose in edge middleware,
    // so we check cookie existence here. The layout does full verification.
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*"],
};
