'use client';

/*
  EVENT PAGE v3 — multi-event, desktop two-column, flyer-tinted background.

  Checkout flow (per Jose's spec): tap GET TICKETS →
    1. phone number ("where do we text you")
    2. name + email
    3. CART — full in-page review: ticket type, quantity, line items, total.
  Stripe is only the card form at the very end; the cart lives here.
*/

import { useState, useEffect, useCallback } from 'react';
import { api, money, fmtDate, ORGANIZER, DEFAULT_EVENT_ID } from '@/lib/api';

const ROSE = '#c25b6e';
const CARD = 'rgba(12,12,16,0.62)';

interface TicketType { id: string; name: string; price: number; remaining: number }
interface Info {
  event: { id: string; name: string; date: string; location: string; imageUrl: string | null; description: string | null };
  ticketTypes: TicketType[];
}
interface Quote {
  faceValue: number; serviceFee: number; tax: number; processingFee: number;
  total: number; remaining: number; ticketTypeName: string;
  buyerPaysFees: boolean; buyerPaysProcessing: boolean;
}

/* --- sample the flyer's dominant color for the page tint --- */
function usePalette(imageUrl: string | null) {
  const [pal, setPal] = useState<{ accent: string; deep: string } | null>(null);
  useEffect(() => {
    if (!imageUrl) { setPal(null); return; }
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const c = document.createElement('canvas');
        c.width = 32; c.height = 32;
        const ctx = c.getContext('2d')!;
        ctx.drawImage(img, 0, 0, 32, 32);
        const { data } = ctx.getImageData(0, 0, 32, 32);
        let br = 0, bg = 0, bb = 0, best = -1;
        let ar = 0, ag = 0, ab = 0, n = 0;
        for (let i = 0; i < data.length; i += 4) {
          const r = data[i], g = data[i + 1], b = data[i + 2];
          ar += r; ag += g; ab += b; n++;
          const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
          const sat = mx === 0 ? 0 : (mx - mn) / mx;
          const score = sat * mx;
          if (score > best && mx > 60) { best = score; br = r; bg = g; bb = b; }
        }
        ar /= n; ag /= n; ab /= n;
        const dk = (v: number, f: number) => Math.round(v * f);
        setPal({
          accent: `rgb(${dk(br, 0.55)},${dk(bg, 0.55)},${dk(bb, 0.55)})`,
          deep: `rgb(${dk(ar, 0.22)},${dk(ag, 0.22)},${dk(ab, 0.22)})`,
        });
      } catch { setPal(null); }
    };
    img.onerror = () => setPal(null);
    img.src = imageUrl;
  }, [imageUrl]);
  return pal;
}

/* --- phone helpers: display as (314) 555-0123, store digits --- */
const phoneDigits = (s: string) => s.replace(/\D/g, '').slice(0, 10);
function phonePretty(d: string) {
  if (d.length <= 3) return d;
  if (d.length <= 6) return `(${d.slice(0, 3)}) ${d.slice(3)}`;
  return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
}

type Step = null | 'phone' | 'contact' | 'cart';

export default function EventPage({ eventId = DEFAULT_EVENT_ID }: { eventId?: string }) {
  const [info, setInfo] = useState<Info | null>(null);
  const [loadErr, setLoadErr] = useState('');
  const [step, setStep] = useState<Step>(null);
  const [ttId, setTtId] = useState('');
  const [qty, setQty] = useState(1);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [loadingQuote, setLoadingQuote] = useState(false);
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api(`/checkout?eventId=${eventId}&info=1`)
      .then((d: Info) => { setInfo(d); if (d.ticketTypes[0]) setTtId(d.ticketTypes[0].id); })
      .catch((e) => setLoadErr(e.message));
  }, [eventId]);

  const fetchQuote = useCallback(async (typeId: string, q: number) => {
    if (!typeId) return;
    setLoadingQuote(true);
    try {
      const d = await api(`/checkout?eventId=${eventId}&ticketTypeId=${typeId}&quantity=${q}`);
      setQuote(d); setError('');
    } catch (e: any) { setError(e.message); }
    finally { setLoadingQuote(false); }
  }, [eventId]);

  useEffect(() => { if (step === 'cart') fetchQuote(ttId, qty); }, [step, ttId, qty, fetchQuote]);

  const ev = info?.event;
  const pal = usePalette(ev?.imageUrl ?? null);
  const accent = pal?.accent || 'rgba(58,13,24,1)';
  const deep = pal?.deep || 'rgba(10,4,8,1)';
  const types = info?.ticketTypes ?? [];
  const minPrice = types.length ? Math.min(...types.map((t) => t.price)) : 25;
  const allSoldOut = types.length > 0 && types.every((t) => t.remaining <= 0);
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const phoneOk = phoneDigits(phone).length === 10;
  const details = (ev?.description || '').split('\n').map((s) => s.trim()).filter(Boolean);

  const pay = async () => {
    setSubmitting(true); setError('');
    try {
      const d = await api('/checkout', {
        method: 'POST',
        body: JSON.stringify({
          eventId, ticketTypeId: ttId, quantity: qty,
          buyerName: name.trim(), buyerEmail: email.trim(),
          buyerPhone: `+1${phoneDigits(phone)}`,
        }),
      });
      window.location.href = d.url;
    } catch (e: any) { setError(e.message); setSubmitting(false); }
  };

  if (loadErr) {
    return (
      <div style={{ minHeight: '100vh', background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, fontFamily: F }}>
        <p style={{ color: '#8a8f98', fontSize: 15, textAlign: 'center' }}>This event isn&apos;t available.<br /><span style={{ fontSize: 12.5 }}>{loadErr}</span></p>
      </div>
    );
  }
  if (!ev) return <div style={{ minHeight: '100vh', background: '#000' }} />;

  const flyer = ev.imageUrl ? (
    <img src={ev.imageUrl} alt={ev.name} style={{ width: '100%', display: 'block' }} />
  ) : (
    <div style={{ aspectRatio: '4/5', background: `radial-gradient(120% 90% at 50% 20%, ${accent} 0%, ${deep} 60%, #000 100%)`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14, padding: 24, textAlign: 'center' }}>
      <p style={{ color: '#fff', fontSize: 13, letterSpacing: 4, margin: 0, fontWeight: 500 }}>{fmtDate(ev.date).toUpperCase()}</p>
      <p style={{ color: ROSE, fontSize: 42, fontWeight: 800, letterSpacing: 2, margin: 0, lineHeight: 1.05, textShadow: `0 0 28px ${ROSE}66` }}>{ev.name.split('—')[0]}</p>
      <p style={{ color: '#c9ccd4', fontSize: 12, letterSpacing: 3, margin: 0 }}>{ORGANIZER.name}</p>
    </div>
  );

  const open = () => { if (!allSoldOut) { setError(''); setStep('phone'); } };

  return (
    <div style={{ minHeight: '100vh', fontFamily: F, background: `radial-gradient(130% 100% at 50% 0%, ${accent} 0%, ${deep} 55%, #000 100%)`, backgroundAttachment: 'fixed' }}>
      <style>{`
        .gz-shell { max-width: 520px; margin: 0 auto; padding: 16px 18px 0; }
        .gz-left-cta { display: none; }
        .gz-bar { position: fixed; left: 0; right: 0; bottom: 0; padding: 12px 18px calc(14px + env(safe-area-inset-bottom)); background: linear-gradient(transparent, rgba(0,0,0,0.9) 40%); z-index: 10; }
        @media (min-width: 920px) {
          .gz-shell { max-width: 1080px; display: grid; grid-template-columns: 420px 1fr; gap: 48px; padding: 40px 32px 0; align-items: start; }
          .gz-col-left { position: sticky; top: 40px; }
          .gz-left-cta { display: block; }
          .gz-bar { display: none; }
          .gz-title { font-size: 46px !important; }
        }
      `}</style>

      <div className="gz-shell">
        <div className="gz-col-left">
          <div style={{ borderRadius: 20, overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,0.55)' }}>{flyer}</div>
          <button className="gz-left-cta" onClick={open} disabled={allSoldOut}
            style={{ width: '100%', marginTop: 22, background: 'rgba(20,40,48,0.55)', border: '1px solid rgba(120,220,230,0.45)', boxShadow: '0 0 24px rgba(120,220,230,0.25)', color: '#fff', borderRadius: 30, padding: '16px 0', fontSize: 17, fontWeight: 700, cursor: allSoldOut ? 'default' : 'pointer', opacity: allSoldOut ? 0.55 : 1 }}>
            {allSoldOut ? 'SOLD OUT' : `Get Tickets from ${money(minPrice)}`}
          </button>
        </div>

        <div style={{ paddingBottom: 40 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '16px 0 14px' }}>
            <div style={{ width: 28, height: 28, borderRadius: '50%', background: ROSE, color: '#000', fontSize: 13, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>G</div>
            <span style={{ color: '#fff', fontSize: 14, fontWeight: 600, letterSpacing: 0.5 }}>{ORGANIZER.name}</span>
          </div>

          <h1 className="gz-title" style={{ color: '#fff', fontSize: 38, fontWeight: 800, lineHeight: 1.04, letterSpacing: -0.5, margin: '0 0 14px' }}>{ev.name.toUpperCase()}</h1>
          <p style={{ color: '#fff', fontSize: 19, fontWeight: 700, margin: '0 0 4px' }}>{ev.location}</p>
          <p style={{ color: '#b9bec8', fontSize: 17, margin: '0 0 20px' }}>{fmtDate(ev.date)}</p>

          <div style={{ background: CARD, backdropFilter: 'blur(8px)', borderRadius: 16, padding: '18px 18px 14px', marginBottom: 28, border: '1px solid rgba(255,255,255,0.07)' }}>
            <p style={{ color: '#fff', fontSize: 15, fontWeight: 600, letterSpacing: 0.5, margin: 0 }}>
              TICKETS FROM {money(minPrice)}
            </p>
            <div style={{ height: 1, background: 'rgba(255,255,255,0.09)', margin: '16px 0 14px' }} />
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <p style={{ color: '#fff', fontSize: 15, fontWeight: 600, margin: '0 0 3px' }}>Guest list</p>
                <p style={{ color: '#b9bec8', fontSize: 14, margin: 0 }}>Be there</p>
              </div>
              <button onClick={open} style={{ background: 'rgba(255,255,255,0.14)', color: '#fff', border: 'none', borderRadius: 22, padding: '11px 22px', fontSize: 14.5, fontWeight: 600, cursor: 'pointer' }}>Get in</button>
            </div>
          </div>

          {details.length > 0 && (
            <>
              <p style={SH}>About this event</p>
              <div style={{ background: CARD, backdropFilter: 'blur(8px)', borderRadius: 16, padding: 20, marginBottom: 28, border: '1px solid rgba(255,255,255,0.07)' }}>
                {details.map((line, i) => (
                  <p key={i} style={{ color: '#d6d9df', fontSize: 16, lineHeight: 1.65, margin: i ? '14px 0 0' : 0 }}>{line}</p>
                ))}
              </div>
            </>
          )}

          <p style={SH}>Location</p>
          <p style={{ color: '#b9bec8', fontSize: 17, margin: '0 0 12px' }}>{ev.location}</p>
          <a href={`https://maps.google.com/?q=${encodeURIComponent(ev.location)}`} target="_blank" rel="noreferrer"
            style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, height: 180, background: 'rgba(8,8,10,0.55)', borderRadius: 16, marginBottom: 30, textDecoration: 'none', border: '1px solid rgba(255,255,255,0.06)' }}>
            <div style={{ width: 54, height: 54, borderRadius: '50%', background: `${ROSE}33`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ width: 20, height: 20, borderRadius: '50%', background: ROSE }} />
            </div>
            <span style={{ color: '#b9bec8', fontSize: 13 }}>Open in Maps</span>
          </a>

          <p style={SH}>Organizer</p>
          <div style={{ background: CARD, backdropFilter: 'blur(8px)', borderRadius: 16, padding: 20, marginBottom: 26, border: '1px solid rgba(255,255,255,0.07)' }}>
            <p style={{ color: '#fff', fontSize: 17, fontWeight: 700, margin: '0 0 3px' }}>{ORGANIZER.name}</p>
            <p style={{ color: '#b9bec8', fontSize: 14, margin: '0 0 16px' }}>From {ORGANIZER.from}</p>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <a href={`mailto:${ORGANIZER.email}`} style={{ background: 'rgba(20,40,48,0.55)', border: '1px solid rgba(120,220,230,0.4)', color: '#fff', borderRadius: 10, padding: '11px 20px', fontSize: 14.5, fontWeight: 600, textDecoration: 'none' }}>Contact organizer</a>
              <a href={ORGANIZER.instagram} target="_blank" rel="noreferrer" style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.15)', color: '#fff', borderRadius: 10, padding: '11px 16px', fontSize: 14.5, fontWeight: 600, textDecoration: 'none' }}>Instagram</a>
            </div>
          </div>

          <p style={{ textAlign: 'center', padding: '10px 0 90px' }}>
            <a href="/admin" style={{ color: 'rgba(255,255,255,0.28)', fontSize: 11, letterSpacing: 2, textDecoration: 'none' }}>ADMIN</a>
          </p>
        </div>
      </div>

      <div className="gz-bar">
        <button onClick={open} disabled={allSoldOut}
          style={{ display: 'block', width: '100%', maxWidth: 520, margin: '0 auto', background: ROSE, color: '#fff', border: 'none', borderRadius: 14, padding: '17px 0', fontSize: 17, fontWeight: 700, letterSpacing: 0.5, cursor: 'pointer', opacity: allSoldOut ? 0.5 : 1 }}>
          {allSoldOut ? 'SOLD OUT' : 'GET TICKETS'}
        </button>
      </div>

      {/* ---------- CHECKOUT SHEET: phone → contact → cart ---------- */}
      {step && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 50, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }} onClick={() => !submitting && setStep(null)}>
          <div style={{ width: '100%', maxWidth: 520, background: '#0b0b0b', borderRadius: '22px 22px 0 0', padding: '22px 22px calc(26px + env(safe-area-inset-bottom))', position: 'relative' }} onClick={(e) => e.stopPropagation()}>
            <button onClick={() => !submitting && setStep(null)} style={{ position: 'absolute', top: 18, right: 18, background: 'none', border: 'none', color: '#fff', fontSize: 20, cursor: 'pointer' }} aria-label="Close">✕</button>

            {/* step dots */}
            <div style={{ display: 'flex', gap: 6, marginBottom: 18 }}>
              {(['phone', 'contact', 'cart'] as const).map((s) => (
                <div key={s} style={{ height: 4, flex: 1, borderRadius: 2, background: step === s ? ROSE : (['phone','contact','cart'].indexOf(step) > ['phone','contact','cart'].indexOf(s) ? `${ROSE}88` : 'rgba(255,255,255,0.12)') }} />
              ))}
            </div>

            {/* -------- STEP 1: PHONE -------- */}
            {step === 'phone' && (
              <>
                <p style={SHEETH}>What&apos;s your number?</p>
                <p style={SHEETSUB}>We text your confirmation here after you pay.</p>
                <input
                  value={phonePretty(phoneDigits(phone))}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="(314) 555-0123"
                  type="tel" inputMode="tel" autoFocus
                  style={{ ...INPUT, fontSize: 22, letterSpacing: 1, textAlign: 'center' }}
                />
                <button onClick={() => setStep('contact')} disabled={!phoneOk}
                  style={{ ...PRIMARY, opacity: phoneOk ? 1 : 0.45 }}>
                  Continue
                </button>
              </>
            )}

            {/* -------- STEP 2: NAME + EMAIL -------- */}
            {step === 'contact' && (
              <>
                <p style={SHEETH}>Who&apos;s coming?</p>
                <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" autoFocus style={INPUT} />
                <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" type="email" style={INPUT} />
                <p style={{ color: '#6f747d', fontSize: 12.5, lineHeight: 1.5, margin: '2px 0 16px' }}>
                  Your QR code{qty > 1 ? 's land' : ' lands'} in this inbox.
                </p>
                <button onClick={() => setStep('cart')} disabled={name.trim().length < 2 || !emailOk}
                  style={{ ...PRIMARY, opacity: name.trim().length < 2 || !emailOk ? 0.45 : 1 }}>
                  Review order
                </button>
                <button onClick={() => setStep('phone')} style={BACKBTN}>Back</button>
              </>
            )}

            {/* -------- STEP 3: CART -------- */}
            {step === 'cart' && (
              <>
                <p style={SHEETH}>Your cart</p>

                {types.length > 1 && (
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
                    {types.map((t) => (
                      <button key={t.id} onClick={() => setTtId(t.id)} disabled={t.remaining <= 0}
                        style={{ background: ttId === t.id ? ROSE : '#1c1c1c', color: '#fff', border: 'none', borderRadius: 12, padding: '10px 16px', fontSize: 13.5, fontWeight: 600, cursor: 'pointer', opacity: t.remaining <= 0 ? 0.4 : 1 }}>
                        {t.name} · {money(t.price)}{t.remaining <= 0 ? ' · SOLD OUT' : ''}
                      </button>
                    ))}
                  </div>
                )}

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                  <button onClick={() => setQty((q) => Math.max(1, q - 1))} style={QBTN} aria-label="Fewer">−</button>
                  <div style={{ textAlign: 'center' }}>
                    <span style={{ color: '#fff', fontSize: 40, fontWeight: 800, display: 'block', lineHeight: 1 }}>{qty}</span>
                    <span style={{ color: '#8a8f98', fontSize: 13 }}>{qty > 1 ? 'tickets' : 'ticket'}</span>
                  </div>
                  <button onClick={() => setQty((q) => Math.min(10, q + 1))} style={QBTN} aria-label="More">+</button>
                </div>

                {quote && !loadingQuote && (
                  <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 12, marginBottom: 8 }}>
                    <Row l={`${quote.ticketTypeName} × ${qty}`} v={money(quote.faceValue)} />
                    {quote.buyerPaysFees && quote.serviceFee > 0 && <Row l="Service fee" v={money(quote.serviceFee)} dim />}
                    {quote.tax > 0 && <Row l="Tax" v={money(quote.tax)} dim />}
                    {quote.buyerPaysProcessing && <Row l="Processing" v={money(quote.processingFee)} dim />}
                    <div style={{ height: 1, background: 'rgba(255,255,255,0.08)', margin: '8px 0' }} />
                    <Row l="Total" v={money(quote.total)} big />
                  </div>
                )}
                {loadingQuote && <p style={{ color: '#8a8f98', fontSize: 14, textAlign: 'center', padding: '16px 0' }}>Loading…</p>}

                {/* deliver-to summary */}
                <div style={{ background: '#141414', borderRadius: 12, padding: '12px 14px', margin: '4px 0 16px', border: '1px solid rgba(255,255,255,0.08)' }}>
                  <p style={{ color: '#8a8f98', fontSize: 12, margin: '0 0 4px', letterSpacing: 1 }}>DELIVERING TO</p>
                  <p style={{ color: '#fff', fontSize: 14, margin: 0, lineHeight: 1.6 }}>
                    {name} · {phonePretty(phoneDigits(phone))}<br />{email}
                  </p>
                  <button onClick={() => setStep('phone')} style={{ background: 'none', border: 'none', color: ROSE, fontSize: 12.5, padding: '6px 0 0', cursor: 'pointer', fontWeight: 600 }}>Edit</button>
                </div>

                {error && <p style={{ color: ROSE, fontSize: 13.5, margin: '0 0 14px' }}>{error}</p>}

                <button onClick={pay} disabled={!quote || loadingQuote || submitting}
                  style={{ ...PRIMARY, opacity: !quote || loadingQuote || submitting ? 0.45 : 1 }}>
                  {submitting ? 'Opening secure payment…' : quote ? `Pay ${money(quote.total)}` : 'Pay'}
                </button>
                <button onClick={() => setStep('contact')} disabled={submitting} style={BACKBTN}>Back</button>
                <p style={{ color: '#6f747d', fontSize: 11.5, textAlign: 'center', margin: '12px 0 0' }}>Card handled securely by Stripe. We never see your number.</p>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Row({ l, v, dim, big }: { l: string; v: string; dim?: boolean; big?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', alignItems: 'baseline' }}>
      <span style={{ color: dim ? '#8a8f98' : '#fff', fontSize: big ? 17 : 14.5, fontWeight: big ? 700 : 400 }}>{l}</span>
      <span style={{ color: dim ? '#8a8f98' : '#fff', fontSize: big ? 22 : 14.5, fontWeight: big ? 800 : 500 }}>{v}</span>
    </div>
  );
}

const F = 'Helvetica Neue,Helvetica,Arial,sans-serif';
const SH: React.CSSProperties = { color: '#fff', fontSize: 22, fontWeight: 800, margin: '0 0 14px', textTransform: 'uppercase', letterSpacing: 0.5 };
const SHEETH: React.CSSProperties = { color: '#fff', fontSize: 26, fontWeight: 800, margin: '4px 0 8px' };
const SHEETSUB: React.CSSProperties = { color: '#8a8f98', fontSize: 14.5, margin: '0 0 20px', lineHeight: 1.5 };
const QBTN: React.CSSProperties = { width: 54, height: 54, borderRadius: 14, background: '#1c1c1c', color: '#fff', border: 'none', fontSize: 26, cursor: 'pointer' };
const INPUT: React.CSSProperties = { width: '100%', height: 56, background: '#141414', color: '#fff', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 12, padding: '0 16px', fontSize: 17, outline: 'none', boxSizing: 'border-box', marginBottom: 12 };
const PRIMARY: React.CSSProperties = { width: '100%', background: '#f2f2f2', color: '#000', border: 'none', borderRadius: 28, padding: '17px 0', fontSize: 17, fontWeight: 700, cursor: 'pointer', marginTop: 6 };
const BACKBTN: React.CSSProperties = { width: '100%', background: 'none', border: 'none', color: '#8a8f98', fontSize: 15, padding: '14px 0 0', cursor: 'pointer' };
