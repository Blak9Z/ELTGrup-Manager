import { cn } from "@/src/lib/utils";

const styles: Record<string, string> = {
  success: "bg-[#ddf5e4] text-[#0b6a36]",
  warning: "bg-[#fff1d6] text-[#8a5a00]",
  danger: "bg-[#fce0e1] text-[#8f1f28]",
  neutral: "bg-[#edf2ee] text-[#425347]",
  info: "bg-[#dff1ff] text-[#115886]",
};

export function Badge({ children, tone = "neutral" }: { children: React.ReactNode; tone?: keyof typeof styles }) {
  return <span className={cn("inline-flex rounded-full px-2.5 py-1 text-xs font-semibold", styles[tone])}>{children}</span>;
}
