import { describe, expect, it } from "vitest";
import { safeRedirectPath } from "./safe-redirect";

describe("safeRedirectPath", () => {
  it.each([
    ["/dashboard/bookings", "/dashboard/bookings"],
    ["/items/tent?x=1#calendar", "/items/tent?x=1#calendar"],
  ])("keeps same-site path %s", (input, expected) => {
    expect(safeRedirectPath(input)).toBe(expected);
  });

  it.each([
    "https://evil.example/phish",
    "//evil.example",
    "/\\evil.example",
    "\\\\evil.example",
    "javascript:alert(1)",
    "/\tevil",
    "",
    null,
    42,
  ])("rejects %j", (input) => {
    expect(safeRedirectPath(input, "/fallback")).toBe("/fallback");
  });
});
