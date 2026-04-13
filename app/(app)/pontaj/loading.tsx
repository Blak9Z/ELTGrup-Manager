export default function PontajLoading() {
  return (
    <div className="space-y-4">
      <div className="h-10 w-56 animate-pulse rounded-xl bg-[rgba(60,95,150,0.35)]" />
      <div className="h-24 animate-pulse rounded-2xl border border-[color:var(--border)] bg-[rgba(17,29,51,0.9)]" />
      <div className="h-56 animate-pulse rounded-2xl border border-[color:var(--border)] bg-[rgba(17,29,51,0.9)]" />
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-24 animate-pulse rounded-xl border border-[color:var(--border)] bg-[rgba(12,22,39,0.85)]" />
        ))}
      </div>
    </div>
  );
}
