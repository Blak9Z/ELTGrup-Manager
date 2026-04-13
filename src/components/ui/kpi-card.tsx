import { Card } from "@/src/components/ui/card";

export function KpiCard({ label, value, helper }: { label: string; value: string; helper?: string }) {
  return (
    <Card className="relative overflow-hidden before:absolute before:right-[-24px] before:top-[-24px] before:h-24 before:w-24 before:rounded-full before:bg-[rgba(61,120,255,0.16)] before:content-['']">
      <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[#93a7c2]">{label}</p>
      <p className="mt-2 text-3xl font-semibold text-[#f4f7ff]">{value}</p>
      {helper ? <p className="mt-2 text-xs text-[#a7b8d0]">{helper}</p> : null}
    </Card>
  );
}
