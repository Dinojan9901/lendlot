import { describe, expect, it } from "vitest";
import { isActiveMember } from "./membership";

const now = new Date("2026-10-13T12:00:00Z");

describe("isActiveMember", () => {
  it("is true for an active subscription inside the paid period", () => {
    expect(isActiveMember({ membershipStatus: "ACTIVE", membershipPeriodEnd: "2026-11-13T12:00:00Z" }, now)).toBe(true);
  });

  it.each([
    ["no membership", { membershipStatus: "NONE", membershipPeriodEnd: null }],
    ["payment failed", { membershipStatus: "PAST_DUE", membershipPeriodEnd: "2026-11-13T12:00:00Z" }],
    ["cancelled", { membershipStatus: "CANCELED", membershipPeriodEnd: "2026-11-13T12:00:00Z" }],
    ["period already ended", { membershipStatus: "ACTIVE", membershipPeriodEnd: "2026-10-01T00:00:00Z" }],
  ])("is false when %s", (_label, user) => {
    expect(isActiveMember(user, now)).toBe(false);
  });

  it("is false for signed-out visitors", () => {
    expect(isActiveMember(null, now)).toBe(false);
  });
});
