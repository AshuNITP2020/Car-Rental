import { useAuth } from '../../features/auth/use-auth'
import { StatusBadge } from '../../components/ui/badge'
import { Alert } from '../../components/ui/alert'
import { Card, CardContent } from '../../components/ui/card'
import { EmptyState } from '../../components/ui/empty-state'
import { LoadingState } from '../../components/ui/spinner'
import { useToast } from '../../components/ui/toast'
import { errorMessage } from '../../lib/errors'
import { AgencyForm } from './agency-form'
import { toAgencyRequest, type AgencyFormValues } from './agency-schema'
import { ServiceAreaCard } from './service-area-card'
import { useGetMyAgencyQuery, useUpdateAgencyMutation } from './api'

export function AgencySettingsPage() {
  const { isAgencyAdmin } = useAuth()
  const { data: agency, isLoading } = useGetMyAgencyQuery()
  const [update, { isLoading: saving }] = useUpdateAgencyMutation()
  const toast = useToast()

  if (isLoading) return <LoadingState />
  if (!agency) return <EmptyState title="Agency not found" />

  async function onSubmit(values: AgencyFormValues) {
    try {
      await update(toAgencyRequest(values)).unwrap()
      toast.success('Agency details saved')
    } catch (e) {
      toast.error(errorMessage(e), 'Could not save')
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Agency settings</h1>
        <StatusBadge status={agency.status} />
      </div>

      {!isAgencyAdmin && (
        <Alert variant="info">Only an agency admin can edit these details.</Alert>
      )}

      <Card>
        <CardContent className="pt-5">
          {isAgencyAdmin ? (
            <AgencyForm
              defaultValues={agency}
              submitLabel="Save changes"
              loading={saving}
              onSubmit={onSubmit}
            />
          ) : (
            <dl className="space-y-2 text-sm">
              <Row label="Name" value={agency.name} />
              <Row label="City" value={agency.city || '—'} />
              <Row label="GST number" value={agency.gstNo || '—'} />
              <Row label="Payout account" value={agency.payoutAccount || '—'} />
            </dl>
          )}
        </CardContent>
      </Card>

      <ServiceAreaCard
        agencyCenter={
          agency.latitude != null && agency.longitude != null
            ? { lat: agency.latitude, lng: agency.longitude }
            : null
        }
        canEdit={isAgencyAdmin}
      />
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  )
}
