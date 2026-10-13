import Form from "next/form";

/**
 * A plain GET form: it works without JavaScript, and next/form upgrades it to
 * a client-side navigation when JS is available. Submitting resets to page 1.
 */
export function SearchForm({ q, category }: { q?: string; category?: string }) {
  return (
    <Form action="/" role="search" className="flex w-full max-w-xl gap-2">
      <label htmlFor="search" className="sr-only">
        Search items
      </label>
      <input
        id="search"
        name="q"
        type="search"
        defaultValue={q}
        placeholder="Search drills, tents, cameras…"
        className="input"
        maxLength={100}
      />
      {category && <input type="hidden" name="category" value={category} />}
      <button type="submit" className="btn-primary shrink-0">
        Search
      </button>
    </Form>
  );
}
