import { baseApi } from '../../app/base-api'
import type { DocumentResponse, DocumentStatus, UserResponse } from '../../lib/types'

/** One agency in the admin review queue. */
export interface AdminAgencyRow {
  id: number
  name: string
  city: string | null
  status: 'PENDING' | 'ACTIVE' | 'SUSPENDED'
  ownerEmail: string
  /** Onboarding completeness — has the agency drawn its operating area? */
  hasZone: boolean
  cars: number
}

export const adminApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getAdminUsers: build.query<UserResponse[], void>({
      query: () => ({ url: '/admin/users' }),
      providesTags: ['AdminUsers'],
    }),
    getAdminAgencies: build.query<AdminAgencyRow[], void>({
      query: () => ({ url: '/admin/agencies' }),
      providesTags: ['AdminAgencies'],
    }),
    approveAgency: build.mutation<unknown, number>({
      query: (id) => ({ url: `/admin/agencies/${id}/approve`, method: 'POST' }),
      invalidatesTags: ['AdminAgencies', 'Agency'],
    }),
    suspendAgency: build.mutation<unknown, number>({
      query: (id) => ({ url: `/admin/agencies/${id}/suspend`, method: 'POST' }),
      invalidatesTags: ['AdminAgencies', 'Agency'],
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
  useGetAdminAgenciesQuery,
  useApproveAgencyMutation,
  useSuspendAgencyMutation,
  useGetAdminDocumentsQuery,
  useVerifyDocumentMutation,
  useRejectDocumentMutation,
} = adminApi
