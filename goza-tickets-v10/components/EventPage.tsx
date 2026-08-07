'use client';

/*
  EVENT PAGE v4 — multi-event, desktop two-column, flyer-tinted background.
  Adds: per-event music player (press play), share button, logo, and cart
  upsells (buy-X-get discount + add-on product) shown as quick-click cards
  inside the cart step.
*/

import { useState, useEffect, useCallback, useRef } from 'react';
import { api, money, fmtDate, ORGANIZER, DEFAULT_EVENT_ID } from '@/lib/api';
import { trackViewContent, trackInitiateCheckout, trackAddPaymentInfo } from '@/lib/track';

const ROSE = '#c25b6e';
const CARD = 'rgba(12,12,16,0.62)';

interface TicketType { id: string; name: string; price: number; remaining: number }
interface Bump { triggerQty: number; addQty: number; discount: number }
interface Addon { ticketTypeId: string; name: string; price: number; pitch: string }
interface Info {
  event: { id: string; name: string; date: string; location: string; imageUrl: string | null; description: string | null; musicUrl: string | null; logoUrl: string | null };
  ticketTypes: TicketType[];
  upsells: { bump: Bump | null; addon: Addon | null };
}
interface Quote {
  faceValue: number; discount: number; addon: number; serviceFee: number; tax: number;
  processingFee: number; total: number; remaining: number; ticketTypeName: string;
  buyerPaysFees: boolean; buyerPaysProcessing: boolean;
}

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
        let br = 0, bg = 0, bb = 0, best = -1, ar = 0, ag = 0, ab = 0, n = 0;
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
        setPal({ accent: `rgb(${dk(br, 0.55)},${dk(bg, 0.55)},${dk(bb, 0.55)})`, deep: `rgb(${dk(ar, 0.22)},${dk(ag, 0.22)},${dk(ab, 0.22)})` });
      } catch { setPal(null); }
    };
    img.onerror = () => setPal(null);
    img.src = imageUrl;
  }, [imageUrl]);
  return pal;
}

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
  const [addonOn, setAddonOn] = useState(false);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [loadingQuote, setLoadingQuote] = useState(false);
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [playing, setPlaying] = useState(false);
  const [shared, setShared] = useState('');
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    api(`/checkout?eventId=${eventId}&info=1`)
      .then((d: Info) => {
        setInfo(d);
        if (d.ticketTypes[0]) setTtId(d.ticketTypes[0].id);
        const mp = d.ticketTypes.length ? Math.min(...d.ticketTypes.map((t) => t.price)) : 0;
        trackViewContent(d.event.id, d.event.name, mp);
      })
      .catch((e) => setLoadErr(e.message));
  }, [eventId]);

  const bump = info?.upsells?.bump || null;
  const addon = info?.upsells?.addon || null;
  // bump applies once the buyer has taken the "add" — modeled as qty>=trigger+add with discount
  const bumpActive = !!bump && qty >= (bump.triggerQty + bump.addQty);
  const discount = bumpActive ? bump!.discount : 0;

  const fetchQuote = useCallback(async (typeId: string, q: number, disc: number, withAddon: boolean) => {
    if (!typeId) return;
    setLoadingQuote(true);
    try {
      const addonParam = withAddon && addon ? `&addonTypeId=${addon.ticketTypeId}` : '';
      const d = await api(`/checkout?eventId=${eventId}&ticketTypeId=${typeId}&quantity=${q}&discount=${disc}${addonParam}`);
      setQuote(d); setError('');
    } catch (e: any) { setError(e.message); }
    finally { setLoadingQuote(false); }
  }, [eventId, addon]);

  useEffect(() => { if (step === 'cart') fetchQuote(ttId, qty, discount, addonOn); }, [step, ttId, qty, discount, addonOn, fetchQuote]);

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

  const toggleMusic = () => {
    if (!audioRef.current) return;
    if (playing) { audioRef.current.pause(); setPlaying(false); }
    else { audioRef.current.play().then(() => setPlaying(true)).catch(() => {}); }
  };

  const share = async () => {
    const url = typeof window !== 'undefined' ? window.location.href : '';
    const text = `${ev?.name} — get tickets`;
    try {
      if (navigator.share) { await navigator.share({ title: ev?.name, text, url }); setShared('Shared ✓'); }
      else { await navigator.clipboard.writeText(url); setShared('Link copied ✓'); }
    } catch { /* user cancelled */ }
    setTimeout(() => setShared(''), 2500);
  };

  const pay = async () => {
    setSubmitting(true); setError('');
    if (quote) trackAddPaymentInfo(eventId, quote.total);
    try {
      const d = await api('/checkout', {
        method: 'POST',
        body: JSON.stringify({
          eventId, ticketTypeId: ttId, quantity: qty,
          discount, addonTypeId: addonOn && addon ? addon.ticketTypeId : '',
          buyerName: name.trim(), buyerEmail: email.trim(), buyerPhone: `+1${phoneDigits(phone)}`,
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

  const open = () => { if (!allSoldOut) { setError(''); setStep('phone'); trackInitiateCheckout(eventId, ev.name); } };

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
          .gz-title { font-size: 52px !important; line-height: 0.98 !important; }
        }
      `}</style>

      {ev.musicUrl && <audio ref={audioRef} src={ev.musicUrl} loop preload="none" onEnded={() => setPlaying(false)} />}

      <div className="gz-shell">
        <div className="gz-col-left">
          <div style={{ position: 'relative', borderRadius: 20, overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,0.55)' }}>
            {flyer}
            {ev.musicUrl && (
              <button onClick={toggleMusic} aria-label={playing ? 'Pause music' : 'Play music'}
                style={{ position: 'absolute', bottom: 14, right: 14, width: 52, height: 52, borderRadius: '50%', background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(6px)', border: '1.5px solid rgba(255,255,255,0.5)', color: '#fff', fontSize: 20, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {playing ? '❚❚' : '▶'}
              </button>
            )}
          </div>
          <button className="gz-left-cta" onClick={open} disabled={allSoldOut}
            style={{ width: '100%', marginTop: 22, background: 'rgba(20,40,48,0.55)', border: '1px solid rgba(120,220,230,0.45)', boxShadow: '0 0 24px rgba(120,220,230,0.25)', color: '#fff', borderRadius: 30, padding: '16px 0', fontSize: 17, fontWeight: 700, cursor: allSoldOut ? 'default' : 'pointer', opacity: allSoldOut ? 0.55 : 1 }}>
            {allSoldOut ? 'SOLD OUT' : `Get Tickets from ${money(minPrice)}`}
          </button>
        </div>

        <div style={{ paddingBottom: 40 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '16px 0 14px' }}>
            {ev.logoUrl
              ? <img src={ev.logoUrl} alt={ORGANIZER.name} style={{ height: 30, maxWidth: 150, objectFit: 'contain' }} />
              : <>
                  <div style={{ width: 28, height: 28, borderRadius: '50%', background: ROSE, color: '#000', fontSize: 13, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>G</div>
                  <span style={{ color: '#fff', fontSize: 14, fontWeight: 600, letterSpacing: 0.5 }}>{ORGANIZER.name}</span>
                </>}
            <button onClick={share} style={{ marginLeft: 'auto', background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.16)', color: '#fff', borderRadius: 20, padding: '7px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 14 }}>↗</span> {shared || 'Share'}
            </button>
          </div>

          <h1 className="gz-title" style={{ color: '#fff', fontSize: 40, fontWeight: 800, lineHeight: 1.0, letterSpacing: -0.8, margin: '0 0 16px' }}>{ev.name.toUpperCase()}</h1>
          <p style={{ color: '#fff', fontSize: 19, fontWeight: 700, margin: '0 0 4px' }}>{ev.location}</p>
          <p style={{ color: '#b9bec8', fontSize: 17, margin: '0 0 20px' }}>{fmtDate(ev.date)}</p>

          <div style={{ background: CARD, backdropFilter: 'blur(8px)', borderRadius: 16, padding: '18px 18px 14px', marginBottom: 28, border: '1px solid rgba(255,255,255,0.07)' }}>
            <p style={{ color: '#fff', fontSize: 15, fontWeight: 600, letterSpacing: 0.5, margin: 0 }}>TICKETS FROM {money(minPrice)}</p>
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
              <p style={SH}>Details</p>
              <div style={{ background: CARD, backdropFilter: 'blur(8px)', borderRadius: 16, padding: 20, marginBottom: 28, border: '1px solid rgba(255,255,255,0.07)' }}>
                {details.map((line, i) => (<p key={i} style={{ color: '#a8adb8', fontSize: 17, lineHeight: 1.7, margin: i ? '18px 0 0' : 0, letterSpacing: 0.2 }}>{line}</p>))}
              </div>
            </>
          )}

          <p style={SH}>Location</p>
          <p style={{ color: '#b9bec8', fontSize: 17, margin: '0 0 14px', lineHeight: 1.4 }}>{ev.location}</p>
          <EventMap location={ev.location} />

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

      {step && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 50, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }} onClick={() => !submitting && setStep(null)}>
          <div style={{ width: '100%', maxWidth: 520, background: '#0b0b0b', borderRadius: '22px 22px 0 0', padding: '22px 22px calc(26px + env(safe-area-inset-bottom))', position: 'relative', maxHeight: '92vh', overflowY: 'auto', overscrollBehavior: 'contain' }} onClick={(e) => e.stopPropagation()}>
            <button onClick={() => !submitting && setStep(null)} style={{ position: 'absolute', top: 18, right: 18, background: 'none', border: 'none', color: '#fff', fontSize: 20, cursor: 'pointer' }} aria-label="Close">✕</button>

            <div style={{ display: 'flex', gap: 6, marginBottom: 18 }}>
              {(['phone', 'contact', 'cart'] as const).map((s) => (
                <div key={s} style={{ height: 4, flex: 1, borderRadius: 2, background: step === s ? ROSE : (['phone','contact','cart'].indexOf(step) > ['phone','contact','cart'].indexOf(s) ? `${ROSE}88` : 'rgba(255,255,255,0.12)') }} />
              ))}
            </div>

            {step === 'phone' && (
              <>
                <p style={SHEETH}>What&apos;s your number?</p>
                <p style={SHEETSUB}>We text your confirmation + receipt here after you pay.</p>
                <input value={phonePretty(phoneDigits(phone))} onChange={(e) => setPhone(e.target.value)} placeholder="(314) 555-0123" type="tel" inputMode="tel" autoFocus style={{ ...INPUT, fontSize: 22, letterSpacing: 1, textAlign: 'center' }} />
                <button onClick={() => setStep('contact')} disabled={!phoneOk} style={{ ...PRIMARY, opacity: phoneOk ? 1 : 0.45 }}>Continue</button>
              </>
            )}

            {step === 'contact' && (
              <>
                <p style={SHEETH}>Who&apos;s coming?</p>
                <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" autoFocus style={INPUT} />
                <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" type="email" style={INPUT} />
                <p style={{ color: '#6f747d', fontSize: 12.5, lineHeight: 1.5, margin: '2px 0 16px' }}>Your QR code{qty > 1 ? 's land' : ' lands'} in this inbox.</p>
                <button onClick={() => setStep('cart')} disabled={name.trim().length < 2 || !emailOk} style={{ ...PRIMARY, opacity: name.trim().length < 2 || !emailOk ? 0.45 : 1 }}>Review order</button>
                <button onClick={() => setStep('phone')} style={BACKBTN}>Back</button>
              </>
            )}

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

                {/* UPSELL: buy-X-get discount */}
                {bump && !bumpActive && qty >= bump.triggerQty && (
                  <div style={{ background: 'linear-gradient(135deg, #1a2f24, #0f1f18)', border: '1px solid rgba(61,220,132,0.35)', borderRadius: 16, padding: '15px 16px', marginBottom: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <span style={{ background: '#3ddc84', color: '#06331d', fontSize: 10, fontWeight: 800, letterSpacing: 1, padding: '3px 8px', borderRadius: 6 }}>GROUP DEAL</span>
                      <span style={{ color: '#3ddc84', fontSize: 12.5, fontWeight: 600 }}>Save {money(bump.discount)}</span>
                    </div>
                    <p style={{ color: '#fff', fontSize: 15.5, fontWeight: 600, margin: '6px 0 12px', lineHeight: 1.35 }}>
                      Add {bump.addQty} more &amp; take {money(bump.discount)} off the batch
                    </p>
                    <button onClick={() => setQty((q) => q + bump.addQty)} style={{ width: '100%', background: '#3ddc84', color: '#06331d', border: 'none', borderRadius: 12, padding: '13px 0', fontSize: 15, fontWeight: 800, cursor: 'pointer' }}>
                      ＋ Add {bump.addQty} &amp; save {money(bump.discount)}
                    </button>
                  </div>
                )}
                {bumpActive && (
                  <div style={{ background: 'rgba(61,220,132,0.1)', border: '1px solid rgba(61,220,132,0.35)', borderRadius: 12, padding: '10px 14px', marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: '#3ddc84', fontSize: 13.5, fontWeight: 600 }}>✓ Group deal — {money(bump!.discount)} off</span>
                    <button onClick={() => setQty(bump!.triggerQty)} style={{ background: 'none', border: 'none', color: '#8a8f98', fontSize: 12.5, cursor: 'pointer' }}>remove</button>
                  </div>
                )}

                {/* UPSELL: add-on product */}
                {addon && (
                  <div onClick={() => setAddonOn((v) => !v)}
                    style={{ background: addonOn ? 'rgba(194,91,110,0.14)' : '#141414', border: `1px solid ${addonOn ? ROSE : 'rgba(255,255,255,0.1)'}`, borderRadius: 16, padding: '14px 16px', marginBottom: 16, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 24, height: 24, borderRadius: 7, border: `2px solid ${addonOn ? ROSE : '#555'}`, background: addonOn ? ROSE : 'transparent', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 15 }}>{addonOn ? '✓' : ''}</div>
                    <div style={{ flex: 1 }}>
                      <p style={{ color: '#fff', fontSize: 14.5, fontWeight: 600, margin: '0 0 2px', lineHeight: 1.3 }}>{addon.pitch || `Make it a night — add ${addon.name}`}</p>
                      <p style={{ color: '#b9bec8', fontSize: 13, margin: 0 }}>{addon.name} · +{money(addon.price)}</p>
                    </div>
                  </div>
                )}

                {quote && (
                  <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 12, marginBottom: 8, opacity: loadingQuote ? 0.5 : 1, transition: 'opacity 0.15s' }}>
                    <Row l={`${quote.ticketTypeName} × ${qty}`} v={money(quote.faceValue + quote.discount - quote.addon)} />
                    {addonOn && addon && <Row l={addon.name} v={money(quote.addon)} />}
                    {quote.discount > 0 && <Row l="Group deal" v={`−${money(quote.discount)}`} green />}
                    {quote.buyerPaysFees && quote.serviceFee > 0 && <Row l="Service fee" v={money(quote.serviceFee)} dim />}
                    {quote.tax > 0 && <Row l="Tax" v={money(quote.tax)} dim />}
                    {quote.buyerPaysProcessing && <Row l="Processing" v={money(quote.processingFee)} dim />}
                    <div style={{ height: 1, background: 'rgba(255,255,255,0.08)', margin: '8px 0' }} />
                    <Row l="Total" v={money(quote.total)} big />
                  </div>
                )}
                {!quote && <div style={{ height: 120 }} />}

                <div style={{ background: '#141414', borderRadius: 12, padding: '12px 14px', margin: '4px 0 16px', border: '1px solid rgba(255,255,255,0.08)' }}>
                  <p style={{ color: '#8a8f98', fontSize: 12, margin: '0 0 4px', letterSpacing: 1 }}>DELIVERING TO</p>
                  <p style={{ color: '#fff', fontSize: 14, margin: 0, lineHeight: 1.6 }}>{name} · {phonePretty(phoneDigits(phone))}<br />{email}</p>
                  <button onClick={() => setStep('phone')} style={{ background: 'none', border: 'none', color: ROSE, fontSize: 12.5, padding: '6px 0 0', cursor: 'pointer', fontWeight: 600 }}>Edit</button>
                </div>

                {error && <p style={{ color: ROSE, fontSize: 13.5, margin: '0 0 14px' }}>{error}</p>}

                <button onClick={pay} disabled={!quote || loadingQuote || submitting} style={{ ...PRIMARY, opacity: !quote || loadingQuote || submitting ? 0.45 : 1 }}>
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

/* --- Live map: geocode the venue address, drop a pin on OSM tiles.
   No API key (works with static export). Tappable → opens full Maps app. --- */
function EventMap({ location }: { location: string }) {
  const [coords, setCoords] = useState<{ lat: number; lon: number } | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let stop = false;
    fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(location)}`, {
      headers: { 'Accept': 'application/json' },
    })
      .then((r) => r.json())
      .then((d) => { if (!stop) { if (d?.[0]) setCoords({ lat: +d[0].lat, lon: +d[0].lon }); else setFailed(true); } })
      .catch(() => { if (!stop) setFailed(true); });
    return () => { stop = true; };
  }, [location]);

  const mapsUrl = `https://maps.google.com/?q=${encodeURIComponent(location)}`;

  if (failed) {
    return (
      <a href={mapsUrl} target="_blank" rel="noreferrer"
        style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, height: 200, background: 'rgba(8,8,10,0.55)', borderRadius: 16, marginBottom: 30, textDecoration: 'none', border: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ width: 54, height: 54, borderRadius: '50%', background: `${ROSE}33`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ width: 20, height: 20, borderRadius: '50%', background: ROSE }} />
        </div>
        <span style={{ color: '#b9bec8', fontSize: 13 }}>Open in Maps</span>
      </a>
    );
  }
  if (!coords) {
    return <div style={{ height: 200, background: 'rgba(8,8,10,0.55)', borderRadius: 16, marginBottom: 30, border: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6f747d', fontSize: 13 }}>Loading map…</div>;
  }

  const d = 0.008;
  const bbox = `${coords.lon - d},${coords.lat - d},${coords.lon + d},${coords.lat + d}`;
  const src = `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${coords.lat},${coords.lon}`;

  return (
    <div style={{ position: 'relative', height: 220, borderRadius: 16, overflow: 'hidden', marginBottom: 30, border: '1px solid rgba(255,255,255,0.08)' }}>
      <iframe title="Event location" src={src} loading="lazy"
        style={{ width: '100%', height: '100%', border: 0, filter: 'grayscale(0.5) brightness(0.85)' }} />
      <a href={mapsUrl} target="_blank" rel="noreferrer"
        style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'flex-end', justifyContent: 'flex-end', padding: 12, textDecoration: 'none', background: 'linear-gradient(transparent 70%, rgba(0,0,0,0.35))' }}>
        <span style={{ background: 'rgba(0,0,0,0.75)', color: '#fff', fontSize: 12.5, fontWeight: 600, padding: '7px 13px', borderRadius: 20, border: '1px solid rgba(255,255,255,0.2)' }}>Get directions ↗</span>
      </a>
    </div>
  );
}

function Row({ l, v, dim, big, green }: { l: string; v: string; dim?: boolean; big?: boolean; green?: boolean }) {
  const color = green ? '#3ddc84' : dim ? '#8a8f98' : '#fff';
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', alignItems: 'baseline' }}>
      <span style={{ color, fontSize: big ? 17 : 14.5, fontWeight: big ? 700 : 400 }}>{l}</span>
      <span style={{ color, fontSize: big ? 22 : 14.5, fontWeight: big ? 800 : 500 }}>{v}</span>
    </div>
  );
}

const F = 'Helvetica Neue,Helvetica,Arial,sans-serif';
const SH: React.CSSProperties = { color: '#fff', fontSize: 25, fontWeight: 800, margin: '4px 0 16px', letterSpacing: -0.2 };
const SHEETH: React.CSSProperties = { color: '#fff', fontSize: 26, fontWeight: 800, margin: '4px 0 8px' };
const SHEETSUB: React.CSSProperties = { color: '#8a8f98', fontSize: 14.5, margin: '0 0 20px', lineHeight: 1.5 };
const QBTN: React.CSSProperties = { width: 54, height: 54, borderRadius: 14, background: '#1c1c1c', color: '#fff', border: 'none', fontSize: 26, cursor: 'pointer' };
const INPUT: React.CSSProperties = { width: '100%', height: 56, background: '#141414', color: '#fff', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 12, padding: '0 16px', fontSize: 17, outline: 'none', boxSizing: 'border-box', marginBottom: 12 };
const PRIMARY: React.CSSProperties = { width: '100%', background: '#f2f2f2', color: '#000', border: 'none', borderRadius: 28, padding: '17px 0', fontSize: 17, fontWeight: 700, cursor: 'pointer', marginTop: 6 };
const BACKBTN: React.CSSProperties = { width: '100%', background: 'none', border: 'none', color: '#8a8f98', fontSize: 15, padding: '14px 0 0', cursor: 'pointer' };
