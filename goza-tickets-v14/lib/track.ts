/*
  Marketing pixels — Meta (fbq) + TikTok (ttq).
  Every wrapper is null-safe: if a pixel is blocked or slow to load, the call
  no-ops instead of throwing — analytics must never break a sale.
  Events map to both platforms' standard event names:
    ViewContent        -> fbq ViewContent      / ttq ViewContent
    InitiateCheckout   -> fbq InitiateCheckout / ttq InitiateCheckout
    AddToCart          -> fbq AddToCart        / ttq AddToCart
    AddPaymentInfo     -> fbq AddPaymentInfo   / ttq AddPaymentInfo
    Purchase           -> fbq Purchase         / ttq CompletePayment
*/

declare global {
  interface Window { fbq?: (...a: any[]) => void; ttq?: any }
}

export const META_PIXEL_ID = '1672659623595525';
export const TIKTOK_PIXEL_ID = 'D34UDMRC77U0D4L1M0B0';

// fire on both platforms, guard each independently so one failing can't stop the other
function fire(fb: () => void, tt: () => void) {
  try { if (typeof window !== 'undefined' && window.fbq) fb(); } catch { /* no-op */ }
  try { if (typeof window !== 'undefined' && window.ttq?.track) tt(); } catch { /* no-op */ }
}

/** Event page viewed */
export function trackViewContent(eventId: string, eventName: string, minPrice: number) {
  fire(
    () => window.fbq!('track', 'ViewContent', { content_ids: [eventId], content_name: eventName, content_type: 'product', value: minPrice, currency: 'USD' }),
    () => window.ttq.track('ViewContent', { content_id: eventId, content_name: eventName, content_type: 'product', value: minPrice, currency: 'USD' }),
  );
}

/** Tapped GET TICKETS — checkout sheet opened */
export function trackInitiateCheckout(eventId: string, eventName: string) {
  fire(
    () => window.fbq!('track', 'InitiateCheckout', { content_ids: [eventId], content_name: eventName, content_type: 'product' }),
    () => window.ttq.track('InitiateCheckout', { content_id: eventId, content_name: eventName, content_type: 'product' }),
  );
}

/** Added tickets to cart (reached the cart step with a quantity) */
export function trackAddToCart(eventId: string, eventName: string, value: number, qty: number) {
  fire(
    () => window.fbq!('track', 'AddToCart', { content_ids: [eventId], content_name: eventName, content_type: 'product', value, currency: 'USD', num_items: qty }),
    () => window.ttq.track('AddToCart', { content_id: eventId, content_name: eventName, content_type: 'product', value, currency: 'USD', quantity: qty }),
  );
}

/** Hit Pay — heading to Stripe card entry */
export function trackAddPaymentInfo(eventId: string, value: number) {
  fire(
    () => window.fbq!('track', 'AddPaymentInfo', { content_ids: [eventId], value, currency: 'USD' }),
    () => window.ttq.track('AddPaymentInfo', { content_id: eventId, value, currency: 'USD' }),
  );
}

/**
 * Paid — THE optimization event. Fired on the receipt page once the order is
 * confirmed. orderId is the dedup key (+ Meta eventID) so a refresh can't
 * double-count. Retries briefly if the pixel scripts haven't loaded yet.
 */
export function trackPurchase(orderId: string, value: number, tickets: number, eventName: string, attempt = 0) {
  try {
    const key = `gz_purchased_${orderId}`;
    if (sessionStorage.getItem(key)) return;

    const fbReady = typeof window !== 'undefined' && !!window.fbq;
    const ttReady = typeof window !== 'undefined' && !!window.ttq?.track;

    // If neither pixel has loaded yet, wait and retry (up to ~5s) — the redirect
    // back from Stripe sometimes lands before the head scripts finish.
    if (!fbReady && !ttReady && attempt < 10) {
      setTimeout(() => trackPurchase(orderId, value, tickets, eventName, attempt + 1), 500);
      return;
    }

    sessionStorage.setItem(key, '1');
    fire(
      () => window.fbq!('track', 'Purchase', { value, currency: 'USD', num_items: tickets, content_name: eventName, content_type: 'product' }, { eventID: orderId }),
      () => window.ttq.track('CompletePayment', { value, currency: 'USD', quantity: tickets, content_name: eventName, content_type: 'product', event_id: orderId }),
    );
  } catch { /* no-op */ }
}
