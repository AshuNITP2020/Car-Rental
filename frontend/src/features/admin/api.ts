import { baseApi } from '../../app/base-api'
import type { DocumentResponse, DocumentStatus, UserResponse } from '../../lib/types'

export const adminApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getAdminUsers: build.query<UserResponse[], void>({
      query: () => ({ url: '/admin/users' }),
      providesTags: ['AdminUsers'],
    }),
    /** Omit status to list all documents. */
    getAdminDocuments: build.query<DocumentResponse[], DocumentStatus | undefined>({
      query: (status) => ({ url: '/admin/documents', params: { status } }),
      providesTags: ['AdminDocs'],
    }),
    // Verifying/rejecting a KYC doc also moves the owner's kycStatus -> AdminUsers.
    verifyDocument: build.mutation<DocumentResponse, { id: number; note?: string }>({
      query: ({ id, note }) => ({
        url: `/admin/documents/${id}/verify`,
        method: 'POST',
        params: { note },
      }),
      invalidatesTags: ['AdminDocs', 'AdminUsers'],
    }),
    rejectDocument: build.mutation<DocumentResponse, { id: number; note?: string }>({
      query: ({ id, note }) => ({
        url: `/admin/documents/${id}/reject`,
        method: 'POST',
        params: { note },
      }),
      invalidatesTags: ['AdminDocs', 'AdminUsers'],
    }),
  }),
})

export const {
  useGetAdminUsersQuery,
  useGetAdminDocumentsQuery,
  useVerifyDocumentMutation,
  useRejectDocumentMutation,
} = adminApi
