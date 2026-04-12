export function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-xl border border-dashed border-[#c8d8cd] bg-[#f7fbf8] p-8 text-center">
      <h3 className="text-base font-semibold text-[#1d2f22]">{title}</h3>
      <p className="mt-2 text-sm text-[#5c6d61]">{description}</p>
    </div>
  );
}
