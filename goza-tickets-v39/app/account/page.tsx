'use client';

/*
  ACCOUNT / BUYER PORTAL
  Three states:
   1. token in URL (?token=...) -> verify it, store a session, show tickets
   2. saved session in localStorage -> show tickets straight away
   3. neither -> ask for phone/email -> email a magic link ("see my tickets")
  Verification is by EMAIL (link), so there's no SMS/Twilio Verify cost. A buyer
  only ever sees their OWN tickets (scoped server-side by their account).
*/

import { useState, useEffect, useRef, useCallback } from 'react';
import { BACKEND, fmtDate, money } from '@/lib/api';

const ROSE = '#c25b6e';
const F = 'Helvetica Neue,Helvetica,Arial,sans-serif';
/* Fullscreen ticket viewer: one BIG QR per screen, swipe sideways for the next
   ticket. Built for the door — max brightness area, huge code, zero clutter. */
function TicketViewer({ order, onClose }: { order: any; onClose: () => void }) {
  const [idx, setIdx] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const n = order.tickets.length;
  const onScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    setIdx(Math.round(el.scrollLeft / el.clientWidth));
  };
  useEffect(() => {
    // lock background scroll while open
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 100, background: '#000', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 18px', paddingTop: 'calc(16px + env(safe-area-inset-top))' }}>
        <div>
          <p style={{ color: '#fff', fontSize: 16, fontWeight: 800, margin: 0 }}>{order.event.name}</p>
          <p style={{ color: '#8a8f98', fontSize: 12.5, margin: '2px 0 0' }}>Ticket {idx + 1} of {n}</p>
        </div>
        <button onClick={onClose} aria-label="Close"
          style={{ background: 'rgba(255,255,255,0.12)', border: 'none', color: '#fff', width: 38, height: 38, borderRadius: '50%', fontSize: 17, cursor: 'pointer' }}>✕</button>
      </div>

      <div ref={scrollRef} onScroll={onScroll}
        style={{ flex: 1, display: 'flex', overflowX: 'auto', scrollSnapType: 'x mandatory', WebkitOverflowScrolling: 'touch' }}>
        {order.tickets.map((t: any, i: number) => (
          <div key={t.id} style={{ minWidth: '100%', scrollSnapAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '0 24px' }}>
            <div style={{ background: '#fff', borderRadius: 22, padding: 22, boxShadow: '0 0 60px rgba(255,255,255,0.12)' }}>
              <img src={`data:image/gif;base64,${t.qrGif}`} alt={`Ticket ${i + 1}`}
                style={{ width: 'min(78vw, 340px)', height: 'min(78vw, 340px)', display: 'block', imageRendering: 'pixelated' }} />
            </div>
            <p style={{ color: '#fff', fontSize: 16, fontWeight: 800, margin: '18px 0 2px' }}>{t.typeName}</p>
            {t.checkedIn
              ? <p style={{ color: ROSE, fontSize: 13, fontWeight: 800, margin: 0 }}>✓ ALREADY CHECKED IN</p>
              : <p style={{ color: '#8a8f98', fontSize: 13, margin: 0 }}>Show this at the door</p>}
          </div>
        ))}
      </div>

      <div style={{ padding: '14px 0', paddingBottom: 'calc(18px + env(safe-area-inset-bottom))', textAlign: 'center' }}>
        {n > 1 && (
          <>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 7, marginBottom: 8 }}>
              {order.tickets.map((_: any, i: number) => (
                <span key={i} style={{ width: 7, height: 7, borderRadius: '50%', background: i === idx ? ROSE : 'rgba(255,255,255,0.25)', transition: 'background 0.2s' }} />
              ))}
            </div>
            <p style={{ color: '#8a8f98', fontSize: 12.5, margin: 0 }}>Swipe for the next ticket →</p>
          </>
        )}
      </div>
    </div>
  );
}

const SESSION_KEY = 'gz_portal_session';

/* Profile pic: tap the circle -> pick a photo -> auto-cropped square, compressed
   to 256px JPEG in the browser (a few KB), uploaded. Shows in the "X are in!"
   avatar stack and the recently-bought popups on event pages. */
function AvatarUpload({ current, name, onSaved }: { current: string | null; name: string; onSaved: (url: string) => void }) {
  const [busy, setBusy] = useState(false);
  const pick = () => {
    const input = document.createElement('input');
    input.type = 'file'; input.accept = 'image/*';
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return;
      setBusy(true);
      const img = new Image();
      const objUrl = URL.createObjectURL(file);
      img.src = objUrl;
      img.onload = async () => {
        URL.revokeObjectURL(objUrl);
        try {
          const S = 256;
          const canvas = document.createElement('canvas');
          canvas.width = S; canvas.height = S;
          const ctx = canvas.getContext('2d')!;
          const side = Math.min(img.naturalWidth, img.naturalHeight);
          const sx = (img.naturalWidth - side) / 2;
          const sy = (img.naturalHeight - side) / 2;
          ctx.drawImage(img, sx, sy, side, side, 0, 0, S, S);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
          const session = localStorage.getItem(SESSION_KEY) || '';
          const r = await fetch(`${BACKEND}/account`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'set_avatar', session, fileBase64: dataUrl.split(',')[1] }),
          }).then((x) => x.json());
          if (r.ok && r.avatarUrl) onSaved(r.avatarUrl);
        } catch { /* silent */ }
        finally { setBusy(false); }
      };
      img.onerror = () => setBusy(false);
    };
    input.click();
  };
  return (
    <button onClick={pick} disabled={busy} aria-label="Change profile photo"
      style={{ position: 'relative', width: 54, height: 54, borderRadius: '50%', border: 'none', padding: 0, cursor: 'pointer', background: '#1a1a20', flexShrink: 0 }}>
      {current
        ? <img src={current} alt="" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover', display: 'block', opacity: busy ? 0.5 : 1 }} />
        : <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%', borderRadius: '50%', background: ROSE, color: '#fff', fontSize: 22, fontWeight: 800 }}>{(name || '?').charAt(0).toUpperCase()}</span>}
      <span style={{ position: 'absolute', bottom: -2, right: -2, width: 22, height: 22, borderRadius: '50%', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, border: '2px solid #000' }}>
        {busy ? '…' : '📷'}
      </span>
    </button>
  );
}

export default function Account() {
  const [phase, setPhase] = useState<'loading' | 'signin' | 'sent' | 'portal'>('loading');
  const [data, setData] = useState<any>(null);
  const [viewer, setViewer] = useState<any>(null);
  const [contact, setContact] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const loadSession = useCallback(async (session: string) => {
    try {
      const r = await fetch(`${BACKEND}/account?session=${encodeURIComponent(session)}`).then((x) => x.json());
      if (r.ok) { setData(r); setPhase('portal'); return true; }
    } catch { /* fall through */ }
    return false;
  }, []);

  useEffect(() => {
    (async () => {
      const url = new URL(window.location.href);
      const token = url.searchParams.get('token');
      if (token) {
        // verify the magic link
        try {
          const r = await fetch(`${BACKEND}/account`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'verify', token }),
          }).then((x) => x.json());
          if (r.ok && r.session) {
            localStorage.setItem(SESSION_KEY, r.session);
            window.history.replaceState({}, '', '/account');
            if (await loadSession(r.session)) return;
          } else { setErr(r.error || 'This link has expired. Request a new one.'); }
        } catch { setErr('Something went wrong verifying your link.'); }
        setPhase('signin'); return;
      }
      const saved = localStorage.getItem(SESSION_KEY);
      if (saved && (await loadSession(saved))) return;
      setPhase('signin');
    })();
  }, [loadSession]);

  const sendLink = async () => {
    const c = contact.trim();
    if (!c) { setErr('Enter your phone or email'); return; }
    setBusy(true); setErr('');
    const isEmail = c.includes('@');
    try {
      await fetch(`${BACKEND}/account`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'send_link', [isEmail ? 'email' : 'phone']: c }),
      });
      setPhase('sent');
    } catch { setErr('Something went wrong. Try again.'); }
    finally { setBusy(false); }
  };

  const signOut = () => { localStorage.removeItem(SESSION_KEY); setData(null); setPhase('signin'); };

  return (
    <div style={{ minHeight: '100vh', background: '#000', fontFamily: F, color: '#fff' }}>
      <div style={{ maxWidth: 560, margin: '0 auto', padding: '28px 18px 60px' }}>
        <p style={{ color: '#fff', fontSize: 13, letterSpacing: 3, fontWeight: 700, margin: '0 0 26px' }}>GOZA ENTERTAINMENT</p>

        {phase === 'loading' && <p style={{ color: '#8a8f98', fontSize: 15 }}>Loading…</p>}

        {phase === 'signin' && (
          <div>
            <h1 style={{ fontSize: 32, fontWeight: 800, margin: '0 0 8px' }}>Your tickets</h1>
            <p style={{ color: '#a8adb8', fontSize: 15, lineHeight: 1.5, margin: '0 0 24px' }}>
              Enter the phone or email you used at checkout. We&apos;ll send a secure link to your email to open your account.
            </p>
            <input
              value={contact} onChange={(e) => setContact(e.target.value)} placeholder="Phone or email"
              onKeyDown={(e) => { if (e.key === 'Enter') sendLink(); }}
              style={{ width: '100%', boxSizing: 'border-box', background: '#0e0e12', border: `1px solid ${err ? '#ff6b6b' : 'rgba(255,255,255,0.15)'}`, borderRadius: 12, padding: '15px 16px', color: '#fff', fontSize: 16, marginBottom: 12, outline: 'none' }}
            />
            {err && <p style={{ color: '#ff8585', fontSize: 13.5, margin: '0 0 12px' }}>{err}</p>}
            <button onClick={sendLink} disabled={busy}
              style={{ width: '100%', background: ROSE, color: '#fff', border: 'none', borderRadius: 12, padding: '15px 0', fontSize: 16, fontWeight: 800, cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.6 : 1 }}>
              {busy ? 'Sending…' : 'Email me my sign-in link'}
            </button>
          </div>
        )}

        {phase === 'sent' && (
          <div style={{ background: 'rgba(194,91,110,0.1)', border: `1px solid ${ROSE}`, borderRadius: 16, padding: 26, textAlign: 'center' }}>
            <div style={{ fontSize: 40, marginBottom: 10 }}>📧</div>
            <p style={{ fontSize: 20, fontWeight: 800, margin: '0 0 6px' }}>Check your email</p>
            <p style={{ color: '#c9ccd4', fontSize: 14.5, margin: 0, lineHeight: 1.5 }}>
              If an account exists, a sign-in link is on its way. Tap it to see your tickets. The link expires in 30 minutes.
            </p>
          </div>
        )}

        {phase === 'portal' && data && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <AvatarUpload
                  current={data.customer.avatarUrl || null}
                  name={data.customer.name || ''}
                  onSaved={(url: string) => setData((p: any) => ({ ...p, customer: { ...p.customer, avatarUrl: url } }))}
                />
                <h1 style={{ fontSize: 28, fontWeight: 800, margin: 0 }}>Hey {(data.customer.name || 'there').split(' ')[0]}</h1>
              </div>
              <button onClick={signOut} style={{ background: 'transparent', border: 'none', color: '#8a8f98', fontSize: 13, cursor: 'pointer', textDecoration: 'underline' }}>Sign out</button>
            </div>
            <p style={{ color: '#a8adb8', fontSize: 14, margin: '0 0 26px' }}>{data.orders.length} order{data.orders.length === 1 ? '' : 's'} on your account</p>

            {data.orders.length === 0 && (
              <p style={{ color: '#8a8f98', fontSize: 15 }}>No tickets yet. When you buy, they&apos;ll show up here.</p>
            )}

            {data.orders.map((o: any) => (
              <div key={o.orderId} style={{ background: '#0c0c10', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 18, padding: 20, marginBottom: 18, opacity: o.isPast ? 0.6 : 1 }}>
                <div style={{ display: 'flex', gap: 14, marginBottom: 16 }}>
                  {o.event.imageUrl && <img loading="lazy" decoding="async" src={o.event.imageUrl} alt="" style={{ width: 64, height: 64, borderRadius: 12, objectFit: 'cover' }} />}
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: 17, fontWeight: 800, margin: '0 0 3px' }}>{o.event.name}{o.isPast ? ' (past)' : ''}</p>
                    <p style={{ color: '#b9bec8', fontSize: 13.5, margin: '0 0 2px' }}>{fmtDate(o.event.date)}</p>
                    <p style={{ color: '#8a8f98', fontSize: 13, margin: 0 }}>{o.event.location}</p>
                  </div>
                </div>

                {o.tickets.length > 0 && (
                  <button onClick={() => setViewer(o)}
                    style={{ width: '100%', background: '#fff', border: 'none', borderRadius: 12, padding: 14, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 14, cursor: 'pointer', textAlign: 'left' }}>
                    <img src={`data:image/gif;base64,${o.tickets[0].qrGif}`} alt="QR" style={{ width: 74, height: 74, display: 'block', flexShrink: 0 }} />
                    <span style={{ flex: 1 }}>
                      <span style={{ display: 'block', color: '#111', fontSize: 14.5, fontWeight: 800, marginBottom: 2 }}>
                        {o.tickets.length > 1 ? `${o.tickets.length} tickets` : o.tickets[0].typeName}
                      </span>
                      <span style={{ display: 'block', color: '#666', fontSize: 12.5 }}>Tap to show at the door</span>
                    </span>
                    <span style={{ color: ROSE, fontSize: 13, fontWeight: 800, flexShrink: 0 }}>OPEN →</span>
                  </button>
                )}

                <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
                  {!o.isPast && o.event.shortCode && (
                    <button onClick={() => { window.location.href = `/e?id=${o.event.id}`; }}
                      style={{ flex: 1, background: ROSE, color: '#fff', border: 'none', borderRadius: 10, padding: '11px 0', fontSize: 13.5, fontWeight: 700, cursor: 'pointer' }}>
                      Buy more
                    </button>
                  )}
                  <button onClick={() => {
                    const shareUrl = `${window.location.origin}/e?id=${o.event.id}`;
                    if (navigator.share) navigator.share({ title: o.event.name, url: shareUrl }).catch(() => {});
                    else { navigator.clipboard?.writeText(shareUrl); }
                  }}
                    style={{ flex: 1, background: 'transparent', color: '#fff', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 10, padding: '11px 0', fontSize: 13.5, fontWeight: 700, cursor: 'pointer' }}>
                    Share
                  </button>
                </div>
                <p style={{ color: '#5a5f68', fontSize: 11.5, margin: '12px 0 0' }}>Order #{o.shortId} · {money(o.total)}</p>
              </div>
            ))}
            {viewer && <TicketViewer order={viewer} onClose={() => setViewer(null)} />}
          </div>
        )}
      </div>
    </div>
  );
}
