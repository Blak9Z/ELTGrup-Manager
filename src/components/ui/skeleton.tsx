import { cn } from "@/src/lib/utils";

function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("animate-pulse rounded-md bg-[rgba(255,255,255,0.05)]", className)}
      {...props}
    />
  );
}

export { Skeleton };
