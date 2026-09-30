'use client';

/* BAR — the bartender's till.
   Flow: enter station code once → tap products → scan the guest → charge.
   Prices come from the server, never from this screen, so a tampered phone
   can't invent a cheap beer. Nothing here can move money between people. */

import { useState, useEffect, useRef, useCallback } from 'react';
import { BACKEND } from '@/lib/api';

const C = {
  bg: '#07080C', card: '#141821', line: '#232936',
  blue: '#1140F0', green: '#4ADE80', bad: '#FF6B6B', warn: '#FFB86B', muted: '#9AA5B5',
};
const FD = "'Archivo Black',Impact,Haettenschweiler,sans-serif";
const FL = "'Chakra Petch','Trebuchet MS',sans-serif";
const F = "'Saira Condensed','Arial Narrow',Helvetica,Arial,sans-serif";
const money = (c: number) => `$${(c / 100).toFixed(2)}`;

const CODE_KEY = 'gz_bar_code';
const EVENT_KEY = 'gz_bar_event';

export default function Bar() {
  const [code, setCode] = useState('');
  const [eventId, setEventId] = useState('');
  const [events, setEvents] = useState<any[]>([]);
  const [ready, setReady] = useState(false);
  const [staffLabel, setStaffLabel] = useState('');
  const [station, setStation] = useState('');
  const [products, setProducts] = useState<any[]>([]);
  const [cart, setCart] = useState<Record<string, number>>({});
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [guest, setGuest] = useState<any>(null);
  const [tipPct, setTipPct] = useState(0);
  const [done, setDone] = useState<any>(null);
  const qrRef = useRef<any>(null);

  // events list for the setup screen
  useEffect(() => {
    fetch(`${BACKEND}/checkout?events=1`).then((r) => r.json())
      .then((d) => setEvents(d.events || [])).catch(() => {});
    try {
      const c = localStorage.getItem(CODE_KEY) || '';
      const e = localStorage.getItem(EVENT_KEY) || '';
      if (c) setCode(c);
      if (e) setEventId(e);
    } catch {}
  }, []);

  const loadMenu = useCallback(async (theCode: string, theEvent: string) => {
    setErr(''); setBusy(true);
    try {
      const r = await fetch(`${BACKEND}/bar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-staff-code': theCode },
        body: JSON.stringify({ action: 'menu', eventId: theEvent }),
      }).then((x) => x.json());
      if (r.error) { setErr(r.error); return false; }
      setProducts(r.products || []);
      setStaffLabel(r.staff || '');
      setStation(r.station || '');
      setReady(true);
      try { localStorage.setItem(CODE_KEY, theCode); localStorage.setItem(EVENT_KEY, theEvent); } catch {}
      return true;
    } catch { setErr('Could not load the menu — check signal'); return false; }
    finally { setBusy(false); }
  }, []);

  const cartLines = products.filter((p) => cart[p.id] > 0)
    .map((p) => ({ ...p, qty: cart[p.id], cents: Math.round(Number(p.price) * 100) * cart[p.id] }));
  const totalCents = cartLines.reduce((a, l) => a + l.cents, 0);
  const tipCents = Math.round(totalCents * (tipPct / 100));
  const grandCents = totalCents + tipCents;
  const bump = (id: string, by: number) =>
    setCart((c) => { const n = Math.max(0, (c[id] || 0) + by); const out = { ...c }; if (n === 0) delete out[id]; else out[id] = n; return out; });

  // ---- scan the guest ----
  const startScan = async () => {
    setErr(''); setGuest(null); setScanning(true);
    try {
      const { Html5Qrcode, Html5QrcodeSupportedFormats } = await import('html5-qrcode');
      const qr = new Html5Qrcode('gz-bar-reader', { formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE], verbose: false });
      qrRef.current = qr;
      await qr.start({ facingMode: 'environment' }, {
        fps: 20, qrbox: undefined, disableFlip: true,
        videoConstraints: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 }, advanced: [{ focusMode: 'continuous' } as any] },
        experimentalFeatures: { useBarCodeDetectorIfSupported: true },
      } as any, onScan, () => {});
    } catch (e: any) { setScanning(false); setErr(`Camera failed: ${e?.message || e}`); }
  };
  const stopScan = async () => {
    try { await qrRef.current?.stop(); await qrRef.current?.clear(); } catch {}
    qrRef.current = null; setScanning(false);
  };
  const onScan = async (token: string) => {
    await stopScan();
    setBusy(true); setErr('');
    try {
      const r = await fetch(`${BACKEND}/bar`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'x-staff-code': code },
        body: JSON.stringify({ action: 'lookup', eventId, token }),
      }).then((x) => x.json());
      if (r.error) { setErr(r.error); return; }
      setGuest(r);
    } catch { setErr('Could not look that up — check signal'); }
    finally { setBusy(false); }
  };

  const charge = async () => {
    if (!guest || !cartLines.length) return;
    setBusy(true); setErr('');
    try {
      const r = await fetch(`${BACKEND}/bar`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'x-staff-code': code },
        body: JSON.stringify({
          action: 'charge', eventId, customerId: guest.customerId,
          items: cartLines.map((l) => ({ productId: l.id, qty: l.qty })),
          tipCents: Math.round(totalCents * (tipPct / 100)),
        }),
      }).then((x) => x.json());
      if (r.error) { setErr(r.short ? `${r.error} — they have ${r.balance}, need ${r.needed} (short ${r.short})` : r.error); return; }
      setDone({ charged: r.charged, tip: r.tip, remaining: r.remaining, name: guest.name });
      setTipPct(0);
      setCart({}); setGuest(null);
      setTimeout(() => setDone(null), 3500);
    } catch { setErr('Charge failed — check signal'); }
    finally { setBusy(false); }
  };

  // ---------- SETUP ----------
  if (!ready) {
    return (
      <div style={{ minHeight: '100vh', background: C.bg, color: '#fff', fontFamily: F, padding: '48px 22px' }}>
        <div style={{ maxWidth: 420, margin: '0 auto' }}>
          <p style={{ fontFamily: FL, fontSize: 11, letterSpacing: 3, color: C.muted, margin: '0 0 6px' }}>GOZA ENTERTAINMENT</p>
          <h1 style={{ fontFamily: FD, fontSize: 30, margin: '0 0 26px', textTransform: 'uppercase' }}>Bar</h1>

          <label style={{ display: 'block', fontFamily: FL, fontSize: 11, letterSpacing: 2, color: C.muted, textTransform: 'uppercase', marginBottom: 7 }}>Tonight</label>
          <select value={eventId} onChange={(e) => setEventId(e.target.value)}
            style={{ width: '100%', height: 56, background: C.card, color: '#fff', border: `1px solid ${C.line}`, borderRadius: 12, padding: '0 14px', fontSize: 16, marginBottom: 18 }}>
            <option value="">Pick the event…</option>
            {events.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
          </select>

          <label style={{ display: 'block', fontFamily: FL, fontSize: 11, letterSpacing: 2, color: C.muted, textTransform: 'uppercase', marginBottom: 7 }}>Your bar code</label>
          <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="e.g. JWFV2F"
            autoCapitalize="characters" autoCorrect="off"
            style={{ width: '100%', height: 56, background: C.card, color: '#fff', border: `1px solid ${C.line}`, borderRadius: 12, padding: '0 14px', fontSize: 20, letterSpacing: 3, fontFamily: 'ui-monospace,Menlo,monospace', boxSizing: 'border-box', marginBottom: 20, outline: 'none' }} />

          {err && <p style={{ color: C.bad, fontSize: 14, margin: '0 0 14px' }}>{err}</p>}

          <button onClick={() => loadMenu(code.trim(), eventId)} disabled={!code.trim() || !eventId || busy}
            style={{ width: '100%', background: C.blue, color: '#fff', border: 'none', borderRadius: 999, padding: '17px 0', fontFamily: FL, fontWeight: 700, fontSize: 15.5, letterSpacing: 1.1, textTransform: 'uppercase', cursor: 'pointer', opacity: (!code.trim() || !eventId) ? 0.5 : 1, boxShadow: '0 8px 22px rgba(17,64,240,.4)' }}>
            {busy ? 'Opening…' : 'Open the bar'}
          </button>
        </div>
      </div>
    );
  }

  // ---------- TILL ----------
  const cats = [...new Set(products.map((p) => p.category || 'Drinks'))];
  return (
    <div style={{ minHeight: '100vh', background: C.bg, color: '#fff', fontFamily: F, paddingBottom: totalCents > 0 ? 190 : 24 }}>
      <div style={{ padding: '14px 16px', borderBottom: `1px solid ${C.line}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
        <span style={{ fontFamily: FL, fontWeight: 700, fontSize: 12, letterSpacing: 1.6, textTransform: 'uppercase' }}>
          {station || 'Bar'} <span style={{ color: C.muted }}>· {staffLabel}</span>
        </span>
        <button onClick={() => { setReady(false); setCart({}); setGuest(null); }}
          style={{ background: 'none', border: `1px solid ${C.line}`, color: C.muted, borderRadius: 999, padding: '7px 13px', fontFamily: FL, fontSize: 11, letterSpacing: 1, textTransform: 'uppercase', cursor: 'pointer' }}>
          Close
        </button>
      </div>

      {done && (
        <div style={{ margin: 16, background: 'rgba(74,222,128,.10)', border: `1px solid ${C.green}`, borderRadius: 14, padding: 16, textAlign: 'center' }}>
          <p style={{ fontFamily: FD, fontSize: 26, color: C.green, margin: 0 }}>{done.charged} CHARGED</p>
          <p style={{ color: '#cfd6e2', fontSize: 14, margin: '6px 0 0' }}>{done.name}{done.tip && done.tip !== '$0.00' ? ` · ${done.tip} tip` : ''} · {done.remaining} left</p>
        </div>
      )}

      <div style={{ padding: 16 }}>
        {cats.map((cat) => (
          <div key={cat} style={{ marginBottom: 20 }}>
            <p style={{ fontFamily: FL, fontWeight: 700, fontSize: 10.5, letterSpacing: 2.4, textTransform: 'uppercase', color: C.muted, margin: '0 0 9px' }}>{cat}</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(112px,1fr))', gap: 9 }}>
              {products.filter((p) => (p.category || 'Drinks') === cat).map((p) => (
                <button key={p.id} onClick={() => bump(p.id, 1)}
                  style={{ position: 'relative', background: cart[p.id] ? C.blue : C.card, border: `1px solid ${cart[p.id] ? C.blue : C.line}`, borderRadius: 13, padding: '16px 10px', cursor: 'pointer', textAlign: 'center', minHeight: 86 }}>
                  <span style={{ display: 'block', color: '#fff', fontFamily: FL, fontWeight: 700, fontSize: 14, lineHeight: 1.2, marginBottom: 6 }}>{p.name}</span>
                  <span style={{ display: 'block', color: cart[p.id] ? '#C9D6FF' : C.muted, fontFamily: FD, fontSize: 16 }}>${Number(p.price).toFixed(0)}</span>
                  {cart[p.id] > 0 && (
                    <span onClick={(e) => { e.stopPropagation(); bump(p.id, -1); }}
                      style={{ position: 'absolute', top: 6, right: 6, width: 26, height: 26, borderRadius: '50%', background: '#fff', color: '#04121f', fontFamily: FD, fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {cart[p.id]}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        ))}
        {!products.length && <p style={{ color: C.muted }}>No products on this bar&apos;s menu yet.</p>}
      </div>

      {/* scanner overlay */}
      {scanning && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(0,0,0,.95)', padding: 20 }}>
          <p style={{ textAlign: 'center', fontFamily: FL, fontSize: 12, letterSpacing: 2, textTransform: 'uppercase', color: C.muted, margin: '8px 0 14px' }}>Scan the guest&apos;s code</p>
          <div id="gz-bar-reader" style={{ width: '100%', maxWidth: 520, margin: '0 auto' }} />
          <button onClick={stopScan}
            style={{ display: 'block', margin: '18px auto 0', background: 'none', border: `1px solid ${C.line}`, color: '#fff', borderRadius: 999, padding: '13px 26px', fontFamily: FL, fontWeight: 700, fontSize: 13, letterSpacing: 1, textTransform: 'uppercase', cursor: 'pointer' }}>
            Cancel
          </button>
        </div>
      )}

      {/* the bar tab */}
      {totalCents > 0 && (
        <div style={{ position: 'fixed', left: 0, right: 0, bottom: 0, background: '#0B0E13', borderTop: `1px solid ${C.line}`, padding: '14px 16px 18px', zIndex: 50 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
            <span style={{ fontFamily: FL, fontWeight: 700, fontSize: 11, letterSpacing: 2, textTransform: 'uppercase', color: C.muted }}>
              {cartLines.reduce((a, l) => a + l.qty, 0)} item{cartLines.reduce((a, l) => a + l.qty, 0) === 1 ? '' : 's'}
            </span>
            <span style={{ fontFamily: FD, fontSize: 30 }}>{money(totalCents)}</span>
          </div>

          {err && <p style={{ color: C.bad, fontSize: 13.5, margin: '0 0 10px' }}>{err}</p>}

          {guest ? (
            <>
              <div style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 12, padding: '11px 13px', marginBottom: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontFamily: FL, fontWeight: 700, fontSize: 14 }}>{guest.name}</span>
                <span style={{ color: guest.balanceCents >= grandCents ? C.green : C.bad, fontFamily: FD, fontSize: 17 }}>{guest.balance}</span>
              </div>

              {/* tip - hand the phone over, they tap */}
              <div style={{ marginBottom: 10 }}>
                <p style={{ fontFamily: FL, fontWeight: 700, fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', color: C.muted, margin: '0 0 7px' }}>Tip your bartender</p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 7 }}>
                  {[0, 15, 20, 25].map((p) => (
                    <button key={p} onClick={() => setTipPct(p)}
                      style={{ background: tipPct === p ? C.blue : C.card, border: `1px solid ${tipPct === p ? C.blue : C.line}`, borderRadius: 11, padding: '12px 0', cursor: 'pointer' }}>
                      <span style={{ display: 'block', color: '#fff', fontFamily: FD, fontSize: 15 }}>{p === 0 ? 'None' : `${p}%`}</span>
                      {p > 0 && <span style={{ display: 'block', color: tipPct === p ? '#C9D6FF' : C.muted, fontSize: 11.5, marginTop: 2 }}>{money(Math.round(totalCents * p / 100))}</span>}
                    </button>
                  ))}
                </div>
              </div>
              <button onClick={charge} disabled={busy || guest.balanceCents < grandCents}
                style={{ width: '100%', background: guest.balanceCents < grandCents ? '#33383f' : C.green, color: guest.balanceCents < grandCents ? C.muted : '#04210f', border: 'none', borderRadius: 14, padding: '18px 0', fontFamily: FD, fontSize: 19, textTransform: 'uppercase', cursor: 'pointer' }}>
                {busy ? 'Charging…' : guest.balanceCents < grandCents ? 'Not enough balance' : `Charge ${money(grandCents)}`}
              </button>
              <button onClick={() => setGuest(null)}
                style={{ width: '100%', background: 'none', border: 'none', color: C.muted, padding: '10px 0 0', fontSize: 13, cursor: 'pointer' }}>
                Different guest
              </button>
            </>
          ) : (
            <>
              <button onClick={startScan} disabled={busy}
                style={{ width: '100%', background: C.blue, color: '#fff', border: 'none', borderRadius: 14, padding: '18px 0', fontFamily: FD, fontSize: 19, textTransform: 'uppercase', cursor: 'pointer', boxShadow: '0 8px 22px rgba(17,64,240,.4)' }}>
                Scan guest
              </button>
              <button onClick={() => { setCart({}); setErr(''); }}
                style={{ width: '100%', background: 'none', border: 'none', color: C.muted, padding: '10px 0 0', fontSize: 13, cursor: 'pointer' }}>
                Clear order
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
