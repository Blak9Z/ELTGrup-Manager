import * as React from "react";
import { Button as HeroButton } from "@heroui/react";
import { cn } from "@/src/lib/utils";

type BaseHeroButtonProps = Omit<React.ComponentProps<typeof HeroButton>, "variant" | "size" | "color">;

export interface ButtonProps extends BaseHeroButtonProps {
  variant?: "default" | "secondary" | "ghost" | "destructive";
  size?: "sm" | "default" | "lg";
  disabled?: boolean;
}

const sizeMap = {
  sm: "sm",
  default: "md",
  lg: "lg",
} as const;

const variantClassMap: Record<NonNullable<ButtonProps["variant"]>, string> = {
  default:
    "border border-[#6286aa] bg-[linear-gradient(180deg,#4f739a,#3f617f)] text-[#eef5ff] shadow-[0_12px_24px_-16px_rgba(66,105,144,0.88)] hover:-translate-y-px hover:border-[#84a6c7] hover:bg-[linear-gradient(180deg,#5b81ab,#486f92)] hover:shadow-[0_16px_32px_-18px_rgba(94,143,196,0.8)]",
  secondary:
    "border border-[var(--border)] bg-[var(--surface-card)] text-[var(--foreground)] hover:-translate-y-px hover:border-[var(--border-strong)] hover:bg-[var(--surface-2)] hover:shadow-[0_10px_24px_-20px_rgba(109,158,211,0.78)]",
  ghost:
    "border border-transparent bg-transparent text-[var(--muted-strong)] hover:border-[var(--border)] hover:bg-[var(--surface-card)] hover:text-[var(--foreground)]",
  destructive:
    "border border-[#8b3140] bg-[linear-gradient(180deg,#ba5362,#9f3d4b)] text-[#fff6f8] shadow-[0_10px_18px_-14px_rgba(170,66,83,0.85)] hover:-translate-y-px hover:border-[#a34755] hover:bg-[linear-gradient(180deg,#c15b6a,#a54553)]",
};

export function Button({ className, variant = "default", size = "default", ...props }: ButtonProps) {
  const { disabled, ...rest } = props;

  return (
    <HeroButton
      size={sizeMap[size]}
      isDisabled={disabled}
      className={cn(
        "min-w-0 rounded-lg text-sm font-semibold transition-all duration-150 active:translate-y-px data-[disabled=true]:translate-y-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent)]/40",
        variantClassMap[variant],
        className,
      )}
      {...rest}
    />
  );
}
