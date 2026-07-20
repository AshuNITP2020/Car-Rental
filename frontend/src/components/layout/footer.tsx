import { Link } from 'react-router-dom'
import { Car } from 'lucide-react'

const COLUMNS: { title: string; links: { label: string; to: string }[] }[] = [
  {
    title: 'Product',
    links: [
      { label: 'Plan a trip', to: '/' },
      { label: 'Destinations', to: '/destinations' },
      { label: 'My trips', to: '/trips' },
    ],
  },
  {
    title: 'For agencies',
    links: [
      { label: 'List your fleet', to: '/agency/onboard' },
      { label: 'Agency sign in', to: '/agency/login' },
      { label: 'Agency console', to: '/agency' },
    ],
  },
  {
    title: 'Account',
    links: [
      { label: 'Settings & KYC', to: '/account' },
      { label: 'Sign in', to: '/login' },
      { label: 'Create an account', to: '/register' },
    ],
  },
]

/** Site footer — the page has a floor on every screen. */
export function Footer() {
  return (
    <footer className="mt-16 border-t border-border bg-muted/40">
      <div className="grid gap-10 px-4 py-12 sm:grid-cols-2 lg:grid-cols-4 lg:px-6">
        <div className="space-y-3">
          <div className="flex items-center gap-2 font-bold tracking-tight">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-foreground text-background">
              <Car className="h-4 w-4" />
            </span>
            CarRental
          </div>
          <p className="max-w-xs text-sm leading-relaxed text-muted-foreground">
            A marketplace of local rental agencies — plan any trip, round or one-way,
            anywhere an agency operates.
          </p>
        </div>
        {COLUMNS.map((col) => (
          <div key={col.title}>
            <h3 className="text-sm font-semibold">{col.title}</h3>
            <ul className="mt-3 space-y-2.5">
              {col.links.map((l) => (
                <li key={l.label}>
                  <Link
                    to={l.to}
                    className="text-sm text-muted-foreground transition-colors duration-150 hover:text-foreground"
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-border px-4 py-5 lg:px-6">
        <p className="text-xs text-muted-foreground">
          © 2026 CarRental · A learning project — not a real service · Map data ©
          OpenStreetMap contributors
        </p>
      </div>
    </footer>
  )
}
