import { Chip } from "@heroui/react";
import { cn } from "@/src/lib/utils";

const styles: Record<string, string> = {
  success: "border border-[rgba(73,185,130,0.4)] bg-[rgba(69,185,127,0.16)] text-[#8ef5c1]",
  warning: "border border-[rgba(213,170,69,0.4)] bg-[rgba(213,170,69,0.14)] text-[#f2cf77]",
  danger: "border border-[rgba(217,95,106,0.45)] bg-[rgba(217,95,106,0.16)] text-[#ffb7bf]",
  neutral: "border border-[rgba(132,156,186,0.35)] bg-[rgba(132,156,186,0.14)] text-[#cdd8ea]",
  info: "border border-[rgba(95,160,255,0.4)] bg-[rgba(95,160,255,0.16)] text-[#bad6ff]",
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
