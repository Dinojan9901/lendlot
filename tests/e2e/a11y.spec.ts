import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { signIn } from "./helpers";

async function expectNoAxeViolations(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  const summary = results.violations.map((v) => `${v.id}: ${v.help} (${v.nodes.length} nodes)`);
  expect(summary).toEqual([]);
}

test.describe("accessibility (axe)", () => {
  for (const path of ["/", "/?category=photo", "/items/cordless-drill-driver-kit", "/login", "/signup"]) {
    test(`${path} has no detectable WCAG A/AA violations`, async ({ page }) => {
      await page.goto(path);
      await page.waitForLoadState("networkidle");
      await expectNoAxeViolations(page);
    });
  }

  test("My bookings has no detectable WCAG A/AA violations", async ({ page }) => {
    await signIn(page, "renter@lendlot.test");
    await page.goto("/dashboard/bookings");
    await expect(page.getByRole("heading", { name: "My bookings" })).toBeVisible();
    await expectNoAxeViolations(page);
  });

  test("the calendar can be operated with the keyboard", async ({ page }) => {
    await page.goto("/items/folding-banquet-tables");
    const grid = page.getByRole("grid");
    await expect(grid).toBeVisible();
    // One tab stop for the whole grid: focus it, then move with arrow keys.
    await grid.locator('button[tabindex="0"]').focus();
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Enter");
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("Enter");
    await expect(page.getByTestId("total-price")).toHaveText("$96.00"); // 3 days × $32
  });
});
