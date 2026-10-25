import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { NextResponse } from "next/server";

/**
 * Rate limits for sign-in, registration and every write endpoint.
 *
 * Production uses Upstash Redis, so limits are shared by all serverless
 * instances. When the Upstash env vars are missing (local dev, tests, CI) an
 * in-memory sliding window is used instead: per process, but the same rules.
 * If Upstash itself errors, the in-memory limiter takes over rather than
 * either blocking everyone or letting everything through.
 */
export const RATE_LIMITS = {
  /** Per IP + email: slows password guessing against one account. */
  signIn: { limit: 10, windowSeconds: 10 * 60 },
  /** Per IP: caps attempts across many accounts. */
  signInIp: { limit: 50, windowSeconds: 10 * 60 },
  /** Per IP. */
  signUp: { limit: 5, windowSeconds: 60 * 60 },
  /** Per user. */
  booking: { limit: 10, windowSeconds: 60 },
  /** Per user; each call creates objects in Paddle. */
  checkout: { limit: 5, windowSeconds: 10 * 60 },
  /** Per user: listings, cancellations, visibility, roles. */
  write: { limit: 30, windowSeconds: 60 },
} as const satisfies Record<string, { limit: number; windowSeconds: number }>;

export type RateLimitPolicy = keyof typeof RATE_LIMITS;

export type RateLimitResult = {
  success: boolean;
  limit: number;
  remaining: number;
  /** Epoch ms when a request will be allowed again (for a blocked key). */
  resetAt: number;
  /** Seconds to wait before retrying; 0 when allowed. */
  retryAfterSeconds: number;
};

interface Limiter {
  limit(key: string): Promise<RateLimitResult>;
}

/** Sliding-window log kept in memory. */
export class MemoryRateLimiter implements Limiter {
  private readonly hits = new Map<string, number[]>();

  constructor(
    private readonly max: number,
    private readonly windowMs: number,
    private readonly now: () => number = Date.now,
  ) {}

  async limit(key: string): Promise<RateLimitResult> {
    const now = this.now();
    const windowStart = now - this.windowMs;
    const recent = (this.hits.get(key) ?? []).filter((t) => t > windowStart);

    if (recent.length >= this.max) {
      this.hits.set(key, recent);
      const resetAt = recent[0] + this.windowMs;
      return {
        success: false,
        limit: this.max,
        remaining: 0,
        resetAt,
        retryAfterSeconds: Math.max(1, Math.ceil((resetAt - now) / 1000)),
      };
    }

    recent.push(now);
    this.hits.set(key, recent);
    if (this.hits.size > 10_000) this.sweep(windowStart);
    return { success: true, limit: this.max, remaining: this.max - recent.length, resetAt: recent[0] + this.windowMs, retryAfterSeconds: 0 };
  }

  /** Drop keys with no recent hits so memory can't grow without bound. */
  private sweep(windowStart: number) {
    for (const [key, times] of this.hits) {
      if (times.every((t) => t <= windowStart)) this.hits.delete(key);
    }
  }
}

/**
 * Upstash credentials from env vars only. Vercel's Upstash integration names
 * them KV_REST_API_*; a manually created database uses UPSTASH_REDIS_REST_*.
 */
function upstashCredentials(): { url: string; token: string } | null {
  const url = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;
  return url && token ? { url, token } : null;
}

function createLimiter(policy: RateLimitPolicy): Limiter {
  const { limit, windowSeconds } = RATE_LIMITS[policy];
  const memory = new MemoryRateLimiter(limit, windowSeconds * 1000);
  const credentials = upstashCredentials();
  if (!credentials) return memory;

  const upstash = new Ratelimit({
    redis: new Redis(credentials),
    limiter: Ratelimit.slidingWindow(limit, `${windowSeconds} s`),
    prefix: `lendlot:ratelimit:${policy}`,
  });
  return {
    async limit(key) {
      try {
        const result = await upstash.limit(key);
        return {
          success: result.success,
          limit: result.limit,
          remaining: result.remaining,
          resetAt: result.reset,
          retryAfterSeconds: result.success ? 0 : Math.max(1, Math.ceil((result.reset - Date.now()) / 1000)),
        };
      } catch (error) {
        console.error(`Upstash rate limiter failed for ${policy}; using in-memory limiter`, error);
        return memory.limit(key);
      }
    },
  };
}

const limiters = new Map<RateLimitPolicy, Limiter>();

export function rateLimit(policy: RateLimitPolicy, key: string): Promise<RateLimitResult> {
  let limiter = limiters.get(policy);
  if (!limiter) {
    limiter = createLimiter(policy);
    limiters.set(policy, limiter);
  }
  return limiter.limit(key);
}

/** Runs several checks (e.g. per-account and per-IP); returns the first one that blocks. */
export async function rateLimitAll(checks: [RateLimitPolicy, string][]): Promise<RateLimitResult | null> {
  for (const [policy, key] of checks) {
    const result = await rateLimit(policy, key);
    if (!result.success) return result;
  }
  return null;
}

/**
 * Sign-in attempts, limited per IP + email and per IP. Used by both the sign-in
 * Server Action and the Auth.js credentials endpoint, so the two share one budget.
 */
export function signInRateLimit(ip: string, email: string): Promise<RateLimitResult | null> {
  return rateLimitAll([
    ["signIn", `${ip}:${email.trim().toLowerCase()}`],
    ["signInIp", ip],
  ]);
}

/** Forgets all in-memory counters. Tests only. */
export function resetRateLimitsForTests() {
  limiters.clear();
}

/**
 * The caller's IP. On Vercel these headers are set by the platform and can't
 * be spoofed by the client; behind another proxy, make sure it overwrites them.
 */
export function clientIp(headers: Headers): string {
  return headers.get("x-real-ip") ?? headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
}

export function retryMessage(result: RateLimitResult): string {
  const seconds = result.retryAfterSeconds;
  const wait = seconds < 90 ? `${seconds} second${seconds === 1 ? "" : "s"}` : `${Math.ceil(seconds / 60)} minutes`;
  return `Too many requests. Please try again in ${wait}.`;
}

/** 429 response for Route Handlers, with Retry-After and rate-limit headers. */
export function tooManyRequests(result: RateLimitResult): NextResponse {
  return NextResponse.json(
    { error: retryMessage(result) },
    {
      status: 429,
      headers: {
        "Retry-After": String(result.retryAfterSeconds),
        "X-RateLimit-Limit": String(result.limit),
        "X-RateLimit-Remaining": "0",
        "X-RateLimit-Reset": String(Math.ceil(result.resetAt / 1000)),
      },
    },
  );
}
