import { NavLink, Outlet, useLocation, useNavigate, Link } from 'react-router-dom'
import { DropdownMenu } from 'radix-ui'
import {
  Car,
  ChevronsUpDown,
  LayoutDashboard,
  LogOut,
  ShieldCheck,
  Store,
  User as UserIcon,
} from 'lucide-react'
import { useAuth } from '../../auth/auth-context'
import { cn } from '../../lib/utils'
import { Badge } from '../ui/badge'
import { ThemeToggle } from '../theme-toggle'

type Area = 'customer' | 'agency' | 'admin'

const NAV: Record<Area, { to: string; label: string; end?: boolean }[]> = {
  customer: [
    { to: '/', label: 'Browse', end: true },
    { to: '/trips', label: 'My trips' },
    { to: '/account', label: 'Account' },
  ],
  agency: [
    { to: '/agency', label: 'Dashboard', end: true },
    { to: '/agency/cars', label: 'Fleet' },
    { to: '/agency/bookings', label: 'Bookings' },
    { to: '/agency/settings', label: 'Settings' },
  ],
  admin: [
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
  'z-50 min-w-52 rounded-[var(--radius)] border border-border bg-card p-1 shadow-lg'
const menuItemClass =
  'flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm outline-none data-[highlighted]:bg-muted'

function WorkspaceSwitcher({ area }: { area: Area }) {
  const { hasAgency, isAdmin } = useAuth()
  const navigate = useNavigate()

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger className="inline-flex items-center gap-1.5 rounded-[var(--radius)] border border-border px-2.5 py-1.5 text-sm hover:bg-muted">
        {area === 'agency' ? (
          <LayoutDashboard className="h-4 w-4" />
        ) : area === 'admin' ? (
          <ShieldCheck className="h-4 w-4" />
        ) : (
          <Store className="h-4 w-4" />
        )}
        <span className="hidden sm:inline">{AREA_LABEL[area]}</span>
        <ChevronsUpDown className="h-3.5 w-3.5 text-muted-foreground" />
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content align="end" sideOffset={6} className={menuContentClass}>
          <DropdownMenu.Label className="px-2 py-1.5 text-xs text-muted-foreground">
            Switch workspace
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
            <DropdownMenu.Item className={menuItemClass} onSelect={() => navigate('/admin/users')}>
              <ShieldCheck className="h-4 w-4" /> Admin
            </DropdownMenu.Item>
          )}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  )
}

function UserMenu() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const initial = user?.name?.charAt(0).toUpperCase() ?? '?'

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger
        className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground"
        aria-label="Account menu"
      >
        {initial}
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content align="end" sideOffset={6} className={menuContentClass}>
          <div className="px-2 py-1.5">
            <p className="truncate text-sm font-medium">{user?.name}</p>
            <p className="truncate text-xs text-muted-foreground">{user?.email}</p>
          </div>
          <DropdownMenu.Separator className="my-1 h-px bg-border" />
          <DropdownMenu.Item className={menuItemClass} onSelect={() => navigate('/account')}>
            <UserIcon className="h-4 w-4" /> Account &amp; KYC
          </DropdownMenu.Item>
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
  const { user } = useAuth()
  const area = currentArea(pathname)
  const showKyc = area === 'customer' && user && user.kycStatus !== 'VERIFIED'

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 border-b border-border bg-card/80 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-4 px-4">
          <Link to="/" className="flex items-center gap-2 font-semibold">
            <Car className="h-5 w-5 text-primary" />
            <span className="hidden sm:inline">CarRental</span>
          </Link>

          <nav className="ml-2 hidden items-center gap-1 md:flex">
            {NAV[area].map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  cn(
                    'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-muted text-foreground'
                      : 'text-muted-foreground hover:text-foreground',
                  )
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-2">
            {showKyc && (
              <Link to="/account" className="hidden sm:block">
                <Badge tone="warning">KYC {user!.kycStatus.toLowerCase()}</Badge>
              </Link>
            )}
            <WorkspaceSwitcher area={area} />
            <ThemeToggle />
            <UserMenu />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  )
}
