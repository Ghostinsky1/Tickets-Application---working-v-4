/*
  Marketing pixels — Meta (fbq) + TikTok (ttq).
  Every wrapper is null-safe: if a pixel is blocked or slow to load, the call
  no-ops instead of throwing — analytics must never break a sale.

  TikTok specifics:
   - every event carries `content_id` AND the `contents:[{...}]` array
     (required for Video Shopping Ads / catalog matching).
   - Advanced Matching: we pass hashed-in-browser identifiers via ttq.identify
     (TikTok hashes email/phone client-side automatically when passed to identify).
*/

declare global {
  interface Window { fbq?: (...a: any[]) => void; ttq?: any }
}

export const META_PIXEL_ID = '1672659623595525';
export const TIKTOK_PIXEL_ID = 'D34UDMRC77U0D4L1M0B0';

function fire(fb: () => void, tt: () => void) {
  try { if (typeof window !== 'undefined' && window.fbq) fb(); } catch { /* no-op */ }
  try { if (typeof window !== 'undefined' && window.ttq?.track) tt(); } catch { /* no-op */ }
}

/** Fire a PageView on both pixels — call on each page mount so SPA navigation
 *  registers with Meta/TikTok (the base code only fires on first hard load). */
export function trackPageView() {
  fire(
    () => window.fbq!('track', 'PageView'),
    () => window.ttq.page(),
  );
}


// TikTok content payload — content_id (singular) + contents[] array, both required
// for shopping ads to receive the identifier.
function ttContents(eventId: string, eventName: string, price: number, qty: number) {
  return {
    content_id: eventId,
    content_type: 'product',
    content_name: eventName,
    contents: [{ content_id: eventId, content_name: eventName, content_type: 'product', price, quantity: qty }],
    value: price * qty,
    currency: 'USD',
    quantity: qty,
  };
}

/**
 * Advanced Matching — feed TikTok the buyer's email/phone so it can match the
 * conversion to a TikTok account. TikTok's pixel hashes these client-side.
 * Call as soon as you know them (contact step / receipt).
 */
export function identifyUser(email?: string, phone?: string) {
  try {
    if (typeof window === 'undefined' || !window.ttq?.identify) return;
    const payload: Record<string, string> = {};
    if (email) payload.email = email.trim().toLowerCase();
    if (phone) payload.phone_number = phone.replace(/[^\d+]/g, '');
    if (Object.keys(payload).length) window.ttq.identify(payload);
  } catch { /* no-op */ }
}

/** Event page viewed */
export function trackViewContent(eventId: string, eventName: string, minPrice: number) {
  fire(
    () => window.fbq!('track', 'ViewContent', { content_ids: [eventId], content_name: eventName, content_type: 'product', value: minPrice, currency: 'USD' }),
    () => window.ttq.track('ViewContent', ttContents(eventId, eventName, minPrice, 1)),
  );
}

/** Tapped GET TICKETS — checkout sheet opened */
export function trackInitiateCheckout(eventId: string, eventName: string) {
  fire(
    () => window.fbq!('track', 'InitiateCheckout', { content_ids: [eventId], content_name: eventName, content_type: 'product' }),
    () => window.ttq.track('InitiateCheckout', ttContents(eventId, eventName, 0, 1)),
  );
}

/** Added tickets to cart */
export function trackAddToCart(eventId: string, eventName: string, value: number, qty: number) {
  fire(
    () => window.fbq!('track', 'AddToCart', { content_ids: [eventId], content_name: eventName, content_type: 'product', value, currency: 'USD', num_items: qty }),
    () => window.ttq.track('AddToCart', { ...ttContents(eventId, eventName, qty ? value / qty : value, qty), value }),
  );
}

/** Hit Pay — heading to Stripe card entry */
export function trackAddPaymentInfo(eventId: string, eventName: string, value: number, qty: number) {
  fire(
    () => window.fbq!('track', 'AddPaymentInfo', { content_ids: [eventId], content_name: eventName, value, currency: 'USD' }),
    () => window.ttq.track('AddPaymentInfo', { ...ttContents(eventId, eventName, qty ? value / qty : value, qty), value }),
  );
}

/**
 * Paid — THE optimization event, fired on the receipt page once confirmed.
 * orderId dedups (+ Meta eventID). Retries briefly if pixels haven't loaded.
 */
export function trackPurchase(orderId: string, eventId: string, value: number, tickets: number, eventName: string, attempt = 0) {
  try {
    // localStorage (not session) so a revisited receipt can NEVER re-fire an old
    // purchase into whatever campaign is running that day.
    const key = `gz_purchased_${orderId}`;
    if (localStorage.getItem(key)) return;

    const fbReady = typeof window !== 'undefined' && !!window.fbq;
    const ttReady = typeof window !== 'undefined' && !!window.ttq?.track;
    if (!fbReady && !ttReady && attempt < 10) {
      setTimeout(() => trackPurchase(orderId, eventId, value, tickets, eventName, attempt + 1), 500);
      return;
    }

    localStorage.setItem(key, '1');
    if (value <= 0) {
      // FREE tickets are NOT purchases. Fire a Lead instead so campaigns still see
      // the signup signal without polluting purchase/ROAS data.
      fire(
        () => window.fbq!('track', 'Lead', { content_name: eventName, content_type: 'product', content_ids: [eventId] }, { eventID: `free_${orderId}` }),
        () => window.ttq.track('SubmitForm', { ...ttContents(eventId, eventName, 0, tickets), event_id: `free_${orderId}` }),
      );
      return;
    }
    fire(
      () => window.fbq!('track', 'Purchase', { value, currency: 'USD', num_items: tickets, content_name: eventName, content_type: 'product', content_ids: [eventId] }, { eventID: orderId }),
      () => window.ttq.track('CompletePayment', {
        ...ttContents(eventId, eventName, tickets ? value / tickets : value, tickets),
        value, event_id: orderId,
      }),
    );
  } catch { /* no-op */ }
}

export function trackLead(eventId: string, eventName: string) {
  try {
    fire(
      () => window.fbq!('track', 'Lead', { content_name: eventName, content_type: 'product', content_ids: [eventId] }),
      () => window.ttq?.track?.('SubmitForm', { content_id: eventId, content_name: eventName }),
    );
  } catch { /* no-op */ }
}
