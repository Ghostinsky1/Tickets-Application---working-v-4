'use client';

/*
  /offer — one-click post-purchase upsell/downsell (OTO funnel).
  Arrives here right after payment with ?session_id=cs_... (hosted checkout) or
  ?payment_intent=pi_... (embedded card). Shows ONE offer at a time: big YES
  (charges the saved card instantly, no re-entry) or "No thanks".
  Yes on the upsell skips the downsell. When done -> /thanks with the receipt.
*/

import { useState, useEffect, useRef } from 'react';
import { BACKEND, money } from '@/lib/api';

const ROSE = '#c25b6e';
const F = 'Helvetica Neue,Helvetica,Arial,sans-serif';

export default function Offer() {
  const [key, setKey] = useState('');
  const [offer, setOffer] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [accepted, setAccepted] = useState<any>(null);
  const tries = useRef(0);

  const goThanks = (k: string) => {
    const qp = k.startsWith('cs_') ? `session_id=${encodeURIComponent(k)}` : `payment_intent=${encodeURIComponent(k)}`;
    window.location.replace(`/thanks?${qp}`);
  };

  // resolve the key from the URL, then load the current offer (poll briefly —
  // the webhook can lag a few seconds behind the payment)
  useEffect(() => {
    const u = new URL(window.location.href);
    const k = u.searchParams.get('session_id') || u.searchParams.get('payment_intent') || u.searchParams.get('key') || '';
    if (!k) { window.location.replace('/'); return; }
    setKey(k);

    let stop = false;
    const load = async () => {
      if (stop) return;
      try {
        const r = await fetch(`${BACKEND}/oto?key=${encodeURIComponent(k)}`).then((x) => x.json());
        if (stop) return;
        if (r.retry && tries.current < 8) { tries.current += 1; setTimeout(load, 1500); return; }
        if (!r.found || r.stage === 'done') { goThanks(k); return; }
        setOffer(r);
      } catch { if (tries.current < 8) { tries.current += 1; setTimeout(load, 1500); } else goThanks(k); }
    };
    load();
    return () => { stop = true; };
  }, []);

  const answer = async (decision: 'yes' | 'no') => {
    if (busy) return;
    setBusy(true); setErr('');
    try {
      const r = await fetch(`${BACKEND}/oto`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, decision }),
      }).then((x) => x.json());
      if (r.error && r.stage !== 'done') { setErr(r.error); setBusy(false); return; }
      if (r.accepted) {
        setAccepted(r.accepted);
        setTimeout(() => goThanks(key), 1800);
        return;
      }
      if (r.stage === 'done') { goThanks(key); return; }
      setOffer(r); setBusy(false);          // moved to the downsell
    } catch { setErr('Something went wrong.'); setBusy(false); }
  };

  return (
    <div style={{ minHeight: '100vh', background: '#000', fontFamily: F, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ maxWidth: 440, width: '100%', padding: '28px 20px' }}>
        {accepted ? (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 52, marginBottom: 12 }}>🎉</div>
            <p style={{ fontSize: 24, fontWeight: 800, margin: '0 0 6px' }}>Added!</p>
            <p style={{ color: '#a8adb8', fontSize: 15, margin: 0 }}>{accepted.name} is on your order. Taking you to your receipt…</p>
          </div>
        ) : !offer ? (
          <div style={{ textAlign: 'center' }}>
            <p style={{ color: '#8a8f98', fontSize: 15, margin: '0 0 6px' }}>Payment confirmed ✓</p>
            <p style={{ color: '#5a5f68', fontSize: 13.5, margin: 0 }}>One sec…</p>
          </div>
        ) : (
          <div>
            <p style={{ color: ROSE, fontSize: 12, letterSpacing: 3, fontWeight: 800, textTransform: 'uppercase', margin: '0 0 10px', textAlign: 'center' }}>
              {offer.stage === 'upsell' ? '🔥 Wait — one-time offer' : '👀 Okay, last chance'}
            </p>
            <h1 style={{ fontSize: 28, fontWeight: 800, lineHeight: 1.15, margin: '0 0 8px', textAlign: 'center' }}>
              {offer.buyerFirstName}, {offer.stage === 'upsell' ? 'before you go…' : 'how about this instead?'}
            </h1>

            <div style={{ background: '#0c0c10', border: `1px solid ${ROSE}66`, borderRadius: 18, padding: 24, margin: '20px 0' }}>
              <p style={{ fontSize: 21, fontWeight: 800, margin: '0 0 6px' }}>{offer.product.name}</p>
              {offer.product.description && (
                <p style={{ color: '#a8adb8', fontSize: 14.5, lineHeight: 1.5, margin: '0 0 14px' }}>{offer.product.description}</p>
              )}
              <p style={{ fontSize: 32, fontWeight: 800, color: ROSE, margin: 0 }}>{money(offer.product.price)}</p>
              <p style={{ color: '#6f747d', fontSize: 12, margin: '6px 0 0' }}>No fees. This offer won&apos;t show again.</p>
            </div>

            {err && <p style={{ color: '#ff8585', fontSize: 13.5, textAlign: 'center', margin: '0 0 12px' }}>{err}</p>}

            <button onClick={() => answer('yes')} disabled={busy}
              style={{ width: '100%', background: ROSE, color: '#fff', border: 'none', borderRadius: 14, padding: '18px 0', fontSize: 17, fontWeight: 800, cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.6 : 1, marginBottom: 12 }}>
              {busy ? 'Processing…' : `YES — ADD IT (${money(offer.product.price)})`}
            </button>
            <button onClick={() => answer('no')} disabled={busy}
              style={{ width: '100%', background: 'transparent', color: '#8a8f98', border: 'none', padding: '10px 0', fontSize: 14, cursor: busy ? 'default' : 'pointer', textDecoration: 'underline' }}>
              No thanks, take me to my tickets
            </button>

            <p style={{ color: '#5a5f68', fontSize: 11.5, textAlign: 'center', margin: '16px 0 0', lineHeight: 1.5 }}>
              Tapping YES instantly charges your card{offer.cardLast4 ? ` ending in ${offer.cardLast4}` : ' on file'} — no re-entry needed.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
