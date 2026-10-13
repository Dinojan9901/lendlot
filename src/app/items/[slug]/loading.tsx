export default function ItemLoading() {
  return (
    <div className="mx-auto max-w-6xl animate-pulse px-4 py-8 sm:px-6" aria-busy="true" aria-label="Loading item">
      <div className="mb-6 h-4 w-48 rounded bg-stone-200" />
      <div className="grid gap-10 lg:grid-cols-[1fr_380px]">
        <div>
          <div className="aspect-[3/2] rounded-2xl bg-stone-200" />
          <div className="mt-6 h-8 w-2/3 rounded bg-stone-200" />
          <div className="mt-3 h-4 w-1/3 rounded bg-stone-200" />
        </div>
        <div className="h-[560px] rounded-2xl bg-stone-200" />
      </div>
    </div>
  );
}
