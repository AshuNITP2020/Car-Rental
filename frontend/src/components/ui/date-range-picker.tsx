import 'react-day-picker/style.css'
import { useState } from 'react'
import { DayPicker, type DateRange } from 'react-day-picker'
import { Calendar as CalendarIcon } from 'lucide-react'
import { cn } from '../../lib/utils'
import { formatDate } from '../../lib/date'
import { Popover, PopoverContent, PopoverTrigger } from './popover'

export interface DateRangeValue {
  from?: Date
  to?: Date
}

export function DateRangePicker({
  value,
  onChange,
  disabledBefore,
  className,
  placeholder = 'Select dates',
  invalid,
}: {
  value: DateRangeValue
  onChange: (range: DateRangeValue) => void
  disabledBefore?: Date
  className?: string
  placeholder?: string
  invalid?: boolean
}) {
  const [open, setOpen] = useState(false)

  const label =
    value.from && value.to
      ? `${formatDate(value.from.toISOString())} → ${formatDate(value.to.toISOString())}`
      : value.from
        ? `${formatDate(value.from.toISOString())} → …`
        : placeholder

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        className={cn(
          'flex h-12 w-full items-center gap-2 rounded-[var(--radius)] border-0 bg-muted px-4 text-left text-sm',
          'transition-[background-color,box-shadow] duration-200 hover:bg-muted/80',
          'focus-visible:outline-none focus-visible:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring',
          invalid && 'ring-2 ring-destructive',
          className,
        )}
      >
        <CalendarIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
        <span className={cn('truncate', !value.from && 'text-muted-foreground')}>{label}</span>
      </PopoverTrigger>
      <PopoverContent className="w-auto" align="start">
        <DayPicker
          mode="range"
          selected={value as DateRange}
          onSelect={(range) => {
            onChange((range ?? {}) as DateRangeValue)
            // react-day-picker sets from===to on the first click; only close once
            // a real multi-day range is chosen.
            if (range?.from && range?.to && range.from.getTime() !== range.to.getTime()) {
              setOpen(false)
            }
          }}
          numberOfMonths={1}
          disabled={disabledBefore ? { before: disabledBefore } : undefined}
        />
      </PopoverContent>
    </Popover>
  )
}
