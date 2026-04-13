export default function LoadingApp() {
  return (
    <div className="space-y-4">
      <div className="h-10 w-72 animate-pulse rounded-xl bg-[rgba(60,95,150,0.35)]" />
      <div className="h-48 animate-pulse rounded-2xl border border-[var(--border)] bg-[rgba(17,29,51,0.9)]" />
      <div className="h-48 animate-pulse rounded-2xl border border-[var(--border)] bg-[rgba(17,29,51,0.9)]" />
    </div>
  );
}
