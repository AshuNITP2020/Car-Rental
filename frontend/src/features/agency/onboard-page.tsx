import { useState } from 'react'
import { Building2, Car as CarIcon, Check, MapPinned, PartyPopper, Plus } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { skipToken } from '@reduxjs/toolkit/query'
import { useAuth } from '../../features/auth/use-auth'
import { Alert } from '../../components/ui/alert'
import { Button } from '../../components/ui/button'
import { Card, CardContent } from '../../components/ui/card'
import { LoadingState } from '../../components/ui/spinner'
import { useToast } from '../../components/ui/toast'
import { errorMessage } from '../../lib/errors'
import { cn } from '../../lib/utils'
import { AgencyForm } from './agency-form'
import { toAgencyRequest, type AgencyFormValues } from './agency-schema'
import { CarFormDialog } from './car-form-dialog'
import { ServiceAreaCard } from './service-area-card'
import {
  useCreateAgencyMutation,
  useGetAgencyCarsQuery,
  useGetMyAgencyQuery,
  useGetMyServiceAreaQuery,
} from './api'

type Step = 'profile' | 'area' | 'car'

const STEPS: { key: Step; label: string; icon: typeof Building2 }[] = [
  { key: 'profile', label: 'Agency profile', icon: Building2 },
  { key: 'area', label: 'Operating area', icon: MapPinned },
  { key: 'car', label: 'First car', icon: CarIcon },
]

/**
 * Agency onboarding wizard: profile → draw the operating area → list the first
 * car. An agency only shows up in customer searches once it is ACTIVE
 * (admin-approved), has an area, and has an available car — the wizard walks
 * through everything the agency itself controls. Returning mid-onboarding
 * resumes at the first unfinished step.
 */
export function AgencyOnboardPage() {
  const { hasAgency, reauthenticate } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()
  const [create, { isLoading: creating }] = useCreateAgencyMutation()

  const agencyQ = useGetMyAgencyQuery(hasAgency ? undefined : skipToken)
  const areaQ = useGetMyServiceAreaQuery(hasAgency ? undefined : skipToken)
  const carsQ = useGetAgencyCarsQuery(hasAgency ? undefined : skipToken)

  // Wizard position: explicit once the user navigates; before that it is
  // derived from what's already done (resume where they left off).
  const [visited, setVisited] = useState<Step | null>(null)
  const [addCarOpen, setAddCarOpen] = useState(false)

  if (hasAgency && (areaQ.isLoading || carsQ.isLoading)) return <LoadingState />

  const hasArea = (areaQ.data?.polygon?.length ?? 0) >= 3
  const carCount = carsQ.data?.length ?? 0
  const step: Step = visited ?? (!hasAgency ? 'profile' : !hasArea ? 'area' : 'car')

  async function onCreateAgency(values: AgencyFormValues) {
    try {
      await create(toAgencyRequest(values)).unwrap()
      // The current JWT has no agencyId yet; refreshing re-derives it from the
      // new membership so the next steps (tenant-scoped APIs) work.
      await reauthenticate()
      toast.success('Agency created — now draw your operating area')
      setVisited('area')
    } catch (e) {
      toast.error(errorMessage(e), 'Could not create agency')
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="space-y-2 text-center">
        <div className="mx-auto w-fit rounded-full bg-accent p-3 text-accent-foreground">
          <Building2 className="h-6 w-6" />
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">Set up your agency</h1>
        <p className="text-muted-foreground">
          Three steps and your fleet is on the marketplace.
        </p>
      </div>

      {/* stepper */}
      <ol className="flex items-center justify-center gap-2 sm:gap-4">
        {STEPS.map(({ key, label, icon: Icon }, i) => {
          const done =
            (key === 'profile' && hasAgency) ||
            (key === 'area' && hasArea) ||
            (key === 'car' && carCount > 0)
          const active = step === key
          const reachable =
            key === 'profile' ? true : key === 'area' ? hasAgency : hasAgency && hasArea
          return (
            <li key={key} className="flex items-center gap-2 sm:gap-4">
              {i > 0 && <span className="h-px w-6 bg-border sm:w-10" />}
              <button
                type="button"
                disabled={!reachable}
                onClick={() => reachable && setVisited(key)}
                className={cn(
                  'flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors',
                  active
                    ? 'border-primary bg-primary text-primary-foreground'
                    : done
                      ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                      : 'border-border text-muted-foreground',
                  !reachable && 'opacity-50',
                )}
              >
                {done && !active ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
                <span className="hidden sm:inline">{label}</span>
              </button>
            </li>
          )
        })}
      </ol>

      {step === 'profile' && (
        <>
          <Alert variant="info" title="Review">
            New agencies are reviewed by the platform before going live — finish all
            three steps so approval is quick.
          </Alert>
          <Card>
            <CardContent className="pt-5">
              <AgencyForm submitLabel="Create agency" loading={creating} onSubmit={onCreateAgency} />
            </CardContent>
          </Card>
        </>
      )}

      {step === 'area' && (
        <>
          <ServiceAreaCard
            agencyCenter={
              agencyQ.data?.latitude != null && agencyQ.data?.longitude != null
                ? { lat: agencyQ.data.latitude, lng: agencyQ.data.longitude }
                : null
            }
            canEdit
          />
          <div className="flex justify-end">
            <Button onClick={() => setVisited('car')} disabled={!hasArea}>
              Continue — add your first car
            </Button>
          </div>
          {!hasArea && (
            <p className="text-right text-xs text-muted-foreground">
              Draw and save an area with at least 3 corners to continue. Your cars only
              serve trips that start <em>and</em> end inside it.
            </p>
          )}
        </>
      )}

      {step === 'car' && (
        <>
          <Card>
            <CardContent className="space-y-4 pt-5">
              {carCount === 0 ? (
                <div className="space-y-3 text-center">
                  <p className="text-sm text-muted-foreground">
                    List your first car — you can add photos and more cars any time from
                    the Fleet page.
                  </p>
                  <Button onClick={() => setAddCarOpen(true)}>
                    <Plus className="h-4 w-4" /> Add your first car
                  </Button>
                </div>
              ) : (
                <div className="space-y-3 text-center">
                  <PartyPopper className="mx-auto h-8 w-8 text-primary" />
                  <p className="font-medium">
                    {carCount} car{carCount === 1 ? '' : 's'} listed — setup complete!
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {agencyQ.data?.status === 'ACTIVE'
                      ? 'Your agency is live: customers inside your area can book right away.'
                      : 'Your agency awaits platform approval; once approved, customers inside your area will see your fleet.'}
                  </p>
                  <Button onClick={() => navigate('/agency', { replace: true })}>
                    Go to your dashboard
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
          <CarFormDialog open={addCarOpen} onOpenChange={setAddCarOpen} />
        </>
      )}
    </div>
  )
}
