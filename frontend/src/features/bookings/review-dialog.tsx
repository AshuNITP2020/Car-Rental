import { useState } from 'react'
import { Button } from '../../components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../components/ui/dialog'
import { Field } from '../../components/ui/field'
import { StarRatingInput } from '../../components/ui/rating'
import { Textarea } from '../../components/ui/textarea'
import { useToast } from '../../components/ui/toast'
import { errorMessage } from '../../lib/errors'
import { useSubmitReviewMutation } from './api'

export function ReviewDialog({
  bookingId,
  open,
  onOpenChange,
}: {
  bookingId: number
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [rating, setRating] = useState(5)
  const [comment, setComment] = useState('')
  const [submit, { isLoading: submitting }] = useSubmitReviewMutation()
  const toast = useToast()

  async function onSubmit() {
    try {
      await submit({
        bookingId,
        body: { rating, comment: comment.trim() || undefined },
      }).unwrap()
      toast.success('Thanks for your review!')
      onOpenChange(false)
    } catch (e) {
      toast.error(errorMessage(e), 'Could not submit review')
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Rate your trip</DialogTitle>
          <DialogDescription>How was the car and the experience?</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <Field label="Rating" required>
            <StarRatingInput value={rating} onChange={setRating} />
          </Field>
          <Field label="Comment" hint="Optional">
            <Textarea
              value={comment}
              maxLength={2000}
              placeholder="Tell others about your experience…"
              onChange={(e) => setComment(e.target.value)}
            />
          </Field>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button loading={submitting} onClick={onSubmit}>
            Submit review
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
