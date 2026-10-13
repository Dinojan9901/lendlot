import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Pagination } from "./pagination";

describe("Pagination", () => {
  it("renders nothing for a single page", () => {
    const { container } = render(<Pagination page={1} pageCount={1} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("marks the current page and keeps filters in the links", () => {
    render(<Pagination page={2} pageCount={3} q="tent" category="outdoors" />);
    const nav = screen.getByRole("navigation", { name: "Pagination" });
    expect(nav).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Page 2" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Page 3" })).toHaveAttribute("href", "/?q=tent&category=outdoors&page=3");
    expect(screen.getByRole("link", { name: "Previous" })).toHaveAttribute("href", "/?q=tent&category=outdoors");
  });

  it("disables Previous on the first page", () => {
    render(<Pagination page={1} pageCount={3} />);
    expect(screen.queryByRole("link", { name: "Previous" })).not.toBeInTheDocument();
    expect(screen.getByText("Previous")).toHaveAttribute("aria-disabled", "true");
  });
});
