/**
 * Razorpay Checkout integration: loads the widget script once, opens the
 * payment modal, and resolves with the ids + signature the server needs for
 * verification (POST /bookings/{id}/payment/verify) — or null if dismissed.
 */

interface RazorpaySuccessResponse {
  razorpay_order_id: string
  razorpay_payment_id: string
  razorpay_signature: string
}

interface RazorpayOptions {
  key: string
  order_id: string
  name: string
  description?: string
  prefill?: { name?: string; email?: string; contact?: string }
  theme?: { color?: string }
  handler: (response: RazorpaySuccessResponse) => void
  modal?: { ondismiss?: () => void }
}

interface RazorpayInstance {
  open: () => void
}

declare global {
  interface Window {
    Razorpay?: new (options: RazorpayOptions) => RazorpayInstance
  }
}

const SCRIPT_URL = 'https://checkout.razorpay.com/v1/checkout.js'
let scriptPromise: Promise<void> | null = null

function loadScript(): Promise<void> {
  if (window.Razorpay) return Promise.resolve()
  if (!scriptPromise) {
    scriptPromise = new Promise((resolve, reject) => {
      const el = document.createElement('script')
      el.src = SCRIPT_URL
      el.async = true
      el.onload = () => resolve()
      el.onerror = () => {
        scriptPromise = null // allow a retry on the next attempt
        reject(new Error('Could not load the payment widget — check your connection'))
      }
      document.head.appendChild(el)
    })
  }
  return scriptPromise
}

export interface CheckoutParams {
  keyId: string
  orderId: string
  description?: string
  prefillName?: string
  prefillEmail?: string
}

export interface CheckoutResult {
  razorpayOrderId: string
  razorpayPaymentId: string
  razorpaySignature: string
}

/** Opens the Razorpay modal; resolves the handshake result, or null when the
 *  user closes the modal without paying. */
export async function openRazorpayCheckout(params: CheckoutParams): Promise<CheckoutResult | null> {
  await loadScript()
  if (!window.Razorpay) throw new Error('Payment widget unavailable')

  return new Promise((resolve) => {
    const rzp = new window.Razorpay!({
      key: params.keyId,
      order_id: params.orderId,
      name: 'CarRental',
      description: params.description,
      prefill: { name: params.prefillName, email: params.prefillEmail },
      theme: { color: '#4f46e5' },
      handler: (res) =>
        resolve({
          razorpayOrderId: res.razorpay_order_id,
          razorpayPaymentId: res.razorpay_payment_id,
          razorpaySignature: res.razorpay_signature,
        }),
      modal: { ondismiss: () => resolve(null) },
    })
    rzp.open()
  })
}
