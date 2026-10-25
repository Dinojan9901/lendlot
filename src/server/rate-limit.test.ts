// @vitest-environment node
import { beforeEach, describe, expect, it } from "vitest";
import {
  clientIp,
  MemoryRateLimiter,
  rateLimit,
  RATE_LIMITS,
  resetRateLimitsForTests,
  signInRateLimit,
  tooManyRequests,
} from "./rate-limit";

describe("MemoryRateLimiter", () => {
  it("allows requests up to the limit, then blocks with a retry time", async () => {
    let now = 1_000_000;
    const limiter = new MemoryRateLimiter(3, 60_000, () => now);

    for (let i = 0; i < 3; i++) expect((await limiter.limit("k")).success).toBe(true);
    const blocked = await limiter.limit("k");
    expect(blocked).toMatchObject({ success: false, limit: 3, remaining: 0, retryAfterSeconds: 60 });

    now += 20_000;
    expect((await limiter.limit("k")).retryAfterSeconds).toBe(40);
  });

  it("allows again once the oldest request leaves the window (sliding window)", async () => {
    let now = 0;
    const limiter = new MemoryRateLimiter(2, 10_000, () => now);
    await limiter.limit("k");
    now = 5_000;
    await limiter.limit("k");
    expect((await limiter.limit("k")).success).toBe(false);
    now = 10_001; // the first request has expired, the second hasn't
    expect((await limiter.limit("k")).success).toBe(true);
    expect((await limiter.limit("k")).success).toBe(false);
  });

  it("counts keys independently", async () => {
    const limiter = new MemoryRateLimiter(1, 60_000);
    expect((await limiter.limit("a")).success).toBe(true);
    expect((await limiter.limit("a")).success).toBe(false);
    expect((await limiter.limit("b")).success).toBe(true);
  });
});

describe("rateLimit (no Upstash env vars → in-memory fallback)", () => {
  beforeEach(() => {
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.KV_REST_API_URL;
    resetRateLimitsForTests();
  });

  it("enforces the configured policy", async () => {
    const { limit } = RATE_LIMITS.booking;
    for (let i = 0; i < limit; i++) expect((await rateLimit("booking", "user_1")).success).toBe(true);
    expect((await rateLimit("booking", "user_1")).success).toBe(false);
    expect((await rateLimit("booking", "user_2")).success).toBe(true);
  });

  it("limits sign-in per IP + email, case-insensitively", async () => {
    for (let i = 0; i < RATE_LIMITS.signIn.limit; i++) {
      expect(await signInRateLimit("1.2.3.4", i % 2 ? "Renter@Example.com" : "renter@example.com")).toBeNull();
    }
    expect(await signInRateLimit("1.2.3.4", "renter@example.com")).toMatchObject({ success: false });
    expect(await signInRateLimit("1.2.3.4", "someone-else@example.com")).toBeNull();
  });
});

describe("tooManyRequests", () => {
  it("returns 429 with Retry-After and rate-limit headers", async () => {
    const response = tooManyRequests({ success: false, limit: 10, remaining: 0, resetAt: 1_800_000_000_000, retryAfterSeconds: 42 });
    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("42");
    expect(response.headers.get("X-RateLimit-Limit")).toBe("10");
    expect(response.headers.get("X-RateLimit-Remaining")).toBe("0");
    expect(await response.json()).toEqual({ error: "Too many requests. Please try again in 42 seconds." });
  });
});

describe("clientIp", () => {
  it("prefers x-real-ip, then the first x-forwarded-for entry", () => {
    expect(clientIp(new Headers({ "x-real-ip": "9.9.9.9", "x-forwarded-for": "1.1.1.1" }))).toBe("9.9.9.9");
    expect(clientIp(new Headers({ "x-forwarded-for": "1.1.1.1, 10.0.0.1" }))).toBe("1.1.1.1");
    expect(clientIp(new Headers())).toBe("unknown");
  });
});
