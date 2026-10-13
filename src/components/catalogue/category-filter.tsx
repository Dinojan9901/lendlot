import Link from "next/link";
import { catalogueHref } from "@/lib/catalogue-url";

type Props = {
  categories: { slug: string; name: string }[];
  active?: string;
  q?: string;
};

export function CategoryFilter({ categories, active, q }: Props) {
  const options = [{ slug: undefined, name: "All" }, ...categories];
  return (
    <nav aria-label="Categories">
      <ul className="flex flex-wrap gap-2">
        {options.map((category) => {
          const isActive = category.slug === active;
          return (
            <li key={category.slug ?? "all"}>
              <Link
                href={catalogueHref({ q, category: category.slug })}
                aria-current={isActive ? "page" : undefined}
                className={`inline-block rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors ${
                  isActive
                    ? "border-brand-700 bg-brand-700 text-white"
                    : "border-line bg-white text-muted hover:border-stone-400 hover:text-ink"
                }`}
              >
                {category.name}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
