import { useRef, useState } from 'react'
import { ArrowLeft, Eye, FileText, ImagePlus, Pencil, Trash2, Upload } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { StatusBadge } from '../../components/ui/badge'
import { Button } from '../../components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card'
import { ConfirmDialog } from '../../components/ui/confirm-dialog'
import { EmptyState } from '../../components/ui/empty-state'
import { Field } from '../../components/ui/field'
import { Select } from '../../components/ui/select'
import { LoadingState, Spinner } from '../../components/ui/spinner'
import { useToast } from '../../components/ui/toast'
import { fetchBlob } from '../../lib/api'
import { formatDate } from '../../lib/date'
import { errorMessage } from '../../lib/errors'
import type { CarImageResponse, DocumentResponse, DocumentType } from '../../lib/types'
import { formatBytes } from '../../lib/utils'
import { CarFormDialog } from './car-form-dialog'
import {
  useDeleteCarDocumentMutation,
  useDeleteCarImageMutation,
  useGetAgencyCarDocumentsQuery,
  useGetAgencyCarImagesQuery,
  useGetAgencyCarQuery,
  useUploadCarDocumentMutation,
  useUploadCarImageMutation,
} from './api'

const CAR_DOC_TYPES: { value: DocumentType; label: string }[] = [
  { value: 'INSURANCE', label: 'Insurance' },
  { value: 'REGISTRATION', label: 'Registration' },
]

export function CarManagePage() {
  const { id } = useParams()
  const carId = Number(id)
  const { data: car, isLoading } = useGetAgencyCarQuery(carId)
  const [editOpen, setEditOpen] = useState(false)

  if (isLoading) return <LoadingState />
  if (!car) return <EmptyState title="Car not found" />

  return (
    <div className="space-y-6">
      <Link
        to="/agency/cars"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Fleet
      </Link>

      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">
            {car.make} {car.model}
          </h1>
          <StatusBadge status={car.status} />
        </div>
        <Button variant="outline" onClick={() => setEditOpen(true)}>
          <Pencil className="h-4 w-4" /> Edit details
        </Button>
      </div>

      <ImagesCard carId={carId} />
      <DocumentsCard carId={carId} />

      <CarFormDialog car={car} open={editOpen} onOpenChange={setEditOpen} />
    </div>
  )
}

function ImagesCard({ carId }: { carId: number }) {
  const { data: images, isLoading } = useGetAgencyCarImagesQuery(carId)
  const [upload, uploadState] = useUploadCarImageMutation()
  const [remove, removeState] = useDeleteCarImageMutation()
  const toast = useToast()
  const fileRef = useRef<HTMLInputElement>(null)
  const [pendingDelete, setPendingDelete] = useState<CarImageResponse | null>(null)

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      await upload({ carId, file }).unwrap()
      toast.success('Image uploaded')
    } catch (err) {
      toast.error(errorMessage(err), 'Upload failed')
    } finally {
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle>Photos</CardTitle>
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onFile} />
        <Button
          variant="outline"
          size="sm"
          onClick={() => fileRef.current?.click()}
          loading={uploadState.isLoading}
        >
          <ImagePlus className="h-4 w-4" /> Add photo
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Spinner />
        ) : !images || images.length === 0 ? (
          <p className="text-sm text-muted-foreground">No photos yet.</p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {images.map((img) => (
              <div key={img.id} className="group relative aspect-video overflow-hidden rounded-lg border border-border bg-muted">
                <img src={img.url} alt="" className="h-full w-full object-cover" />
                <button
                  type="button"
                  aria-label="Delete photo"
                  onClick={() => setPendingDelete(img)}
                  className="absolute right-1.5 top-1.5 rounded-md bg-black/60 p-1 text-white opacity-0 transition-opacity group-hover:opacity-100"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
      <ConfirmDialog
        open={!!pendingDelete}
        onOpenChange={(o) => !o && setPendingDelete(null)}
        title="Delete this photo?"
        confirmLabel="Delete"
        variant="destructive"
        loading={removeState.isLoading}
        onConfirm={async () => {
          if (!pendingDelete) return
          try {
            await remove({ carId, imageId: pendingDelete.id }).unwrap()
            setPendingDelete(null)
          } catch (err) {
            toast.error(errorMessage(err))
          }
        }}
      />
    </Card>
  )
}

function DocumentsCard({ carId }: { carId: number }) {
  const { data: docs, isLoading } = useGetAgencyCarDocumentsQuery(carId)
  const [upload, uploadState] = useUploadCarDocumentMutation()
  const [remove, removeState] = useDeleteCarDocumentMutation()
  const toast = useToast()
  const fileRef = useRef<HTMLInputElement>(null)
  const [type, setType] = useState<DocumentType>('INSURANCE')
  const [pendingDelete, setPendingDelete] = useState<DocumentResponse | null>(null)

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      await upload({ carId, file, type }).unwrap()
      toast.success('Document uploaded')
    } catch (err) {
      toast.error(errorMessage(err), 'Upload failed')
    } finally {
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  async function view(doc: DocumentResponse) {
    try {
      const blob = await fetchBlob(`/documents/${doc.id}/content`)
      const url = URL.createObjectURL(blob)
      window.open(url, '_blank', 'noopener,noreferrer')
      setTimeout(() => URL.revokeObjectURL(url), 60_000)
    } catch (err) {
      toast.error(errorMessage(err), 'Could not open document')
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Documents</CardTitle>
        <CardDescription>Insurance and registration proof for this car.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="flex flex-wrap items-end gap-3">
          <Field label="Document type" htmlFor="docType" className="min-w-44">
            <Select id="docType" value={type} onChange={(e) => setType(e.target.value as DocumentType)}>
              {CAR_DOC_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </Select>
          </Field>
          <input ref={fileRef} type="file" accept="image/*,application/pdf" className="hidden" onChange={onFile} />
          <Button
            variant="outline"
            onClick={() => fileRef.current?.click()}
            loading={uploadState.isLoading}
          >
            <Upload className="h-4 w-4" /> Upload
          </Button>
        </div>

        {isLoading ? (
          <Spinner />
        ) : !docs || docs.length === 0 ? (
          <p className="text-sm text-muted-foreground">No documents uploaded.</p>
        ) : (
          <ul className="divide-y divide-border rounded-[calc(var(--radius)+2px)] border border-border">
            {docs.map((doc) => (
              <li key={doc.id} className="flex items-center gap-3 p-3">
                <FileText className="h-5 w-5 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">
                      {CAR_DOC_TYPES.find((t) => t.value === doc.docType)?.label ?? doc.docType}
                    </span>
                    <StatusBadge status={doc.status} />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {formatBytes(doc.sizeBytes)} · {formatDate(doc.createdAt)}
                    {doc.reviewNote ? ` · ${doc.reviewNote}` : ''}
                  </p>
                </div>
                <Button variant="ghost" size="icon" aria-label="View" onClick={() => view(doc)}>
                  <Eye className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Delete"
                  className="text-destructive"
                  onClick={() => setPendingDelete(doc)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
      <ConfirmDialog
        open={!!pendingDelete}
        onOpenChange={(o) => !o && setPendingDelete(null)}
        title="Delete this document?"
        confirmLabel="Delete"
        variant="destructive"
        loading={removeState.isLoading}
        onConfirm={async () => {
          if (!pendingDelete) return
          try {
            await remove({ carId, docId: pendingDelete.id }).unwrap()
            setPendingDelete(null)
          } catch (err) {
            toast.error(errorMessage(err))
          }
        }}
      />
    </Card>
  )
}
