export default function DashboardLoading() {
  return (
    <div className="space-y-4">
      <div className="h-10 w-64 animate-pulse rounded-xl bg-[rgba(60,95,150,0.35)]" />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-28 animate-pulse rounded-2xl border border-[var(--border)] bg-[rgba(17,29,51,0.9)]" />
        ))}
      </div>
      <div className="grid gap-4 xl:grid-cols-[2fr_1fr]">
        <div className="h-72 animate-pulse rounded-2xl border border-[var(--border)] bg-[rgba(17,29,51,0.9)]" />
        <div className="h-72 animate-pulse rounded-2xl border border-[var(--border)] bg-[rgba(17,29,51,0.9)]" />
      </div>
    </div>
  );
}
