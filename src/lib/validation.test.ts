import { describe, expect, it } from "vitest";
import { bookingInputSchema, fieldErrors, listingInputSchema, parseCatalogueParams } from "./validation";

const TODAY = "2026-10-13";
const schema = bookingInputSchema(TODAY);

describe("bookingInputSchema", () => {
  it("accepts a valid future range", () => {
    expect(schema.safeParse({ itemId: "x", startDate: "2026-10-20", endDate: "2026-10-22" }).success).toBe(true);
  });

  it.each([
    [{ startDate: "2026-10-12", endDate: "2026-10-14" }, "startDate", "Start date cannot be in the past"],
    [{ startDate: "2026-10-20", endDate: "2026-10-19" }, "endDate", "End date must be on or after the start date"],
    [{ startDate: "2026-10-20", endDate: "2026-11-20" }, "endDate", "Rentals can be at most 30 days"],
    [{ startDate: "", endDate: "2026-10-22" }, "startDate", "Choose a start date"],
  ])("rejects %o on %s", (dates, field, message) => {
    const result = schema.safeParse({ itemId: "x", ...dates });
    expect(result.success).toBe(false);
    if (!result.success) expect(fieldErrors(result.error)[field]).toBe(message);
  });
});

describe("parseCatalogueParams", () => {
  it("parses valid params", () => {
    expect(parseCatalogueParams({ q: " tent ", category: "outdoors", page: "2" })).toEqual({
      q: "tent",
      category: "outdoors",
      page: 2,
    });
  });

  it("falls back to safe defaults for junk from the URL", () => {
    expect(parseCatalogueParams({ category: "<script>", page: "-4" })).toEqual({ q: undefined, category: undefined, page: 1 });
    expect(parseCatalogueParams({ page: ["3", "9"] }).page).toBe(3);
  });
});

describe("listingInputSchema", () => {
  const valid = {
    title: "Camping stove",
    description: "A reliable two-burner stove for weekend trips.",
    dailyPrice: "9.50",
    location: "Riverside",
    categoryId: "c1",
    imageUrl: "/items/two-burner-camping-stove.webp",
  };

  it("converts the dollar price to integer cents", () => {
    expect(listingInputSchema.parse(valid).dailyPrice).toBe(950);
  });

  it("only allows local or approved image hosts", () => {
    const result = listingInputSchema.safeParse({ ...valid, imageUrl: "https://evil.example/x.png" });
    expect(result.success).toBe(false);
  });
});
