import { describe, expect, it } from "vitest";
import { catalogueHref, paginationRange } from "./catalogue-url";

describe("catalogueHref", () => {
  it("omits empty values and page 1", () => {
    expect(catalogueHref({})).toBe("/");
    expect(catalogueHref({ page: 1 })).toBe("/");
    expect(catalogueHref({ q: "tent", category: "outdoors", page: 2 })).toBe("/?q=tent&category=outdoors&page=2");
  });

  it("encodes the search query", () => {
    expect(catalogueHref({ q: "drill & saw" })).toBe("/?q=drill+%26+saw");
  });
});

describe("paginationRange", () => {
  it("shows every page when there are few", () => {
    expect(paginationRange(2, 5)).toEqual([1, 2, 3, 4, 5]);
  });

  it("collapses distant pages into gaps", () => {
    expect(paginationRange(5, 10)).toEqual([1, null, 4, 5, 6, null, 10]);
    expect(paginationRange(1, 10)).toEqual([1, 2, null, 10]);
  });
});
