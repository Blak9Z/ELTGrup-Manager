import { Card } from "@/src/components/ui/card";

export function KpiCard({ label, value, helper }: { label: string; value: string; helper?: string }) {
  return (
    <Card>
      <p className="text-xs font-semibold uppercase tracking-wide text-[#5f7265]">{label}</p>
      <p className="mt-2 text-3xl font-black text-[#13241a]">{value}</p>
      {helper ? <p className="mt-1 text-xs text-[#607366]">{helper}</p> : null}
    </Card>
  );
}
