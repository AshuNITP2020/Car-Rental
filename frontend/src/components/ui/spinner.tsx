import { Loader2 } from 'lucide-react'
import { cn } from '../../lib/utils'

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn('h-5 w-5 animate-spin text-muted-foreground', className)} aria-hidden />
}

/** Full-area centered spinner for route/section loading. */
export function LoadingState({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="flex min-h-40 flex-col items-center justify-center gap-3 text-muted-foreground">
      <Spinner className="h-6 w-6" />
      <span className="text-sm">{label}</span>
    </div>
  )
}
