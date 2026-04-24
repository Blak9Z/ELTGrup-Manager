"use client";

import { Button } from "@/src/components/ui/button";

export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="rounded-2xl border border-[#6e2f39] bg-[linear-gradient(180deg,rgba(59,24,30,0.95),rgba(38,16,20,0.95))] p-6 shadow-[0_22px_52px_-36px_rgba(193,69,89,0.8)]">
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#f0aeb8]">Incident</p>
      <p className="mt-2 text-lg font-semibold text-[#ffc8cf]">A aparut o eroare in modulul curent</p>
      <p className="mt-2 text-sm text-[#f2b8bf]">{error.message || "Eroare necunoscuta"}</p>
      <Button className="mt-4" onClick={() => reset()}>
        Reincearca
      </Button>
    </div>
  );
}
