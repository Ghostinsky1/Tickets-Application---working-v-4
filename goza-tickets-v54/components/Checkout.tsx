'use client';

/*
  TWO-STEP CHECKOUT STOREFRONT
  Drop at: app/page.tsx  (or app/[eventSlug]/page.tsx)

  Step 1  pick quantity — live fee breakdown, no surprises at the end
  Step 2  name / email / phone — then straight to Stripe

  Card details are never typed here. The buyer goes to Stripe's hosted page,
  which keeps card data entirely out of your app and off your servers.

  Set NEXT_PUBLIC_BACKEND_URL to your deployed backend.
*/

import { useState, useEffect, useCallback } from 'react';

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';

interface Quote {
  quantity: number;
  unitPrice: number;
  faceValue: number;
  serviceFee: number;
  tax: number;
  processingFee: number;
  total: number;
  remaining: number;
  ticketTypeName: string;
  buyerPaysFees: boolean;
  buyerPaysProcessing: boolean;
}

interface Props {
  eventId: string;
  ticketTypeId: string;
  eventName: string;
  eventDate: string;
  venue: string;
}

export default function Checkout({ eventId, ticketTypeId, eventName, eventDate, venue }: Props) {
  const [step, setStep] = useState<1 | 2>(1);
  const [quantity, setQuantity] = useState(2);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [loadingQuote, setLoadingQuote] = useState(true);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const fetchQuote = useCallback(async () => {
    setLoadingQuote(true);
    try {
      const res = await fetch(
        `${BACKEND}/api/checkout/quote?eventId=${eventId}&ticketTypeId=${ticketTypeId}&quantity=${quantity}`
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not load pricing');
      setQuote(data);
      setError('');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoadingQuote(false);
    }
  }, [eventId, ticketTypeId, quantity]);

  useEffect(() => { fetchQuote(); }, [fetchQuote]);

  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const canContinue = quote && quote.remaining >= quantity && !loadingQuote;
  const canPay = name.trim().length >= 2 && emailValid && !submitting;

  const goToPayment = async () => {
    setSubmitting(true);
    setError('');
    try {
      const res = await fetch(`${BACKEND}/api/checkout/session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventId, ticketTypeId, quantity,
          buyerName: name.trim(), buyerEmail: email.trim(), buyerPhone: phone.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not start checkout');
      window.location.href = data.url;
    } catch (err: any) {
      setError(err.message);
      setSubmitting(false);
    }
  };

  const money = (n: number) => `$${n.toFixed(2)}`;

  return (
    <div style={S.page}>
      <div style={S.shell}>

        <p style={S.brand}>GOZA ENTERTAINMENT</p>
        <h1 style={S.title}>{eventName}</h1>
        <p style={S.meta}>{eventDate}</p>
        <p style={S.meta}>{venue}</p>

        {/* progress */}
        <div style={S.steps}>
          <div style={{ ...S.stepDot, ...(step >= 1 ? S.stepOn : {}) }}>1</div>
          <div style={{ ...S.stepLine, ...(step >= 2 ? S.lineOn : {}) }} />
          <div style={{ ...S.stepDot, ...(step >= 2 ? S.stepOn : {}) }}>2</div>
        </div>
        <p style={S.stepLabel}>
          {step === 1 ? 'How many tickets?' : 'Where do we send them?'}
        </p>

        {/* ---------- STEP 1 ---------- */}
        {step === 1 && (
          <div style={S.card}>
            <div style={S.qtyRow}>
              <button
                onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                disabled={quantity <= 1}
                aria-label="Fewer tickets"
                style={{ ...S.qtyBtn, opacity: quantity <= 1 ? 0.35 : 1 }}
              >−</button>

              <div style={S.qtyDisplay}>
                <span style={S.qtyNum}>{quantity}</span>
                <span style={S.qtyWord}>ticket{quantity > 1 ? 's' : ''}</span>
              </div>

              <button
                onClick={() => setQuantity((q) => Math.min(10, q + 1))}
                disabled={quantity >= 10 || (quote ? quantity >= quote.remaining : false)}
                aria-label="More tickets"
                style={{ ...S.qtyBtn, opacity: quantity >= 10 ? 0.35 : 1 }}
              >+</button>
            </div>

            {quote && quote.remaining <= 20 && quote.remaining > 0 && (
              <p style={S.lowStock}>Only {quote.remaining} left</p>
            )}

            {quote && !loadingQuote && (
              <div style={S.breakdown}>
                <Row label={`${quote.ticketTypeName} × ${quantity}`} value={money(quote.faceValue)} />
                {quote.buyerPaysFees && quote.serviceFee > 0 && (
                  <Row label="Service fee" value={money(quote.serviceFee)} dim />
                )}
                {quote.tax > 0 && <Row label="Tax" value={money(quote.tax)} dim />}
                {quote.buyerPaysProcessing && quote.processingFee > 0 && (
                  <Row label="Card processing" value={money(quote.processingFee)} dim />
                )}
                <div style={S.divider} />
                <Row label="Total" value={money(quote.total)} big />
              </div>
            )}

            {loadingQuote && <p style={S.dim}>Loading pricing…</p>}
            {error && <p style={S.error}>{error}</p>}

            <button
              onClick={() => setStep(2)}
              disabled={!canContinue}
              style={{ ...S.cta, opacity: canContinue ? 1 : 0.4, cursor: canContinue ? 'pointer' : 'not-allowed' }}
            >
              {quote && quote.remaining <= 0 ? 'Sold out' : 'Continue'}
            </button>
          </div>
        )}

        {/* ---------- STEP 2 ---------- */}
        {step === 2 && quote && (
          <div style={S.card}>
            <Field label="Full name" value={name} onChange={setName} placeholder="Maria Rodriguez" autoFocus />
            <Field
              label="Email" type="email" value={email} onChange={setEmail}
              placeholder="you@email.com"
              hint="Your QR codes go here — one per ticket"
              invalid={email.length > 4 && !emailValid}
            />
            <Field
              label="Phone (optional)" type="tel" value={phone} onChange={setPhone}
              placeholder="(314) 555-0123" hint="Text reminder before doors"
            />

            <div style={S.summaryBox}>
              <Row label={`${quote.ticketTypeName} × ${quantity}`} value={money(quote.total)} />
            </div>

            {error && <p style={S.error}>{error}</p>}

            <button
              onClick={goToPayment}
              disabled={!canPay}
              style={{ ...S.cta, opacity: canPay ? 1 : 0.4, cursor: canPay ? 'pointer' : 'not-allowed' }}
            >
              {submitting ? 'Opening secure checkout…' : `Pay ${money(quote.total)}`}
            </button>

            <button onClick={() => setStep(1)} style={S.back} disabled={submitting}>
              Back
            </button>

            <p style={S.secure}>Payment handled by Stripe. We never see your card.</p>
          </div>
        )}

      </div>
    </div>
  );
}

function Row({ label, value, dim, big }: { label: string; value: string; dim?: boolean; big?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '7px 0' }}>
      <span style={{ color: dim ? '#9aa0ab' : '#fff', fontSize: big ? 17 : 14, fontWeight: big ? 700 : 400 }}>{label}</span>
      <span style={{ color: dim ? '#9aa0ab' : '#fff', fontSize: big ? 22 : 14, fontWeight: big ? 800 : 500 }}>{value}</span>
    </div>
  );
}

function Field({ label, value, onChange, placeholder, hint, type = 'text', autoFocus, invalid }: any) {
  return (
    <div style={{ marginBottom: 18 }}>
      <label style={S.label}>{label}</label>
      <input
        type={type} value={value} placeholder={placeholder} autoFocus={autoFocus}
        onChange={(e) => onChange(e.target.value)}
        style={{ ...S.input, borderColor: invalid ? '#ff2222' : 'rgba(255,255,255,0.14)' }}
      />
      {hint && <p style={S.hint}>{hint}</p>}
    </div>
  );
}

const S: Record<string, React.CSSProperties> = {
  page: { minHeight: '100vh', background: '#050309', padding: '40px 16px', fontFamily: 'Helvetica,Arial,sans-serif' },
  shell: { maxWidth: 460, margin: '0 auto' },
  brand: { color: '#fff', fontSize: 12, fontWeight: 700, letterSpacing: 2, margin: '0 0 14px', textAlign: 'center' },
  title: { color: '#fff', fontSize: 30, fontWeight: 800, lineHeight: 1.15, margin: '0 0 10px', textAlign: 'center' },
  meta: { color: '#c9ccd4', fontSize: 14, margin: '0 0 4px', textAlign: 'center' },
  steps: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, margin: '30px 0 10px' },
  stepDot: { width: 30, height: 30, borderRadius: '50%', background: '#1c1721', color: '#7a808c', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700 },
  stepOn: { background: '#ff2222', color: '#fff' },
  stepLine: { width: 50, height: 2, background: '#1c1721' },
  lineOn: { background: '#ff2222' },
  stepLabel: { color: '#c9ccd4', fontSize: 13, textAlign: 'center', margin: '0 0 22px' },
  card: { background: '#100c16', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, padding: 24 },
  qtyRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  qtyBtn: { width: 52, height: 52, borderRadius: 10, background: '#1c1721', color: '#fff', border: 'none', fontSize: 26, cursor: 'pointer' },
  qtyDisplay: { textAlign: 'center' },
  qtyNum: { color: '#fff', fontSize: 40, fontWeight: 800, display: 'block', lineHeight: 1 },
  qtyWord: { color: '#9aa0ab', fontSize: 13 },
  lowStock: { color: '#ff2222', fontSize: 13, fontWeight: 700, textAlign: 'center', margin: '0 0 14px' },
  breakdown: { borderTop: '1px solid rgba(255,255,255,0.07)', paddingTop: 14, marginBottom: 20 },
  divider: { height: 1, background: 'rgba(255,255,255,0.07)', margin: '8px 0' },
  cta: { width: '100%', height: 54, background: '#ff2222', color: '#fff', border: 'none', borderRadius: 10, fontSize: 16, fontWeight: 800 },
  back: { width: '100%', height: 44, background: 'transparent', color: '#9aa0ab', border: 'none', fontSize: 14, marginTop: 8, cursor: 'pointer' },
  label: { display: 'block', color: '#fff', fontSize: 13, fontWeight: 700, marginBottom: 7 },
  input: { width: '100%', height: 50, background: '#050309', color: '#fff', border: '1px solid rgba(255,255,255,0.14)', borderRadius: 9, padding: '0 14px', fontSize: 16, outline: 'none', boxSizing: 'border-box' },
  hint: { color: '#7a808c', fontSize: 12, margin: '6px 0 0' },
  summaryBox: { background: '#050309', borderRadius: 10, padding: '12px 14px', margin: '4px 0 18px' },
  error: { color: '#ff2222', fontSize: 13, margin: '0 0 14px' },
  dim: { color: '#9aa0ab', fontSize: 14, textAlign: 'center', padding: '18px 0' },
  secure: { color: '#7a808c', fontSize: 11, textAlign: 'center', margin: '14px 0 0' },
};
