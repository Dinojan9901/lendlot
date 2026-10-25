// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

// The route's collaborators are mocked; this test is about the HTTP contract.
vi.mock("@/server/session", () => ({
  getCurrentUser: vi.fn(async () => ({ id: "user_1", name: "Alex", email: "a@example.com", role: "RENTER" })),
}));
vi.mock("@/server/bookings", () => ({
  createBooking: vi.fn(async () => ({ id: "b1", totalCents: 2000, status: "CONFIRMED" })),
  listBookingsForRenter: vi.fn(async () => []),
}));

const { POST } = await import("./route");
const { RATE_LIMITS, resetRateLimitsForTests } = await import("@/server/rate-limit");
const { getCurrentUser } = await import("@/server/session");

const day = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);
const post = () =>
  POST(
    new Request("http://localhost/api/bookings", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ itemId: "item_1", startDate: day(5), endDate: day(6) }),
    }),
  );

describe("POST /api/bookings rate limiting", () => {
  beforeEach(() => resetRateLimitsForTests());

  it("allows bookings up to the limit, then answers 429 with Retry-After", async () => {
    for (let i = 0; i < RATE_LIMITS.booking.limit; i++) expect((await post()).status).toBe(201);

    const limited = await post();
    expect(limited.status).toBe(429);
    expect(Number(limited.headers.get("Retry-After"))).toBeGreaterThan(0);
    expect(await limited.json()).toMatchObject({ error: expect.stringMatching(/Too many requests/) });
  });

  it("checks authentication before spending the rate limit", async () => {
    vi.mocked(getCurrentUser).mockResolvedValueOnce(null);
    expect((await post()).status).toBe(401);
  });
});
