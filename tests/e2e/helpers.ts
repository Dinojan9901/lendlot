import { expect, type Page } from "@playwright/test";
import { addDays, todayIso } from "../../src/lib/dates";
import { monthOf } from "../../src/lib/calendar";

export const DEMO_PASSWORD = "lendlot-demo";

export async function signIn(page: Page, email: string) {
  await page.goto("/login");
  // The real form streams in and replaces the placeholder in the static shell.
  await page.waitForLoadState("networkidle");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(DEMO_PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("button", { name: "Sign out" })).toBeVisible();
}

export const dayFromToday = (offset: number) => addDays(todayIso(), offset);

/** Clicks a day in the availability calendar, paging forward a month if needed. */
export async function pickCalendarDay(page: Page, isoDate: string) {
  const grid = page.getByRole("grid");
  await expect(grid).toBeVisible();
  for (let i = 0; i < 3; i++) {
    const day = grid.locator(`button[data-date="${isoDate}"]`);
    if (await day.count()) {
      await day.click();
      return;
    }
    await page.getByRole("button", { name: "Next month" }).click();
  }
  throw new Error(`Day ${isoDate} (${monthOf(isoDate)}) not found in calendar`);
}
