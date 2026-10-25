import type { NextRequest } from "next/server";
import { handlers } from "@/auth";
import { clientIp, signInRateLimit, tooManyRequests } from "@/server/rate-limit";

export const { GET } = handlers;

/**
 * Credentials posted straight to the Auth.js endpoint (bypassing the sign-in
 * form) share the sign-in rate limit and get a real 429 with Retry-After.
 */
export async function POST(request: NextRequest) {
  if (request.nextUrl.pathname.endsWith("/callback/credentials")) {
    const form = await request.clone().formData().catch(() => null);
    const blocked = await signInRateLimit(clientIp(request.headers), String(form?.get("email") ?? ""));
    if (blocked) return tooManyRequests(blocked);
  }
  return handlers.POST(request);
}
