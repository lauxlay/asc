import * as LabelPrimitive from "@radix-ui/react-label";
import type * as React from "react";
import { cn } from "@/lib/utils";

/** Composant shadcn/ui par défaut, non personnalisé. */
export function Label({
  className,
  ...props
}: React.ComponentProps<typeof LabelPrimitive.Root>): React.JSX.Element {
  return (
    <LabelPrimitive.Root
      className={cn(
        "text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70",
        className,
      )}
      {...props}
    />
  );
}
