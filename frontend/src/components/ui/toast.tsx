import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react'
import { cn } from '../../lib/utils'

type ToastVariant = 'success' | 'error' | 'info'

interface ToastItem {
  id: number
  title?: string
  description?: string
  variant: ToastVariant
  requestId?: string
}

interface ToastInput {
  title?: string
  description?: string
  variant?: ToastVariant
  requestId?: string
  durationMs?: number
}

interface ToastContextValue {
  toast: (t: ToastInput) => void
  success: (description: string, title?: string) => void
  error: (description: string, title?: string) => void
  info: (description: string, title?: string) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

const icons: Record<ToastVariant, ReactNode> = {
  success: <CheckCircle2 className="h-4 w-4 text-emerald-500" />,
  error: <AlertCircle className="h-4 w-4 text-rose-500" />,
  info: <Info className="h-4 w-4 text-blue-500" />,
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([])
  const counter = useRef(0)

  const dismiss = useCallback((id: number) => {
    setItems((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const toast = useCallback(
    (input: ToastInput) => {
      const id = ++counter.current
      const item: ToastItem = {
        id,
        title: input.title,
        description: input.description,
        variant: input.variant ?? 'info',
        requestId: input.requestId,
      }
      setItems((prev) => [...prev, item])
      const duration = input.durationMs ?? (item.variant === 'error' ? 7000 : 4000)
      window.setTimeout(() => dismiss(id), duration)
    },
    [dismiss],
  )

  const success = useCallback(
    (description: string, title?: string) => toast({ description, title, variant: 'success' }),
    [toast],
  )
  const error = useCallback(
    (description: string, title?: string) => toast({ description, title, variant: 'error' }),
    [toast],
  )
  const info = useCallback(
    (description: string, title?: string) => toast({ description, title, variant: 'info' }),
    [toast],
  )

  return (
    <ToastContext.Provider value={{ toast, success, error, info }}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed bottom-4 right-4 z-[100] flex w-full max-w-sm flex-col gap-2"
      >
        {items.map((t) => (
          <div
            key={t.id}
            role="status"
            className={cn(
              'pointer-events-auto flex items-start gap-2 rounded-[var(--radius)] border bg-card p-3 shadow-lg',
              'border-border animate-in',
            )}
          >
            <span className="mt-0.5 shrink-0">{icons[t.variant]}</span>
            <div className="min-w-0 flex-1">
              {t.title && <p className="text-sm font-medium">{t.title}</p>}
              {t.description && (
                <p className="break-words text-sm text-muted-foreground">{t.description}</p>
              )}
              {t.requestId && (
                <p className="mt-1 font-mono text-[10px] text-muted-foreground/70">
                  ref: {t.requestId}
                </p>
              )}
            </div>
            <button
              onClick={() => dismiss(t.id)}
              aria-label="Dismiss"
              className="shrink-0 rounded p-0.5 text-muted-foreground hover:bg-muted"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

 
export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within <ToastProvider>')
  return ctx
}
