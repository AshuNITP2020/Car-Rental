import { useState } from 'react'
import { Car as CarIcon } from 'lucide-react'
import type { CarImageResponse } from '../../lib/types'
import { cn } from '../../lib/utils'

export function CarGallery({ images }: { images: CarImageResponse[] | undefined }) {
  const [active, setActive] = useState(0)

  if (!images || images.length === 0) {
    return (
      <div className="flex aspect-video items-center justify-center rounded-xl border border-border bg-muted">
        <CarIcon className="h-16 w-16 text-muted-foreground/40" />
      </div>
    )
  }

  const main = images[Math.min(active, images.length - 1)]
  return (
    <div className="space-y-3">
      <div className="aspect-video overflow-hidden rounded-xl border border-border bg-muted">
        <img src={main.url} alt="" className="h-full w-full object-cover" />
      </div>
      {images.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {images.map((img, i) => (
            <button
              key={img.id}
              type="button"
              onClick={() => setActive(i)}
              className={cn(
                'h-16 w-24 shrink-0 overflow-hidden rounded-lg border-2',
                i === active ? 'border-primary' : 'border-transparent',
              )}
            >
              <img src={img.url} alt="" className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
