'use client';

/* The promoter's own page: tickets.gozaentertainment.com/p?c=their-code
   The link is the login. Buyer names are shortened on purpose. */

import { useState, useEffect } from 'react';
import { BACKEND } from '@/lib/api';

const C = { bg: '#07080C', card: '#141821', line: '#232936', blue: '#1140F0', muted: '#9AA5B5', good: '#4ADE80' };
const FD = "'Archivo Black',Impact,Haettenschweiler,sans-serif";
const FL = "'Chakra Petch','Trebuchet MS',sans-serif";
const F = "'Saira Condensed','Arial Narrow',Helvetica,Arial,sans-serif";

function Stat({ label, value, hot, sub }: { label: string; value: string; hot?: boolean; sub?: string }) {
  return (
    <div style={{ background: hot ? C.blue : C.card, border: `1px solid ${hot ? C.blue : C.line}`, borderRadius: 14, padding: '15px 14px' }}>
      <p style={{ margin: 0, fontFamily: FL, fontWeight: 700, fontSize: 9.5, letterSpacing: 2, textTransform: 'uppercase', color: hot ? '#C9D6FF' : C.muted }}>{label}</p>
      <p style={{ margin: '7px 0 0', fontFamily: FD, fontSize: 25, lineHeight: 1, color: '#fff' }}>{value}</p>
      {sub && <p style={{ margin: '5px 0 0', fontSize: 12.5, color: hot ? '#C9D6FF' : C.muted }}>{sub}</p>}
    </div>
  );
}

export default function PromoterPage() {
  const [d, setD] = useState<any>(null);
  const [err, setErr] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get('c') || '';
    if (!code) { setErr('No code in the link.'); return; }
    fetch(`${BACKEND}/promoter`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'dash', code }) })
      .then((r) => r.json())
      .then((x) => { if (x.ok) setD(x); else setErr(x.error || 'Could not load that'); })
      .catch(() => setErr('Could not reach us just now'));
  }, []);

  if (err) return <div style={{ minHeight: '100vh', background: C.bg, color: C.muted, fontFamily: F, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, textAlign: 'center' }}>{err}</div>;
  if (!d) return <div style={{ minHeight: '100vh', background: C.bg }} />;

  return (
    <div style={{ minHeight: '100vh', background: C.bg, color: '#fff', fontFamily: F, padding: '26px 18px 60px' }}>
      <div style={{ maxWidth: 560, margin: '0 auto' }}>
        <p style={{ fontFamily: FL, fontWeight: 700, fontSize: 10.5, letterSpacing: 3, color: C.blue, textTransform: 'uppercase', margin: '0 0 6px' }}>Goza · Promoter</p>
        <h1 style={{ fontFamily: FD, fontSize: 32, textTransform: 'uppercase', margin: '0 0 6px', lineHeight: 1 }}>{d.name}</h1>
        <p style={{ color: C.muted, fontSize: 14, margin: '0 0 20px' }}>{d.city ? `${d.city} · ` : ''}{d.rate}</p>

        {/* their link */}
        <div style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 14, padding: '14px 15px', marginBottom: 18 }}>
          <p style={{ margin: 0, fontFamily: FL, fontWeight: 700, fontSize: 9.5, letterSpacing: 2, textTransform: 'uppercase', color: C.muted }}>Your link</p>
          <p style={{ margin: '7px 0 10px', fontSize: 15, color: '#fff', wordBreak: 'break-all' }}>{d.link}</p>
          <button
            onClick={() => { navigator.clipboard?.writeText(`https://${d.link}`); setCopied(true); setTimeout(() => setCopied(false), 1600); }}
            style={{ background: C.blue, color: '#fff', border: 'none', borderRadius: 999, padding: '11px 20px', fontFamily: FL, fontWeight: 700, fontSize: 12.5, letterSpacing: 1, textTransform: 'uppercase', cursor: 'pointer' }}>
            {copied ? 'Copied' : 'Copy link'}
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 10, marginBottom: 12 }}>
          <Stat label="Earned so far" value={d.paid} hot sub="already sent to you" />
          <Stat label="Ready to pay" value={d.payable} hot sub="after the next show" />
          <Stat label="Pending" value={d.pending} sub="shows still to come" />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(110px,1fr))', gap: 10, marginBottom: 20 }}>
          <Stat label="Clicks" value={String(d.clicks)} />
          <Stat label="Tickets" value={String(d.tickets)} />
          <Stat label="Conversion" value={d.conversion} />
        </div>

        <div style={{ background: 'rgba(17,64,240,0.10)', border: `1px solid rgba(17,64,240,0.4)`, borderRadius: 12, padding: '13px 15px', marginBottom: 22 }}>
          <p style={{ margin: 0, fontSize: 14, color: '#fff', lineHeight: 1.5 }}>💸 {d.payout}</p>
          <p style={{ margin: '6px 0 0', fontSize: 12.5, color: C.muted, lineHeight: 1.5 }}>
            Paid out after each show, once tickets are confirmed.
          </p>
        </div>

        {d.recent?.length > 0 && (
          <>
            <p style={{ fontFamily: FL, fontWeight: 700, fontSize: 10.5, letterSpacing: 2.4, textTransform: 'uppercase', color: C.muted, margin: '0 0 10px' }}>Your sales</p>
            <div style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 14, padding: '4px 15px', marginBottom: 22 }}>
              {d.recent.map((r: any, i: number) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '11px 0', borderTop: i ? `1px solid ${C.line}` : 'none' }}>
                  <span>
                    <span style={{ color: '#fff', fontSize: 14.5 }}>{r.who}</span>
                    <span style={{ display: 'block', color: C.muted, fontSize: 12.5, marginTop: 2 }}>{r.tickets} ticket{r.tickets === 1 ? '' : 's'} · {r.when}</span>
                  </span>
                  <span style={{ fontFamily: FD, fontSize: 16, color: r.status === 'paid' ? C.good : '#fff' }}>{r.earned}</span>
                </div>
              ))}
            </div>
          </>
        )}

        {d.leaderboard?.length > 0 && (
          <>
            <p style={{ fontFamily: FL, fontWeight: 700, fontSize: 10.5, letterSpacing: 2.4, textTransform: 'uppercase', color: C.muted, margin: '0 0 10px' }}>
              {d.city} leaderboard
            </p>
            <div style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 14, padding: '4px 15px' }}>
              {d.leaderboard.map((p: any, i: number) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '11px 0', borderTop: i ? `1px solid ${C.line}` : 'none' }}>
                  <span style={{ color: p.you ? '#fff' : C.muted, fontSize: 14.5, fontWeight: p.you ? 700 : 400 }}>
                    {i + 1}. {p.name}{p.you ? ' (you)' : ''}
                  </span>
                  <span style={{ fontFamily: FD, fontSize: 15, color: p.you ? C.blue : C.muted }}>{p.tickets}</span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
