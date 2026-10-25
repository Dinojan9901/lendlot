// @vitest-environment node
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const authPost = vi.fn(async () => new Response(null, { status: 302 }));
vi.mock("@/auth", () => ({ handlers: { GET: vi.fn(), POST: authPost } }));

const { POST } = await import("./route");
const { RATE_LIMITS, resetRateLimitsForTests } = await import("@/server/rate-limit");

function signInRequest(email: string, ip = "203.0.113.7", path = "/api/auth/callback/credentials") {
  return new NextRequest(`http://localhost${path}`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", "x-forwarded-for": ip },
    body: new URLSearchParams({ email, password: "wrong-password" }),
  });
}

describe("Auth.js credentials endpoint rate limiting", () => {
  beforeEach(() => {
    resetRateLimitsForTests();
    authPost.mockClear();
  });

  it("passes attempts through to Auth.js, then answers 429 with Retry-After", async () => {
    for (let i = 0; i < RATE_LIMITS.signIn.limit; i++) {
      expect((await POST(signInRequest("victim@example.com"))).status).toBe(302);
    }
    const limited = await POST(signInRequest("victim@example.com"));
    expect(limited.status).toBe(429);
    expect(Number(limited.headers.get("Retry-After"))).toBeGreaterThan(0);
    expect(authPost).toHaveBeenCalledTimes(RATE_LIMITS.signIn.limit);
  });

  it("doesn't rate-limit other Auth.js POSTs such as sign-out", async () => {
    for (let i = 0; i < RATE_LIMITS.signIn.limit + 2; i++) {
      expect((await POST(signInRequest("x@example.com", "203.0.113.8", "/api/auth/signout"))).status).toBe(302);
    }
  });
});
