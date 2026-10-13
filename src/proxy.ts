import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authConfig } from "./auth.config";

// Next.js 16 renamed middleware.ts to proxy.ts; it runs before matching routes.
const { auth } = NextAuth(authConfig);

const ROLE_RULES: { prefix: string; roles: string[] }[] = [
  { prefix: "/admin", roles: ["ADMIN"] },
  { prefix: "/dashboard/listings", roles: ["OWNER", "ADMIN"] },
  { prefix: "/dashboard", roles: ["RENTER", "OWNER", "ADMIN"] },
];

/**
 * A fast first line of defence: bounce signed-out users to the login page and
 * users with the wrong role to /forbidden before any page code runs.
 * Every page, Server Action and Route Handler still checks permissions itself
 * — the proxy is a convenience, not the security boundary.
 */
export const proxy = auth((request) => {
  const { pathname, search } = request.nextUrl;
  const user = request.auth?.user;

  if (!user) {
    const loginUrl = new URL("/login", request.nextUrl.origin);
    loginUrl.searchParams.set("callbackUrl", `${pathname}${search}`);
    return NextResponse.redirect(loginUrl);
  }

  const rule = ROLE_RULES.find((r) => pathname === r.prefix || pathname.startsWith(`${r.prefix}/`));
  if (rule && !rule.roles.includes(user.role)) {
    return NextResponse.redirect(new URL("/forbidden", request.nextUrl.origin));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/dashboard/:path*", "/admin/:path*"],
};
