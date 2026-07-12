import { CarFront, Gauge, ParkingCircle, Wallet } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import type { ReactNode } from 'react'
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card'
import { EmptyState } from '../../components/ui/empty-state'
import { LoadingState } from '../../components/ui/spinner'
import { formatMoney, humanizeStatus } from '../../lib/utils'
import { useGetAgencyDashboardQuery } from './api'

const CHART = { bookings: '#6366f1', revenue: '#10b981' }

// Distribution bar colours, aligned with the StatusBadge tones.
const STATUS_COLOR: Record<string, string> = {
  AVAILABLE: '#10b981',
  BOOKED: '#3b82f6',
  ACTIVE: '#3b82f6',
  CONFIRMED: '#10b981',
  COMPLETED: '#10b981',
  MAINTENANCE: '#f59e0b',
  PENDING: '#f59e0b',
  OUT_OF_SERVICE: '#f43f5e',
  CANCELLED: '#f43f5e',
  EXPIRED: '#f43f5e',
}

export function AgencyDashboardPage() {
  const { data, isLoading, isError } = useGetAgencyDashboardQuery()

  if (isLoading) return <LoadingState />
  if (isError || !data) return <EmptyState title="Couldn’t load the dashboard" />

  const trends = data.trends.map((t) => ({
    ...t,
    label: safeMonth(t.month),
  }))

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          icon={<CarFront className="h-5 w-5" />}
          label="Total cars"
          value={String(data.fleet.totalCars)}
        />
        <Stat
          icon={<Gauge className="h-5 w-5" />}
          label="Utilisation"
          value={`${data.utilizationPercent}%`}
          hint="Fleet in use now"
        />
        <Stat
          icon={<ParkingCircle className="h-5 w-5" />}
          label="Idle cars"
          value={String(data.idleCarCount)}
          hint="No booking in 30 days"
        />
        <Stat
          icon={<Wallet className="h-5 w-5" />}
          label="Revenue"
          value={formatMoney(data.revenue.total)}
          hint={`${formatMoney(data.revenue.last30Days)} last 30 days`}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Last 6 months</CardTitle>
        </CardHeader>
        <CardContent>
          {trends.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">No activity yet.</p>
          ) : (
            <div className="h-72 w-full text-muted-foreground">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={trends} margin={{ top: 8, right: 8, bottom: 0, left: -8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="currentColor" opacity={0.15} />
                  <XAxis dataKey="label" tick={{ fill: 'currentColor', fontSize: 12 }} />
                  <YAxis
                    yAxisId="left"
                    tick={{ fill: 'currentColor', fontSize: 12 }}
                    allowDecimals={false}
                  />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    tick={{ fill: 'currentColor', fontSize: 12 }}
                    tickFormatter={(v) => `₹${Math.round(Number(v) / 1000)}k`}
                  />
                  <Tooltip
                    formatter={(value, name) =>
                      name === 'Revenue' ? formatMoney(Number(value)) : value
                    }
                    contentStyle={{
                      background: 'var(--card)',
                      border: '1px solid var(--border)',
                      borderRadius: 8,
                      color: 'var(--foreground)',
                    }}
                  />
                  <Legend />
                  <Bar
                    yAxisId="left"
                    dataKey="bookings"
                    name="Bookings"
                    fill={CHART.bookings}
                    radius={[4, 4, 0, 0]}
                    maxBarSize={40}
                  />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="revenue"
                    name="Revenue"
                    stroke={CHART.revenue}
                    strokeWidth={2}
                    dot={{ r: 3 }}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Distribution
          title="Fleet by status"
          data={data.fleet.byStatus}
          total={data.fleet.totalCars}
        />
        <Distribution
          title="Bookings by status"
          data={data.bookings.byStatus}
          total={data.bookings.totalBookings}
        />
      </div>
    </div>
  )
}

function Stat({
  icon,
  label,
  value,
  hint,
}: {
  icon: ReactNode
  label: string
  value: string
  hint?: string
}) {
  return (
    <Card>
      <CardContent className="flex items-start justify-between pt-5">
        <div>
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="mt-1 text-2xl font-semibold">{value}</p>
          {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
        </div>
        <span className="rounded-lg bg-accent p-2 text-accent-foreground">{icon}</span>
      </CardContent>
    </Card>
  )
}

function Distribution({
  title,
  data,
  total,
}: {
  title: string
  data: Record<string, number | undefined>
  total: number
}) {
  const rows = Object.entries(data).filter(([, v]) => v != null) as [string, number][]
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing yet.</p>
        ) : (
          rows.map(([status, count]) => {
            const pct = total > 0 ? Math.round((count / total) * 100) : 0
            return (
              <div key={status} className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span>{humanizeStatus(status)}</span>
                  <span className="text-muted-foreground">{count}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${pct}%`, background: STATUS_COLOR[status] ?? '#94a3b8' }}
                  />
                </div>
              </div>
            )
          })
        )}
      </CardContent>
    </Card>
  )
}

function safeMonth(ym: string): string {
  try {
    return format(parseISO(`${ym}-01`), 'MMM')
  } catch {
    return ym
  }
}
