import { useEffect, useState } from 'react'
import { Clock } from 'lucide-react'

/** Live countdown to a PENDING booking's hold expiry. */
export function HoldCountdown({ expiresAt }: { expiresAt: string }) {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(t)
  }, [])

  const ms = new Date(expiresAt).getTime() - now
  if (ms <= 0) {
    return (
      <span className="inline-flex items-center gap-1 text-destructive">
        <Clock className="h-4 w-4" /> Hold expired
      </span>
    )
  }
  const m = Math.floor(ms / 60000)
  const s = Math.floor((ms % 60000) / 1000)
  return (
    <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400">
      <Clock className="h-4 w-4" /> {m}:{String(s).padStart(2, '0')} left to pay
    </span>
  )
}
