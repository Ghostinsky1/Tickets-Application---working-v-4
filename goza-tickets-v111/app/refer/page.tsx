'use client';

/* /refer - bring a friend, you both get $5 in Goza credits.
   Spendable on tickets, the bar and merch at our venues. */

import { useState, useEffect } from 'react';
import { BACKEND } from '@/lib/api';

const C = { bg: '#07080C', card: '#141821', line: '#232936', blue: '#1140F0', muted: '#9AA5B5', good: '#4ADE80' };
const FD = "'Archivo Black',Impact,Haettenschweiler,sans-serif";
const FL = "'Chakra Petch','Trebuchet MS',sans-serif";
const F = "'Saira Condensed','Arial Narrow',Helvetica,Arial,sans-serif";

function Step({ n, title, body }: { n: string; title: string; body: string }) {
  return (
    <div style={{ display: 'flex', gap: 13, marginBottom: 16 }}>
      <span style={{ flexShrink: 0, width: 30, height: 30, borderRadius: '50%', background: C.blue, color: '#fff',
        fontFamily: FD, fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{n}</span>
      <span>
        <span style={{ display: 'block', color: '#fff', fontFamily: FL, fontWeight: 700, fontSize: 15.5 }}>{title}</span>
        <span style={{ display: 'block', color: C.muted, fontSize: 14, lineHeight: 1.5, marginTop: 3 }}>{body}</span>
      </span>
    </div>
  );
}

export default function Refer() {
  const [d, setD] = useState<any>(null);
  const [err, setErr] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let sess = '';
    try { sess = localStorage.getItem('gz_portal_session') || ''; } catch {}
    if (!sess) { setErr('signin'); return; }
    fetch(`${BACKEND}/refer`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'my_link', session: sess }) })
      .then((r) => r.json())
      .then((x) => { if (x.ok) setD(x); else setErr(x.error === 'Session expired' ? 'signin' : (x.error || 'Could not load')); })
      .catch(() => setErr('Could not reach us just now'));
  }, []);

  const share = async () => {
    if (!d) return;
    const url = `https://${d.link}`;
    const text = `Come to a Goza night with me — use my link and we both get $5 credit: ${url}`;
    try {
      if (navigator.share) { await navigator.share({ text, url }); return; }
      await navigator.clipboard?.writeText(url);
      setCopied(true); setTimeout(() => setCopied(false), 1600);
    } catch { /* user cancelled */ }
  };

  return (
    <div style={{ minHeight: '100vh', background: C.bg, color: '#fff', fontFamily: F, padding: '34px 20px 60px' }}>
      <div style={{ maxWidth: 480, margin: '0 auto' }}>
        <p style={{ fontFamily: FL, fontWeight: 700, fontSize: 10.5, letterSpacing: 3, color: C.blue, textTransform: 'uppercase', margin: '0 0 8px' }}>Goza · Bring a friend</p>
        <h1 style={{ fontFamily: FD, fontSize: 36, textTransform: 'uppercase', margin: '0 0 12px', lineHeight: 0.98 }}>
          You both get $5
        </h1>
        <p style={{ color: C.muted, fontSize: 15.5, lineHeight: 1.55, margin: '0 0 26px' }}>
          Send your link to somebody who hasn&apos;t been yet. When they come to a show, $5 in Goza credits lands on both accounts.
        </p>

        {/* what credits actually buy */}
        <div style={{ background: 'linear-gradient(160deg,#0B1B4F 0%,#0A0D16 70%)', border: '1px solid #22304f', borderRadius: 16, padding: '18px 18px', marginBottom: 24 }}>
          <p style={{ margin: 0, fontFamily: FL, fontWeight: 700, fontSize: 10, letterSpacing: 2.2, color: '#8FB4FF', textTransform: 'uppercase' }}>Spend it on</p>
          <p style={{ margin: '9px 0 0', color: '#fff', fontSize: 15.5, lineHeight: 1.6 }}>
            🎟️ Tickets to any of our nights<br />
            🥤 Whatever you&apos;re drinking &mdash; bar tab&apos;s on your balance<br />
            👕 Merch drops when we have them<br />
            ♾️ Never expires
          </p>
        </div>

        <p style={{ fontFamily: FL, fontWeight: 700, fontSize: 10.5, letterSpacing: 2.4, color: C.muted, textTransform: 'uppercase', margin: '0 0 14px' }}>How it works</p>
        <Step n="1" title="Send your link" body="Group chat, story, DM — wherever your people are." />
        <Step n="2" title="They grab a ticket" body="Has to be someone new to us, and a paid ticket." />
        <Step n="3" title="They show up" body="Once they scan in at the show, the credit is earned." />
        <Step n="4" title="You both get $5" body="Added to your accounts after the night, ready to spend." />

        {err === 'signin' ? (
          <a href="/account" style={{ display: 'block', textAlign: 'center', textDecoration: 'none', marginTop: 8,
            background: C.blue, color: '#fff', borderRadius: 999, padding: '17px 0',
            fontFamily: FL, fontWeight: 700, fontSize: 15, letterSpacing: 1.1, textTransform: 'uppercase', boxShadow: '0 8px 22px rgba(17,64,240,.4)' }}>
            Sign in to get your link
          </a>
        ) : err ? (
          <p style={{ color: '#FF6B6B', fontSize: 14, marginTop: 8 }}>{err}</p>
        ) : !d ? (
          <p style={{ color: C.muted, fontSize: 14, marginTop: 8 }}>Getting your link…</p>
        ) : (
          <>
            <div style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 14, padding: '16px 16px 18px', margin: '22px 0 14px' }}>
              <p style={{ margin: 0, fontFamily: FL, fontWeight: 700, fontSize: 9.5, letterSpacing: 2, textTransform: 'uppercase', color: C.muted }}>Your link</p>
              <p style={{ margin: '8px 0 14px', fontSize: 15.5, wordBreak: 'break-all' }}>{d.link}</p>
              <button onClick={share}
                style={{ width: '100%', background: C.blue, color: '#fff', border: 'none', borderRadius: 999, padding: '16px 0',
                  fontFamily: FL, fontWeight: 700, fontSize: 14.5, letterSpacing: 1, textTransform: 'uppercase', cursor: 'pointer', boxShadow: '0 8px 22px rgba(17,64,240,.4)' }}>
                {copied ? 'Copied' : 'Share my link'}
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 9, marginBottom: 20 }}>
              {[['Invited', String(d.invited)], ['Came through', String(d.cameThrough)], ['Earned', d.earned]].map(([l, v]) => (
                <div key={l} style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 12, padding: '13px 11px' }}>
                  <p style={{ margin: 0, fontFamily: FL, fontWeight: 700, fontSize: 9, letterSpacing: 1.6, textTransform: 'uppercase', color: C.muted }}>{l}</p>
                  <p style={{ margin: '6px 0 0', fontFamily: FD, fontSize: 19 }}>{v}</p>
                </div>
              ))}
            </div>
            {d.pending !== '$0.00' && (
              <p style={{ color: C.good, fontSize: 14, margin: '0 0 18px' }}>{d.pending} on the way once those shows happen.</p>
            )}
          </>
        )}

        <a href="/account" style={{ display: 'block', textAlign: 'center', color: C.muted, fontSize: 13.5, textDecoration: 'none', marginTop: 10 }}>
          Back to my account
        </a>

        <p style={{ color: '#6d7787', fontSize: 11.5, lineHeight: 1.55, margin: '22px 0 0' }}>
          One reward per new person. Paid tickets only — free and RSVP tickets don&apos;t count. You can&apos;t refer yourself, and credits can&apos;t be cashed out.
        </p>
      </div>
    </div>
  );
}
