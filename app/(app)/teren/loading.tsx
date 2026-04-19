export default function TerenLoading() {
  return (
    <div className="space-y-5">
      <div className="h-20 animate-pulse rounded-2xl border border-[var(--border)]/70 bg-[var(--surface-card)]" />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-24 animate-pulse rounded-2xl border border-[var(--border)]/70 bg-[var(--surface-card)]" />
        ))}
      </div>
      <div className="grid gap-4 xl:grid-cols-[1fr_1.2fr_1fr]">
        <div className="h-80 animate-pulse rounded-2xl border border-[var(--border)]/70 bg-[var(--surface-card)]" />
        <div className="h-80 animate-pulse rounded-2xl border border-[var(--border)]/70 bg-[var(--surface-card)]" />
        <div className="h-80 animate-pulse rounded-2xl border border-[var(--border)]/70 bg-[var(--surface-card)]" />
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <div className="h-72 animate-pulse rounded-2xl border border-[var(--border)]/70 bg-[var(--surface-card)]" />
        <div className="h-72 animate-pulse rounded-2xl border border-[var(--border)]/70 bg-[var(--surface-card)]" />
      </div>
    </div>
  );
}
