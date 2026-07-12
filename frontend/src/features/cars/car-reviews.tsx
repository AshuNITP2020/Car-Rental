import { StarRating } from '../../components/ui/rating'
import { Spinner } from '../../components/ui/spinner'
import { formatDate } from '../../lib/date'
import { useGetCarReviewsQuery } from './api'

export function CarReviews({ carId }: { carId: number }) {
  const { data, isLoading } = useGetCarReviewsQuery(carId)

  if (isLoading) return <Spinner />
  if (!data || data.count === 0)
    return <p className="text-sm text-muted-foreground">No reviews yet.</p>

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <StarRating value={data.averageRating ?? 0} />
        <span className="text-sm text-muted-foreground">
          {data.averageRating?.toFixed(1)} · {data.count} review{data.count > 1 ? 's' : ''}
        </span>
      </div>
      <ul className="space-y-3">
        {data.reviews.map((r) => (
          <li key={r.id} className="rounded-lg border border-border p-3">
            <div className="flex items-center justify-between">
              <StarRating value={r.rating} size={14} />
              <span className="text-xs text-muted-foreground">{formatDate(r.createdAt)}</span>
            </div>
            {r.comment && <p className="mt-1 text-sm">{r.comment}</p>}
          </li>
        ))}
      </ul>
    </div>
  )
}
