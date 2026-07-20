import { forwardRef, type SelectHTMLAttributes } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '../../lib/utils'

export type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & { invalid?: boolean }

/** Styled native <select> — good enough for the app's simple option lists. */
export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { className, invalid, children, ...props },
  ref,
) {
  return (
    <div className="relative">
      <select
        ref={ref}
        className={cn(
          'flex h-12 w-full appearance-none rounded-[var(--radius)] border-0 bg-muted px-4 pr-9 text-sm',
          'transition-[background-color,box-shadow] duration-200 hover:bg-muted/80',
          'focus-visible:outline-none focus-visible:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring',
          'disabled:cursor-not-allowed disabled:opacity-50',
          invalid && 'ring-2 ring-destructive',
          className,
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
    </div>
  )
})
