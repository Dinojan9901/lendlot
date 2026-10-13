import { expect, test } from "@playwright/test";
import { signIn } from "./helpers";

test.describe("route protection", () => {
  test("signed-out users are redirected to sign in", async ({ page }) => {
    await page.goto("/dashboard/bookings");
    await expect(page).toHaveURL(/\/login\?callbackUrl=%2Fdashboard%2Fbookings/);
  });

  test("renters cannot open owner or admin pages", async ({ page }) => {
    await signIn(page, "renter@lendlot.test");
    await page.goto("/dashboard/listings");
    await expect(page).toHaveURL(/\/forbidden$/);
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/forbidden$/);
  });

  test("owners see only their own listings and can't edit others'", async ({ page, request }) => {
    await signIn(page, "owner@lendlot.test");
    await page.goto("/dashboard/listings");
    await expect(page.getByRole("heading", { name: "My listings" })).toBeVisible();
    await expect(page.getByRole("link", { name: "18V cordless drill & driver kit", exact: true })).toBeVisible();
    // The wet tile saw belongs to another owner.
    await expect(page.getByRole("link", { name: "Wet tile saw with folding stand", exact: true })).toHaveCount(0);

    const other = await request.get("/api/items?q=tile");
    const { items } = (await other.json()) as { items: { id: string }[] };
    const response = await page.goto(`/dashboard/listings/${items[0].id}/edit`);
    await expect(page.getByRole("heading", { name: /not found/i })).toBeVisible();
    expect(response?.status()).toBeLessThan(500);
  });
});
