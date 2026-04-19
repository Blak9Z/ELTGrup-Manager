import { Card } from "@/src/components/ui/card";

export function KpiCard({ label, value, helper }: { label: string; value: string; helper?: string }) {
  return (
    <Card className="space-y-2 rounded-xl bg-[var(--surface-card)] p-4">
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">{label}</p>
      <p className="text-2xl font-semibold leading-none text-[var(--foreground)] sm:text-[1.85rem]">{value}</p>
      {helper ? <p className="text-xs text-[var(--muted)]">{helper}</p> : null}
    </Card>
  );
}
