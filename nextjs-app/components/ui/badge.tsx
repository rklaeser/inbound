import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-md border px-2.5 py-0.5 text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary text-primary-foreground shadow hover:bg-primary/80",
        secondary:
          "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
        destructive:
          "border-destructive/20 bg-destructive/10 text-destructive",
        outline: "text-foreground",
        success:
          "border-green-500/20 bg-green-500/10 text-green-500",
        warning:
          "border-amber-500/20 bg-amber-500/10 text-amber-500",
        info:
          "border-blue-500/20 bg-blue-500/10 text-blue-500",
        muted:
          "border-muted-foreground/20 bg-muted-foreground/10 text-muted-foreground",
        processing:
          "border-violet-500/20 bg-violet-500/10 text-violet-500",
        purple:
          "border-purple-500/20 bg-purple-500/10 text-purple-500",
        cyan:
          "border-cyan-500/20 bg-cyan-500/10 text-cyan-500",
        pink:
          "border-pink-500/20 bg-pink-500/10 text-pink-500",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

export { Badge, badgeVariants }
