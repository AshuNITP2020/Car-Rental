import type { ComponentProps } from 'react'
import { Tabs as T } from 'radix-ui'
import { cn } from '../../lib/utils'

export const Tabs = T.Root

export function TabsList({ className, ...props }: ComponentProps<typeof T.List>) {
  return (
    <T.List
      className={cn('inline-flex items-center gap-1 rounded-[var(--radius)] bg-muted p-1', className)}
      {...props}
    />
  )
}

export function TabsTrigger({ className, ...props }: ComponentProps<typeof T.Trigger>) {
  return (
    <T.Trigger
      className={cn(
        'rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors',
        'data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-sm',
        className,
      )}
      {...props}
    />
  )
}

export function TabsContent({ className, ...props }: ComponentProps<typeof T.Content>) {
  return <T.Content className={cn('mt-4 focus:outline-none', className)} {...props} />
}
