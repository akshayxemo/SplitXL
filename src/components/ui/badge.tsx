import * as React from "react"
import { cn } from "@/lib/utils"

function Badge({
  className,
  variant = "default",
  ...props
}: React.ComponentProps<"span"> & { variant?: "default" | "secondary" | "destructive" | "outline" }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium",
        variant === "default" && "bg-primary/10 text-primary",
        variant === "secondary" && "bg-secondary text-secondary-foreground",
        variant === "destructive" && "bg-destructive/10 text-destructive",
        variant === "outline" && "border border-border text-foreground",
        className
      )}
      {...props}
    />
  )
}

export { Badge }
