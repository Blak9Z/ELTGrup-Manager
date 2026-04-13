"use client";

import { Button } from "@/src/components/ui/button";

export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="rounded-2xl border border-[#6e2f39] bg-[linear-gradient(180deg,rgba(59,24,30,0.95),rgba(38,16,20,0.95))] p-6">
      <p className="text-lg font-semibold text-[#ffc8cf]">A aparut o eroare in modulul curent</p>
      <p className="mt-2 text-sm text-[#f2b8bf]">{error.message || "Eroare necunoscuta"}</p>
      <Button className="mt-4" onClick={() => reset()}>
        Reincearca
      </Button>
    </div>
  );
}
