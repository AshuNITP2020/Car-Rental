import type { ComponentProps } from 'react'
import { Popover as P } from 'radix-ui'
import { cn } from '../../lib/utils'

export const Popover = P.Root
export const PopoverTrigger = P.Trigger
export const PopoverAnchor = P.Anchor

export function PopoverContent({
  className,
  align = 'start',
  sideOffset = 6,
  ...props
}: ComponentProps<typeof P.Content>) {
  return (
    <P.Portal>
      <P.Content
        align={align}
        sideOffset={sideOffset}
        className={cn(
          'z-50 rounded-[calc(var(--radius)+2px)] border border-border bg-card p-3 shadow-lg focus:outline-none',
          className,
        )}
        {...props}
      />
    </P.Portal>
  )
}
