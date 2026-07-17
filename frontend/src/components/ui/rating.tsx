import { Star } from 'lucide-react'
import { cn } from '../../lib/utils'

/** Read-only star rating (rounds to nearest whole star). */
export function StarRating({
  value,
  size = 16,
  className,
}: {
  value: number
  size?: number
  className?: string
}) {
  return (
    <div
      className={cn('inline-flex items-center gap-0.5', className)}
      role="img"
      aria-label={`${value} out of 5 stars`}
    >
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          style={{ width: size, height: size }}
          className={
            i <= Math.round(value) ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/40'
          }
        />
      ))}
    </div>
  )
}

/** Interactive star selector for submitting a rating. */
export function StarRatingInput({
  value,
  onChange,
}: {
  value: number
  onChange: (value: number) => void
}) {
  return (
    <div className="inline-flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((i) => (
        <button
          key={i}
          type="button"
          onClick={() => onChange(i)}
          aria-label={`${i} star${i > 1 ? 's' : ''}`}
          className="rounded p-0.5 hover:scale-110"
        >
          <Star
            className={cn(
              'h-7 w-7 transition-colors',
              i <= value ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/40',
            )}
          />
        </button>
      ))}
    </div>
  )
}
