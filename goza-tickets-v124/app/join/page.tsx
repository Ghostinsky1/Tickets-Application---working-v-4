'use client';

/* /join - the recruiting door. No approval queue: they fill four fields and
   walk away with a link and a dashboard. */

import { useState } from 'react';
import { BACKEND } from '@/lib/api';

const C = { bg: '#07080C', card: '#141821', line: '#232936', blue: '#1140F0', muted: '#9AA5B5', good: '#4ADE80' };
const FD = "'Archivo Black',Impact,Haettenschweiler,sans-serif";
const FL = "'Chakra Petch','Trebuchet MS',sans-serif";
const F = "'Saira Condensed','Arial Narrow',Helvetica,Arial,sans-serif";
const INP: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box', background: '#0e0e12', border: `1px solid ${C.line}`,
  borderRadius: 12, padding: '15px 16px', color: '#fff', fontSize: 16.5, marginBottom: 11, outline: 'none',
};

export default function Join() {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [city, setCity] = useState('');
  const [pref, setPref] = useState<'cash' | 'credit'>('cash');
  const [handle, setHandle] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [done, setDone] = useState<any>(null);
  const [copied, setCopied] = useState(false);

  const submit = async () => {
    setBusy(true); setErr('');
    try {
      const r = await fetch(`${BACKEND}/join`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'signup', name, phone, city, payoutPref: pref, payoutHandle: handle }),
      }).then((x) => x.json());
      if (r.ok) { setDone(r); return; }
      setErr(r.error || 'Could not set that up');
    } catch { setErr('Could not reach us just now'); }
    finally { setBusy(false); }
  };

  if (done) {
    return (
      <div style={{ minHeight: '100vh', background: C.bg, color: '#fff', fontFamily: F, padding: '40px 20px' }}>
        <div style={{ maxWidth: 480, margin: '0 auto' }}>
          <p style={{ fontFamily: FL, fontWeight: 700, fontSize: 10.5, letterSpacing: 3, color: C.good, textTransform: 'uppercase', margin: '0 0 8px' }}>You&apos;re in</p>
          <h1 style={{ fontFamily: FD, fontSize: 34, textTransform: 'uppercase', margin: '0 0 10px', lineHeight: 1 }}>
            {done.already ? 'You already have a link' : 'Start posting'}
          </h1>
          <p style={{ color: C.muted, fontSize: 15, lineHeight: 1.55, margin: '0 0 22px' }}>
            Anyone who buys through your link counts as yours. {done.rate ? `${done.rate}.` : ''} {done.payout || ''}
          </p>

          <div style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 14, padding: '16px 16px 18px', marginBottom: 14 }}>
            <p style={{ margin: 0, fontFamily: FL, fontWeight: 700, fontSize: 9.5, letterSpacing: 2, textTransform: 'uppercase', color: C.muted }}>Your link</p>
            <p style={{ margin: '8px 0 12px', fontSize: 16, wordBreak: 'break-all' }}>{done.link}</p>
            <button
              onClick={() => { navigator.clipboard?.writeText(`https://${done.link}`); setCopied(true); setTimeout(() => setCopied(false), 1600); }}
              style={{ background: C.blue, color: '#fff', border: 'none', borderRadius: 999, padding: '13px 24px', fontFamily: FL, fontWeight: 700, fontSize: 13, letterSpacing: 1, textTransform: 'uppercase', cursor: 'pointer' }}>
              {copied ? 'Copied' : 'Copy my link'}
            </button>
          </div>

          <a href={`/p?c=${done.code}`}
            style={{ display: 'block', textAlign: 'center', textDecoration: 'none', background: 'linear-gradient(180deg,#1B2130 0%,#11151C 100%)', border: `1px solid ${C.line}`, color: '#fff', borderRadius: 999, padding: '15px 0', fontFamily: FL, fontWeight: 700, fontSize: 13.5, letterSpacing: 1, textTransform: 'uppercase' }}>
            Open my promoter dashboard
          </a>
          <p style={{ color: C.muted, fontSize: 12.5, lineHeight: 1.5, margin: '14px 0 0', textAlign: 'center' }}>
            Save that page. It shows your clicks, your sales and what you&apos;ve earned.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: C.bg, color: '#fff', fontFamily: F, padding: '40px 20px 60px' }}>
      <div style={{ maxWidth: 480, margin: '0 auto' }}>
        <p style={{ fontFamily: FL, fontWeight: 700, fontSize: 10.5, letterSpacing: 3, color: C.blue, textTransform: 'uppercase', margin: '0 0 8px' }}>Goza · Get paid</p>
        <h1 style={{ fontFamily: FD, fontSize: 40, textTransform: 'uppercase', margin: '0 0 12px', lineHeight: 0.94 }}>
          You already<br />bring the people.<br /><span style={{ color: C.blue }}>Get paid for it.</span>
        </h1>
        <p style={{ color: '#fff', fontSize: 16.5, lineHeight: 1.5, margin: '0 0 6px' }}>
          🔥 You&apos;re the one in the group chat saying &ldquo;vamos.&rdquo; You&apos;re already doing the work. Now you get a cut.
        </p>
        <p style={{ color: C.muted, fontSize: 15, lineHeight: 1.55, margin: '0 0 24px' }}>
          Post your link. Anybody who buys through it is yours. <strong style={{ color: '#fff' }}>$2 every ticket.</strong>
        </p>

        {/* the math, because vague offers don't move anybody */}
        <div style={{ background: 'linear-gradient(160deg,#0B1B4F 0%,#0A0D16 70%)', border: '1px solid #22304f', borderRadius: 16, padding: '18px', marginBottom: 14 }}>
          <p style={{ margin: 0, fontFamily: FL, fontWeight: 700, fontSize: 10, letterSpacing: 2.2, color: '#8FB4FF', textTransform: 'uppercase' }}>What that looks like</p>
          <div style={{ marginTop: 12 }}>
            {[['Your 5 closest friends', '$10'], ['One group of 15', '$30'], ['A story that actually pops · 50', '$100'], ['You do it every month · 150', '$300']].map(([l, v]) => (
              <div key={l} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '7px 0' }}>
                <span style={{ color: '#cfd6e2', fontSize: 14.5 }}>{l}</span>
                <span style={{ fontFamily: FD, fontSize: 19, color: '#fff' }}>{v}</span>
              </div>
            ))}
          </div>
          <p style={{ color: '#8FB4FF', fontSize: 12.5, lineHeight: 1.5, margin: '10px 0 0' }}>
            No cap on it. Sell 300 and we pay 300.
          </p>
        </div>

        {/* why it's easy */}
        <div style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 16, padding: '18px', marginBottom: 14 }}>
          <p style={{ margin: 0, fontFamily: FL, fontWeight: 700, fontSize: 10, letterSpacing: 2.2, color: C.muted, textTransform: 'uppercase' }}>Why this is easy money</p>
          <p style={{ margin: '10px 0 0', color: '#fff', fontSize: 15, lineHeight: 1.65 }}>
            ✅ No quota, no interview, no boss<br />
            ✅ One link, works for every show<br />
            ✅ You see your clicks and sales live<br />
            ✅ Paid after each night, not &ldquo;eventually&rdquo;<br />
            ✅ Take it in cash or free tickets + bar tabs
          </p>
        </div>

        {/* the choice, framed */}
        <div style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 16, padding: '18px', marginBottom: 26 }}>
          <p style={{ margin: 0, fontFamily: FL, fontWeight: 700, fontSize: 10, letterSpacing: 2.2, color: C.muted, textTransform: 'uppercase' }}>Two ways to get paid</p>
          <p style={{ margin: '10px 0 0', color: '#fff', fontSize: 15, lineHeight: 1.6 }}>
            💸 <strong>Cash</strong> &mdash; Venmo or Zelle after the show<br />
            🎟️ <strong>Credits</strong> &mdash; tickets free, bar tab covered, merch when it drops
          </p>
          <p style={{ color: C.muted, fontSize: 13, lineHeight: 1.5, margin: '10px 0 0' }}>
            Most people take credits and just never pay to go out again. Your call.
          </p>
        </div>

        <p style={{ fontFamily: FD, fontSize: 21, textTransform: 'uppercase', margin: '0 0 4px' }}>Grab your link 👇</p>
        <p style={{ color: C.muted, fontSize: 14, lineHeight: 1.5, margin: '0 0 18px' }}>
          Takes 30 seconds. You&apos;ll be posting before the next song ends.
        </p>

        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" style={INP} />
        <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(314) 555-0123" inputMode="tel" type="tel" style={INP} />
        <input value={city} onChange={(e) => setCity(e.target.value)} placeholder="Your city — St. Louis, SLC, KC…" style={INP} />

        <p style={{ fontFamily: FL, fontWeight: 700, fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', color: C.muted, margin: '8px 0 8px' }}>How do you want paid?</p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 9, marginBottom: 11 }}>
          {([['cash', 'Cash', 'Venmo or Zelle'], ['credit', 'Credits', 'Tickets + bar']] as const).map(([v, t, s]) => (
            <button key={v} onClick={() => setPref(v)}
              style={{ background: pref === v ? C.blue : C.card, border: `1px solid ${pref === v ? C.blue : C.line}`, borderRadius: 13, padding: '14px 10px', cursor: 'pointer', textAlign: 'left' }}>
              <span style={{ display: 'block', color: '#fff', fontFamily: FL, fontWeight: 700, fontSize: 14.5 }}>{t}</span>
              <span style={{ display: 'block', color: pref === v ? '#C9D6FF' : C.muted, fontSize: 12.5, marginTop: 3 }}>{s}</span>
            </button>
          ))}
        </div>

        {pref === 'cash' && (
          <input value={handle} onChange={(e) => setHandle(e.target.value)} placeholder="@your-venmo or Zelle number/email" style={INP} />
        )}

        {err && <p style={{ color: '#FF6B6B', fontSize: 13.5, margin: '2px 0 12px' }}>{err}</p>}

        <button onClick={submit} disabled={busy}
          style={{ width: '100%', background: C.blue, color: '#fff', border: 'none', borderRadius: 999, padding: '18px 0', fontFamily: FL, fontWeight: 700, fontSize: 15.5, letterSpacing: 1.1, textTransform: 'uppercase', cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.6 : 1, boxShadow: '0 8px 22px rgba(17,64,240,.4)' }}>
          {busy ? 'Setting you up…' : 'Get my link'}
        </button>

        <p style={{ color: '#6d7787', fontSize: 12, lineHeight: 1.55, margin: '16px 0 0' }}>
          You&apos;re paid on tickets that actually get scanned in at a paid event. Refunded or no-show tickets don&apos;t count. Over $600 a year we&apos;ll need a W-9.
        </p>
      </div>
    </div>
  );
}
