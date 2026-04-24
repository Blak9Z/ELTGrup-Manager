import { memo } from "react";
import { Card } from "@/src/components/ui/card";

export const KpiCard = memo(function KpiCard({ label, value, helper }: { label: string; value: string; helper?: string }) {
  return (
    <Card className="space-y-2 rounded-xl bg-[linear-gradient(180deg,rgba(20,31,46,0.96),rgba(13,22,33,0.96))] p-4">
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">{label}</p>
      <p className="bg-[linear-gradient(180deg,#f4fbff,#b5d0ed)] bg-clip-text text-2xl font-semibold leading-none text-transparent sm:text-[1.85rem]">
        {value}
      </p>
      {helper ? <p className="text-xs text-[var(--muted)]">{helper}</p> : null}
    </Card>
  );
});
