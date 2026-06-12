import { cn } from "@/lib/utils"

function Progress({ value, className }: { value: number; className?: string }) {
  const clamped = Math.min(100, Math.max(0, value))
  return (
    <div className={cn("h-2 w-full overflow-hidden rounded-full bg-muted", className)}>
      <div
        className={cn(
          "h-full rounded-full transition-all",
          clamped > 100 ? "bg-destructive" : "bg-primary"
        )}
        style={{ width: `${Math.min(clamped, 100)}%` }}
      />
    </div>
  )
}

export { Progress }
