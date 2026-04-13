export function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-[#2e4366] bg-[rgba(14,24,43,0.68)] p-10 text-center">
      <h3 className="text-base font-semibold text-[#edf3ff]">{title}</h3>
      <p className="mt-2 text-sm text-[#9eb1cb]">{description}</p>
    </div>
  );
}
