export function CatalogueSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading items" className="animate-pulse">
      <div className="h-11 max-w-xl rounded-lg bg-stone-200" />
      <div className="mt-4 flex gap-2">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="h-8 w-24 rounded-full bg-stone-200" />
        ))}
      </div>
      <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="card overflow-hidden">
            <div className="aspect-[3/2] bg-stone-200" />
            <div className="space-y-2 p-4">
              <div className="h-3 w-20 rounded bg-stone-200" />
              <div className="h-4 w-3/4 rounded bg-stone-200" />
              <div className="h-4 w-1/3 rounded bg-stone-200" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
