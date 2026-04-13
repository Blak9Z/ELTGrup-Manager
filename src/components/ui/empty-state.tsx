export function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-[#355373] bg-[rgba(12,26,43,0.74)] p-8 text-center sm:p-10">
      <h3 className="text-base font-semibold text-[#edf7ff]">{title}</h3>
      <p className="mt-2 text-sm text-[#9ab4d1]">{description}</p>
    </div>
  );
}
