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
  default: "border border-[#4e6f90] bg-[#2a4f73] text-[#eef4fb] hover:bg-[#346089]",
  secondary: "border border-[#3a5068] bg-[#17273a] text-[color:var(--foreground)] hover:border-[#4e6987] hover:bg-[#1b2f46]",
  ghost: "border border-transparent bg-transparent text-[#cfdceb] hover:border-[#3b526b] hover:bg-[#142336]",
  destructive: "bg-[linear-gradient(180deg,#ce4a5c,#b63e4d)] text-[#fff6f7] border border-[#a93645] hover:brightness-105",
};

export function Button({ className, variant = "default", size = "default", ...props }: ButtonProps) {
  const { disabled, ...rest } = props;

  return (
    <HeroButton
      size={sizeMap[size]}
      isDisabled={disabled}
      className={cn(
        "min-w-0 rounded-xl text-sm font-semibold transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent)]/50",
        variantClassMap[variant],
        className,
      )}
      {...rest}
    />
  );
}
