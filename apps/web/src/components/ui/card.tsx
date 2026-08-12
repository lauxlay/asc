import type * as React from "react";
import { cn } from "@/lib/utils";

/** Composants shadcn/ui par défaut, non personnalisés. */

type DivProps = React.HTMLAttributes<HTMLDivElement>;

export function Card({ className, ...props }: DivProps): React.JSX.Element {
  return (
    <div
      className={cn(
        "rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] text-[var(--color-card-foreground)] shadow",
        className,
      )}
      {...props}
    />
  );
}

export function CardHeader({ className, ...props }: DivProps): React.JSX.Element {
  return <div className={cn("flex flex-col space-y-1.5 p-6", className)} {...props} />;
}

export function CardTitle({ className, ...props }: DivProps): React.JSX.Element {
  return <h2 className={cn("font-semibold leading-none tracking-tight", className)} {...props} />;
}

export function CardDescription({ className, ...props }: DivProps): React.JSX.Element {
  return <p className={cn("text-sm text-[var(--color-muted-foreground)]", className)} {...props} />;
}

export function CardContent({ className, ...props }: DivProps): React.JSX.Element {
  return <div className={cn("p-6 pt-0", className)} {...props} />;
}

export function CardFooter({ className, ...props }: DivProps): React.JSX.Element {
  return <div className={cn("flex items-center p-6 pt-0", className)} {...props} />;
}
