import { expect, test, type Page } from "@playwright/test";
import { signIn } from "./helpers";

/** Collects CSP violations reported by the browser while a page is used. */
async function trackCspViolations(page: Page) {
  const violations: string[] = [];
  page.on("console", (message) => {
    if (/Content Security Policy/i.test(message.text())) violations.push(message.text());
  });
  await page.addInitScript(() => {
    document.addEventListener("securitypolicyviolation", (event) => {
      console.error(`Content Security Policy violation: ${event.violatedDirective} ${event.blockedURI}`);
    });
  });
  return violations;
}

test.describe("security headers", () => {
  for (const path of ["/", "/items/cordless-drill-driver-kit", "/api/items?category=tools"]) {
    test(`${path} sends the security headers`, async ({ request }) => {
      const response = await request.get(path);
      const headers = response.headers();
      expect(headers["content-security-policy"]).toContain("frame-ancestors 'none'");
      expect(headers["content-security-policy"]).toContain("object-src 'none'");
      expect(headers["strict-transport-security"]).toContain("max-age=");
      expect(headers["x-content-type-options"]).toBe("nosniff");
      expect(headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");
      expect(headers["permissions-policy"]).toContain("camera=()");
      expect(headers["x-powered-by"]).toBeUndefined();
    });
  }
});

test.describe("content security policy", () => {
  test("main pages run without CSP violations", async ({ page }) => {
    const violations = await trackCspViolations(page);
    for (const path of ["/", "/?category=photo", "/items/cordless-drill-driver-kit", "/login", "/signup"]) {
      await page.goto(path);
      await page.waitForLoadState("networkidle");
    }
    // The calendar is client-rendered: proves scripts and the availability fetch ran.
    await page.goto("/items/cordless-drill-driver-kit");
    await expect(page.getByRole("grid")).toBeVisible();

    await signIn(page, "owner@lendlot.test");
    for (const path of ["/dashboard/bookings", "/dashboard/listings", "/dashboard/earnings", "/dashboard/membership"]) {
      await page.goto(path);
      await page.waitForLoadState("networkidle");
    }
    expect(violations).toEqual([]);
  });
});
