import type { HTMLAttributes } from 'react'
import { cn } from '../../lib/utils'

export function Table({ className, ...props }: HTMLAttributes<HTMLTableElement>) {
  return (
    <div className="w-full overflow-x-auto rounded-[calc(var(--radius)+2px)] border border-border">
      <table className={cn('w-full caption-bottom text-sm', className)} {...props} />
    </div>
  )
}

export function THead({ className, ...props }: HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <thead
      className={cn(
        'border-b border-border bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground',
        className,
      )}
      {...props}
    />
  )
}

export function TBody({ className, ...props }: HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody className={cn('divide-y divide-border', className)} {...props} />
}

export function TR({ className, ...props }: HTMLAttributes<HTMLTableRowElement>) {
  return <tr className={cn('transition-colors hover:bg-muted/40', className)} {...props} />
}

export function TH({ className, ...props }: HTMLAttributes<HTMLTableCellElement>) {
  return <th className={cn('px-3 py-2.5 font-medium', className)} {...props} />
}

export function TD({ className, ...props }: HTMLAttributes<HTMLTableCellElement>) {
  return <td className={cn('px-3 py-3 align-middle', className)} {...props} />
}
