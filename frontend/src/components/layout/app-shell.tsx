import { Suspense } from 'react'
import { NavLink, Outlet, useLocation, useNavigate, Link } from 'react-router-dom'
import { DropdownMenu } from 'radix-ui'
import {
  Car,
  ChevronDown,
  LayoutDashboard,
  LogOut,
  ShieldCheck,
  Store,
  User as UserIcon,
} from 'lucide-react'
import { useAuth } from '../../features/auth/use-auth'
import { cn } from '../../lib/utils'
import { Badge } from '../ui/badge'
import { LoadingState } from '../ui/spinner'
import { ThemeToggle } from '../theme-toggle'
import { Footer } from './footer'

type Area = 'customer' | 'agency' | 'admin'

/** Tier 1 (the black bar): where you can GO. */
const GLOBAL_NAV: { to: string; label: string; end?: boolean }[] = [
  { to: '/', label: 'Home', end: true },
  { to: '/destinations', label: 'Destinations' },
  { to: '/trips', label: 'My trips' },
]

/** Tier 2 (white tab bar): the current workspace's sections. */
const AREA_TABS: Record<Exclude<Area, 'customer'>, { to: string; label: string; end?: boolean }[]> = {
  agency: [
    { to: '/agency', label: 'Dashboard', end: true },
    { to: '/agency/cars', label: 'Fleet' },
    { to: '/agency/bookings', label: 'Bookings' },
    { to: '/agency/settings', label: 'Settings' },
  ],
  admin: [
    { to: '/admin/agencies', label: 'Agencies' },
    { to: '/admin/users', label: 'Users' },
    { to: '/admin/documents', label: 'Documents' },
  ],
}

const AREA_LABEL: Record<Area, string> = {
  customer: 'Marketplace',
  agency: 'Agency console',
  admin: 'Admin',
}

function currentArea(pathname: string): Area {
  if (pathname.startsWith('/agency')) return 'agency'
  if (pathname.startsWith('/admin')) return 'admin'
  return 'customer'
}

const menuContentClass =
  'z-50 min-w-60 rounded-[var(--radius)] bg-card p-1.5 shadow-lifted'
const menuItemClass =
  'flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm outline-none transition-colors duration-150 data-[highlighted]:bg-muted'

/** The account pill (far right of the black bar): identity + workspaces. */
function AccountMenu() {
  const { user, hasAgency, isAdmin, logout } = useAuth()
  const navigate = useNavigate()
  const firstName = user?.name?.split(' ')[0] ?? 'Account'
  const kycPending = user && user.kycStatus !== 'VERIFIED'

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger
        className="inline-flex items-center gap-2 rounded-full bg-white/10 py-1.5 pl-1.5 pr-3 text-sm font-medium text-chrome-foreground transition-colors duration-150 hover:bg-white/20"
        aria-label="Account menu"
      >
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/90 text-xs font-bold text-neutral-900">
          {firstName.charAt(0).toUpperCase()}
        </span>
        <span className="hidden sm:inline">{firstName}</span>
        <ChevronDown className="h-3.5 w-3.5 opacity-70" />
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content align="end" sideOffset={8} className={menuContentClass}>
          <div className="px-2.5 py-2">
            <p className="truncate text-sm font-medium">{user?.name}</p>
            <p className="truncate text-xs text-muted-foreground">{user?.email}</p>
          </div>
          <DropdownMenu.Separator className="my-1 h-px bg-border" />
          <DropdownMenu.Item className={menuItemClass} onSelect={() => navigate('/account')}>
            <UserIcon className="h-4 w-4" /> Settings &amp; KYC
            {kycPending && (
              <Badge tone="warning" className="ml-auto">
                {user!.kycStatus.toLowerCase()}
              </Badge>
            )}
          </DropdownMenu.Item>
          <DropdownMenu.Separator className="my-1 h-px bg-border" />
          <DropdownMenu.Label className="px-2.5 py-1 text-xs text-muted-foreground">
            Workspaces
          </DropdownMenu.Label>
          <DropdownMenu.Item className={menuItemClass} onSelect={() => navigate('/')}>
            <Store className="h-4 w-4" /> Marketplace
          </DropdownMenu.Item>
          <DropdownMenu.Item
            className={menuItemClass}
            onSelect={() => navigate(hasAgency ? '/agency' : '/agency/onboard')}
          >
            <LayoutDashboard className="h-4 w-4" />
            {hasAgency ? 'Agency console' : 'Become an agency'}
          </DropdownMenu.Item>
          {isAdmin && (
            <DropdownMenu.Item className={menuItemClass} onSelect={() => navigate('/admin/agencies')}>
              <ShieldCheck className="h-4 w-4" /> Admin
            </DropdownMenu.Item>
          )}
          <DropdownMenu.Separator className="my-1 h-px bg-border" />
          <DropdownMenu.Item
            className={cn(menuItemClass, 'text-destructive')}
            onSelect={() => {
              logout()
              navigate('/login', { replace: true })
            }}
          >
            <LogOut className="h-4 w-4" /> Sign out
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  )
}

export function AppShell() {
  const { pathname } = useLocation()
  const { hasAgency } = useAuth()
  const area = currentArea(pathname)
  const globalNav = hasAgency
    ? [...GLOBAL_NAV, { to: '/agency', label: 'My agency' }]
    : GLOBAL_NAV
  const tabs = area !== 'customer' ? AREA_TABS[area] : null

  return (
    <div className="flex min-h-screen flex-col">
      {/* ── tier 1: the global bar (always dark, like the reference) ── */}
      <header className="sticky top-0 z-40 bg-chrome text-chrome-foreground">
        <div className="flex h-16 items-center gap-6 px-4 lg:px-6">
          <Link to="/" className="flex items-center gap-2 text-lg font-bold tracking-tight">
            <Car className="h-6 w-6" />
            CarRental
          </Link>

          <nav className="hidden items-center gap-1 md:flex">
            {globalNav.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  cn(
                    'rounded-full px-3.5 py-2 text-sm transition-colors duration-150',
                    isActive
                      ? 'bg-white/15 font-semibold text-white'
                      : 'text-white/70 hover:bg-white/10 hover:text-white',
                  )
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-2">
            <ThemeToggle />
            <AccountMenu />
          </div>
        </div>

        {/* mobile: the same global nav as a scrollable row */}
        <nav className="flex gap-1 overflow-x-auto px-4 pb-2 md:hidden">
          {globalNav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                cn(
                  'shrink-0 rounded-full px-3.5 py-1.5 text-sm transition-colors duration-150',
                  isActive
                    ? 'bg-white/15 font-semibold text-white'
                    : 'text-white/70 hover:text-white',
                )
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </header>

      {/* ── tier 2: contextual tabs for the agency console / admin ── */}
      {tabs && (
        <div className="sticky top-16 z-30 border-b border-border bg-card/95 backdrop-blur">
          <div className="flex items-center gap-4 overflow-x-auto px-4 lg:px-6">
            <span className="hidden py-3 text-sm font-semibold sm:block">
              {AREA_LABEL[area]}
            </span>
            <nav className="flex items-center gap-1">
              {tabs.map((tab) => (
                <NavLink
                  key={tab.to}
                  to={tab.to}
                  end={tab.end}
                  className={({ isActive }) =>
                    cn(
                      'shrink-0 border-b-2 px-3 py-3 text-sm transition-colors duration-150',
                      isActive
                        ? 'border-foreground font-semibold text-foreground'
                        : 'border-transparent text-muted-foreground hover:text-foreground',
                    )
                  }
                >
                  {tab.label}
                </NavLink>
              ))}
            </nav>
          </div>
        </div>
      )}

      {/* Pages own their width: the planner spreads edge-to-edge, narrower
          pages center themselves with mx-auto. */}
      <main className="flex-1 px-4 py-8 lg:px-6">
        <Suspense fallback={<LoadingState />}>
          <Outlet />
        </Suspense>
      </main>

      <Footer />
    </div>
  )
}
