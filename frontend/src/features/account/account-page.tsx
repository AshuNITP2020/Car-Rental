import { useRef, useState } from 'react'
import { Eye, FileText, Trash2, Upload } from 'lucide-react'
import { useAuth } from '../../features/auth/use-auth'
import { StatusBadge } from '../../components/ui/badge'
import { Button } from '../../components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card'
import { ConfirmDialog } from '../../components/ui/confirm-dialog'
import { EmptyState } from '../../components/ui/empty-state'
import { Field } from '../../components/ui/field'
import { Select } from '../../components/ui/select'
import { Spinner } from '../../components/ui/spinner'
import { useToast } from '../../components/ui/toast'
import { fetchBlob } from '../../lib/api'
import { formatDate } from '../../lib/date'
import { errorMessage } from '../../lib/errors'
import type { DocumentResponse, DocumentType } from '../../lib/types'
import { formatBytes } from '../../lib/utils'
import {
  useDeleteKycDocumentMutation,
  useGetMyKycDocumentsQuery,
  useUploadKycDocumentMutation,
} from './api'

const KYC_TYPES: { value: DocumentType; label: string }[] = [
  { value: 'KYC_IDENTITY', label: 'Identity proof' },
  { value: 'KYC_ADDRESS', label: 'Address proof' },
]

export function AccountPage() {
  const { user } = useAuth()

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Account</h1>

      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <Row label="Name" value={user?.name ?? '—'} />
          <Row label="Email" value={user?.email ?? '—'} />
          <Row label="Phone" value={user?.phone || '—'} />
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">KYC status</span>
            {user && <StatusBadge status={user.kycStatus} />}
          </div>
        </CardContent>
      </Card>

      <KycSection />
    </div>
  )
}

function KycSection() {
  const { refreshUser } = useAuth()
  const { data, isLoading } = useGetMyKycDocumentsQuery()
  const [upload, uploadState] = useUploadKycDocumentMutation()
  const [remove, removeState] = useDeleteKycDocumentMutation()
  const toast = useToast()

  const [type, setType] = useState<DocumentType>('KYC_IDENTITY')
  const [pendingDelete, setPendingDelete] = useState<DocumentResponse | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      await upload({ file, type }).unwrap()
      toast.success('Document uploaded — pending verification')
      await refreshUser()
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

  async function confirmDelete() {
    if (!pendingDelete) return
    try {
      await remove(pendingDelete.id).unwrap()
      toast.success('Document removed')
      setPendingDelete(null)
    } catch (err) {
      toast.error(errorMessage(err), 'Could not delete')
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>KYC documents</CardTitle>
        <CardDescription>
          Upload your identity and address proof. An admin verifies them before you can be fully
          KYC-approved.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="flex flex-wrap items-end gap-3">
          <Field label="Document type" htmlFor="kycType" className="min-w-48">
            <Select id="kycType" value={type} onChange={(e) => setType(e.target.value as DocumentType)}>
              {KYC_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </Select>
          </Field>
          <input
            ref={fileRef}
            type="file"
            accept="image/*,application/pdf"
            className="hidden"
            onChange={onFile}
          />
          <Button
            variant="outline"
            onClick={() => fileRef.current?.click()}
            loading={uploadState.isLoading}
          >
            <Upload className="h-4 w-4" /> Upload file
          </Button>
        </div>

        {isLoading ? (
          <Spinner />
        ) : !data || data.length === 0 ? (
          <EmptyState icon={FileText} title="No documents yet" description="Upload your KYC proofs above." />
        ) : (
          <ul className="divide-y divide-border rounded-[calc(var(--radius)+2px)] border border-border">
            {data.map((doc) => (
              <li key={doc.id} className="flex items-center gap-3 p-3">
                <FileText className="h-5 w-5 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{labelFor(doc.docType)}</span>
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
        description="You can re-upload it later if needed."
        confirmLabel="Delete"
        variant="destructive"
        loading={removeState.isLoading}
        onConfirm={confirmDelete}
      />
    </Card>
  )
}

function labelFor(type: DocumentType): string {
  return KYC_TYPES.find((t) => t.value === type)?.label ?? type
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  )
}
