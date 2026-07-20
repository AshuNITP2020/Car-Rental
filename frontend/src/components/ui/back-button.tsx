import { ArrowLeft } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

/**
 * History-aware back control: returns to the page the user actually came from
 * (results list, profile, …) instead of hard-linking home. Falls back to home
 * on a direct deep link with no history behind it.
 */
export function BackButton({ label = 'Back' }: { label?: string }) {
  const navigate = useNavigate()
  return (
    <button
      type="button"
      onClick={() => (window.history.length > 1 ? navigate(-1) : navigate('/'))}
      className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors duration-150 hover:text-foreground"
    >
      <ArrowLeft className="h-4 w-4" /> {label}
    </button>
  )
}
