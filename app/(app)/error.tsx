"use client";

import { Button } from "@/src/components/ui/button";

export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="rounded-xl border border-[#f2d2d4] bg-[#fff4f5] p-6">
      <p className="text-lg font-bold text-[#8f1f28]">A aparut o eroare</p>
      <p className="mt-2 text-sm text-[#89333a]">{error.message || "Eroare necunoscuta"}</p>
      <Button className="mt-4" onClick={() => reset()}>
        Reincearca
      </Button>
    </div>
  );
}
