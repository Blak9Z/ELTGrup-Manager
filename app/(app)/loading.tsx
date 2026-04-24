export default function LoadingApp() {
  return (
    <div className="space-y-4">
      <div className="shimmer h-10 w-72 rounded-xl bg-[rgba(60,95,150,0.35)]" />
      <div className="shimmer h-48 rounded-2xl border border-[var(--border)] bg-[rgba(17,29,51,0.9)]" />
      <div className="shimmer h-48 rounded-2xl border border-[var(--border)] bg-[rgba(17,29,51,0.9)]" />
    </div>
  );
}
