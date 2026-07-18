import type { ReactNode } from 'react'
import { Car } from 'lucide-react'
import { Card } from '../../components/ui/card'

export function AuthLayout({
  title,
  subtitle,
  badge,
  children,
  footer,
}: {
  title: string
  subtitle?: string
  /** Portal chip next to the wordmark (e.g. "for Agencies"). */
  badge?: string
  children: ReactNode
  footer?: ReactNode
}) {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-10">
      {/* soft brand glow behind the card */}
      <div className="pointer-events-none absolute -top-48 left-1/2 h-96 w-[44rem] -translate-x-1/2 rounded-full bg-primary/15 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-56 left-1/4 h-96 w-96 rounded-full bg-violet-500/10 blur-3xl" />

      <div className="relative w-full max-w-md">
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <div className="flex items-center gap-2 text-lg font-bold tracking-tight">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 text-white shadow-sm">
              <Car className="h-5 w-5" />
            </span>
            CarRental
            {badge && (
              <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
                {badge}
              </span>
            )}
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
        </div>
        <Card className="p-6 shadow-lg">{children}</Card>
        {footer && <div className="mt-4 text-center text-sm text-muted-foreground">{footer}</div>}
      </div>
    </div>
  )
}
