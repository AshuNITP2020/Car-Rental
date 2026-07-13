import { useState } from 'react'
import { Check, Eye, FileCheck2, X } from 'lucide-react'
import { StatusBadge } from '../../components/ui/badge'
import { Button } from '../../components/ui/button'
import { Card, CardContent } from '../../components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../components/ui/dialog'
import { EmptyState } from '../../components/ui/empty-state'
import { Field } from '../../components/ui/field'
import { LoadingState } from '../../components/ui/spinner'
import { Textarea } from '../../components/ui/textarea'
import { useToast } from '../../components/ui/toast'
import { cn } from '../../lib/utils'
import { fetchBlob } from '../../lib/api'
import { formatDate } from '../../lib/date'
import { errorMessage } from '../../lib/errors'
import type { DocumentResponse, DocumentStatus, DocumentType } from '../../lib/types'
import { formatBytes } from '../../lib/utils'
import {
  useGetAdminDocumentsQuery,
  useRejectDocumentMutation,
  useVerifyDocumentMutation,
} from './api'

const DOC_TYPE_LABEL: Record<DocumentType, string> = {
  KYC_IDENTITY: 'Identity proof',
  KYC_ADDRESS: 'Address proof',
  INSURANCE: 'Insurance',
  REGISTRATION: 'Registration',
}

const FILTERS: { label: string; value: DocumentStatus | undefined }[] = [
  { label: 'Pending', value: 'PENDING' },
  { label: 'Verified', value: 'VERIFIED' },
  { label: 'Rejected', value: 'REJECTED' },
  { label: 'All', value: undefined },
]

export function AdminDocumentsPage() {
  const [filter, setFilter] = useState<DocumentStatus | undefined>('PENDING')
  const { data: docs, isLoading, isError } = useGetAdminDocumentsQuery(filter)
  const [verify, verifyState] = useVerifyDocumentMutation()
  const [reject, rejectState] = useRejectDocumentMutation()
  const toast = useToast()

  const [rejectTarget, setRejectTarget] = useState<DocumentResponse | null>(null)
  const [note, setNote] = useState('')

  async function view(doc: DocumentResponse) {
    try {
      const blob = await fetchBlob(`/documents/${doc.id}/content`)
      const url = URL.createObjectURL(blob)
      window.open(url, '_blank', 'noopener,noreferrer')
      setTimeout(() => URL.revokeObjectURL(url), 60_000)
    } catch (e) {
      toast.error(errorMessage(e), 'Could not open document')
    }
  }

  async function doVerify(doc: DocumentResponse) {
    try {
      await verify({ id: doc.id }).unwrap()
      toast.success('Document verified')
    } catch (e) {
      toast.error(errorMessage(e), 'Could not verify')
    }
  }

  async function doReject() {
    if (!rejectTarget) return
    try {
      await reject({ id: rejectTarget.id, note: note.trim() || undefined }).unwrap()
      toast.success('Document rejected')
      setRejectTarget(null)
      setNote('')
    } catch (e) {
      toast.error(errorMessage(e), 'Could not reject')
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Document review</h1>
        <p className="text-sm text-muted-foreground">Verify KYC and car documents.</p>
      </div>

      <div className="flex gap-1 rounded-[var(--radius)] border border-border p-1">
        {FILTERS.map((f) => (
          <button
            key={f.label}
            onClick={() => setFilter(f.value)}
            className={cn(
              'flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
              filter === f.value
                ? 'bg-muted text-foreground'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <LoadingState />
      ) : isError ? (
        <EmptyState icon={FileCheck2} title="Couldn’t load documents" />
      ) : !docs || docs.length === 0 ? (
        <EmptyState icon={FileCheck2} title="Nothing here" description="No documents in this state." />
      ) : (
        <div className="space-y-3">
          {docs.map((doc) => (
            <Card key={doc.id}>
              <CardContent className="flex flex-wrap items-center gap-3 pt-5">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{DOC_TYPE_LABEL[doc.docType]}</span>
                    <StatusBadge status={doc.status} />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {doc.ownerType} #{doc.ownerId} · {formatBytes(doc.sizeBytes)} ·{' '}
                    {formatDate(doc.createdAt)}
                    {doc.reviewNote ? ` · “${doc.reviewNote}”` : ''}
                  </p>
                </div>
                <Button variant="outline" size="sm" onClick={() => view(doc)}>
                  <Eye className="h-4 w-4" /> View
                </Button>
                {doc.status === 'PENDING' && (
                  <>
                    <Button
                      size="sm"
                      onClick={() => doVerify(doc)}
                      loading={verifyState.isLoading && verifyState.originalArgs?.id === doc.id}
                    >
                      <Check className="h-4 w-4" /> Verify
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-destructive"
                      onClick={() => setRejectTarget(doc)}
                    >
                      <X className="h-4 w-4" /> Reject
                    </Button>
                  </>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog
        open={!!rejectTarget}
        onOpenChange={(o) => {
          if (!o) {
            setRejectTarget(null)
            setNote('')
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject document</DialogTitle>
          </DialogHeader>
          <Field label="Reason" hint="Optional — shown to the owner">
            <Textarea
              value={note}
              placeholder="e.g. Image is blurry, please re-upload"
              onChange={(e) => setNote(e.target.value)}
            />
          </Field>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectTarget(null)}>
              Cancel
            </Button>
            <Button variant="destructive" loading={rejectState.isLoading} onClick={doReject}>
              Reject document
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
