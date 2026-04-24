export function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-[var(--border-strong)] bg-[linear-gradient(180deg,rgba(16,26,38,0.95),rgba(12,21,31,0.92))] p-8 text-center sm:p-10">
      <div className="mx-auto mb-3 h-2 w-20 rounded-full bg-[linear-gradient(90deg,rgba(132,177,227,0.2),rgba(138,187,239,0.7),rgba(132,177,227,0.2))]" />
      <h3 className="text-base font-semibold text-[var(--foreground)]">{title}</h3>
      <p className="mt-2 text-sm text-[var(--muted)]">{description}</p>
    </div>
  );
}
