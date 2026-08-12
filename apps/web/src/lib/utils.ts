import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/** Utilitaire standard de shadcn/ui : fusionne les classes sans conflit Tailwind. */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
