import { forwardRef, type ButtonHTMLAttributes } from 'react'
import { Loader2 } from 'lucide-react'
import { cn } from '../../lib/utils'

type Variant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'destructive'
type Size = 'sm' | 'md' | 'lg' | 'icon'

const variants: Record<Variant, string> = {
  // Monochrome CTA: black in light mode, white in dark (chrome, not accent).
  primary:
    'bg-foreground text-background shadow-sm hover:bg-foreground/85 hover:shadow-lifted',
  secondary: 'bg-muted text-foreground hover:bg-muted/70',
  outline:
    'border border-border bg-transparent hover:border-foreground/30 hover:bg-muted/60 hover:shadow-soft',
  ghost: 'bg-transparent hover:bg-muted',
  destructive:
    'bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90 hover:shadow-lifted',
}
const sizes: Record<Size, string> = {
  sm: 'h-8 gap-1.5 px-3 text-sm',
  md: 'h-10 gap-2 px-4 text-sm',
  lg: 'h-12 gap-2 px-7 text-base',
  icon: 'h-10 w-10',
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  loading?: boolean
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant = 'primary', size = 'md', loading, disabled, children, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(
        'inline-flex items-center justify-center rounded-[var(--radius)] font-medium',
        'transition-all duration-200 active:scale-[0.99]',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60',
        'focus-visible:ring-offset-2 focus-visible:ring-offset-background',
        'disabled:pointer-events-none disabled:opacity-50 disabled:shadow-none',
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
      {children}
    </button>
  )
})
