import { Construction } from 'lucide-react'
import { EmptyState } from './ui/empty-state'

/** Temporary page body for routes whose feature phase hasn't landed yet. */
export function Placeholder({ title, note }: { title: string; note?: string }) {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      <EmptyState
        icon={Construction}
        title="Coming soon"
        description={note ?? 'This screen will be built in an upcoming phase.'}
      />
    </div>
  )
}
