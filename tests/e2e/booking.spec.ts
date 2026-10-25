import { expect, test } from "@playwright/test";
import { dayFromToday, pickCalendarDay, signIn } from "./helpers";

test.describe("booking flow", () => {
  test("browse → pick dates → book → see it in My bookings", async ({ page }) => {
    await signIn(page, "renter@lendlot.test");

    // Browse: search and filter the catalogue.
    await page.goto("/");
    await page.getByRole("link", { name: "Camping & Outdoors" }).click();
    await expect(page).toHaveURL(/category=outdoors/);
    await page.getByRole("searchbox", { name: "Search items" }).fill("stove");
    await page.getByRole("button", { name: "Search" }).click();
    await expect(page).toHaveURL(/q=stove/);
    await expect(page.getByRole("status")).toHaveText(/1 item/);

    // Open the item.
    await page.getByRole("link", { name: "Two-burner camping stove" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Two-burner camping stove" })).toBeVisible();

    // Pick a 3-day range on the calendar: $9/day × 3 = $27.
    const start = dayFromToday(20);
    const end = dayFromToday(22);
    await pickCalendarDay(page, start);
    await pickCalendarDay(page, end);
    await expect(page.getByLabel("Start date")).toHaveValue(start);
    await expect(page.getByLabel("End date")).toHaveValue(end);
    await expect(page.getByTestId("total-price")).toHaveText("$27.00");

    // Confirm (Server Action) and land on My bookings.
    await page.getByRole("button", { name: "Confirm booking" }).click();
    await expect(page).toHaveURL(/\/dashboard\/bookings\?booked=/);
    await expect(page.getByRole("status").filter({ hasText: "Booked!" })).toContainText("Two-burner camping stove");
    const row = page.getByTestId("booking-row").filter({ hasText: "Two-burner camping stove" });
    await expect(row).toContainText("$27.00");

    // Booking the same dates again is rejected by the database constraint.
    await page.goto("/items/two-burner-camping-stove");
    await expect(page.getByRole("grid")).toBeVisible();
    await page.getByLabel("Start date").fill(start);
    await page.getByLabel("End date").fill(end);
    await page.getByRole("button", { name: "Confirm booking" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "just booked" })).toBeVisible();
  });

  test("signed-out users are sent to sign in, then back to the item", async ({ page }) => {
    await page.goto("/items/sit-on-top-kayak");
    await expect(page.getByRole("grid")).toBeVisible(); // hydrated and interactive
    await page.getByLabel("Start date").fill(dayFromToday(25));
    await page.getByLabel("End date").fill(dayFromToday(26));
    await page.getByRole("button", { name: "Confirm booking" }).click();

    await expect(page).toHaveURL(/\/login\?callbackUrl=%2Fitems%2Fsit-on-top-kayak/);
    // The form carrying callbackUrl streams in and replaces the shell's placeholder form.
    await page.waitForLoadState("networkidle");
    await page.getByLabel("Email").fill("renter@lendlot.test");
    await page.getByLabel("Password").fill("lendlot-demo");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/items\/sit-on-top-kayak$/);
  });

  test("invalid dates focus the first invalid field", async ({ page }) => {
    await signIn(page, "renter@lendlot.test");
    await page.goto("/items/sit-on-top-kayak");
    await expect(page.getByRole("grid")).toBeVisible(); // hydrated and interactive
    await page.getByLabel("Start date").fill(dayFromToday(10));
    await page.getByLabel("End date").fill(dayFromToday(5));
    await page.getByRole("button", { name: "Confirm booking" }).click();

    const endDate = page.getByLabel("End date");
    await expect(endDate).toHaveAttribute("aria-invalid", "true");
    await expect(endDate).toBeFocused();
    await expect(page.getByText("End date must be on or after the start date")).toBeVisible();
  });
});
