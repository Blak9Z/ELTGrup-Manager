import { Card } from "@/src/components/ui/card";

export function KpiCard({ label, value, helper }: { label: string; value: string; helper?: string }) {
  return (
    <Card className="space-y-2">
      <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[#8ea2b8]">{label}</p>
      <p className="text-2xl font-semibold text-[#ecf3fa] sm:text-[1.8rem]">{value}</p>
      {helper ? <p className="text-xs text-[#a0b3c7]">{helper}</p> : null}
    </Card>
  );
}
