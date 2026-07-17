import type { ReactNode } from 'react'
import { cn } from '../../lib/utils'

/** Label + control + inline error, for use with react-hook-form. */
export function Field({
  label,
  htmlFor,
  error,
  hint,
  required,
  children,
  className,
}: {
  label?: string
  htmlFor?: string
  error?: string
  hint?: string
  required?: boolean
  children: ReactNode
  className?: string
}) {
  return (
    <div className={cn('space-y-1.5', className)}>
      {label && (
        <label htmlFor={htmlFor} className="block text-sm font-medium">
          {label}
          {required && <span className="ml-0.5 text-destructive">*</span>}
        </label>
      )}
      {children}
      {error ? (
        <p className="text-xs text-destructive">{error}</p>
      ) : hint ? (
        <p className="text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  )
}
