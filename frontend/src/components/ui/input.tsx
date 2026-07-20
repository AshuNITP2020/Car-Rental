import { forwardRef, type InputHTMLAttributes } from 'react'
import { cn } from '../../lib/utils'

export type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  invalid?: boolean
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, invalid, ...props },
  ref,
) {
  return (
    <input
      ref={ref}
      className={cn(
        // Filled, borderless (Uber-style): separation via the gray surface.
        'flex h-12 w-full rounded-[var(--radius)] border-0 bg-muted px-4 py-2 text-sm',
        'placeholder:text-muted-foreground',
        'transition-[background-color,box-shadow] duration-200',
        'hover:bg-muted/80',
        'focus-visible:outline-none focus-visible:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring',
        'disabled:cursor-not-allowed disabled:opacity-50',
        invalid && 'ring-2 ring-destructive focus-visible:ring-destructive',
        className,
      )}
      {...props}
    />
  )
})
