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
  default: "bg-[linear-gradient(180deg,#3f73f2,#325fd0)] text-[#edf3ff] border border-[#3a66d8] hover:brightness-110",
  secondary: "bg-[rgba(16,26,44,0.8)] text-[color:var(--foreground)] border border-[color:var(--border)] hover:border-[#355282]",
  ghost: "bg-transparent text-[#d9e4f6] hover:bg-[rgba(53,82,130,0.24)]",
  destructive: "bg-[linear-gradient(180deg,#c85865,#a5424d)] text-[#fff2f4] border border-[#a64a53] hover:brightness-105",
};

export function Button({ className, variant = "default", size = "default", ...props }: ButtonProps) {
  const { disabled, ...rest } = props;

  return (
    <HeroButton
      size={sizeMap[size]}
      isDisabled={disabled}
      className={cn(
        "min-w-0 rounded-lg text-sm font-semibold transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent)]",
        variantClassMap[variant],
        className,
      )}
      {...rest}
    />
  );
}
