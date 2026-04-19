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
    "border border-[#5f7f9f] bg-[linear-gradient(180deg,#4b6f95,#3f617f)] text-[#eef5ff] shadow-[0_10px_18px_-14px_rgba(66,105,144,0.8)] hover:border-[#7a9bbc] hover:bg-[linear-gradient(180deg,#547ba4,#456b8e)]",
  secondary:
    "border border-[var(--border)] bg-[var(--surface-card)] text-[var(--foreground)] hover:border-[var(--border-strong)] hover:bg-[var(--surface-2)]",
  ghost:
    "border border-transparent bg-transparent text-[var(--muted-strong)] hover:border-[var(--border)] hover:bg-[var(--surface-card)] hover:text-[var(--foreground)]",
  destructive:
    "border border-[#8b3140] bg-[linear-gradient(180deg,#ba5362,#9f3d4b)] text-[#fff6f8] shadow-[0_10px_18px_-14px_rgba(170,66,83,0.85)] hover:border-[#a34755] hover:bg-[linear-gradient(180deg,#c15b6a,#a54553)]",
};

export function Button({ className, variant = "default", size = "default", ...props }: ButtonProps) {
  const { disabled, ...rest } = props;

  return (
    <HeroButton
      size={sizeMap[size]}
      isDisabled={disabled}
      className={cn(
        "min-w-0 rounded-lg text-sm font-semibold transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent)]/40",
        variantClassMap[variant],
        className,
      )}
      {...rest}
    />
  );
}
