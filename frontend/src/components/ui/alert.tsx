import type { ReactNode } from 'react'
import { AlertCircle, CheckCircle2, Info, TriangleAlert } from 'lucide-react'
import { cn } from '../../lib/utils'

type Variant = 'error' | 'success' | 'info' | 'warning'

const styles: Record<Variant, { box: string; icon: ReactNode }> = {
  error: {
    box: 'border-destructive/30 bg-destructive/10 text-destructive',
    icon: <AlertCircle className="h-4 w-4" />,
  },
  success: {
    box: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
    icon: <CheckCircle2 className="h-4 w-4" />,
  },
  info: {
    box: 'border-blue-500/30 bg-blue-500/10 text-blue-600 dark:text-blue-400',
    icon: <Info className="h-4 w-4" />,
  },
  warning: {
    box: 'border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400',
    icon: <TriangleAlert className="h-4 w-4" />,
  },
}

export function Alert({
  variant = 'info',
  title,
  children,
  className,
}: {
  variant?: Variant
  title?: string
  children?: ReactNode
  className?: string
}) {
  const s = styles[variant]
  return (
    <div
      role="alert"
      className={cn('flex gap-2 rounded-[var(--radius)] border px-3 py-2 text-sm', s.box, className)}
    >
      <span className="mt-0.5 shrink-0">{s.icon}</span>
      <div className="space-y-0.5">
        {title && <p className="font-medium">{title}</p>}
        {children && <div className="opacity-90">{children}</div>}
      </div>
    </div>
  )
}
