/*
  Marketing pixels — Meta + TikTok.
  Safe wrappers: if a pixel script is blocked (ad blockers), calls no-op
  instead of crashing checkout. Never let analytics break a sale.
*/

declare global {
  interface Window { fbq?: (...a: any[]) => void; ttq?: any }
}

export const META_PIXEL_ID = '1672659623595525';
export const TIKTOK_PIXEL_ID = 'D34UDMRC77U0D4L1M0B0';

/** Event page viewed */
export function trackViewContent(eventId: string, eventName: string, minPrice: number) {
  try {
    window.fbq?.('track', 'ViewContent', {
      content_ids: [eventId], content_name: eventName,
      content_type: 'product', value: minPrice, currency: 'USD',
    });
    window.ttq?.track?.('ViewContent', {
      content_id: eventId, content_name: eventName,
      content_type: 'product', value: minPrice, currency: 'USD',
    });
  } catch { /* never break the page over analytics */ }
}

/** Tapped GET TICKETS (checkout sheet opened) */
export function trackInitiateCheckout(eventId: string, eventName: string) {
  try {
    window.fbq?.('track', 'InitiateCheckout', { content_ids: [eventId], content_name: eventName });
    window.ttq?.track?.('InitiateCheckout', { content_id: eventId, content_name: eventName });
  } catch { /* no-op */ }
}

/** Hit Pay (heading to card entry) */
export function trackAddPaymentInfo(eventId: string, value: number) {
  try {
    window.fbq?.('track', 'AddPaymentInfo', { content_ids: [eventId], value, currency: 'USD' });
    window.ttq?.track?.('AddPaymentInfo', { content_id: eventId, value, currency: 'USD' });
  } catch { /* no-op */ }
}

/**
 * Paid — THE optimization event. Fired on the receipt page once the order
 * is confirmed. orderId doubles as the dedup key (and Meta eventID) so a
 * page refresh can't double-count the sale.
 */
export function trackPurchase(orderId: string, value: number, tickets: number, eventName: string) {
  try {
    const key = `gz_purchased_${orderId}`;
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, '1');
    window.fbq?.('track', 'Purchase', {
      value, currency: 'USD', num_items: tickets,
      content_name: eventName, content_type: 'product',
    }, { eventID: orderId });
    window.ttq?.track?.('CompletePayment', {
      value, currency: 'USD', quantity: tickets,
      content_name: eventName, event_id: orderId,
    });
  } catch { /* no-op */ }
}
