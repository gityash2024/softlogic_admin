import { aiBillingApi } from '@/services/ai-billing.api';
import type { AiCheckout, AiOrder, AiPaymentGateway } from '@/types/ai';

const SDK_URLS: Partial<Record<AiPaymentGateway, string>> = {
  RAZORPAY: 'https://checkout.razorpay.com/v1/checkout.js',
  CASHFREE: 'https://sdk.cashfree.com/js/v3/cashfree.js',
};

const loaded = new Map<string, Promise<void>>();

function loadScript(src: string): Promise<void> {
  const existing = loaded.get(src);
  if (existing) return existing;
  const promise = new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      loaded.delete(src);
      reject(new Error('Could not load the payment window. Check your connection and try again.'));
    };
    document.head.appendChild(script);
  });
  loaded.set(src, promise);
  return promise;
}

/**
 * Idempotency key per checkout attempt. Kept in sessionStorage so a double
 * click or a page refresh reuses the same server order instead of creating a
 * second one.
 */
export function idempotencyKeyFor(selection: string): string {
  const storageKey = `softlogic-ai-checkout:${selection}`;
  try {
    const existing = window.sessionStorage.getItem(storageKey);
    if (existing) return existing;
    const created = crypto.randomUUID();
    window.sessionStorage.setItem(storageKey, created);
    return created;
  } catch {
    return crypto.randomUUID();
  }
}

export function clearIdempotencyKey(selection: string) {
  try {
    window.sessionStorage.removeItem(`softlogic-ai-checkout:${selection}`);
  } catch {
    // ignore
  }
}

type RazorpayResponse = { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string };
type RazorpayInstance = { open: () => void; on: (event: string, handler: (response: unknown) => void) => void };
type RazorpayCtor = new (options: Record<string, unknown>) => RazorpayInstance;
type CashfreeFactory = (options: { mode: string }) => { checkout: (options: Record<string, unknown>) => Promise<{ error?: { message?: string } } | undefined> };

export type CheckoutOutcome =
  | { kind: 'redirected' }
  | { kind: 'completed'; order: AiOrder }
  | { kind: 'dismissed' };

/** Opens the gateway checkout. SDK gateways resolve in-page; redirect gateways leave the page. */
export async function launchCheckout(order: AiOrder, checkout: AiCheckout, brandName: string): Promise<CheckoutOutcome> {
  if (checkout.kind === 'redirect') {
    if (!checkout.redirectUrl) throw new Error('The payment gateway did not return a checkout link.');
    window.location.assign(checkout.redirectUrl);
    return { kind: 'redirected' };
  }
  const payload = checkout.clientPayload ?? {};
  if (order.gateway === 'RAZORPAY') {
    await loadScript(SDK_URLS.RAZORPAY!);
    const Razorpay = (window as unknown as { Razorpay?: RazorpayCtor }).Razorpay;
    if (!Razorpay) throw new Error('Razorpay checkout is unavailable.');
    return new Promise<CheckoutOutcome>((resolve, reject) => {
      const instance = new Razorpay({
        key: payload.keyId,
        order_id: payload.orderId,
        amount: payload.amount,
        currency: payload.currency,
        name: payload.name ?? brandName,
        description: payload.description,
        prefill: payload.prefill,
        notes: payload.notes,
        theme: { color: '#1149B5' },
        handler: (response: RazorpayResponse) => {
          aiBillingApi
            .confirm(order.id, { ...response })
            .then((confirmed) => resolve({ kind: 'completed', order: confirmed }))
            .catch(reject);
        },
        modal: { ondismiss: () => resolve({ kind: 'dismissed' }) },
      });
      instance.on('payment.failed', () => {
        // The buyer can retry inside the Razorpay window; the order stays pending.
      });
      instance.open();
    });
  }
  if (order.gateway === 'CASHFREE') {
    await loadScript(SDK_URLS.CASHFREE!);
    const Cashfree = (window as unknown as { Cashfree?: CashfreeFactory }).Cashfree;
    if (!Cashfree) throw new Error('Cashfree checkout is unavailable.');
    const cashfree = Cashfree({ mode: String(payload.mode ?? 'sandbox') });
    const result = await cashfree.checkout({ paymentSessionId: payload.paymentSessionId, redirectTarget: '_self', returnUrl: payload.returnUrl });
    if (result?.error) throw new Error(result.error.message ?? 'Cashfree checkout failed.');
    return { kind: 'redirected' };
  }
  throw new Error('Unsupported payment method.');
}
