import { Building2, CheckCircle2, MapPinned, PauseCircle } from 'lucide-react'
import { Badge, StatusBadge } from '../../components/ui/badge'
import { Button } from '../../components/ui/button'
import { EmptyState } from '../../components/ui/empty-state'
import { LoadingState } from '../../components/ui/spinner'
import { TBody, TD, TH, THead, TR, Table } from '../../components/ui/table'
import { useToast } from '../../components/ui/toast'
import { errorMessage } from '../../lib/errors'
import {
  useApproveAgencyMutation,
  useGetAdminAgenciesQuery,
  useSuspendAgencyMutation,
  type AdminAgencyRow,
} from './api'

/**
 * The agency review queue. Approving flips PENDING/SUSPENDED -> ACTIVE, which
 * is what makes an agency visible in customer searches; the zone/cars columns
 * show whether it actually finished onboarding before you approve it.
 */
export function AdminAgenciesPage() {
  const { data: agencies, isLoading, isError } = useGetAdminAgenciesQuery()
  const pending = agencies?.filter((a) => a.status === 'PENDING').length ?? 0

  if (isLoading) return <LoadingState />
  if (isError) return <EmptyState icon={Building2} title="Couldn’t load agencies" />

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Agencies</h1>
        <p className="text-sm text-muted-foreground">
          {agencies?.length ?? 0} agencies · {pending} awaiting review
        </p>
      </div>

      {!agencies || agencies.length === 0 ? (
        <EmptyState icon={Building2} title="No agencies yet" />
      ) : (
        <Table>
          <THead>
            <TR>
              <TH>Agency</TH>
              <TH>Owner</TH>
              <TH>Base city</TH>
              <TH>Onboarding</TH>
              <TH>Status</TH>
              <TH>Actions</TH>
            </TR>
          </THead>
          <TBody>
            {agencies.map((a) => (
              <AgencyRow key={a.id} agency={a} />
            ))}
          </TBody>
        </Table>
      )}
    </div>
  )
}

function AgencyRow({ agency }: { agency: AdminAgencyRow }) {
  const toast = useToast()
  const [approve, { isLoading: approving }] = useApproveAgencyMutation()
  const [suspend, { isLoading: suspending }] = useSuspendAgencyMutation()

  async function act(fn: () => Promise<unknown>, verb: string) {
    try {
      await fn()
      toast.success(`${agency.name} ${verb}`)
    } catch (e) {
      toast.error(errorMessage(e), `Could not ${verb.split(' ')[0]} agency`)
    }
  }

  return (
    <TR>
      <TD className="font-medium">{agency.name}</TD>
      <TD className="text-muted-foreground">{agency.ownerEmail}</TD>
      <TD>{agency.city || '—'}</TD>
      <TD>
        <span className="flex items-center gap-2 text-xs">
          <Badge tone={agency.hasZone ? 'success' : 'warning'}>
            <MapPinned className="mr-1 h-3 w-3" />
            {agency.hasZone ? 'Area drawn' : 'No area'}
          </Badge>
          <Badge tone={agency.cars > 0 ? 'success' : 'warning'}>
            {agency.cars} car{agency.cars === 1 ? '' : 's'}
          </Badge>
        </span>
      </TD>
      <TD>
        <StatusBadge status={agency.status} />
      </TD>
      <TD>
        <div className="flex gap-2">
          {agency.status !== 'ACTIVE' && (
            <Button
              size="sm"
              variant="outline"
              loading={approving}
              onClick={() => act(() => approve(agency.id).unwrap(), 'approved — now live')}
            >
              <CheckCircle2 className="h-3.5 w-3.5" /> Approve
            </Button>
          )}
          {agency.status === 'ACTIVE' && (
            <Button
              size="sm"
              variant="outline"
              className="text-destructive"
              loading={suspending}
              onClick={() => act(() => suspend(agency.id).unwrap(), 'suspended')}
            >
              <PauseCircle className="h-3.5 w-3.5" /> Suspend
            </Button>
          )}
        </div>
      </TD>
    </TR>
  )
}
