import { useEffect, useState } from 'react'

type Health = {
  status: string
  service: string
  database: string
  dbTime: string | null
}

type Probe =
  | { state: 'loading' }
  | { state: 'ok'; data: Health }
  | { state: 'error'; message: string }

function App() {
  const [probe, setProbe] = useState<Probe>({ state: 'loading' })

  useEffect(() => {
    // Calls the backend via Vite's /api proxy (-> http://localhost:8080).
    fetch('/api/health')
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json() as Promise<Health>
      })
      .then((data) => setProbe({ state: 'ok', data }))
      .catch((err) => setProbe({ state: 'error', message: String(err.message ?? err) }))
  }, [])

  const dbUp = probe.state === 'ok' && probe.data.database === 'up'

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-6">
      <div className="max-w-lg w-full rounded-2xl border border-slate-800 bg-slate-900/60 p-10 text-center shadow-xl">
        <div className="text-5xl mb-4">🚗</div>
        <h1 className="text-3xl font-semibold tracking-tight">Car Rental Marketplace</h1>
        <p className="mt-3 text-slate-400">Walking skeleton — React → Spring Boot → Postgres</p>

        {/* Live end-to-end probe */}
        <div className="mt-8 rounded-xl border border-slate-800 bg-slate-950/60 p-5 text-left">
          <div className="text-xs uppercase tracking-wider text-slate-500 mb-3">
            Backend health
          </div>

          {probe.state === 'loading' && (
            <p className="text-slate-400 text-sm">Checking…</p>
          )}

          {probe.state === 'error' && (
            <p className="text-rose-400 text-sm">
              ✗ Could not reach backend: {probe.message}
              <span className="block text-slate-500 mt-1">
                Is the backend running on :8080?
              </span>
            </p>
          )}

          {probe.state === 'ok' && (
            <ul className="space-y-2 text-sm">
              <li className="flex justify-between">
                <span className="text-slate-400">API</span>
                <span className="text-emerald-400">● {probe.data.status}</span>
              </li>
              <li className="flex justify-between">
                <span className="text-slate-400">Database</span>
                <span className={dbUp ? 'text-emerald-400' : 'text-rose-400'}>
                  ● {probe.data.database}
                </span>
              </li>
              <li className="flex justify-between gap-4">
                <span className="text-slate-400">DB time</span>
                <span className="text-slate-300 font-mono text-xs truncate">
                  {probe.data.dbTime}
                </span>
              </li>
            </ul>
          )}
        </div>

        <p className="mt-6 text-sm text-slate-500">
          Phase 0 complete — the full stack is wired. Next: the booking engine.
        </p>
      </div>
    </main>
  )
}

export default App
