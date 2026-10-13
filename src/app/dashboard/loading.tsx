export default function DashboardLoading() {
  return (
    <div className="animate-pulse space-y-4" aria-busy="true" aria-label="Loading">
      <div className="h-8 w-48 rounded bg-stone-200" />
      {Array.from({ length: 3 }, (_, i) => (
        <div key={i} className="h-24 rounded-2xl bg-stone-200" />
      ))}
    </div>
  );
}
