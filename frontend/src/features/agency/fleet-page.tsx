import { useState } from 'react'
import { Link } from 'react-router-dom'
import { CarFront, Pencil, Plus, Settings2, Trash2 } from 'lucide-react'
import { useAuth } from '../../features/auth/use-auth'
import { StatusBadge } from '../../components/ui/badge'
import { Button } from '../../components/ui/button'
import { ConfirmDialog } from '../../components/ui/confirm-dialog'
import { EmptyState } from '../../components/ui/empty-state'
import { LoadingState } from '../../components/ui/spinner'
import { TBody, TD, TH, THead, TR, Table } from '../../components/ui/table'
import { useToast } from '../../components/ui/toast'
import { errorMessage } from '../../lib/errors'
import { formatMoney } from '../../lib/utils'
import type { CarResponse } from '../../lib/types'
import { CarFormDialog } from './car-form-dialog'
import { useDeleteCarMutation, useGetAgencyCarsQuery } from './api'

export function FleetPage() {
  const { isAgencyAdmin } = useAuth()
  const { data: cars, isLoading } = useGetAgencyCarsQuery()
  const [deleteCar, deleteState] = useDeleteCarMutation()
  const toast = useToast()

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<CarResponse | undefined>(undefined)
  const [pendingDelete, setPendingDelete] = useState<CarResponse | null>(null)

  function openAdd() {
    setEditing(undefined)
    setFormOpen(true)
  }
  function openEdit(car: CarResponse) {
    setEditing(car)
    setFormOpen(true)
  }

  async function confirmDelete() {
    if (!pendingDelete) return
    try {
      await deleteCar(pendingDelete.id).unwrap()
      toast.success('Car removed')
      setPendingDelete(null)
    } catch (e) {
      toast.error(errorMessage(e), 'Could not delete')
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Fleet</h1>
        <Button onClick={openAdd}>
          <Plus className="h-4 w-4" /> Add car
        </Button>
      </div>

      {isLoading ? (
        <LoadingState />
      ) : !cars || cars.length === 0 ? (
        <EmptyState
          icon={CarFront}
          title="No cars yet"
          description="Add your first car to start renting it out."
          action={
            <Button onClick={openAdd}>
              <Plus className="h-4 w-4" /> Add car
            </Button>
          }
        />
      ) : (
        <Table>
          <THead>
            <TR>
              <TH>Car</TH>
              <TH>Category</TH>
              <TH>Reg. no.</TH>
              <TH>Price / day</TH>
              <TH>Status</TH>
              <TH className="text-right">Actions</TH>
            </TR>
          </THead>
          <TBody>
            {cars.map((car) => (
              <TR key={car.id}>
                <TD className="font-medium">
                  {car.make} {car.model}
                </TD>
                <TD>{car.category}</TD>
                <TD className="font-mono text-xs">{car.regNo}</TD>
                <TD>{formatMoney(car.pricePerDay)}</TD>
                <TD>
                  <StatusBadge status={car.status} />
                </TD>
                <TD>
                  <div className="flex justify-end gap-1">
                    <Link to={`/agency/cars/${car.id}`}>
                      <Button variant="ghost" size="icon" aria-label="Manage">
                        <Settings2 className="h-4 w-4" />
                      </Button>
                    </Link>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Edit"
                      onClick={() => openEdit(car)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    {isAgencyAdmin && (
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Delete"
                        className="text-destructive"
                        onClick={() => setPendingDelete(car)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}

      <CarFormDialog car={editing} open={formOpen} onOpenChange={setFormOpen} />
      <ConfirmDialog
        open={!!pendingDelete}
        onOpenChange={(o) => !o && setPendingDelete(null)}
        title="Delete this car?"
        description={
          pendingDelete
            ? `${pendingDelete.make} ${pendingDelete.model} (${pendingDelete.regNo}) will be removed from your fleet.`
            : undefined
        }
        confirmLabel="Delete"
        variant="destructive"
        loading={deleteState.isLoading}
        onConfirm={confirmDelete}
      />
    </div>
  )
}
