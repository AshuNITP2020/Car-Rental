import { Users } from 'lucide-react'
import { Badge, StatusBadge } from '../../components/ui/badge'
import { humanizeStatus } from '../../lib/utils'
import { EmptyState } from '../../components/ui/empty-state'
import { LoadingState } from '../../components/ui/spinner'
import { TBody, TD, TH, THead, TR, Table } from '../../components/ui/table'
import { useGetAdminUsersQuery } from './api'

export function AdminUsersPage() {
  const { data: users, isLoading, isError } = useGetAdminUsersQuery()

  if (isLoading) return <LoadingState />
  if (isError) return <EmptyState icon={Users} title="Couldn’t load users" />

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Users</h1>
        <p className="text-sm text-muted-foreground">{users?.length ?? 0} registered users</p>
      </div>

      {!users || users.length === 0 ? (
        <EmptyState icon={Users} title="No users yet" />
      ) : (
        <Table>
          <THead>
            <TR>
              <TH>Name</TH>
              <TH>Email</TH>
              <TH>Phone</TH>
              <TH>Role</TH>
              <TH>KYC</TH>
            </TR>
          </THead>
          <TBody>
            {users.map((u) => (
              <TR key={u.id}>
                <TD className="font-medium">{u.name}</TD>
                <TD>{u.email}</TD>
                <TD>{u.phone || '—'}</TD>
                <TD>
                  <Badge tone={u.role === 'PLATFORM_ADMIN' ? 'info' : 'neutral'}>
                    {humanizeStatus(u.role)}
                  </Badge>
                </TD>
                <TD>
                  <StatusBadge status={u.kycStatus} />
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}
    </div>
  )
}
