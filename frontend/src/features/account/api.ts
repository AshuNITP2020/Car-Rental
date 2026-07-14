import { baseApi } from '../../app/base-api'
import type { DocumentResponse, DocumentType } from '../../lib/types'

export const accountApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getMyKycDocuments: build.query<DocumentResponse[], void>({
      query: () => ({ url: '/me/kyc-documents' }),
      providesTags: ['KycDocs'],
    }),
    uploadKycDocument: build.mutation<DocumentResponse, { file: File; type: DocumentType }>({
      query: ({ file, type }) => {
        const form = new FormData()
        form.append('file', file)
        // `type` is a @RequestParam server-side — send it in the query string.
        return { url: '/me/kyc-documents', method: 'POST', form, params: { type } }
      },
      invalidatesTags: ['KycDocs'],
    }),
    deleteKycDocument: build.mutation<void, number>({
      query: (id) => ({ url: `/me/kyc-documents/${id}`, method: 'DELETE' }),
      // Optimistic: remove the row immediately, roll back if the delete fails.
      async onQueryStarted(id, { dispatch, queryFulfilled }) {
        const patch = dispatch(
          accountApi.util.updateQueryData('getMyKycDocuments', undefined, (draft) => {
            const i = draft.findIndex((d) => d.id === id)
            if (i !== -1) draft.splice(i, 1)
          }),
        )
        try {
          await queryFulfilled
        } catch {
          patch.undo()
        }
      },
      invalidatesTags: ['KycDocs'],
    }),
  }),
})

export const {
  useGetMyKycDocumentsQuery,
  useUploadKycDocumentMutation,
  useDeleteKycDocumentMutation,
} = accountApi
