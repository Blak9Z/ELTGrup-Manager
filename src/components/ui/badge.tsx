import { Chip } from "@heroui/react";
import { cn } from "@/src/lib/utils";

const styles: Record<string, string> = {
  success: "border border-[rgba(56,168,112,0.4)] bg-[rgba(56,168,112,0.16)] text-[#9ef2c7]",
  warning: "border border-[rgba(196,146,44,0.45)] bg-[rgba(196,146,44,0.15)] text-[#f2d48c]",
  danger: "border border-[rgba(197,83,98,0.46)] bg-[rgba(197,83,98,0.16)] text-[#ffc0c9]",
  neutral: "border border-[rgba(111,144,182,0.42)] bg-[rgba(111,144,182,0.16)] text-[#cfe0f6]",
  info: "border border-[rgba(63,141,221,0.42)] bg-[rgba(63,141,221,0.16)] text-[#b9dcff]",
};

export function Badge({ children, tone = "neutral" }: { children: React.ReactNode; tone?: keyof typeof styles }) {
  return (
    <Chip
      variant="soft"
      className={cn("h-auto min-h-0 rounded-full px-2.5 py-1 text-[11px] font-semibold", styles[tone])}
    >
      {children}
    </Chip>
  );
}
