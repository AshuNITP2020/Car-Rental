function App() {
  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-6">
      <div className="max-w-lg w-full rounded-2xl border border-slate-800 bg-slate-900/60 p-10 text-center shadow-xl">
        <div className="text-5xl mb-4">🚗</div>
        <h1 className="text-3xl font-semibold tracking-tight">
          Car Rental Marketplace
        </h1>
        <p className="mt-3 text-slate-400">
          Frontend scaffold is live — React + TypeScript + Tailwind, served by Vite.
        </p>

        <div className="mt-6 flex flex-wrap justify-center gap-2 text-xs">
          <span className="rounded-full border border-slate-700 bg-slate-800 px-3 py-1 text-slate-300">React</span>
          <span className="rounded-full border border-slate-700 bg-slate-800 px-3 py-1 text-slate-300">TypeScript</span>
          <span className="rounded-full border border-slate-700 bg-slate-800 px-3 py-1 text-slate-300">Tailwind v4</span>
          <span className="rounded-full border border-slate-700 bg-slate-800 px-3 py-1 text-slate-300">Vite</span>
        </div>

        <p className="mt-8 text-sm text-slate-500">
          Task #3 complete. Next: the walking skeleton wires this UI to the
          Spring Boot API (Task #5).
        </p>
      </div>
    </main>
  )
}

export default App
