import { baseApi } from '../../app/base-api'
import type {
  AgencyDashboardResponse,
  AgencyRequest,
  AgencyResponse,
  BookingResponse,
  CarImageResponse,
  CarResponse,
  CreateCarRequest,
  DocumentResponse,
  DocumentType,
  LatLng,
  UpdateCarRequest,
} from '../../lib/types'

export const agencyApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    // ── Agency profile ─────────────────────────────────────────────────────
    getMyAgency: build.query<AgencyResponse, void>({
      query: () => ({ url: '/agencies/me' }),
      providesTags: ['Agency'],
    }),
    createAgency: build.mutation<AgencyResponse, AgencyRequest>({
      query: (body) => ({ url: '/agencies', method: 'POST', body }),
      invalidatesTags: ['Agency', 'AgencyCars', 'Dashboard'],
    }),
    updateAgency: build.mutation<AgencyResponse, AgencyRequest>({
      query: (body) => ({ url: '/agencies/me', method: 'PUT', body }),
      invalidatesTags: ['Agency'],
    }),

    // ── Operating area (the polygon trip searches match against) ──────────
    getMyServiceArea: build.query<{ polygon: LatLng[] | null }, void>({
      query: () => ({ url: '/agencies/me/service-area' }),
      providesTags: ['Agency'],
    }),
    updateServiceArea: build.mutation<{ polygon: LatLng[] }, { polygon: LatLng[] }>({
      query: (body) => ({ url: '/agencies/me/service-area', method: 'PUT', body }),
      invalidatesTags: ['Agency'],
    }),

    // ── Dashboard ──────────────────────────────────────────────────────────
    getAgencyDashboard: build.query<AgencyDashboardResponse, void>({
      query: () => ({ url: '/agency/dashboard' }),
      providesTags: ['Dashboard'],
    }),

    // ── Fleet ──────────────────────────────────────────────────────────────
    getAgencyCars: build.query<CarResponse[], void>({
      query: () => ({ url: '/agency/cars' }),
      providesTags: ['AgencyCars'],
    }),
    getAgencyCar: build.query<CarResponse, number>({
      query: (id) => ({ url: `/agency/cars/${id}` }),
      providesTags: (_r, _e, id) => [{ type: 'AgencyCars', id }],
    }),
    createCar: build.mutation<CarResponse, CreateCarRequest>({
      query: (body) => ({ url: '/agency/cars', method: 'POST', body }),
      // 'Car' keeps the customer-facing search fresh too.
      invalidatesTags: ['AgencyCars', 'Dashboard', 'Car'],
    }),
    updateCar: build.mutation<CarResponse, { id: number; body: UpdateCarRequest }>({
      query: ({ id, body }) => ({ url: `/agency/cars/${id}`, method: 'PUT', body }),
      invalidatesTags: (_r, _e, { id }) => [
        'AgencyCars',
        { type: 'AgencyCars', id },
        'Dashboard',
        'Car',
        { type: 'Car', id },
      ],
    }),
    deleteCar: build.mutation<void, number>({
      query: (id) => ({ url: `/agency/cars/${id}`, method: 'DELETE' }),
      invalidatesTags: ['AgencyCars', 'Dashboard', 'Car'],
    }),

    // ── Car images ─────────────────────────────────────────────────────────
    getAgencyCarImages: build.query<CarImageResponse[], number>({
      query: (carId) => ({ url: `/agency/cars/${carId}/images` }),
      providesTags: (_r, _e, carId) => [{ type: 'AgencyCarImages', id: carId }],
    }),
    uploadCarImage: build.mutation<CarImageResponse, { carId: number; file: File }>({
      query: ({ carId, file }) => {
        const form = new FormData()
        form.append('file', file)
        return { url: `/agency/cars/${carId}/images`, method: 'POST', form }
      },
      invalidatesTags: (_r, _e, { carId }) => [
        { type: 'AgencyCarImages', id: carId },
        { type: 'CarImages', id: carId },
      ],
    }),
    /** Make an image the gallery cover; returns the reordered gallery. */
    setCoverImage: build.mutation<CarImageResponse[], { carId: number; imageId: number }>({
      query: ({ carId, imageId }) => ({
        url: `/agency/cars/${carId}/images/${imageId}/cover`,
        method: 'PUT',
      }),
      invalidatesTags: (_r, _e, { carId }) => [
        { type: 'AgencyCarImages', id: carId },
        { type: 'CarImages', id: carId },
      ],
    }),
    deleteCarImage: build.mutation<void, { carId: number; imageId: number }>({
      query: ({ carId, imageId }) => ({
        url: `/agency/cars/${carId}/images/${imageId}`,
        method: 'DELETE',
      }),
      // Optimistic: drop the image from the gallery immediately, roll back on failure.
      async onQueryStarted({ carId, imageId }, { dispatch, queryFulfilled }) {
        const patch = dispatch(
          agencyApi.util.updateQueryData('getAgencyCarImages', carId, (draft) => {
            const i = draft.findIndex((img) => img.id === imageId)
            if (i !== -1) draft.splice(i, 1)
          }),
        )
        try {
          await queryFulfilled
        } catch {
          patch.undo()
        }
      },
      invalidatesTags: (_r, _e, { carId }) => [
        { type: 'AgencyCarImages', id: carId },
        { type: 'CarImages', id: carId },
      ],
    }),

    // ── Car documents ──────────────────────────────────────────────────────
    getAgencyCarDocuments: build.query<DocumentResponse[], number>({
      query: (carId) => ({ url: `/agency/cars/${carId}/documents` }),
      providesTags: (_r, _e, carId) => [{ type: 'AgencyCarDocs', id: carId }],
    }),
    uploadCarDocument: build.mutation<
      DocumentResponse,
      { carId: number; file: File; type: DocumentType }
    >({
      query: ({ carId, file, type }) => {
        const form = new FormData()
        form.append('file', file)
        return { url: `/agency/cars/${carId}/documents`, method: 'POST', form, params: { type } }
      },
      invalidatesTags: (_r, _e, { carId }) => [{ type: 'AgencyCarDocs', id: carId }],
    }),
    deleteCarDocument: build.mutation<void, { carId: number; docId: number }>({
      query: ({ carId, docId }) => ({
        url: `/agency/cars/${carId}/documents/${docId}`,
        method: 'DELETE',
      }),
      invalidatesTags: (_r, _e, { carId }) => [{ type: 'AgencyCarDocs', id: carId }],
    }),

    // ── Booking lifecycle actions ──────────────────────────────────────────
    activateBooking: build.mutation<BookingResponse, number>({
      query: (id) => ({ url: `/agency/bookings/${id}/activate`, method: 'POST' }),
      invalidatesTags: ['Bookings', 'Dashboard'],
    }),
    completeBooking: build.mutation<BookingResponse, number>({
      query: (id) => ({ url: `/agency/bookings/${id}/complete`, method: 'POST' }),
      invalidatesTags: ['Bookings', 'Dashboard'],
    }),
  }),
})

export const {
  useGetMyAgencyQuery,
  useCreateAgencyMutation,
  useUpdateAgencyMutation,
  useGetMyServiceAreaQuery,
  useUpdateServiceAreaMutation,
  useGetAgencyDashboardQuery,
  useGetAgencyCarsQuery,
  useGetAgencyCarQuery,
  useCreateCarMutation,
  useUpdateCarMutation,
  useDeleteCarMutation,
  useGetAgencyCarImagesQuery,
  useUploadCarImageMutation,
  useSetCoverImageMutation,
  useDeleteCarImageMutation,
  useGetAgencyCarDocumentsQuery,
  useUploadCarDocumentMutation,
  useDeleteCarDocumentMutation,
  useActivateBookingMutation,
  useCompleteBookingMutation,
} = agencyApi
