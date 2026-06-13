import { cn } from "@/lib/utils"

interface LogoPlaceholderProps {
  className?: string
  src?: string
  alt?: string
}

export function LogoPlaceholder({ className, src, alt = "SplitXL" }: LogoPlaceholderProps) {
  if (src) {
    return <img src={src} alt={alt} className={cn("object-contain", className)} />
  }

  return (
    <div
      className={cn(
        "flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold text-sm",
        className
      )}
      aria-label={alt}
    >
      SX
    </div>
  )
}
