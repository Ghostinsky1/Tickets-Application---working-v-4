'use client';

/*
  EVENT PAGE v4 — multi-event, desktop two-column, flyer-tinted background.
  Adds: per-event music player (press play), share button, logo, and cart
  upsells (buy-X-get discount + add-on product) shown as quick-click cards
  inside the cart step.
*/

import { useState, useEffect, useCallback, useRef } from 'react';
import { api, money, fmtDate, ORGANIZER, DEFAULT_EVENT_ID, BACKEND } from '@/lib/api';
import CardCheckout from './CardCheckout';
import { trackViewContent, trackInitiateCheckout, trackAddToCart, trackAddPaymentInfo, identifyUser, trackPageView } from '@/lib/track';

const ROSE = '#c25b6e';
const CARD = 'rgba(12,12,16,0.62)';

interface TicketType { id: string; name: string; price: number; remaining: number }
interface Bump { triggerQty: number; addQty: number; discount: number }
interface Addon { ticketTypeId: string; name: string; price: number; pitch: string }
interface Info {
  event: { id: string; name: string; date: string; endDate?: string | null; ageRestriction?: string | null; eventMode?: string; maxPerOrder?: number; hideVenue?: boolean; areaLabel?: string | null; location: string; imageUrl: string | null; description: string | null; musicUrl: string | null; logoUrl: string | null; buttonColor?: string; accentColor?: string; hasOffers?: boolean; dropAt?: string | null; dropHeadline?: string | null; faqs?: { q: string; a: string }[]; videoUrl?: string | null };
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

type Step = null | 'phone' | 'contact' | 'cart' | 'pay';


// Formats "Fri, Aug 22 · 10:00 PM – 3:00 AM" — shows end time if provided.

// Scale the title font so long event names fit instead of overflowing.
function titleSize(name: string): number {
  const n = (name || '').length;
  if (n <= 14) return 42;
  if (n <= 20) return 36;
  if (n <= 28) return 30;
  if (n <= 38) return 25;
  return 21;
}

function whenRange(startIso: string, endIso?: string | null): string {
  try {
    const start = new Date(startIso);
    const dateStr = start.toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    const startT = start.toLocaleString('en-US', { hour: 'numeric', minute: '2-digit' });
    if (!endIso) return `${dateStr} · ${startT}`;
    const end = new Date(endIso);
    const endT = end.toLocaleString('en-US', { hour: 'numeric', minute: '2-digit' });
    // if the event ends on a different calendar day, note it
    const sameDay = start.toDateString() === end.toDateString();
    const endLabel = sameDay ? endT : `${endT} (${end.toLocaleString('en-US', { weekday: 'short' })})`;
    return `${dateStr} · ${startT} – ${endLabel}`;
  } catch { return ''; }
}

export default function EventPage({ eventId = DEFAULT_EVENT_ID }: { eventId?: string }) {
  const [info, setInfo] = useState<Info | null>(null);
  const btn = info?.event?.buttonColor || '#c25b6e'; // themeable button color (event override -> site default)
  const accentCol = info?.event?.accentColor || '#c25b6e'; // themeable accent (date/labels/highlights)
  const maxPer = info?.event?.maxPerOrder || 10; // per-order ticket cap
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
  const [pk, setPk] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [playing, setPlaying] = useState(false);
  const [shared, setShared] = useState('');
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    trackPageView();
    // log a view to our own analytics (once per browser-session per event)
    try {
      const seenKey = `gz_viewed_${eventId}`;
      if (!sessionStorage.getItem(seenKey)) {
        sessionStorage.setItem(seenKey, '1');
        let hint = localStorage.getItem('gz_session_hint');
        if (!hint) { hint = Math.random().toString(36).slice(2, 12); localStorage.setItem('gz_session_hint', hint); }
        fetch(`${BACKEND}/track`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ eventId, sessionHint: hint }),
        }).catch(() => {});
      }
    } catch { /* storage blocked — skip view logging */ }
    // INSTANT LOAD: render the cached copy immediately (if we have one), then
    // refresh from the network in the background (stale-while-revalidate).
    // On bad internet the page appears instantly from cache; fresh data swaps in
    // whenever it arrives.
    const cacheKey = `gz_info_${eventId}`;
    try {
      const cached = sessionStorage.getItem(cacheKey);
      if (cached) {
        const d: Info = JSON.parse(cached);
        setInfo(d);
        if (d.ticketTypes[0]) setTtId((prev) => prev || d.ticketTypes[0].id);
      }
    } catch { /* bad cache — ignore */ }
    api(`/checkout?eventId=${eventId}&info=1`)
      .then((d: Info) => {
        setInfo(d);
        try { sessionStorage.setItem(cacheKey, JSON.stringify(d)); } catch { /* full */ }
        if (d.ticketTypes[0]) setTtId((prev) => prev || d.ticketTypes[0].id);
        const mp = d.ticketTypes.length ? Math.min(...d.ticketTypes.map((t) => t.price)) : 0;
        trackViewContent(d.event.id, d.event.name, mp);
      })
      .catch((e) => { try { if (!sessionStorage.getItem(cacheKey)) setLoadErr(e.message); } catch { setLoadErr(e.message); } });
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

  // Fire AddToCart once, when the buyer first reaches the cart step.
  const cartTracked = useRef(false);
  useEffect(() => {
    if (step === 'cart' && quote && !cartTracked.current) {
      cartTracked.current = true;
      trackAddToCart(eventId, ev?.name || '', quote.total, qty);
    }
    if (step !== 'cart') cartTracked.current = false;
  }, [step, quote, eventId, qty]); // eslint-disable-line react-hooks/exhaustive-deps

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
    if (quote) trackAddPaymentInfo(eventId, ev?.name || '', quote.total, qty);
    try {
      const payload = {
        eventId, ticketTypeId: ttId, quantity: qty,
        discount, addonTypeId: addonOn && addon ? addon.ticketTypeId : '',
        buyerName: name.trim(), buyerEmail: email.trim(), buyerPhone: `+1${phoneDigits(phone)}`,
      };
      // Free ($0) tickets: skip card entry, use the hosted checkout which handles $0.
      if (quote && quote.total <= 0) {
        const d = await api('/checkout', { method: 'POST', body: JSON.stringify(payload) });
        window.location.href = d.url;
        return;
      }
      // Paid: fetch the publishable key + create a PaymentIntent, then show the card form.
      const [cfg, pi] = await Promise.all([
        pk ? Promise.resolve({ publishableKey: pk }) : api('/payment-intent?config=1'),
        api('/payment-intent', { method: 'POST', body: JSON.stringify(payload) }),
      ]);
      if (pi.free) { // safety: server says $0
        const d = await api('/checkout', { method: 'POST', body: JSON.stringify(payload) });
        window.location.href = d.url;
        return;
      }
      setPk(cfg.publishableKey);
      setClientSecret(pi.clientSecret);
      setStep('pay');
      setSubmitting(false);
    } catch (e: any) { setError(e.message); setSubmitting(false); }
  };

  if (loadErr) {
    return (
      <div style={{ minHeight: '100vh', background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, fontFamily: F }}>
        <p style={{ color: '#8a8f98', fontSize: 15, textAlign: 'center' }}>This event isn&apos;t available.<br /><span style={{ fontSize: 12.5 }}>{loadErr}</span></p>
      </div>
    );
  }
  if (!ev) {
    // skeleton while first load is in flight (only shown when there's no cache yet)
    return (
      <div style={{ minHeight: '100vh', background: '#000', padding: '20px 18px' }}>
        <div style={{ maxWidth: 520, margin: '0 auto' }}>
          <div style={{ width: '100%', aspectRatio: '4/5', borderRadius: 20, background: 'linear-gradient(110deg, #0c0c10 30%, #17171d 50%, #0c0c10 70%)', backgroundSize: '200% 100%', animation: 'gzshimmer 1.2s infinite' }} />
          <div style={{ height: 28, width: '70%', borderRadius: 8, marginTop: 22, background: '#0f0f14' }} />
          <div style={{ height: 16, width: '45%', borderRadius: 8, marginTop: 12, background: '#0d0d11' }} />
          <style>{`@keyframes gzshimmer { 0% { background-position: 200% 0 } 100% { background-position: -200% 0 } }`}</style>
        </div>
      </div>
    );
  }

  // DROP / TEASER MODE — before tickets go on sale: flyer + countdown + phone signup.
  if (ev.eventMode === 'drop') {
    return <DropTeaser ev={ev} btn={btn} accentCol={accentCol} accent={accent} deep={deep} />;
  }

  const flyer = ev.imageUrl ? (
    <img fetchPriority="high" decoding="async" src={ev.imageUrl} alt={ev.name} style={{ width: '100%', display: 'block' }} />
  ) : (
    <div style={{ aspectRatio: '4/5', background: `radial-gradient(120% 90% at 50% 20%, ${accent} 0%, ${deep} 60%, #000 100%)`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14, padding: 24, textAlign: 'center' }}>
      <p style={{ color: '#fff', fontSize: 13, letterSpacing: 4, margin: 0, fontWeight: 500 }}>{fmtDate(ev.date).toUpperCase()}</p>
      <p style={{ color: accentCol, fontSize: titleSize(ev.name.split('—')[0].trim()), fontWeight: 800, letterSpacing: ev.name.length > 22 ? 0.5 : 2, margin: 0, lineHeight: 1.08, textShadow: `0 0 28px ${accentCol}66`, wordBreak: 'break-word' }}>{ev.name.split('—')[0].trim()}</p>
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
            style={{ width: '100%', marginTop: 22, background: btn, border: 'none', boxShadow: `0 0 24px ${btn}55`, color: '#fff', borderRadius: 30, padding: '16px 0', fontSize: 17, fontWeight: 700, cursor: allSoldOut ? 'default' : 'pointer', opacity: allSoldOut ? 0.55 : 1 }}>
            {allSoldOut ? 'SOLD OUT' : `Get Tickets from ${money(minPrice)}`}
          </button>
        </div>

        <div style={{ paddingBottom: 40 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '16px 0 14px' }}>
            {ev.logoUrl
              ? <img src={ev.logoUrl} alt={ORGANIZER.name} style={{ height: 30, maxWidth: 150, objectFit: 'contain' }} />
              : <>
                  <div style={{ width: 28, height: 28, borderRadius: '50%', background: accentCol, color: '#000', fontSize: 13, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>G</div>
                  <span style={{ color: '#fff', fontSize: 14, fontWeight: 600, letterSpacing: 0.5 }}>{ORGANIZER.name}</span>
                </>}
            <button onClick={share} style={{ marginLeft: 'auto', background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.16)', color: '#fff', borderRadius: 20, padding: '7px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 14 }}>↗</span> {shared || 'Share'}
            </button>
          </div>

          <h1 className="gz-title" style={{ color: '#fff', fontSize: 40, fontWeight: 800, lineHeight: 1.0, letterSpacing: -0.8, margin: '0 0 16px' }}>{ev.name.toUpperCase()}</h1>
          <p style={{ color: '#fff', fontSize: 19, fontWeight: 700, margin: '0 0 4px' }}>{ev.location}</p>
          <p style={{ color: '#b9bec8', fontSize: 17, margin: '0 0 12px' }}>{whenRange(ev.date, ev.endDate)}</p>
          {ev.ageRestriction && (
            <span style={{ display: 'inline-block', background: `${accentCol}22`, border: `1px solid ${accentCol}`, color: accentCol, fontSize: 13, fontWeight: 700, letterSpacing: 0.5, padding: '5px 12px', borderRadius: 20, marginBottom: 20 }}>
              {ev.ageRestriction === 'All ages' ? 'ALL AGES' : `${ev.ageRestriction} EVENT`}
            </span>
          )}
          {!ev.ageRestriction && <div style={{ marginBottom: 20 }} />}

          <SocialProof eventId={eventId} accent={accentCol} paused={step !== null} />

          <div style={{ background: CARD, backdropFilter: 'blur(8px)', borderRadius: 16, padding: '18px 18px 14px', marginBottom: 28, border: '1px solid rgba(255,255,255,0.07)' }}>
            <p style={{ color: '#fff', fontSize: 15, fontWeight: 600, letterSpacing: 0.5, margin: 0 }}>TICKETS FROM {money(minPrice)}</p>
            <div style={{ height: 1, background: 'rgba(255,255,255,0.09)', margin: '16px 0 14px' }} />
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <p style={{ color: '#fff', fontSize: 15, fontWeight: 600, margin: '0 0 3px' }}>Guest list</p>
                <p style={{ color: '#b9bec8', fontSize: 14, margin: 0 }}>Be there</p>
              </div>
              <button onClick={open} style={{ background: btn, color: '#fff', border: 'none', borderRadius: 22, padding: '11px 22px', fontSize: 14.5, fontWeight: 600, cursor: 'pointer' }}>Get in</button>
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
          {ev.hideVenue ? (
            <div style={{ background: `${accentCol}18`, border: `1px solid ${accentCol}`, borderRadius: 14, padding: '14px 16px', marginBottom: 26 }}>
              <p style={{ color: '#fff', fontSize: 14.5, fontWeight: 700, margin: '0 0 4px' }}>📍 Secret location</p>
              <p style={{ color: '#b9bec8', fontSize: 13.5, margin: 0, lineHeight: 1.5 }}>Exact address drops the day of the show — check your email &amp; text, and it&apos;ll appear right here.</p>
            </div>
          ) : (
            <EventMap location={ev.location} />
          )}

          {ev.videoUrl && (
            <>
              <p style={SH}>The vibe</p>
              <VideoPreview url={ev.videoUrl} poster={ev.imageUrl} accent={accentCol} />
            </>
          )}

          {Array.isArray(ev.faqs) && ev.faqs.length > 0 && (
            <>
              <p style={SH}>Questions</p>
              <div style={{ marginBottom: 26 }}>
                {ev.faqs.map((f: any, i: number) => <FaqItem key={i} q={f.q} a={f.a} accent={accentCol} />)}
              </div>
            </>
          )}

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
          style={{ display: 'block', width: '100%', maxWidth: 520, margin: '0 auto', background: btn, color: '#fff', border: 'none', borderRadius: 14, padding: '17px 0', fontSize: 17, fontWeight: 700, letterSpacing: 0.5, cursor: 'pointer', opacity: allSoldOut ? 0.5 : 1 }}>
          {allSoldOut ? 'SOLD OUT' : 'GET TICKETS'}
        </button>
      </div>

      {step && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 50, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }} onClick={() => !submitting && setStep(null)}>
          <div style={{ width: '100%', maxWidth: 520, background: '#0b0b0b', borderRadius: '22px 22px 0 0', maxHeight: '92vh', display: 'flex', flexDirection: 'column', overscrollBehavior: 'contain' }} onClick={(e) => e.stopPropagation()}>
            {/* fixed header: grabber + close, never scrolls, always tappable */}
            <div style={{ flexShrink: 0, padding: '10px 22px 0', position: 'relative' }}>
              <div style={{ width: 40, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.25)', margin: '0 auto 14px' }} />
              <button onClick={() => { if (!submitting) setStep(null); }} type="button"
                style={{ position: 'absolute', top: 8, right: 14, width: 40, height: 40, borderRadius: '50%', background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff', fontSize: 18, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2 }} aria-label="Close">✕</button>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '4px 22px calc(26px + env(safe-area-inset-bottom))', overscrollBehavior: 'contain' }}>

            <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
              {(['phone', 'contact', 'cart', 'pay'] as const).map((s) => (
                <div key={s} style={{ height: 4, flex: 1, borderRadius: 2, background: step === s ? btn : (['phone','contact','cart','pay'].indexOf(step) > ['phone','contact','cart','pay'].indexOf(s) ? `${btn}88` : 'rgba(255,255,255,0.12)') }} />
              ))}
            </div>

            <HoldTimer accent={accentCol} />

            {step === 'phone' && (
              <>
                <p style={SHEETH}>What&apos;s your number?</p>
                <p style={SHEETSUB}>We text your confirmation + receipt here after you pay.</p>
                <input value={phonePretty(phoneDigits(phone))} onChange={(e) => setPhone(e.target.value)} placeholder="(314) 555-0123" type="tel" inputMode="tel" autoFocus style={{ ...INPUT, fontSize: 22, letterSpacing: 1, textAlign: 'center' }} />
                <button onClick={() => setStep('contact')} disabled={!phoneOk} style={{ ...PRIMARY, background: btn, color: '#fff', opacity: phoneOk ? 1 : 0.45 }}>Continue</button>
              </>
            )}

            {step === 'contact' && (
              <>
                <p style={SHEETH}>Who&apos;s coming?</p>
                <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" autoFocus style={INPUT} />
                <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" type="email" style={INPUT} />
                <p style={{ color: '#6f747d', fontSize: 12.5, lineHeight: 1.5, margin: '2px 0 16px' }}>Your QR code{qty > 1 ? 's land' : ' lands'} in this inbox.</p>
                <button onClick={() => { identifyUser(email, `+1${phoneDigits(phone)}`); try { fetch(`${BACKEND}/leads`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ eventId, name, phone: `+1${phoneDigits(phone)}`, email }), keepalive: true }); } catch {} setStep('cart'); }} disabled={name.trim().length < 2 || !emailOk} style={{ ...PRIMARY, background: btn, color: '#fff', opacity: name.trim().length < 2 || !emailOk ? 0.45 : 1 }}>Review order</button>
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
                        style={{ background: ttId === t.id ? accentCol : '#1c1c1c', color: '#fff', border: 'none', borderRadius: 12, padding: '10px 16px', fontSize: 13.5, fontWeight: 600, cursor: 'pointer', opacity: t.remaining <= 0 ? 0.4 : 1 }}>
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
                  <button onClick={() => setQty((q) => Math.min(maxPer, q + 1))} style={QBTN} aria-label="More">+</button>
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
                    style={{ background: addonOn ? `${accentCol}24` : '#141414', border: `1px solid ${addonOn ? accentCol : 'rgba(255,255,255,0.1)'}`, borderRadius: 16, padding: '14px 16px', marginBottom: 16, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 24, height: 24, borderRadius: 7, border: `2px solid ${addonOn ? accentCol : '#555'}`, background: addonOn ? accentCol : 'transparent', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 15 }}>{addonOn ? '✓' : ''}</div>
                    <div style={{ flex: 1 }}>
                      <p style={{ color: '#fff', fontSize: 14.5, fontWeight: 600, margin: '0 0 2px', lineHeight: 1.3 }}>{addon.pitch || `Make it a night — add ${addon.name}`}</p>
                      <p style={{ color: '#b9bec8', fontSize: 13, margin: 0 }}>{addon.name} · +{money(addon.price)}</p>
                    </div>
                  </div>
                )}

                <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 12, marginBottom: 8 }}>
                  {quote ? (
                    <div style={{ opacity: loadingQuote ? 0.55 : 1, transition: 'opacity 0.12s' }}>
                      <Row l={`${quote.ticketTypeName} × ${qty}`} v={money(quote.faceValue + quote.discount - quote.addon)} />
                      {addonOn && addon && <Row l={addon.name} v={money(quote.addon)} />}
                      {quote.discount > 0 && <Row l="Group deal" v={`−${money(quote.discount)}`} green />}
                      {quote.buyerPaysFees && quote.serviceFee > 0 && <Row l="Service fee" v={money(quote.serviceFee)} dim />}
                      {quote.tax > 0 && <Row l="Tax" v={money(quote.tax)} dim />}
                      {quote.buyerPaysProcessing && <Row l="Processing" v={money(quote.processingFee)} dim />}
                      <div style={{ height: 1, background: 'rgba(255,255,255,0.08)', margin: '8px 0' }} />
                      <Row l="Total" v={money(quote.total)} big />
                    </div>
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 70, color: '#6f747d', fontSize: 14 }}>Calculating…</div>
                  )}
                </div>

                <div style={{ background: '#141414', borderRadius: 12, padding: '12px 14px', margin: '4px 0 16px', border: '1px solid rgba(255,255,255,0.08)' }}>
                  <p style={{ color: '#8a8f98', fontSize: 12, margin: '0 0 4px', letterSpacing: 1 }}>DELIVERING TO</p>
                  <p style={{ color: '#fff', fontSize: 14, margin: 0, lineHeight: 1.6 }}>{name} · {phonePretty(phoneDigits(phone))}<br />{email}</p>
                  <button onClick={() => setStep('phone')} style={{ background: 'none', border: 'none', color: accentCol, fontSize: 12.5, padding: '6px 0 0', cursor: 'pointer', fontWeight: 600 }}>Edit</button>
                </div>

                {error && <p style={{ color: accentCol, fontSize: 13.5, margin: '0 0 14px' }}>{error}</p>}

                <button onClick={pay} disabled={!quote || loadingQuote || submitting} style={{ ...PRIMARY, background: btn, color: '#fff', opacity: !quote || loadingQuote || submitting ? 0.45 : 1 }}>
                  {submitting ? 'Loading payment…' : quote ? `Continue to payment · ${money(quote.total)}` : 'Pay'}
                </button>
                <button onClick={() => setStep('contact')} disabled={submitting} style={BACKBTN}>Back</button>
                <p style={{ color: '#6f747d', fontSize: 11.5, textAlign: 'center', margin: '12px 0 0' }}>Card handled securely by Stripe. We never see your number.</p>
              </>
            )}

            {step === 'pay' && (
              <>
                <p style={SHEETH}>Payment</p>
                {quote && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', background: '#141418', borderRadius: 12, padding: '12px 14px', margin: '0 0 18px', border: '1px solid rgba(255,255,255,0.08)' }}>
                    <span style={{ color: '#b9bec8', fontSize: 14 }}>{qty} {qty > 1 ? 'tickets' : 'ticket'} · {ev.name}</span>
                    <span style={{ color: '#fff', fontSize: 18, fontWeight: 800 }}>{money(quote.total)}</span>
                  </div>
                )}
                {error && <p style={{ color: accentCol, fontSize: 13.5, margin: '0 0 14px' }}>{error}</p>}
                {pk && clientSecret ? (
                  <CardCheckout
                    publishableKey={pk}
                    clientSecret={clientSecret}
                    btn={btn}
                    returnUrl={typeof window !== 'undefined' ? window.location.origin + (ev.hasOffers ? '/offer' : '/thanks') : '/thanks'}
                    onError={setError}
                  />
                ) : (
                  <p style={{ color: '#8a8f98', fontSize: 14, textAlign: 'center', padding: '20px 0' }}>Loading secure payment…</p>
                )}
                <button onClick={() => { setStep('cart'); setError(''); }} style={BACKBTN}>Back</button>
                <p style={{ color: '#6f747d', fontSize: 11.5, textAlign: 'center', margin: '12px 0 0' }}>Payments secured by Stripe.</p>
              </>
            )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* --- Live map: geocode the venue address, drop a pin on OSM tiles.
   No API key (works with static export). Tappable → opens full Maps app. --- */

/* ---------- VIDEO PREVIEW (click-to-play: zero cost until tapped) ----------
   Supports YouTube, Vimeo, and direct .mp4 links. Shows the flyer (or a dark
   card) with a play button; the actual player only loads when tapped, so slow
   connections never download video bytes they didn't ask for. */
function videoEmbed(url: string): { type: 'iframe' | 'video'; src: string } | null {
  try {
    const u = new URL(url);
    const host = u.hostname.replace('www.', '');
    if (host.includes('youtube.com') || host === 'youtu.be') {
      const id = host === 'youtu.be' ? u.pathname.slice(1) : (u.searchParams.get('v') || u.pathname.split('/').pop() || '');
      if (id) return { type: 'iframe', src: `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&playsinline=1` };
    }
    if (host.includes('vimeo.com')) {
      const id = u.pathname.split('/').filter(Boolean).pop();
      if (id) return { type: 'iframe', src: `https://player.vimeo.com/video/${id}?autoplay=1` };
    }
    if (/\.(mp4|webm|mov)(\?|$)/i.test(url)) return { type: 'video', src: url };
    return { type: 'iframe', src: url }; // last resort: try embedding as-is
  } catch { return null; }
}
function VideoPreview({ url, poster, accent }: { url: string; poster: string | null; accent: string }) {
  const [playing, setPlaying] = useState(false);
  const embed = videoEmbed(url);
  if (!embed) return null;
  return (
    <div style={{ position: 'relative', width: '100%', aspectRatio: '16/9', borderRadius: 16, overflow: 'hidden', marginBottom: 26, background: '#0c0c10', border: '1px solid rgba(255,255,255,0.08)' }}>
      {!playing ? (
        <button onClick={() => setPlaying(true)} aria-label="Play video"
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 'none', cursor: 'pointer', padding: 0, background: '#000' }}>
          {poster && <img src={poster} alt="" loading="lazy" decoding="async" style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.55, display: 'block' }} />}
          <span style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 68, height: 68, borderRadius: '50%', background: accent, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 30px rgba(0,0,0,0.6)' }}>
            <span style={{ width: 0, height: 0, borderTop: '12px solid transparent', borderBottom: '12px solid transparent', borderLeft: '20px solid #fff', marginLeft: 5 }} />
          </span>
          <span style={{ position: 'absolute', bottom: 12, left: 0, right: 0, textAlign: 'center', color: '#fff', fontSize: 13, fontWeight: 700, letterSpacing: 1 }}>TAP TO FEEL THE VIBE</span>
        </button>
      ) : embed.type === 'video' ? (
        <video src={embed.src} controls autoPlay playsInline style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      ) : (
        <iframe src={embed.src} title="Event video" allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
          style={{ width: '100%', height: '100%', border: 'none' }} loading="lazy" />
      )}
    </div>
  );
}

/* ---------- FAQ ITEM (tap to expand) ---------- */
function FaqItem({ q, a, accent }: { q: string; a: string; accent: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, marginBottom: 8, overflow: 'hidden' }}>
      <button onClick={() => setOpen(!open)}
        style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, background: 'none', border: 'none', padding: '14px 16px', cursor: 'pointer', textAlign: 'left' }}>
        <span style={{ color: '#fff', fontSize: 14.5, fontWeight: 700, lineHeight: 1.35 }}>{q}</span>
        <span style={{ color: accent, fontSize: 18, fontWeight: 800, flexShrink: 0, transform: open ? 'rotate(45deg)' : 'none', transition: 'transform 0.15s' }}>+</span>
      </button>
      {open && (
        <p style={{ color: '#b9bec8', fontSize: 13.5, lineHeight: 1.6, margin: 0, padding: '0 16px 14px', whiteSpace: 'pre-wrap' }}>{a}</p>
      )}
    </div>
  );
}

/* ---------- SOCIAL PROOF (Posh-style) ----------
   Loaded AFTER first paint (separate tiny request, never blocks the page).
   1. Avatar stack + "🔥 122 are in!" — real attendee count, real profile pics,
      colored-initial circles for buyers without pics. Hidden below 5 so a new
      event never looks empty.
   2. "Recently bought" toasts — rotates through real recent purchases/RSVPs:
      first name + city (when known) + qty + time ago. One at a time, bottom-left,
      auto-dismisses. Pure hype, zero interaction needed. */
const INITIAL_COLORS = ['#c25b6e', '#7c5cff', '#2f9e6e', '#d98324', '#3b82c4', '#b8476b'];
function InitialCircle({ name, size, idx }: { name: string; size: number; idx: number }) {
  return (
    <span style={{ width: size, height: size, borderRadius: '50%', background: INITIAL_COLORS[idx % INITIAL_COLORS.length], display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: size * 0.42, fontWeight: 800, border: '2px solid #000', flexShrink: 0 }}>
      {(name || '?').charAt(0).toUpperCase()}
    </span>
  );
}
function SocialProof({ eventId, accent, paused }: { eventId: string; accent: string; paused?: boolean }) {
  const [data, setData] = useState<any>(null);
  const [toastIdx, setToastIdx] = useState(-1);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let stop = false;
    // small delayed fetch so it never competes with the main page load
    const t = setTimeout(() => {
      fetch(`${BACKEND}/social?eventId=${eventId}`).then((r) => r.json()).then((d) => { if (!stop && !d.error) setData(d); }).catch(() => {});
    }, 900);
    return () => { stop = true; clearTimeout(t); };
  }, [eventId]);

  // rotate the "recently bought" toasts: first after 4s, then every 13s, each shown 5.5s
  useEffect(() => {
    if (!data?.recent?.length || paused) { setVisible(false); return; }
    let i = 0; let stop = false;
    const showNext = () => {
      if (stop) return;
      setToastIdx(i % data.recent.length); setVisible(true);
      setTimeout(() => { if (!stop) setVisible(false); }, 5500);
      i += 1;
    };
    const first = setTimeout(showNext, 4000);
    const loop = setInterval(showNext, 13000);
    return () => { stop = true; clearTimeout(first); clearInterval(loop); };
  }, [data, paused]);

  if (!data) return null;
  const { count, recent, avatars } = data;
  const stack: { avatar?: string; name?: string }[] = [
    ...(avatars || []).slice(0, 4).map((a: string) => ({ avatar: a })),
    ...(recent || []).filter((r: any) => !r.avatar).slice(0, Math.max(0, 4 - (avatars || []).length)).map((r: any) => ({ name: r.name })),
  ].slice(0, 4);
  const toast = toastIdx >= 0 ? recent[toastIdx] : null;

  return (
    <>
      {count >= 5 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
          {stack.length > 0 && (
            <span style={{ display: 'inline-flex' }}>
              {stack.map((s, i) => (
                <span key={i} style={{ marginLeft: i === 0 ? 0 : -10, zIndex: 4 - i, display: 'inline-flex' }}>
                  {s.avatar
                    ? <img src={s.avatar} alt="" loading="lazy" decoding="async" style={{ width: 30, height: 30, borderRadius: '50%', objectFit: 'cover', border: '2px solid #000', display: 'block' }} />
                    : <InitialCircle name={s.name || '?'} size={30} idx={i} />}
                </span>
              ))}
            </span>
          )}
          <span style={{ color: '#fff', fontSize: 14.5, fontWeight: 800 }}>
            🔥 {count} are in!
          </span>
        </div>
      )}

      {toast && !paused && (
        <div style={{
          position: 'fixed', left: 14, bottom: 'calc(84px + env(safe-area-inset-bottom))', zIndex: 60,
          display: 'flex', alignItems: 'center', gap: 10,
          background: 'rgba(12,12,16,0.94)', backdropFilter: 'blur(10px)',
          border: `1px solid ${accent}55`, borderRadius: 14, padding: '10px 14px 10px 10px',
          boxShadow: '0 10px 30px rgba(0,0,0,0.55)', maxWidth: 300,
          transform: visible ? 'translateY(0)' : 'translateY(14px)',
          opacity: visible ? 1 : 0, pointerEvents: 'none',
          transition: 'opacity 0.35s ease, transform 0.35s ease',
        }}>
          {toast.avatar
            ? <img src={toast.avatar} alt="" style={{ width: 34, height: 34, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
            : <InitialCircle name={toast.name} size={34} idx={toastIdx} />}
          <span style={{ lineHeight: 1.35 }}>
            <span style={{ display: 'block', color: '#fff', fontSize: 13, fontWeight: 800 }}>
              {toast.name}{toast.city ? ` from ${toast.city}` : ''}
            </span>
            <span style={{ display: 'block', color: '#9aa0aa', fontSize: 12 }}>
              {toast.qty > 1 ? `grabbed ${toast.qty} tickets` : 'grabbed a ticket'} · {toast.when}
            </span>
          </span>
        </div>
      )}
    </>
  );
}

/* ---------- HOLD TIMER (checkout urgency: "tickets held for 7:59") ---------- */
function HoldTimer({ accent }: { accent: string }) {
  const [left, setLeft] = useState(8 * 60);
  useEffect(() => {
    const t = setInterval(() => setLeft((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, []);
  const mm = Math.floor(left / 60);
  const ss = String(left % 60).padStart(2, '0');
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, background: `${accent}14`, border: `1px solid ${accent}44`, borderRadius: 10, padding: '8px 12px', marginBottom: 16 }}>
      <span style={{ fontSize: 13 }}>⏱</span>
      {left > 0 ? (
        <span style={{ color: '#fff', fontSize: 12.5, fontWeight: 600 }}>
          Tickets held for <span style={{ color: accent, fontVariantNumeric: 'tabular-nums', fontWeight: 800 }}>{mm}:{ss}</span>
        </span>
      ) : (
        <span style={{ color: '#fff', fontSize: 12.5, fontWeight: 600 }}>High demand — complete your order to lock it in</span>
      )}
    </div>
  );
}

/* ---------- DROP / TEASER MODE (pre-sale phone capture + countdown) ---------- */
function DropTeaser({ ev, btn, accentCol, accent, deep }: { ev: any; btn: string; accentCol: string; accent: string; deep: string }) {
  const [phone, setPhone] = useState('');
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [signups, setSignups] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    fetch(`${BACKEND}/drop?info=1&eventId=${ev.id}`).then((r) => r.json()).then((d) => {
      if (typeof d.signups === 'number') setSignups(d.signups);
      // if the drop already went live, reload into the normal ticket page
      if (d.live && d.eventMode === 'ticketed') window.location.reload();
    }).catch(() => {});
  }, [ev.id]);

  const dropAt = ev.dropAt ? new Date(ev.dropAt).getTime() : null;
  const remaining = dropAt ? Math.max(0, dropAt - now) : null;
  const dd = remaining != null ? Math.floor(remaining / 86400000) : 0;
  const hh = remaining != null ? Math.floor((remaining % 86400000) / 3600000) : 0;
  const mm = remaining != null ? Math.floor((remaining % 3600000) / 60000) : 0;
  const ss = remaining != null ? Math.floor((remaining % 60000) / 1000) : 0;
  const liveNow = dropAt != null && remaining === 0;

  const submit = async () => {
    const digits = phone.replace(/\D/g, '');
    if (digits.length < 10) { setErr('Enter a valid phone number'); return; }
    setBusy(true); setErr('');
    try {
      const r = await fetch(`${BACKEND}/drop`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventId: ev.id, phone }),
      }).then((x) => x.json());
      if (r.error) throw new Error(r.error);
      if (typeof r.signups === 'number') setSignups(r.signups);
      setDone(true);
    } catch (e: any) { setErr(e.message || 'Something went wrong'); }
    finally { setBusy(false); }
  };

  const Box = ({ v, l }: { v: number; l: string }) => (
    <div style={{ textAlign: 'center', minWidth: 62 }}>
      <div style={{ background: 'rgba(255,255,255,0.06)', border: `1px solid ${accentCol}55`, borderRadius: 14, padding: '14px 0', fontSize: 34, fontWeight: 800, color: '#fff', fontVariantNumeric: 'tabular-nums' }}>
        {String(v).padStart(2, '0')}
      </div>
      <div style={{ fontSize: 10.5, letterSpacing: 2, color: '#9aa0aa', marginTop: 6, textTransform: 'uppercase' }}>{l}</div>
    </div>
  );

  return (
    <div style={{ minHeight: '100vh', fontFamily: F, background: `radial-gradient(130% 100% at 50% 0%, ${accent} 0%, ${deep} 55%, #000 100%)`, backgroundAttachment: 'fixed' }}>
      <div style={{ maxWidth: 520, margin: '0 auto', padding: '20px 18px 60px' }}>
        {ev.imageUrl && (
          <img src={ev.imageUrl} alt={ev.name} style={{ width: '100%', borderRadius: 20, display: 'block', marginBottom: 22, boxShadow: '0 20px 60px rgba(0,0,0,0.5)' }} />
        )}

        <p style={{ color: accentCol, fontSize: 12, letterSpacing: 4, fontWeight: 700, margin: '0 0 8px', textTransform: 'uppercase' }}>
          {liveNow ? '🎟️ Tickets are live' : '🔒 Coming soon'}
        </p>
        <h1 style={{ color: '#fff', fontSize: titleSize(ev.name.split('—')[0].trim()), fontWeight: 800, lineHeight: 1.08, margin: '0 0 10px', wordBreak: 'break-word' }}>
          {ev.name.split('—')[0].trim()}
        </h1>
        {ev.dropHeadline && (
          <p style={{ color: '#c9ccd4', fontSize: 15.5, lineHeight: 1.5, margin: '0 0 22px' }}>{ev.dropHeadline}</p>
        )}

        {remaining != null && !liveNow && (
          <>
            <p style={{ color: '#9aa0aa', fontSize: 12, letterSpacing: 3, margin: '10px 0 12px', textTransform: 'uppercase' }}>Tickets drop in</p>
            <div style={{ display: 'flex', gap: 10, marginBottom: 28 }}>
              <Box v={dd} l="Days" /><Box v={hh} l="Hrs" /><Box v={mm} l="Min" /><Box v={ss} l="Sec" />
            </div>
          </>
        )}

        {!done ? (
          <div style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 18, padding: 22 }}>
            <p style={{ color: '#fff', fontSize: 18, fontWeight: 800, margin: '0 0 4px' }}>Get the info first 🔥</p>
            <p style={{ color: '#9aa0aa', fontSize: 13.5, margin: '0 0 16px', lineHeight: 1.5 }}>
              Drop your number — we text you the second tickets go live. First dibs, before it&apos;s public.
            </p>
            <input
              value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" placeholder="Your number"
              onKeyDown={(e) => { if (e.key === 'Enter') submit(); }}
              style={{ width: '100%', boxSizing: 'border-box', background: '#0e0e12', border: `1px solid ${err ? '#ff6b6b' : 'rgba(255,255,255,0.15)'}`, borderRadius: 12, padding: '15px 16px', color: '#fff', fontSize: 16, marginBottom: 12, outline: 'none' }}
            />
            {err && <p style={{ color: '#ff8585', fontSize: 13, margin: '0 0 12px' }}>{err}</p>}
            <button onClick={submit} disabled={busy}
              style={{ width: '100%', background: btn, color: '#fff', border: 'none', borderRadius: 12, padding: '15px 0', fontSize: 16, fontWeight: 800, cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.6 : 1 }}>
              {busy ? 'Adding you…' : liveNow ? 'NOTIFY ME' : 'NOTIFY ME WHEN LIVE'}
            </button>
            <p style={{ color: '#6f747d', fontSize: 11, margin: '12px 0 0', lineHeight: 1.5, textAlign: 'center' }}>
              By signing up you agree to receive texts from Goza Entertainment. Msg &amp; data rates may apply. Reply STOP to opt out.
            </p>
          </div>
        ) : (
          <div style={{ background: `${accentCol}15`, border: `1px solid ${accentCol}`, borderRadius: 18, padding: 26, textAlign: 'center' }}>
            <div style={{ fontSize: 40, marginBottom: 8 }}>🎉</div>
            <p style={{ color: '#fff', fontSize: 20, fontWeight: 800, margin: '0 0 6px' }}>You&apos;re on the list.</p>
            <p style={{ color: '#c9ccd4', fontSize: 14.5, margin: 0, lineHeight: 1.5 }}>
              We&apos;ll text you the moment tickets drop — before anyone else. Check for our confirmation text. 🔥
            </p>
          </div>
        )}

        {signups != null && signups > 3 && (
          <p style={{ color: '#9aa0aa', fontSize: 13, textAlign: 'center', margin: '18px 0 0' }}>
            🔥 <strong style={{ color: '#fff' }}>{signups}</strong> already waiting
          </p>
        )}

        <p style={{ color: '#5a5f68', fontSize: 12, textAlign: 'center', margin: '30px 0 0', letterSpacing: 1 }}>{ORGANIZER.name}</p>
      </div>
    </div>
  );
}

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
        <div style={{ width: 54, height: 54, borderRadius: '50%', background: 'rgba(194,91,110,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ width: 20, height: 20, borderRadius: '50%', background: '#c25b6e' }} />
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
