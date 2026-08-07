'use client';

/*
  DOOR SCANNER

  Design constraints came from the actual environment: a dark room, a line of
  people, staff holding a phone at arm's length who cannot read small text.

  So: the result takes over the entire screen in solid green or red. Color is
  readable before words are. The phone vibrates so staff feel the answer
  without looking down.

  Performance decisions that matter when the line is 40 deep:
  - The camera NEVER restarts between scans. Restarting costs 1-2 seconds
    each time, which compounds into a backed-up door.
  - Scans are debounced: the same code sitting in frame fires one request,
    not twenty.
  - The result auto-clears after 2.5s. Staff shouldn't have to tap anything.
*/

import { useState, useEffect, useRef, useCallback } from 'react';
import { api, C, EVENT } from '@/lib/api';

type Result = 'valid' | 'already_used' | 'wrong_event' | 'invalid';

interface ScanResponse {
  result: Result;
  message: string;
  attendeeName?: string;
  ticketType?: string;
  checkedInAt?: string;
  stats?: { tickets_issued: number; checked_in: number; not_yet_arrived: number };
}

const HOLD_MS = 2500;
const DEBOUNCE_MS = 2000;

export default function ScanPage() {
  const [started, setStarted] = useState(false);
  const [eventId, setEventId] = useState(EVENT.id);

  // Admin hands door staff a link like /scan?e=<eventId>; prefill from it.
  useEffect(() => {
    const p = new URLSearchParams(window.location.search).get('e');
    if (p) setEventId(p);
  }, []);
  const [staffName, setStaffName] = useState('');
  const [result, setResult] = useState<ScanResponse | null>(null);
  const [stats, setStats] = useState({ checked_in: 0, not_yet_arrived: 0 });
  const [camError, setCamError] = useState('');
  const [busy, setBusy] = useState(false);

  const scannerRef = useRef<any>(null);
  const lastScan = useRef<{ code: string; at: number }>({ code: '', at: 0 });
  const clearTimer = useRef<any>(null);

  const handleScan = useCallback(
    async (text: string) => {
      const now = Date.now();
      // Same code within the debounce window: ignore. The camera reads the
      // same QR many times per second while it sits in frame.
      if (text === lastScan.current.code && now - lastScan.current.at < DEBOUNCE_MS) return;
      lastScan.current = { code: text, at: now };

      setBusy(true);
      try {
        const res: ScanResponse = await api('/scan', {
          method: 'POST',
          body: JSON.stringify({ token: text, eventId, staffName: staffName || undefined }),
        });

        setResult(res);
        if (res.stats) {
          setStats({
            checked_in: res.stats.checked_in,
            not_yet_arrived: res.stats.not_yet_arrived,
          });
        }

        // Short buzz for go, long buzz for stop.
        if (typeof navigator !== 'undefined' && navigator.vibrate) {
          navigator.vibrate(res.result === 'valid' ? 100 : 400);
        }
      } catch (err: any) {
        setResult({ result: 'invalid', message: err.message || 'Connection failed' });
        if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(400);
      } finally {
        setBusy(false);
        clearTimeout(clearTimer.current);
        clearTimer.current = setTimeout(() => setResult(null), HOLD_MS);
      }
    },
    [eventId, staffName]
  );

  // Start the camera once, keep it running for the whole shift.
  useEffect(() => {
    if (!started) return;
    let cancelled = false;

    (async () => {
      try {
        const { Html5Qrcode } = await import('html5-qrcode');
        if (cancelled) return;

        const scanner = new Html5Qrcode('reader', { verbose: false });
        scannerRef.current = scanner;

        await scanner.start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: { width: 260, height: 260 } },
          (decoded: string) => handleScan(decoded),
          () => {} // per-frame misses are normal, not errors
        );
      } catch (err: any) {
        setCamError(
          err?.message?.includes('Permission') || err?.name === 'NotAllowedError'
            ? 'Camera permission denied. Enable it in your browser settings and reload.'
            : `Could not start camera: ${err?.message || err}`
        );
      }
    })();

    return () => {
      cancelled = true;
      clearTimeout(clearTimer.current);
      const s = scannerRef.current;
      if (s?.isScanning) s.stop().then(() => s.clear()).catch(() => {});
    };
  }, [started, handleScan]);

  // ---------- setup ----------
  if (!started) {
    return (
      <main style={s.setupPage}>
        <div style={{ width: '100%', maxWidth: 380 }}>
          <p style={s.brand}>GOZA ENTERTAINMENT</p>
          <h1 style={s.h1}>Door Scanner</h1>

          <label style={s.label}>Event ID</label>
          <input
            value={eventId}
            onChange={(e) => setEventId(e.target.value)}
            placeholder="Paste event ID"
            style={s.input}
          />

          <label style={{ ...s.label, marginTop: 16 }}>Your name (optional)</label>
          <input
            value={staffName}
            onChange={(e) => setStaffName(e.target.value)}
            placeholder="Marcos"
            style={s.input}
          />
          <p style={s.hint}>Recorded on each scan, so disputes can be traced.</p>

          <button
            onClick={() => setStarted(true)}
            disabled={!eventId.trim()}
            style={{ ...s.cta, opacity: eventId.trim() ? 1 : 0.4, marginTop: 24 }}
          >
            Start scanning
          </button>

          <p style={s.tip}>
            Keep the screen awake and stay on Wi-Fi if you can. Every scan needs
            the network.
          </p>
        </div>
      </main>
    );
  }

  // ---------- result takeover ----------
  if (result) {
    const good = result.result === 'valid';
    const label =
      result.result === 'valid' ? 'LET THEM IN'
      : result.result === 'already_used' ? 'ALREADY SCANNED'
      : result.result === 'wrong_event' ? 'WRONG EVENT'
      : 'NOT VALID';

    return (
      <main style={{ ...s.takeover, background: good ? '#0f9d58' : '#c62828' }}>
        <div style={s.mark}>{good ? '✓' : '✕'}</div>
        <p style={s.takeoverLabel}>{label}</p>

        {result.attendeeName && <p style={s.name}>{result.attendeeName}</p>}
        {good && result.ticketType && <p style={s.sub}>{result.ticketType}</p>}

        {result.result === 'already_used' && result.checkedInAt && (
          <p style={s.sub}>
            First scanned{' '}
            {new Date(result.checkedInAt).toLocaleTimeString('en-US', {
              hour: 'numeric',
              minute: '2-digit',
            })}
          </p>
        )}

        {!good && !result.attendeeName && <p style={s.sub}>{result.message}</p>}

        <button onClick={() => setResult(null)} style={s.dismiss}>
          Tap to scan next
        </button>
      </main>
    );
  }

  // ---------- live camera ----------
  return (
    <main style={s.camPage}>
      <div id="reader" style={s.reader} />

      {camError && (
        <div style={s.camErrorBox}>
          <p style={{ color: '#fff', fontSize: 15, margin: 0 }}>{camError}</p>
        </div>
      )}

      {!camError && (
        <>
          <div style={s.frameHint}>
            <p style={s.frameText}>{busy ? 'Checking…' : 'Point at the QR code'}</p>
          </div>

          <div style={s.counter}>
            <span style={{ color: C.green, fontSize: 26, fontWeight: 800 }}>
              {stats.checked_in}
            </span>
            <span style={{ color: C.muted, fontSize: 14 }}> in</span>
            <span style={{ color: C.faint, fontSize: 14 }}> · </span>
            <span style={{ color: '#fff', fontSize: 26, fontWeight: 800 }}>
              {stats.not_yet_arrived}
            </span>
            <span style={{ color: C.muted, fontSize: 14 }}> to go</span>
          </div>
        </>
      )}
    </main>
  );
}

const s: Record<string, React.CSSProperties> = {
  setupPage: {
    minHeight: '100vh', background: C.bg, display: 'flex', alignItems: 'center',
    justifyContent: 'center', padding: 24, fontFamily: 'Helvetica,Arial,sans-serif',
  },
  brand: { color: '#fff', fontSize: 12, fontWeight: 700, letterSpacing: 2, margin: '0 0 10px' },
  h1: { color: '#fff', fontSize: 28, fontWeight: 800, margin: '0 0 28px' },
  label: { display: 'block', color: '#fff', fontSize: 13, fontWeight: 700, marginBottom: 7 },
  input: {
    width: '100%', height: 52, background: C.card, color: '#fff',
    border: `1px solid ${C.line}`, borderRadius: 10, padding: '0 14px',
    fontSize: 16, outline: 'none', boxSizing: 'border-box',
  },
  hint: { color: C.faint, fontSize: 12, margin: '7px 0 0' },
  cta: {
    width: '100%', height: 56, background: C.red, color: '#fff', border: 'none',
    borderRadius: 10, fontSize: 17, fontWeight: 800, cursor: 'pointer',
  },
  tip: { color: C.faint, fontSize: 12, textAlign: 'center', margin: '20px 0 0', lineHeight: 1.5 },

  camPage: { minHeight: '100vh', background: '#000', position: 'relative', overflow: 'hidden' },
  reader: { width: '100%', minHeight: '100vh' },
  frameHint: {
    position: 'fixed', top: 28, left: 0, right: 0, textAlign: 'center', zIndex: 10,
  },
  frameText: {
    display: 'inline-block', background: 'rgba(0,0,0,0.65)', color: '#fff',
    fontSize: 15, fontWeight: 600, padding: '9px 18px', borderRadius: 20,
    margin: 0, fontFamily: 'Helvetica,Arial,sans-serif',
  },
  counter: {
    position: 'fixed', bottom: 26, left: 0, right: 0, textAlign: 'center', zIndex: 10,
    background: 'rgba(0,0,0,0.7)', padding: '12px 0',
    fontFamily: 'Helvetica,Arial,sans-serif',
  },
  camErrorBox: {
    position: 'fixed', inset: 0, background: C.bg, display: 'flex',
    alignItems: 'center', justifyContent: 'center', padding: 28, textAlign: 'center',
    fontFamily: 'Helvetica,Arial,sans-serif',
  },

  takeover: {
    minHeight: '100vh', display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center', padding: 24,
    textAlign: 'center', fontFamily: 'Helvetica,Arial,sans-serif',
  },
  mark: { color: '#fff', fontSize: 110, lineHeight: 1, fontWeight: 700 },
  takeoverLabel: {
    color: '#fff', fontSize: 26, fontWeight: 800, letterSpacing: 1,
    margin: '14px 0 0',
  },
  name: { color: '#fff', fontSize: 34, fontWeight: 800, margin: '22px 0 0', lineHeight: 1.15 },
  sub: { color: 'rgba(255,255,255,0.9)', fontSize: 17, margin: '10px 0 0' },
  dismiss: {
    marginTop: 40, background: 'rgba(255,255,255,0.18)', color: '#fff',
    border: 'none', borderRadius: 26, padding: '13px 30px', fontSize: 15,
    fontWeight: 700, cursor: 'pointer',
  },
};
