import Link from "next/link";

export default function ItemNotFound() {
  return (
    <div className="mx-auto max-w-xl px-4 py-20 text-center">
      <h1 className="text-2xl font-bold text-ink">This item isn&apos;t available</h1>
      <p className="mt-2 text-muted">It may have been removed by its owner, or the link is wrong.</p>
      <Link href="/" className="btn-primary mt-6">
        Browse other items
      </Link>
    </div>
  );
}
