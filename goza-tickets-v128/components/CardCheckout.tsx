'use client';

/*
  Embedded Stripe Payment Element — collects the card (plus Apple/Google Pay + Link)
  right inside the cart, no redirect to Stripe's hosted page.

  Flow:
   1. Parent already created a PaymentIntent (via /payment-intent) and passes clientSecret.
   2. We mount <Elements> with that secret + the publishable key.
   3. <PayForm> renders <PaymentElement> and confirms on submit.
   4. On success Stripe returns to /thanks?payment_intent=... which shows the receipt.
*/

import { useState } from 'react';
import { loadStripe, Stripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';

let stripePromise: Promise<Stripe | null> | null = null;
function getStripe(pk: string) {
  if (!stripePromise) stripePromise = loadStripe(pk);
  return stripePromise;
}

function PayForm({ btn, returnUrl, onError }: { btn: string; returnUrl: string; onError: (m: string) => void }) {
  const stripe = useStripe();
  const elements = useElements();
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    if (!stripe || !elements) return;
    setSubmitting(true);
    onError('');
    const { error } = await stripe.confirmPayment({
      elements,
      confirmParams: { return_url: returnUrl },
    });
    // If we get here, confirmation failed (success redirects away).
    if (error) {
      onError(error.message || 'Payment could not be completed. Please try another card.');
      setSubmitting(false);
    }
  };

  return (
    <div>
      <PaymentElement options={{ layout: 'tabs' }} />
      <button onClick={submit} disabled={!stripe || submitting}
        style={{ width: '100%', background: btn, color: '#fff', border: 'none', borderRadius: 28, padding: '17px 0', fontSize: 17, fontWeight: 700, cursor: 'pointer', marginTop: 18, opacity: !stripe || submitting ? 0.5 : 1 }}>
        {submitting ? 'Processing…' : 'Pay now'}
      </button>
    </div>
  );
}

export default function CardCheckout({
  publishableKey, clientSecret, btn, returnUrl, onError,
}: {
  publishableKey: string; clientSecret: string; btn: string; returnUrl: string; onError: (m: string) => void;
}) {
  const appearance = {
    theme: 'night' as const,
    variables: {
      colorPrimary: btn,
      colorBackground: '#141418',
      colorText: '#ffffff',
      colorDanger: '#ff6b6b',
      fontFamily: 'Helvetica Neue, Helvetica, Arial, sans-serif',
      borderRadius: '12px',
    },
  };
  return (
    <Elements stripe={getStripe(publishableKey)} options={{ clientSecret, appearance }}>
      <PayForm btn={btn} returnUrl={returnUrl} onError={onError} />
    </Elements>
  );
}
