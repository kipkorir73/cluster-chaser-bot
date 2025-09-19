import * as React from "react"
import { cn } from "@/lib/utils"

type BadgeVariant = 'default' | 'secondary' | 'destructive' | 'outline'

function getBadgeClass(variant: BadgeVariant = 'default'): string {
  const base = "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2";
  switch (variant) {
    case 'secondary':
      return cn(base, "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80");
    case 'destructive':
      return cn(base, "border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/80");
    case 'outline':
      return cn(base, "text-foreground");
    default:
      return cn(base, "border-transparent bg-primary text-primary-foreground hover:bg-primary/80");
  }
}

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: BadgeVariant
}

function Badge({ className, variant = 'default', ...props }: BadgeProps) {
  return (
    <div className={cn(getBadgeClass(variant), className)} {...props} />
  )
}

export { Badge }
