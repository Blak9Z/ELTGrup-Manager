export default function WorkOrdersLoading() {
  return (
    <div className="space-y-4">
      <div className="h-10 w-64 animate-pulse rounded-xl bg-[rgba(60,95,150,0.35)]" />
      <div className="h-56 animate-pulse rounded-2xl border border-[var(--border)] bg-[rgba(17,29,51,0.9)]" />
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-24 animate-pulse rounded-xl border border-[var(--border)] bg-[linear-gradient(180deg,rgba(10,24,40,0.82),rgba(8,20,34,0.82))]" />
        ))}
      </div>
    </div>
  );
}
