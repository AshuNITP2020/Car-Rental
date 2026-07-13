import { Building2 } from 'lucide-react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../../features/auth/use-auth'
import { Alert } from '../../components/ui/alert'
import { Card, CardContent } from '../../components/ui/card'
import { useToast } from '../../components/ui/toast'
import { errorMessage } from '../../lib/errors'
import { AgencyForm } from './agency-form'
import { toAgencyRequest, type AgencyFormValues } from './agency-schema'
import { useCreateAgencyMutation } from './api'

export function AgencyOnboardPage() {
  const { hasAgency, reauthenticate } = useAuth()
  const [create, { isLoading: creating }] = useCreateAgencyMutation()
  const toast = useToast()
  const navigate = useNavigate()

  if (hasAgency) return <Navigate to="/agency" replace />

  async function onSubmit(values: AgencyFormValues) {
    try {
      await create(toAgencyRequest(values)).unwrap()
      // The current JWT has no agencyId yet; refreshing re-derives it from the
      // new membership so the agency console unlocks without a re-login.
      await reauthenticate()
      toast.success('Agency created — welcome aboard!')
      navigate('/agency', { replace: true })
    } catch (e) {
      toast.error(errorMessage(e), 'Could not create agency')
    }
  }

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div className="space-y-2 text-center">
        <div className="mx-auto w-fit rounded-full bg-accent p-3 text-accent-foreground">
          <Building2 className="h-6 w-6" />
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">Become an agency</h1>
        <p className="text-muted-foreground">
          List your fleet and start earning on the marketplace.
        </p>
      </div>
      <Alert variant="info" title="Verification">
        New agencies start in a pending state and may be reviewed before going fully live.
      </Alert>
      <Card>
        <CardContent className="pt-5">
          <AgencyForm submitLabel="Create agency" loading={creating} onSubmit={onSubmit} />
        </CardContent>
      </Card>
    </div>
  )
}
