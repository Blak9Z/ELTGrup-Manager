import { Chip } from "@heroui/react";
import { cn } from "@/src/lib/utils";

const styles: Record<string, string> = {
  success: "border border-[rgba(79,156,118,0.45)] bg-[rgba(79,156,118,0.18)] text-[#bde7cf]",
  warning: "border border-[rgba(184,142,67,0.45)] bg-[rgba(184,142,67,0.18)] text-[#eed8a8]",
  danger: "border border-[rgba(190,95,111,0.46)] bg-[rgba(190,95,111,0.18)] text-[#f6c7cf]",
  neutral: "border border-[rgba(95,122,154,0.44)] bg-[rgba(95,122,154,0.17)] text-[#d2deec]",
  info: "border border-[rgba(94,134,190,0.44)] bg-[rgba(94,134,190,0.17)] text-[#cadcf7]",
};

export function Badge({ children, tone = "neutral" }: { children: React.ReactNode; tone?: keyof typeof styles }) {
  return (
    <Chip
      variant="soft"
      className={cn("h-auto min-h-0 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.06em]", styles[tone])}
    >
      {children}
    </Chip>
  );
}
