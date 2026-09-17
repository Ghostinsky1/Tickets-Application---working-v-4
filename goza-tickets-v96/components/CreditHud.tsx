'use client';

import { useEffect, useRef, useState } from 'react';
import { BACKEND } from '@/lib/api';
import { sfxTally, sfxCoin, sfxTick } from '@/lib/sfx';

/* The corner badge, on every page. Three states:
     signed out           -> "SIGN IN"
     signed in, no credit -> "MY TICKETS"
     signed in + balance  -> GTA-style money HUD that counts up and glows
   One component, so there's always a way into the account from anywhere. */

const PILL: React.CSSProperties = {
  position: 'fixed', top: 14, right: 14, zIndex: 9999,
  textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 8,
  background: 'rgba(7,8,12,0.82)',
  backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)',
  borderRadius: 999, padding: '9px 15px 9px 12px',
  boxShadow: '0 4px 14px rgba(0,0,0,0.5)',
};
const LABEL: React.CSSProperties = {
  fontFamily: "'Chakra Petch','Trebuchet MS',sans-serif",
  fontWeight: 700, fontSize: 11.5, letterSpacing: 1.4, textTransform: 'uppercase', color: '#fff',
};

function Star({ size = 16, glow = false }: { size?: number; glow?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden="true"
      style={{ display: 'block', filter: glow ? 'drop-shadow(0 0 7px rgba(17,64,240,0.9))' : 'none' }}>
      <path fill="#1140F0" d="M56 4 L64 34 L97 31 L68 50 L80 90 L50 68 L20 92 L32 55 L3 44 L38 38 Z" />
    </svg>
  );
}

export default function CreditHud() {
  const [state, setState] = useState<'loading' | 'out' | 'in' | 'money'>('loading');
  const [balance, setBalance] = useState(0);
  const [shown, setShown] = useState(0);
  const [pop, setPop] = useState(false);
  const lastStep = useRef(-1);
  const counted = useRef(false);

  useEffect(() => {
    let sess = '';
    try { sess = localStorage.getItem('gz_portal_session') || ''; } catch {}
    if (!sess) { setState('out'); return; }
    fetch(`${BACKEND}/credits`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'my_credits', session: sess }),
    })
      .then((r) => r.json())
      .then((d) => {
        if (d?.ok && d.totalCents > 0) { setBalance(d.totalCents / 100); setState('money'); }
        else if (d?.ok) setState('in');
        else setState('out');
      })
      .catch(() => setState('in'));
  }, []);

  useEffect(() => {
    if (state !== 'money') return;
    let already = false;
    try { already = sessionStorage.getItem('gz_hud_counted') === '1'; } catch {}
    if (already || counted.current) { setShown(balance); setPop(true); return; }
    counted.current = true;
    try { sessionStorage.setItem('gz_hud_counted', '1'); } catch {}
    const DUR = 1200, t0 = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const p = Math.min(1, (now - t0) / DUR);
      const eased = 1 - Math.pow(1 - p, 3);
      setShown(balance * eased);
      const step = Math.floor(p * 12);
      if (step !== lastStep.current) { lastStep.current = step; sfxTally(step); }
      if (p < 1) raf = requestAnimationFrame(tick);
      else { setPop(true); sfxCoin(); }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [state, balance]);

  if (state === 'loading') return null;

  if (state === 'money') {
    return (
      <a href="/account" onMouseEnter={sfxTick} aria-label={`Goza credit $${balance.toFixed(2)}`}
        style={{ ...PILL, border: `1px solid ${pop ? '#1140F0' : '#22304f'}`,
          boxShadow: pop ? '0 0 26px rgba(17,64,240,0.5), inset 0 1px 0 rgba(255,255,255,0.10)' : PILL.boxShadow,
          transition: 'box-shadow 500ms ease, border-color 500ms ease' }}>
        <Star glow />
        <span style={{ fontFamily: "'Archivo Black',Impact,Haettenschweiler,sans-serif", fontSize: 17, lineHeight: 1, color: '#fff',
          textShadow: pop ? '0 0 16px rgba(17,64,240,0.95)' : 'none', transition: 'text-shadow 500ms ease' }}>
          ${shown.toFixed(2)}
        </span>
      </a>
    );
  }

  return (
    <a href="/account" onMouseEnter={sfxTick}
      style={{ ...PILL, border: '1px solid rgba(255,255,255,0.14)' }}>
      <Star />
      <span style={LABEL}>{state === 'in' ? 'My tickets' : 'Sign in'}</span>
    </a>
  );
}
