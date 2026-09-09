'use client';

/*
  DOOR SCANNER v2 — pick the event from a dropdown (no codes to type),
  enter staff name, scan.

  Speed: native BarcodeDetector when the phone supports it, 15fps, big scan
  box, and the camera never stops — result flashes over the live feed and
  auto-clears. Same-code debounce stops accidental double-reads without
  slowing the next guest.
*/

import { useState, useEffect, useRef } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { api } from '@/lib/api';

const C = {
  bg: '#0a0a0c', card: '#141418', line: 'rgba(255,255,255,0.1)',
  red: '#c25b6e', green: '#3ddc84', muted: '#8a8f98',
};
const F = 'Helvetica Neue,Helvetica,Arial,sans-serif';

type Result = {
  kind: 'checking' | 'valid' | 'bad';
  title: string; sub?: string; name?: string;
} | null;

export default function Scan() {
  const [events, setEvents] = useState<any[]>([]);
  const [eventId, setEventId] = useState('');
  const [staff, setStaff] = useState('');
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState<Result>(null);
  const [stats, setStats] = useState<any>(null);
  const [err, setErr] = useState('');
  const qrRef = useRef<Html5Qrcode | null>(null);
  const lastToken = useRef<{ t: string; at: number }>({ t: '', at: 0 });
  const busy = useRef(false);
  const clearTimer = useRef<any>(null);

  /* load events for the picker; preselect from ?e= link if present */
  useEffect(() => {
    api('/checkout?events=1')
      .then((d) => {
        setEvents(d.events);
        const pre = new URLSearchParams(window.location.search).get('e');
        if (pre && d.events.find((x: any) => x.id === pre)) setEventId(pre);
        else if (d.events[0]) setEventId(d.events[0].id);
      })
      .catch((e) => setErr(e.message));
  }, []);

  useEffect(() => () => { qrRef.current?.stop().catch(() => {}); }, []);

  const start = async () => {
    setErr('');
    // Mount the scanner view FIRST so the #gz-reader div exists, then start the
    // camera on the next tick. Starting before the div renders throws
    // \"HTML Element with id=gz-reader not found\".
    setScanning(true);
    // wait for React to paint the #gz-reader container
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    const el = document.getElementById('gz-reader');
    if (!el) {
      setErr('Camera failed to start. Tap START SCANNING again.');
      setScanning(false);
      return;
    }
    try {
      const qr = new Html5Qrcode('gz-reader', {
        formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
        verbose: false,
      });
      qrRef.current = qr;
      await qr.start(
        { facingMode: 'environment' },
        {
          fps: 15,
          qrbox: (w, h) => { const s = Math.min(w, h) * 0.75; return { width: s, height: s }; },
          disableFlip: true,
          experimentalFeatures: { useBarCodeDetectorIfSupported: true },
        } as any,
        onDecode,
        () => {} // per-frame misses are normal; stay quiet
      );
    } catch (e: any) {
      // roll back to the start screen so they can retry / grant permission
      setScanning(false);
      const msg = String(e?.message || e);
      if (/permission|denied|NotAllowed/i.test(msg)) {
        setErr('Camera access was blocked. Enable camera permission for this site in your browser settings, then tap START SCANNING.');
      } else if (/NotFound|no camera/i.test(msg)) {
        setErr('No camera found on this device.');
      } else {
        setErr(`Camera failed: ${msg}. Tap START SCANNING to try again.`);
      }
    }
  };

  const onDecode = (token: string) => {
    const now = Date.now();
    // ignore rapid re-reads of the same code (the guest holding it up)
    if (busy.current) return;
    if (token === lastToken.current.t && now - lastToken.current.at < 2500) return;
    lastToken.current = { t: token, at: now };
    busy.current = true;

    if (clearTimer.current) clearTimeout(clearTimer.current);
    setResult({ kind: 'checking', title: 'CHECKING…' });

    api('/scan', {
      method: 'POST',
      body: JSON.stringify({ token, eventId, staffName: staff.trim() || 'door' }),
    })
      .then((d) => {
        if (d.stats) setStats(d.stats);
        if (d.result === 'valid') {
          setResult({ kind: 'valid', title: 'LET THEM IN', name: d.attendeeName, sub: d.ticketType });
        } else if (d.result === 'already_used') {
          const at = d.checkedInAt ? new Date(d.checkedInAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : '';
          setResult({ kind: 'bad', title: 'ALREADY SCANNED', name: d.attendeeName, sub: `First scanned ${at}${d.checkedInBy ? ` by ${d.checkedInBy}` : ''}` });
        } else {
          setResult({ kind: 'bad', title: 'NOT VALID', sub: d.message || 'This code does not match this event.' });
        }
      })
      .catch((e) => setResult({ kind: 'bad', title: 'CHECK FAILED', sub: e.message }))
      .finally(() => {
        busy.current = false;
        // auto-clear back to live camera
        clearTimer.current = setTimeout(() => setResult(null), 2200);
      });
  };

  const evName = events.find((e) => e.id === eventId)?.name || '';

  return (
    <div style={{ minHeight: '100vh', background: C.bg, fontFamily: F, color: '#fff' }}>
      {!scanning ? (
        /* ---------- SETUP ---------- */
        <div style={{ maxWidth: 430, margin: '0 auto', padding: '48px 22px' }}>
          <p style={{ fontSize: 12, letterSpacing: 3, color: C.muted, margin: '0 0 6px' }}>GOZA ENTERTAINMENT</p>
          <h1 style={{ fontSize: 30, fontWeight: 800, margin: '0 0 26px' }}>Door Scanner</h1>

          <label style={{ display: 'block', fontSize: 12, letterSpacing: 1.5, color: C.muted, marginBottom: 8 }}>EVENT</label>
          <select value={eventId} onChange={(e) => setEventId(e.target.value)}
            style={{ width: '100%', height: 56, background: C.card, color: '#fff', border: `1px solid ${C.line}`, borderRadius: 12, padding: '0 14px', fontSize: 16, marginBottom: 18 }}>
            {events.length === 0 && <option>Loading events…</option>}
            {events.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name} — {new Date(e.date).toLocaleDateString([], { month: 'short', day: 'numeric' })}
              </option>
            ))}
          </select>

          <label style={{ display: 'block', fontSize: 12, letterSpacing: 1.5, color: C.muted, marginBottom: 8 }}>YOUR NAME (shows on scan log)</label>
          <input value={staff} onChange={(e) => setStaff(e.target.value)} placeholder="e.g. Marco"
            style={{ width: '100%', height: 56, background: C.card, color: '#fff', border: `1px solid ${C.line}`, borderRadius: 12, padding: '0 14px', fontSize: 16, boxSizing: 'border-box', marginBottom: 22, outline: 'none' }} />

          {err && <p style={{ color: C.red, fontSize: 13.5, margin: '0 0 16px' }}>{err}</p>}

          <button onClick={start} disabled={!eventId}
            style={{ width: '100%', background: C.red, color: '#fff', border: 'none', borderRadius: 14, padding: '17px 0', fontSize: 17, fontWeight: 700, cursor: 'pointer', opacity: eventId ? 1 : 0.5 }}>
            START SCANNING
          </button>
          <p style={{ color: '#6f747d', fontSize: 12.5, margin: '14px 0 0', lineHeight: 1.5 }}>
            Point the camera at the guest&apos;s QR code. Green = in. Red = stop. The camera stays on between scans.
          </p>
        </div>
      ) : (
        /* ---------- SCANNING ---------- */
        <div style={{ position: 'relative', minHeight: '100vh' }}>
          <div style={{ padding: '14px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <p style={{ fontSize: 11, letterSpacing: 2, color: C.muted, margin: 0 }}>SCANNING</p>
              <p style={{ fontSize: 14.5, fontWeight: 700, margin: '2px 0 0' }}>{evName}</p>
            </div>
            {stats && (
              <p style={{ fontSize: 13, color: C.muted, margin: 0, textAlign: 'right' }}>
                <span style={{ color: C.green, fontWeight: 700 }}>{stats.checked_in}</span> in · {stats.not_yet_arrived} to go
              </p>
            )}
          </div>

          <div id="gz-reader" style={{ width: '100%', maxWidth: 520, margin: '0 auto' }} />

          {/* result overlay */}
          {result && (
            <div
              onClick={() => { if (clearTimer.current) clearTimeout(clearTimer.current); setResult(null); }}
              style={{
                position: 'fixed', inset: 0, zIndex: 40, display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center', padding: 24, textAlign: 'center', cursor: 'pointer',
                background: result.kind === 'valid' ? 'rgba(15,60,35,0.96)'
                  : result.kind === 'bad' ? 'rgba(70,12,20,0.96)'
                  : 'rgba(10,10,14,0.9)',
              }}>
              <p style={{ fontSize: 56, margin: '0 0 10px' }}>
                {result.kind === 'valid' ? '✓' : result.kind === 'bad' ? '✕' : '…'}
              </p>
              <h2 style={{ fontSize: 34, fontWeight: 800, margin: '0 0 8px', letterSpacing: 1 }}>{result.title}</h2>
              {result.name && <p style={{ fontSize: 22, fontWeight: 600, margin: '0 0 4px' }}>{result.name}</p>}
              {result.sub && <p style={{ fontSize: 15, color: 'rgba(255,255,255,0.75)', margin: 0 }}>{result.sub}</p>}
              <p style={{ position: 'absolute', bottom: 30, fontSize: 12.5, color: 'rgba(255,255,255,0.5)' }}>tap to keep scanning</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
