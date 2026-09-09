'use client';

/*
  THANKS / RECEIPT — polls the order by Stripe session id (webhook can lag a
  few seconds after payment, so the page starts as "preparing" and flips to
  the full receipt automatically). Compact card: flyer, event, when, where,
  order summary, and live delivery status.
*/

import { useState, useEffect } from 'react';
import { api, money, fmtDate } from '@/lib/api';
import { trackPurchase, identifyUser, trackPageView } from '@/lib/track';

const ROSE = '#c25b6e';
const F = 'Helvetica Neue,Helvetica,Arial,sans-serif';

export default function Thanks() {
  const [r, setR] = useState<any>(null);
  const [tries, setTries] = useState(0);

  useEffect(() => {
    trackPageView();
    const params = new URLSearchParams(window.location.search);
    // hosted checkout returns ?session_id=; Payment Element returns ?payment_intent=
    const sid = params.get('session_id') || params.get('payment_intent');
    if (!sid) { setTries(-1); return; }
    let stop = false;
    const poll = async (n: number) => {
      if (stop || n > 20) { setTries(n); return; }
      try {
        const d = await api(`/checkout?receipt=1&session=${encodeURIComponent(sid)}`);
        if (d.found) {
          if (!stop) {
            setR(d);
            identifyUser(d.order.email, d.order.phone);
            trackPurchase(d.order.shortId, d.event?.id || '', Number(d.order.total || 0), d.order.tickets, d.event?.name || '');
          }
          return;
        }
      } catch { /* keep polling */ }
      setTries(n);
      setTimeout(() => poll(n + 1), 2000);
    };
    poll(0);
    return () => { stop = true; };
  }, []);

  const ev = r?.event;
  const o = r?.order;

  return (
    <div style={{ minHeight: '100vh', background: 'radial-gradient(120% 100% at 50% 0%, #2a1018 0%, #0c0508 55%, #000 100%)', fontFamily: F, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '32px 18px' }}>
      <div style={{ width: '100%', maxWidth: 430 }}>

        {/* header */}
        <div style={{ textAlign: 'center', marginBottom: 22 }}>
          <div style={{ width: 58, height: 58, borderRadius: '50%', background: `${ROSE}22`, border: `1.5px solid ${ROSE}`, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px', fontSize: 26 }}>🎟️</div>
          <h1 style={{ color: '#fff', fontSize: 28, fontWeight: 800, margin: '0 0 6px', letterSpacing: -0.3 }}>You&apos;re in.</h1>
          <p style={{ color: '#b9bec8', fontSize: 14.5, margin: 0, lineHeight: 1.5 }}>
            Payment received. Your QR ticket{o && o.tickets > 1 ? 's' : ''} &amp; receipt are on the way.
          </p>
        </div>

        {/* receipt card */}
        <div style={{ background: 'rgba(14,14,18,0.85)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 18, overflow: 'hidden', boxShadow: '0 18px 50px rgba(0,0,0,0.5)' }}>

          {!r ? (
            <div style={{ padding: '36px 22px', textAlign: 'center' }}>
              {tries === -1 ? (
                <p style={{ color: '#b9bec8', fontSize: 14, margin: 0, lineHeight: 1.6 }}>Payment received.<br />Check your email and texts for your QR code.</p>
              ) : tries > 20 ? (
                <p style={{ color: '#b9bec8', fontSize: 14, margin: 0, lineHeight: 1.6 }}>Your order is processing — your QR code will land in your email within a few minutes.</p>
              ) : (
                <>
                  <div style={{ width: 26, height: 26, border: `2.5px solid ${ROSE}44`, borderTopColor: ROSE, borderRadius: '50%', margin: '0 auto 14px', animation: 'gzspin 0.8s linear infinite' }} />
                  <style>{`@keyframes gzspin { to { transform: rotate(360deg) } }`}</style>
                  <p style={{ color: '#8a8f98', fontSize: 13.5, margin: 0 }}>Preparing your receipt…</p>
                </>
              )}
            </div>
          ) : (
            <>
              {/* event block with flyer */}
              <div style={{ display: 'flex', gap: 14, padding: 16, borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                {ev?.imageUrl && (
                  <img src={ev.imageUrl} alt="" style={{ width: 74, height: 92, objectFit: 'cover', borderRadius: 10, flexShrink: 0 }} />
                )}
                <div style={{ minWidth: 0 }}>
                  <p style={{ color: '#fff', fontSize: 16.5, fontWeight: 800, margin: '2px 0 6px', lineHeight: 1.25 }}>{ev?.name}</p>
                  <p style={{ color: '#d6d9df', fontSize: 13.5, margin: '0 0 3px' }}>{fmtDate(ev?.date)}</p>
                  <a href={`https://maps.google.com/?q=${encodeURIComponent(ev?.location || '')}`} target="_blank" rel="noreferrer"
                    style={{ color: ROSE, fontSize: 13.5, textDecoration: 'none', fontWeight: 600 }}>
                    {ev?.location} ↗
                  </a>
                </div>
              </div>

              {/* order block */}
              <div style={{ padding: '14px 16px', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                <RowX l={`${o.tickets} ticket${o.tickets > 1 ? 's' : ''}`} v={money(o.total)} strong />
                <RowX l="Order" v={`#${o.shortId}`} />
                <RowX l="Name" v={o.buyer} />
              </div>

              {/* delivery block */}
              <div style={{ padding: '14px 16px' }}>
                <p style={{ color: '#8a8f98', fontSize: 11.5, letterSpacing: 1.5, margin: '0 0 10px' }}>DELIVERY</p>
                <Delivery ok={o.emailSent} label="Email" to={o.email} note="QR codes + receipt" />
                <Delivery ok={o.smsSent} label="Text" to={o.phone} note="confirmation" />
                <p style={{ color: '#6f747d', fontSize: 12, margin: '12px 0 0', lineHeight: 1.55 }}>
                  Nothing yet? Give it a minute and check spam. Screenshot your QR code — no signal at the door, no problem.
                </p>
              </div>
            </>
          )}
        </div>

        <p style={{ textAlign: 'center', margin: '20px 0 0' }}>
          <a href="/account" style={{ color: ROSE, fontSize: 14, fontWeight: 700, textDecoration: 'none' }}>View all my tickets →</a>
        </p>
        <p style={{ textAlign: 'center', margin: '12px 0 0' }}>
          <a href="/" style={{ color: '#8a8f98', fontSize: 13.5, textDecoration: 'none' }}>← Back to event</a>
        </p>
      </div>
    </div>
  );
}

function RowX({ l, v, strong }: { l: string; v: string; strong?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', alignItems: 'baseline' }}>
      <span style={{ color: '#8a8f98', fontSize: 13.5 }}>{l}</span>
      <span style={{ color: '#fff', fontSize: strong ? 17 : 13.5, fontWeight: strong ? 800 : 600 }}>{v}</span>
    </div>
  );
}

function Delivery({ ok, label, to, note }: { ok: boolean; label: string; to: string; note: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '5px 0' }}>
      <span style={{ width: 20, height: 20, borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, background: ok ? 'rgba(61,220,132,0.15)' : 'rgba(255,255,255,0.08)', color: ok ? '#3ddc84' : '#8a8f98', border: `1px solid ${ok ? 'rgba(61,220,132,0.4)' : 'rgba(255,255,255,0.1)'}` }}>
        {ok ? '✓' : '…'}
      </span>
      <p style={{ color: '#d6d9df', fontSize: 13.5, margin: 0, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        <strong style={{ color: '#fff' }}>{label}</strong> · {note} → {to}
      </p>
    </div>
  );
}
