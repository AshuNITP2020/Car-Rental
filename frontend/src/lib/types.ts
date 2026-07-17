/**
 * API contract types — mirror the Spring Boot backend DTOs.
 *
 * Conventions from the backend serializer:
 *  - Java OffsetDateTime  -> ISO-8601 string
 *  - Java BigDecimal/Long -> JSON number
 *  - Enums are serialized as their UPPERCASE name (string)
 */

// ── Enums ──────────────────────────────────────────────────────────────────
export type UserRole = 'CUSTOMER' | 'PLATFORM_ADMIN'
export type AgencyRole = 'ADMIN' | 'STAFF'
export type AgencyStatus = 'PENDING' | 'ACTIVE' | 'SUSPENDED'
export type KycStatus = 'PENDING' | 'VERIFIED' | 'REJECTED'
export type CarStatus = 'AVAILABLE' | 'BOOKED' | 'MAINTENANCE' | 'OUT_OF_SERVICE'
export type BookingStatus =
  | 'PENDING'
  | 'CONFIRMED'
  | 'ACTIVE'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'EXPIRED'
export type PaymentStatus = 'CREATED' | 'CAPTURED' | 'FAILED' | 'REFUNDED'
export type PaymentType = 'BOOKING' | 'DEPOSIT' | 'REFUND' | 'PAYOUT'
export type DocumentStatus = 'PENDING' | 'VERIFIED' | 'REJECTED'
export type DocumentType =
  | 'KYC_IDENTITY'
  | 'KYC_ADDRESS'
  | 'INSURANCE'
  | 'REGISTRATION'
export type DocumentOwnerType = 'USER' | 'CAR'
export type TripType = 'ROUND_TRIP' | 'ONE_WAY'

// ── Errors & envelopes ───────────────────────────────────────────────────────
export interface ApiFieldError {
  field: string
  message: string
}
export interface ApiError {
  status: number
  error: string
  message: string
  path: string
  fieldErrors?: ApiFieldError[]
}
export interface PageResponse<T> {
  content: T[]
  page: number
  size: number
  totalElements: number
  totalPages: number
  hasNext: boolean
}

// ── Auth & user ──────────────────────────────────────────────────────────────
export interface UserResponse {
  id: number
  name: string
  email: string
  phone: string | null
  kycStatus: KycStatus
  role: UserRole
}
export interface AuthResponse {
  accessToken: string
  refreshToken: string
  tokenType: string // "Bearer"
  expiresInSeconds: number
  user: UserResponse
}
export interface RegisterRequest {
  name: string
  email: string
  phone?: string
  password: string
}
export interface LoginRequest {
  email: string
  password: string
}

/** Claims we read out of the decoded access token for UI workspace gating. */
export interface AccessTokenClaims {
  sub: string
  email?: string
  role: UserRole
  agencyId?: number
  agencyRole?: AgencyRole
  type: 'access' | 'refresh'
  exp: number
  iat?: number
}

// ── Search / cars ─────────────────────────────────────────────────────────────
export interface CarSearchResult {
  id: number
  agencyId: number
  agencyName: string
  city: string | null
  make: string
  model: string
  category: string
  pricePerDay: number
  latitude: number | null
  longitude: number | null
  status: CarStatus
  /** Aggregate review rating — null / 0 when the car has no reviews yet. */
  averageRating: number | null
  reviewCount: number
}
export interface AgencyRatingResponse {
  averageRating: number | null
  reviewCount: number
}
export interface CarImageResponse {
  id: number
  carId: number
  url: string
  contentType: string
  sizeBytes: number
  position: number
}
export interface AvailabilityResponse {
  carId: number
  from: string
  to: string
  available: boolean
  reason: string | null
}
export interface PriceBreakdown {
  days: number
  rental: number
  gst: number
  deposit: number
  /** Distance-based relocation fee for one-way drop-offs (0 for round trips). */
  oneWayFee: number
  platformFee: number
  total: number
  currency: string
}

/** An operating city (has at least one agency); centroid for distance estimates. */
export interface CityInfo {
  city: string
  agencyCount: number
  latitude: number | null
  longitude: number | null
}

/** A WGS84 map point. */
export interface LatLng {
  lat: number
  lng: number
}

/** A geocoded place (GET /api/geo/search|reverse): any city/town/village in India. */
export interface PlaceSuggestion {
  name: string
  state: string | null
  lat: number
  lng: number
}

/** One agency in the trip-first search — the marketplace's "ride option".
 *  Matched because its operating polygon covers the pickup pin. */
export interface AgencySearchResult {
  agencyId: number
  name: string
  city: string
  latitude: number | null
  longitude: number | null
  availableCars: number
  fromPricePerDay: number
  averageRating: number | null
  reviewCount: number
  /** Agency base -> pickup pin, km. */
  distanceKm: number | null
  /** The operating polygon (unclosed ring) — drawn on the results map. */
  serviceArea: LatLng[] | null
}

// ── Bookings & payments ────────────────────────────────────────────────────────
export interface BookingResponse {
  id: number
  carId: number
  agencyId: number
  userId: number
  from: string
  to: string
  status: BookingStatus
  amount: number
  deposit: number
  tripType: TripType
  pickupCity: string | null
  dropCity: string | null
  pickupLat: number | null
  pickupLng: number | null
  dropLat: number | null
  dropLng: number | null
  oneWayFee: number
  expiresAt: string | null
}
export interface CreateBookingRequest {
  carId: number
  from: string
  to: string
  /** Defaults to ROUND_TRIP server-side when omitted. */
  tripType?: TripType
  /** ONE_WAY: the drop pin — must be inside a serviced operating area. */
  dropLat?: number
  dropLng?: number
}
export interface CancelResponse {
  bookingId: number
  status: BookingStatus
  refundedAmount: number
  currency: string
}
export interface PaymentOrderResponse {
  paymentId: number
  bookingId: number
  provider: string
  orderId: string
  amount: number
  currency: string
  status: PaymentStatus
  /** Provider's PUBLIC key id for the browser checkout widget (null for mock). */
  keyId: string | null
}
export interface VerifyCheckoutRequest {
  razorpayOrderId: string
  razorpayPaymentId: string
  razorpaySignature: string
}

// ── Reviews ────────────────────────────────────────────────────────────────────
export interface ReviewResponse {
  id: number
  bookingId: number
  carId: number
  rating: number
  comment: string | null
  createdAt: string
}
export interface CarReviewsResponse {
  averageRating: number | null
  count: number
  reviews: ReviewResponse[]
}
export interface CreateReviewRequest {
  rating: number
  comment?: string
}

// ── Documents ─────────────────────────────────────────────────────────────────
export interface DocumentResponse {
  id: number
  ownerType: DocumentOwnerType
  ownerId: number
  docType: DocumentType
  status: DocumentStatus
  contentType: string
  sizeBytes: number
  downloadUrl: string
  reviewNote: string | null
  createdAt: string
}

// ── Agency & fleet ─────────────────────────────────────────────────────────────
export interface AgencyResponse {
  id: number
  name: string
  ownerId: number
  city: string | null
  latitude: number | null
  longitude: number | null
  gstNo: string | null
  payoutAccount: string | null
  status: AgencyStatus
}
export interface AgencyRequest {
  name: string
  city?: string
  gstNo?: string
  payoutAccount?: string
  latitude?: number
  longitude?: number
}
export interface CarResponse {
  id: number
  agencyId: number
  make: string
  model: string
  category: string
  regNo: string
  pricePerDay: number
  status: CarStatus
}
export interface CreateCarRequest {
  make: string
  model: string
  category: string
  regNo: string
  pricePerDay: number
  latitude?: number
  longitude?: number
}
export interface UpdateCarRequest extends CreateCarRequest {
  status: CarStatus
}

// ── Agency dashboard ────────────────────────────────────────────────────────────
export interface MonthlyTrend {
  month: string // "YYYY-MM"
  bookings: number
  revenue: number
}
export interface AgencyDashboardResponse {
  fleet: {
    totalCars: number
    byStatus: Partial<Record<CarStatus, number>>
  }
  bookings: {
    totalBookings: number
    byStatus: Partial<Record<BookingStatus, number>>
  }
  revenue: {
    total: number
    last30Days: number
  }
  utilizationPercent: number
  idleCarCount: number
  trends: MonthlyTrend[]
}
