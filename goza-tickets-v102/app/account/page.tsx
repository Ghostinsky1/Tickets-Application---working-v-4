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
import { sfxClick, sfxCoin, sfxTally, sfxConfirm, sfxTick } from '@/lib/sfx';
import { BACKEND, fmtDate, money } from '@/lib/api';
import CardCheckout from '@/components/CardCheckout';

const ROSE = '#1140F0';
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
          <p style={{ color: '#fff', fontFamily: "'Archivo Black',Impact,Haettenschweiler,sans-serif", fontSize: 16.5, margin: 0, textTransform: 'uppercase', lineHeight: 1.2 }}>{order.event.name}</p>
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
            <p style={{ color: '#fff', fontFamily: "'Chakra Petch','Trebuchet MS',sans-serif", fontWeight: 700, fontSize: 13, letterSpacing: 2, margin: '18px 0 2px', textTransform: 'uppercase' }}>{t.typeName}</p>
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

/* ---------- CREDIT BALANCE: counts up on arrival, glows like money landing ---------- */
function CreditBanner({ credits }: { credits: any }) {
  const target = (credits?.totalCents || 0) / 100;
  const [shown, setShown] = useState(0);
  const [landed, setLanded] = useState(false);
  const lastStep = useRef(-1);
  useEffect(() => {
    if (target <= 0) return;
    const DUR = 1400, t0 = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const p = Math.min(1, (now - t0) / DUR);
      const eased = 1 - Math.pow(1 - p, 3);
      setShown(target * eased);
      const step = Math.floor(p * 14);
      if (step !== lastStep.current) { lastStep.current = step; sfxTally(step); }
      if (p < 1) raf = requestAnimationFrame(tick);
      else { setLanded(true); sfxCoin(); }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target]);
  if (target <= 0) return null;
  const c = credits.credits?.[0];
  return (
    <div style={{
      position: 'relative', overflow: 'hidden',
      background: 'linear-gradient(160deg,#0B1B4F 0%,#0A0D16 70%)',
      border: `1px solid ${landed ? '#1140F0' : '#22304f'}`,
      borderRadius: 18, padding: '22px 20px', marginBottom: 22,
      boxShadow: landed ? '0 0 40px rgba(17,64,240,0.35), inset 0 1px 0 rgba(255,255,255,0.08)' : 'none',
      transition: 'box-shadow 600ms ease, border-color 600ms ease',
    }}>
      <div style={{ position: 'absolute', top: -70, right: -50, width: 190, height: 190, borderRadius: '50%',
        background: 'radial-gradient(circle,rgba(17,64,240,0.55) 0%,rgba(17,64,240,0) 70%)',
        opacity: landed ? 1 : 0, transition: 'opacity 900ms ease', pointerEvents: 'none' }} />
      <p style={{ margin: 0, fontFamily: "'Chakra Petch','Trebuchet MS',sans-serif", fontSize: 10.5, letterSpacing: 2.6, fontWeight: 700, color: '#8FB4FF', textTransform: 'uppercase' }}>
        Goza credits
      </p>
      <p style={{ margin: '8px 0 2px', fontFamily: "'Archivo Black',Impact,sans-serif", fontSize: 44, lineHeight: 1, color: '#fff',
        textShadow: landed ? '0 0 26px rgba(17,64,240,0.85)' : 'none', transition: 'text-shadow 600ms ease' }}>
        ${shown.toFixed(2)}
      </p>
      <p style={{ margin: '0 0 16px', color: '#9AA5B5', fontSize: 13.5 }}>
        Ready to spend at Plaza Garibaldi and El Palenque events - never expires
      </p>
      <a href="/" style={{ display: 'inline-block', background: '#1140F0', color: '#fff', textDecoration: 'none',
        fontFamily: "'Chakra Petch','Trebuchet MS',sans-serif", fontWeight: 700, fontSize: 13.5, letterSpacing: 1,
        textTransform: 'uppercase', padding: '13px 22px', borderRadius: 999, boxShadow: '0 8px 22px rgba(17,64,240,0.45)' }}>
        Use it on a ticket
      </a>
      {c?.code && (
        <p style={{ margin: '12px 0 0', color: '#6d7787', fontSize: 11.5, fontFamily: 'ui-monospace,Menlo,monospace' }}>{c.code}</p>
      )}
    </div>
  );
}


/* ---------- THE CHOICE: cancelled show, credit or cash ---------- */
function CreditChoice({ credit, session, onTakeCredit }: { credit: any; session: string; onTakeCredit: () => void }) {
  const [busy, setBusy] = useState('');
  const [done, setDone] = useState('');
  const take = async () => {
    setBusy('credit'); sfxCoin();
    try {
      const r = await fetch(`${BACKEND}/credits`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'claim_credit', session, code: credit.code }) }).then((x) => x.json());
      if (!r?.ok) { setErr(r?.error || 'Could not take that credit'); return; }
      setDone('credit');
      onTakeCredit();
    } catch { setErr('Could not reach us just now - try again'); }
    finally { setBusy(''); }
  };
  const [err, setErr] = useState('');
  const refund = async () => {
    if (!window.confirm('Ask for your money back instead? Your credit and the 20% bonus go away.')) return;
    setBusy('refund'); setErr(''); sfxConfirm();
    try {
      const r = await fetch(`${BACKEND}/credits`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'request_refund', session, code: credit.code }) }).then((x) => x.json());
      // only say it worked if it actually worked
      if (!r?.ok) { setErr(r?.error || 'Could not record that - try again'); return; }
      setDone('refund');
    } catch { setErr('Could not reach us just now - try again'); }
    finally { setBusy(''); }
  };

  if (done === 'refund') {
    return (
      <div style={{ background: '#0E1116', border: '1px solid #232936', borderRadius: 18, padding: 22, marginBottom: 22 }}>
        <p style={{ color: '#fff', fontFamily: "'Archivo Black',Impact,sans-serif", fontSize: 20, textTransform: 'uppercase', margin: '0 0 8px' }}>Refund on the way</p>
        <p style={{ color: '#9AA5B5', fontSize: 14.5, lineHeight: 1.55, margin: 0 }}>
          We&apos;ll send it back to the card you paid with. Give it 7&ndash;15 days to show up.
        </p>
      </div>
    );
  }
  if (done === 'credit') return null;   // the balance card takes over

  return (
    <div style={{ background: 'linear-gradient(160deg,#0B1B4F 0%,#0A0D16 70%)', border: '1px solid #22304f', borderRadius: 18, padding: '24px 20px', marginBottom: 22 }}>
      <p style={{ margin: 0, fontFamily: "'Chakra Petch','Trebuchet MS',sans-serif", fontSize: 10.5, letterSpacing: 2.6, fontWeight: 700, color: '#8FB4FF', textTransform: 'uppercase' }}>
        {credit.fromEvent || 'Your show'} was cancelled
      </p>
      <p style={{ margin: '10px 0 6px', fontFamily: "'Archivo Black',Impact,sans-serif", fontSize: 26, lineHeight: 1.05, color: '#fff', textTransform: 'uppercase' }}>
        Pick one.
      </p>
      <p style={{ margin: '0 0 20px', color: '#9AA5B5', fontSize: 14.5, lineHeight: 1.55 }}>
        Sorry about this one. Take the credit and we added 20% on top, or take your money back. No hard feelings either way.
      </p>

      <button onClick={take} onMouseEnter={sfxTick} disabled={!!busy}
        style={{ width: '100%', background: '#1140F0', color: '#fff', border: 'none', borderRadius: 14, padding: '18px 16px', cursor: 'pointer',
          boxShadow: '0 10px 30px rgba(17,64,240,0.45)', marginBottom: 10, textAlign: 'left' }}>
        <span style={{ display: 'block', fontFamily: "'Archivo Black',Impact,sans-serif", fontSize: 22, lineHeight: 1 }}>{credit.issued} CREDIT</span>
        <span style={{ display: 'block', fontFamily: "'Chakra Petch','Trebuchet MS',sans-serif", fontSize: 12.5, letterSpacing: 1, textTransform: 'uppercase', color: '#C9D6FF', marginTop: 6 }}>
          20% bonus included &middot; never expires
        </span>
      </button>

      {err && <p style={{ color: '#FF6B6B', fontSize: 13.5, margin: '0 0 10px' }}>{err}</p>}
      <button onClick={refund} onMouseEnter={sfxTick} disabled={!!busy}
        style={{ width: '100%', background: 'transparent', color: '#9AA5B5', border: '1px solid #2A3040', borderRadius: 14, padding: '15px 16px', cursor: 'pointer',
          fontFamily: "'Chakra Petch','Trebuchet MS',sans-serif", fontSize: 13.5, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase' }}>
        Just refund me
      </button>
    </div>
  );
}


/* ---------- RELOAD: buy credit, with the reason to ---------- */
function Reload({ session, balance, onDone }: { session: string; balance: string; onDone: () => void }) {
  const [tiers, setTiers] = useState<any[]>([]);
  const [busy, setBusy] = useState('');
  const [err, setErr] = useState('');
  const [open, setOpen] = useState(false);

  useEffect(() => {
    fetch(`${BACKEND}/wallet`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'tiers' }) })
      .then((r) => r.json()).then((d) => setTiers(d.tiers || [])).catch(() => {});
  }, []);

  // coming back from Stripe: ?topup=cs_...
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const sid = p.get('topup');
    const pi = p.get('topup_pi') || p.get('payment_intent');
    if ((!sid && !pi) || !session) return;
    fetch(`${BACKEND}/wallet`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'topup_confirm', session, ...(pi ? { paymentIntent: pi } : { stripeSession: sid }) }) })
      .then((r) => r.json())
      .then((d) => {
        if (d.ok) { sfxCoin(); onDone(); }
        window.history.replaceState({}, '', '/account');
      })
      .catch(() => {});
  }, [session, onDone]);

  const [pay, setPay] = useState<any>(null);   // the in-app card step

  const go = async (cents: number) => {
    setBusy(String(cents)); setErr('');
    try {
      const r = await fetch(`${BACKEND}/wallet`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'topup_intent', session, amountCents: cents }) }).then((x) => x.json());
      if (r.clientSecret) { setPay(r); return; }
      setErr(r.error || 'Could not start that');
    } catch { setErr('Could not reach us just now'); }
    finally { setBusy(''); }
  };

  if (!open) {
    return (
      <button onClick={() => { setOpen(true); sfxClick(); }}
        style={{ display: 'block', width: '100%', background: 'linear-gradient(160deg,#0B1B4F 0%,#0A0D16 70%)', border: '1px solid #22304f', borderRadius: 16, padding: '16px 18px', marginBottom: 22, cursor: 'pointer', textAlign: 'left' }}>
        <span style={{ display: 'block', fontFamily: "'Chakra Petch','Trebuchet MS',sans-serif", fontSize: 10.5, letterSpacing: 2.4, fontWeight: 700, color: '#8FB4FF', textTransform: 'uppercase', marginBottom: 5 }}>Add credits</span>
        <span style={{ display: 'block', color: '#fff', fontSize: 15, lineHeight: 1.45 }}>
          Load your balance and skip the line at the bar &mdash; Plaza Garibaldi and El Palenque nights.
        </span>
      </button>
    );
  }

  return (
    <div style={{ background: 'linear-gradient(160deg,#0B1B4F 0%,#0A0D16 70%)', border: '1px solid #22304f', borderRadius: 18, padding: '20px 18px', marginBottom: 22 }}>
      <p style={{ margin: 0, fontFamily: "'Chakra Petch','Trebuchet MS',sans-serif", fontSize: 10.5, letterSpacing: 2.4, fontWeight: 700, color: '#8FB4FF', textTransform: 'uppercase' }}>Add credits</p>
      <p style={{ margin: '8px 0 4px', fontFamily: "'Archivo Black',Impact,sans-serif", fontSize: 22, color: '#fff', textTransform: 'uppercase', lineHeight: 1.05 }}>
        One tap at the bar.
      </p>
      <p style={{ margin: '0 0 16px', color: '#9AA5B5', fontSize: 14, lineHeight: 1.5 }}>
        Load it once, then just show your code at the bar. Works at our Plaza Garibaldi and El Palenque events. Load more, we add more on top.
      </p>

      {pay ? (
        <div style={{ marginBottom: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 }}>
            <span style={{ color: '#9AA5B5', fontSize: 14 }}>Adding {pay.total}{pay.bonus ? ` (${pay.amount} + ${pay.bonus} bonus)` : ''}</span>
            <button onClick={() => setPay(null)} style={{ background: 'none', border: 'none', color: '#8FB4FF', fontSize: 13, cursor: 'pointer' }}>Change</button>
          </div>
          <CardCheckout
            clientSecret={pay.clientSecret}
            publishableKey={pay.publishableKey}
            returnUrl={pay.returnUrl}
            btn="#1140F0"
            onError={(m: string) => setErr(m)}
          />
        </div>
      ) : (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(130px,1fr))', gap: 9, marginBottom: 12 }}>
        {tiers.map((t) => (
          <button key={t.amountCents} onClick={() => go(t.amountCents)} disabled={!!busy}
            style={{ position: 'relative', background: t.bonusCents ? '#1140F0' : '#141821', border: `1px solid ${t.bonusCents ? '#1140F0' : '#232936'}`, borderRadius: 13, padding: '15px 10px', cursor: 'pointer', textAlign: 'center' }}>
            <span style={{ display: 'block', fontFamily: "'Archivo Black',Impact,sans-serif", fontSize: 21, color: '#fff' }}>{t.amount}</span>
            {t.bonusCents > 0 && (
              <span style={{ display: 'block', fontFamily: "'Chakra Petch','Trebuchet MS',sans-serif", fontWeight: 700, fontSize: 11.5, letterSpacing: 0.6, color: '#C9D6FF', marginTop: 4 }}>
                you get {t.total}
              </span>
            )}
            {busy === String(t.amountCents) && <span style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,.4)', borderRadius: 13 }} />}
          </button>
        ))}
      </div>
      )}

      {err && <p style={{ color: '#FF6B6B', fontSize: 13.5, margin: '0 0 10px' }}>{err}</p>}
      <p style={{ color: '#6d7787', fontSize: 11.5, lineHeight: 1.5, margin: 0 }}>
        Credit works at our Plaza Garibaldi and El Palenque events &mdash; not at outside venues. It never expires and stays on your account between events. It can&apos;t be cashed out.
      </p>
      <button onClick={() => setOpen(false)}
        style={{ display: 'block', width: '100%', marginTop: 12, background: 'none', border: 'none', color: '#6d7787', fontSize: 13, cursor: 'pointer' }}>
        Not now
      </button>
    </div>
  );
}

/* ---------- SHOW THIS AT THE BAR ---------- */
function WalletCode({ session }: { session: string }) {
  const [tok, setTok] = useState<any>(null);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open || tok || !session) return;
    fetch(`${BACKEND}/bar`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'wallet_code', session }) })
      .then((r) => r.json()).then((d) => { if (d.ok) setTok(d); }).catch(() => {});
  }, [open, tok, session]);

  if (!open) {
    return (
      <button onClick={() => { setOpen(true); sfxClick(); }}
        style={{ display: 'block', width: '100%', background: '#1140F0', color: '#fff', border: 'none', borderRadius: 999, padding: '16px 0', marginBottom: 22, cursor: 'pointer', fontFamily: "'Chakra Petch','Trebuchet MS',sans-serif", fontWeight: 700, fontSize: 14.5, letterSpacing: 1.1, textTransform: 'uppercase', boxShadow: '0 8px 22px rgba(17,64,240,.4)' }}>
        Show my code at the bar
      </button>
    );
  }

  return (
    <div style={{ background: '#fff', borderRadius: 18, padding: '22px 18px', marginBottom: 22, textAlign: 'center' }}>
      <p style={{ margin: '0 0 4px', fontFamily: "'Chakra Petch','Trebuchet MS',sans-serif", fontWeight: 700, fontSize: 10.5, letterSpacing: 2.4, color: '#6b7280', textTransform: 'uppercase' }}>Goza wallet</p>
      <p style={{ margin: '0 0 14px', fontFamily: "'Archivo Black',Impact,sans-serif", fontSize: 30, color: '#04121f' }}>{tok?.balance || '—'}</p>
      {tok?.token ? (
        <img
          alt="Your bar code"
          src={`https://api.qrserver.com/v1/create-qr-code/?size=520x520&margin=12&ecc=M&data=${encodeURIComponent(tok.token)}`}
          style={{ width: '100%', maxWidth: 260, height: 'auto', display: 'block', margin: '0 auto' }}
        />
      ) : (
        <p style={{ color: '#6b7280', fontSize: 14, padding: '40px 0' }}>Loading your code…</p>
      )}
      <p style={{ margin: '14px 0 0', color: '#6b7280', fontSize: 13, lineHeight: 1.5 }}>
        Hold this up at the bar. It only says who you are &mdash; nobody can spend your balance with it.
      </p>
      <button onClick={() => setOpen(false)}
        style={{ marginTop: 12, background: 'none', border: 'none', color: '#6b7280', fontSize: 13, cursor: 'pointer' }}>
        Hide
      </button>
    </div>
  );
}

export default function Account() {
  const [phase, setPhase] = useState<'loading' | 'signin' | 'sent' | 'portal'>('loading');
  const [data, setData] = useState<any>(null);
  const [credits, setCredits] = useState<any>(null);
  const [sessionToken, setSessionToken] = useState('');
  const loadCredits = useCallback(async (session: string) => {
    setSessionToken(session);
    try {
      const r = await fetch(`${BACKEND}/credits`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'my_credits', session }) }).then((x) => x.json());
      if (r.ok && r.totalCents > 0) setCredits(r);
    } catch { /* no credits, no banner */ }
  }, []);
  const [viewer, setViewer] = useState<any>(null);
  const [contact, setContact] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const loadSession = useCallback(async (session: string) => {
    try {
      const r = await fetch(`${BACKEND}/account?session=${encodeURIComponent(session)}`).then((x) => x.json());
      if (r.ok) { setData(r); setPhase('portal'); loadCredits(session); return true; }
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

  const [remember, setRemember] = useState(true);
  const [codeSent, setCodeSent] = useState(false);
  const [smsCode, setSmsCode] = useState('');

  // phone + texted code: works in whatever browser they're actually holding
  const textCode = async () => {
    const digits = contact.replace(/\D/g, '');
    if (digits.length < 10) { setErr('Enter your 10-digit number'); return; }
    setBusy(true); setErr('');
    try {
      const r = await fetch(`${BACKEND}/signin`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'start', phone: digits }) }).then((x) => x.json());
      if (r.ok) { setCodeSent(true); return; }
      setErr(r.error || 'Could not text a code');
    } catch { setErr('Could not reach us just now'); }
    finally { setBusy(false); }
  };

  const checkCode = async (code: string) => {
    setBusy(true); setErr('');
    try {
      const r = await fetch(`${BACKEND}/signin`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'verify', phone: contact.replace(/\D/g, ''), code, remember }) }).then((x) => x.json());
      if (r.ok && r.session) {
        try { localStorage.setItem(SESSION_KEY, r.session); } catch {}
        sfxCoin();
        await loadSession(r.session);
        return;
      }
      setErr(r.error || 'That code did not work');
    } catch { setErr('Could not reach us just now'); }
    finally { setBusy(false); }
  };

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
        <p style={{ color: '#fff', fontFamily: "'Chakra Petch','Trebuchet MS',sans-serif", fontSize: 11.5, letterSpacing: 3.4, fontWeight: 700, margin: '0 0 26px' }}>GOZA ENTERTAINMENT</p>

        {phase === 'loading' && <p style={{ color: '#8a8f98', fontSize: 15 }}>Loading…</p>}

        {phase === 'signin' && (
          <div>
            <h1 style={{ fontFamily: "'Archivo Black',Impact,Haettenschweiler,sans-serif", fontSize: 32, margin: '0 0 8px', textTransform: 'uppercase' }}>Your tickets</h1>
            <p style={{ color: '#a8adb8', fontSize: 15, lineHeight: 1.5, margin: '0 0 22px' }}>
              {codeSent ? 'Enter the code we just texted you.' : 'Your phone number is your account. We\u2019ll text you a code.'}
            </p>

            {!codeSent ? (
              <>
                <input
                  value={contact} onChange={(e) => setContact(e.target.value)} placeholder="(314) 555-0123"
                  inputMode="tel" type="tel" autoFocus
                  onKeyDown={(e) => { if (e.key === 'Enter') textCode(); }}
                  style={{ width: '100%', boxSizing: 'border-box', background: '#0e0e12', border: `1px solid ${err ? '#ff6b6b' : 'rgba(255,255,255,0.15)'}`, borderRadius: 12, padding: '15px 16px', color: '#fff', fontSize: 17, marginBottom: 12, outline: 'none' }}
                />
                <label style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#a8adb8', fontSize: 14, margin: '0 0 16px', cursor: 'pointer' }}>
                  <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} style={{ width: 18, height: 18, accentColor: '#1140F0' }} />
                  Keep me signed in on this phone
                </label>
                {err && <p style={{ color: '#ff8585', fontSize: 13.5, margin: '0 0 12px' }}>{err}</p>}
                <button onClick={textCode} disabled={busy}
                  style={{ width: '100%', background: '#1140F0', color: '#fff', border: 'none', borderRadius: 999, padding: '17px 0', fontFamily: "'Chakra Petch','Trebuchet MS',sans-serif", fontWeight: 700, fontSize: 15, letterSpacing: 1.1, textTransform: 'uppercase', cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.6 : 1, boxShadow: '0 8px 22px rgba(17,64,240,.4)' }}>
                  {busy ? 'Texting\u2026' : 'Text me a code'}
                </button>
                <button onClick={sendLink} disabled={busy}
                  style={{ width: '100%', background: 'none', border: 'none', color: '#8a8f98', fontSize: 13.5, padding: '14px 0 0', cursor: 'pointer' }}>
                  Rather use email? Send me a link instead
                </button>
              </>
            ) : (
              <>
                <input
                  value={smsCode}
                  onChange={(e) => {
                    const v = e.target.value.replace(/\D/g, '').slice(0, 6);
                    setSmsCode(v);
                    if (v.length === 6) checkCode(v);
                  }}
                  placeholder="123456" inputMode="numeric" autoFocus
                  style={{ width: '100%', boxSizing: 'border-box', background: '#0e0e12', border: `1px solid ${err ? '#ff6b6b' : 'rgba(255,255,255,0.15)'}`, borderRadius: 12, padding: '15px 16px', color: '#fff', fontSize: 26, letterSpacing: 8, textAlign: 'center', fontFamily: 'ui-monospace,Menlo,monospace', marginBottom: 14, outline: 'none' }}
                />
                {err && <p style={{ color: '#ff8585', fontSize: 13.5, margin: '0 0 12px' }}>{err}</p>}
                <button onClick={() => checkCode(smsCode)} disabled={busy || smsCode.length !== 6}
                  style={{ width: '100%', background: '#1140F0', color: '#fff', border: 'none', borderRadius: 999, padding: '17px 0', fontFamily: "'Chakra Petch','Trebuchet MS',sans-serif", fontWeight: 700, fontSize: 15, letterSpacing: 1.1, textTransform: 'uppercase', cursor: 'pointer', opacity: busy || smsCode.length !== 6 ? 0.5 : 1, boxShadow: '0 8px 22px rgba(17,64,240,.4)' }}>
                  {busy ? 'Checking\u2026' : 'Open my account'}
                </button>
                <button onClick={() => { setCodeSent(false); setSmsCode(''); setErr(''); }}
                  style={{ width: '100%', background: 'none', border: 'none', color: '#8a8f98', fontSize: 13.5, padding: '14px 0 0', cursor: 'pointer' }}>
                  Wrong number? Start over
                </button>
              </>
            )}
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
            <p style={{ color: '#a8adb8', fontSize: 14, margin: '0 0 20px' }}>{data.orders.length} order{data.orders.length === 1 ? '' : 's'} on your account</p>

            {credits?.decided?.filter((d: any) => d.decision === 'refund').map((d: any) => (
              <div key={d.code} style={{ background: '#0E1116', border: '1px solid #232936', borderRadius: 18, padding: 20, marginBottom: 18 }}>
                <p style={{ color: '#fff', fontFamily: "'Archivo Black',Impact,sans-serif", fontSize: 18, textTransform: 'uppercase', margin: '0 0 6px' }}>Refund on the way</p>
                <p style={{ color: '#9AA5B5', fontSize: 14, lineHeight: 1.55, margin: 0 }}>
                  {d.fromEvent ? `${d.fromEvent} — ` : ''}back to the card you paid with. Give it 7&ndash;15 days to land.
                </p>
              </div>
            ))}
            {credits?.credits?.filter((c: any) => !c.claimed).map((c: any) => (
              <CreditChoice key={c.code} credit={c} session={sessionToken}
                onTakeCredit={() => setCredits((p: any) => ({ ...p, credits: p.credits.map((x: any) => x.code === c.code ? { ...x, claimed: true } : x) }))} />
            ))}
            {credits && credits.credits?.some((c: any) => c.claimed) && <CreditBanner credits={credits} />}
            <a href="/" style={{ display: 'block', width: '100%', boxSizing: 'border-box', textAlign: 'center', textDecoration: 'none',
              background: 'linear-gradient(180deg,#1B2130 0%,#11151C 100%)', border: '1px solid #232936', color: '#fff',
              borderRadius: 999, padding: '15px 0', marginBottom: 18,
              fontFamily: "'Chakra Petch','Trebuchet MS',sans-serif", fontWeight: 700, fontSize: 13.5, letterSpacing: 1, textTransform: 'uppercase' }}>
              See all events
            </a>

            {sessionToken && (credits?.totalCents ?? 0) > 0 && <WalletCode session={sessionToken} />}
            {sessionToken && <Reload session={sessionToken} balance={credits?.total || '$0.00'} onDone={() => loadCredits(sessionToken)} />}

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
