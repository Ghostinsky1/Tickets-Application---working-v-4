'use client';

/*
  ADMIN v2 — Desenfocado chrome style. Multi-event.
  Tabs: Events (create/edit shows, descriptions, ticket types, flyer, page link),
  Dashboard, Roster, Fees — all scoped to the selected event.
  Auth: passcode → x-admin-key → ADMIN_KEY secret. Key in sessionStorage only.
*/

import { useState, useEffect, useCallback } from 'react';
import { BACKEND, DEFAULT_EVENT_ID, money, fmtDate } from '@/lib/api';

const T = {
  red: '#c25b6e', redBright: '#d47088', chrome: '#c25b6e', dim: '#8a8f98',
  white: '#ffffff', text: '#d6d9df', line: 'rgba(255,255,255,0.08)',
  card: 'rgba(14,14,18,0.7)',
};
const HEAD = "'Helvetica Neue', Helvetica, Arial, sans-serif";
const BODY = "'Helvetica Neue', Helvetica, Arial, sans-serif";

async function adminApi(key: string, action: string, extra: any = {}) {
  const res = await fetch(`${BACKEND}/admin`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-admin-key': key },
    body: JSON.stringify({ action, ...extra }),
  });
  const body = await res.json().catch(() => ({ error: `Server ${res.status}` }));
  if (!res.ok) throw new Error(body.error || `Request failed (${res.status})`);
  return body;
}

export default function Admin() {
  const [key, setKey] = useState('');
  const [authed, setAuthed] = useState(false);
  useEffect(() => {
    const k = sessionStorage.getItem('gz_admin_key');
    if (k) { setKey(k); setAuthed(true); }
  }, []);

  return (
    <div style={{ minHeight: '100vh', background: 'radial-gradient(120% 100% at 50% 0%, #1a0000 0%, #060000 45%, #000 100%)', fontFamily: BODY, color: T.text }}>
      <style>{`
        * { box-sizing: border-box; }
        input:focus, button:focus, textarea:focus, select:focus { outline: 1px solid ${T.red}; }
        ::placeholder { color: #6a6060; }
      `}</style>
      {authed
        ? <Panel adminKey={key} onLogout={() => { sessionStorage.removeItem('gz_admin_key'); setAuthed(false); setKey(''); }} />
        : <Login onOk={(k) => { sessionStorage.setItem('gz_admin_key', k); setKey(k); setAuthed(true); }} />}
    </div>
  );
}

/* ---------------- LOGIN ---------------- */
function Login({ onOk }: { onOk: (k: string) => void }) {
  const [pass, setPass] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const go = async () => {
    if (!pass.trim()) return;
    setBusy(true); setErr('');
    try { await adminApi(pass.trim(), 'login'); onOk(pass.trim()); }
    catch (e: any) { setErr(e.message); }
    finally { setBusy(false); }
  };
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ width: '100%', maxWidth: 380, background: T.card, border: `1px solid ${T.line}`, padding: '40px 32px', textAlign: 'center' }}>
        <p style={{ fontFamily: HEAD, fontWeight: 800, fontSize: 30, letterSpacing: 2, color: T.white, margin: '0 0 4px' }}>GOZA</p>
        <p style={{ fontFamily: HEAD, fontWeight: 700, fontSize: 10, letterSpacing: 6, textTransform: 'uppercase', color: T.dim, margin: '0 0 30px' }}>Admin Panel</p>
        <input type="password" value={pass} placeholder="PASSCODE"
          onChange={(e) => setPass(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && go()}
          style={{ width: '100%', background: '#141418', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 12, color: T.white, fontFamily: BODY, fontWeight: 400, fontSize: 16, padding: '14px 16px', letterSpacing: 2, textAlign: 'center', outline: 'none', boxSizing: 'border-box' }} />
        {err && <p style={{ color: T.redBright, fontSize: 12.5, margin: '12px 0 0' }}>{err}</p>}
        <button onClick={go} disabled={busy || !pass.trim()}
          style={{ width: '100%', marginTop: 18, background: T.red, border: 'none', color: T.white, fontFamily: HEAD, fontWeight: 900, fontSize: 14, letterSpacing: 5, padding: '13px 0', cursor: 'pointer', opacity: busy || !pass.trim() ? 0.5 : 1 }}>
          {busy ? 'CHECKING…' : 'ENTER'}
        </button>
      </div>
    </div>
  );
}

/* ---------------- PANEL ---------------- */
const NAV = [
  { id: 'events', label: 'Events' },
  { id: 'dash', label: 'Dashboard' },
  { id: 'orders', label: 'Orders' },
  { id: 'roster', label: 'Roster' },
  { id: 'fees', label: 'Fees' },
  { id: 'appearance', label: 'Appearance' },
] as const;
type Tab = (typeof NAV)[number]['id'];

function Panel({ adminKey, onLogout }: { adminKey: string; onLogout: () => void }) {
  const [tab, setTab] = useState<Tab>('events');
  const [events, setEvents] = useState<any[]>([]);
  const [eventId, setEventId] = useState(DEFAULT_EVENT_ID);
  const [evErr, setEvErr] = useState('');

  const loadEvents = useCallback(() => {
    setEvErr('');
    adminApi(adminKey, 'list_events')
      .then((d) => {
        setEvents(d.events);
        if (d.events.length && !d.events.find((e: any) => e.id === eventId)) setEventId(d.events[0].id);
      })
      .catch((e) => setEvErr(e.message));
  }, [adminKey, eventId]);
  useEffect(() => { loadEvents(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const current = events.find((e) => e.id === eventId);

  return (
    <div style={{ display: 'flex', minHeight: '100vh', flexWrap: 'wrap', background: 'radial-gradient(120% 80% at 50% 0%, #2a1018 0%, #0c0508 55%, #000 100%)', backgroundAttachment: 'fixed', fontFamily: BODY }}>
      <aside style={{ width: 220, borderRight: `1px solid ${T.line}`, display: 'flex', flexDirection: 'column', background: 'rgba(8,8,12,0.55)', backdropFilter: 'blur(8px)', flexShrink: 0 }}>
        <div style={{ padding: '22px 16px 18px', borderBottom: `1px solid ${T.line}`, textAlign: 'center' }}>
          <p style={{ fontFamily: HEAD, fontWeight: 800, fontSize: 22, letterSpacing: 2, color: T.white, margin: 0 }}>GOZA</p>
          <p style={{ fontFamily: HEAD, fontWeight: 600, fontSize: 10.5, letterSpacing: 1, color: T.red, margin: '5px 0 0' }}>Admin</p>
        </div>
        <nav style={{ flex: 1, padding: '14px 0' }}>
          {NAV.map((n) => (
            <button key={n.id} onClick={() => setTab(n.id)}
              style={{ display: 'block', width: 'calc(100% - 16px)', margin: '2px 8px', textAlign: 'left', padding: '11px 16px', borderRadius: 10, fontFamily: HEAD, fontWeight: 600, fontSize: 14.5, letterSpacing: -0.1, background: tab === n.id ? T.red : 'none', border: 'none', color: tab === n.id ? '#fff' : T.dim, cursor: 'pointer', transition: 'background 0.12s' }}>
              {n.label}
            </button>
          ))}
        </nav>
        <div style={{ padding: '16px 20px', borderTop: `1px solid ${T.line}` }}>
          <button onClick={onLogout} style={{ background: 'none', border: 'none', color: T.dim, fontFamily: HEAD, fontWeight: 600, fontSize: 13.5, letterSpacing: 0, cursor: 'pointer', padding: 0 }}>Log out</button>
        </div>
      </aside>

      <main style={{ flex: 1, minWidth: 300, padding: '26px 26px 60px' }}>
        {/* event selector — everything below is scoped to it */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 22 }}>
          <span style={{ fontFamily: HEAD, fontWeight: 600, fontSize: 12.5, letterSpacing: 0, color: T.dim }}>Event</span>
          <select value={eventId} onChange={(e) => setEventId(e.target.value)}
            style={{ background: '#141418', border: `1px solid rgba(255,255,255,0.12)`, borderRadius: 12, color: T.white, fontFamily: BODY, fontSize: 14.5, padding: '11px 14px', minWidth: 240 }}>
            {events.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
            {!events.length && <option value={eventId}>Loading events…</option>}
          </select>
          {current && (
            <a href={`/e?id=${current.id}`} target="_blank" rel="noreferrer"
              style={{ fontFamily: HEAD, fontWeight: 600, fontSize: 12.5, color: '#fff', textDecoration: 'none', background: 'rgba(255,255,255,0.06)', border: `1px solid rgba(255,255,255,0.14)`, borderRadius: 20, padding: '9px 16px' }}>
              View page ↗
            </a>
          )}
          {current && (
            <a href={`/scan?e=${current.id}`} target="_blank" rel="noreferrer"
              style={{ fontFamily: HEAD, fontWeight: 600, fontSize: 12.5, color: '#fff', textDecoration: 'none', background: 'rgba(255,255,255,0.06)', border: `1px solid rgba(255,255,255,0.14)`, borderRadius: 20, padding: '9px 16px' }}>
              Scanner ↗
            </a>
          )}
        </div>
        {evErr && <Err msg={evErr} retry={loadEvents} />}

        {tab === 'events' && <Events adminKey={adminKey} events={events} eventId={eventId} setEventId={setEventId} refresh={loadEvents} />}
        {tab === 'dash' && <Dashboard adminKey={adminKey} eventId={eventId} />}
        {tab === 'orders' && <Orders adminKey={adminKey} eventId={eventId} />}
        {tab === 'roster' && <Roster adminKey={adminKey} eventId={eventId} />}
        {tab === 'fees' && <Fees adminKey={adminKey} eventId={eventId} />}
        {tab === 'appearance' && <Appearance adminKey={adminKey} />}
      </main>
    </div>
  );
}

/* ---------------- SHARED ---------------- */
function H({ children }: { children: React.ReactNode }) {
  return <h2 style={{ fontFamily: HEAD, fontWeight: 800, fontSize: 28, letterSpacing: -0.5, color: T.white, margin: '0 0 20px' }}>{children}</h2>;
}
function Sub({ children }: { children: React.ReactNode }) {
  return <p style={{ fontFamily: HEAD, fontWeight: 700, fontSize: 15, letterSpacing: -0.1, color: T.white, margin: '26px 0 12px' }}>{children}</p>;
}
function Badge({ on, yes, no }: { on: boolean; yes: string; no: string }) {
  return (
    <span style={{ display: 'inline-block', padding: '4px 11px', borderRadius: 20, fontFamily: HEAD, fontWeight: 600, fontSize: 11, letterSpacing: 0.2, ...(on ? { background: 'rgba(61,220,132,0.12)', border: '1px solid rgba(61,220,132,0.4)', color: '#3ddc84' } : { background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.14)', color: T.dim }) }}>{on ? yes : no}</span>
  );
}
function Err({ msg, retry }: { msg: string; retry: () => void }) {
  return (
    <div style={{ border: `1px solid ${T.red}`, background: 'rgba(194,91,110,0.1)', borderRadius: 14, padding: 16, marginBottom: 16 }}>
      <p style={{ color: T.redBright, fontSize: 13.5, margin: '0 0 10px' }}>{msg}</p>
      <button onClick={retry} style={{ background: T.red, border: 'none', borderRadius: 20, color: '#fff', fontFamily: HEAD, fontWeight: 600, fontSize: 12.5, padding: '8px 18px', cursor: 'pointer' }}>Retry</button>
    </div>
  );
}
const Loading = () => <p style={{ color: T.dim, fontSize: 14 }}>Loading…</p>;
const LBL: React.CSSProperties = { display: 'block', fontFamily: HEAD, fontWeight: 600, fontSize: 11.5, letterSpacing: 0.5, color: T.dim, marginBottom: 7 };
const INP: React.CSSProperties = { width: '100%', background: '#141418', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 12, color: T.white, fontFamily: BODY, fontSize: 15, padding: '12px 14px', outline: 'none', boxSizing: 'border-box' };
const BTN: React.CSSProperties = { background: T.red, border: 'none', borderRadius: 24, color: '#fff', fontFamily: HEAD, fontWeight: 700, fontSize: 14, letterSpacing: 0.3, padding: '13px 30px', cursor: 'pointer' };
const GHOST: React.CSSProperties = { background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.14)', borderRadius: 20, color: '#fff', fontFamily: HEAD, fontWeight: 600, fontSize: 11.5, letterSpacing: 0.3, padding: '8px 16px', cursor: 'pointer' };

function toLocalInput(iso?: string | null) {
  if (!iso) return '';
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

/* ---------------- EVENTS ---------------- */
/* ---------- inline orders list shown inside the event editor ---------- */
function EventOrders({ adminKey, eventId }: { adminKey: string; eventId: string }) {
  const [rows, setRows] = useState<any[] | null>(null);
  const [q, setQ] = useState('');
  const [err, setErr] = useState('');
  const [open, setOpen] = useState(true);

  const load = useCallback(() => {
    setErr(''); setRows(null);
    adminApi(adminKey, 'list_orders', { eventId }).then((d) => setRows(d.orders)).catch((e) => setErr(e.message));
  }, [adminKey, eventId]);
  useEffect(load, [load]);

  const needle = q.trim().toLowerCase();
  const filtered = rows ? (needle ? rows.filter((r) => `${r.buyer} ${r.email} ${r.phone} ${r.shortId}`.toLowerCase().includes(needle)) : rows) : [];
  const revenue = rows ? rows.reduce((a, r) => a + Number(r.total || 0), 0) : 0;

  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 24, marginBottom: 12 }}>
        <span style={{ fontFamily: HEAD, fontWeight: 900, fontSize: 13, letterSpacing: 4, textTransform: 'uppercase', color: T.chrome }}>
          Orders {rows ? `(${rows.length})` : ''}
        </span>
        <div style={{ display: 'flex', gap: 8 }}>
          <button style={GHOST} onClick={load}>REFRESH</button>
          <button style={GHOST} onClick={() => setOpen((v) => !v)}>{open ? 'HIDE' : 'SHOW'}</button>
        </div>
      </div>

      {open && (
        <>
          {err && <Err msg={err} retry={load} />}
          {!rows && !err && <Loading />}
          {rows && (
            <>
              <p style={{ color: T.dim, fontSize: 13, margin: '0 0 12px', letterSpacing: 1 }}>
                {rows.length} order{rows.length === 1 ? '' : 's'} · {money(revenue)} collected
              </p>
              {rows.length > 0 && (
                <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="SEARCH NAME, PHONE, EMAIL, OR ORDER #"
                  style={{ ...INP, maxWidth: 460, letterSpacing: 1.5, marginBottom: 14 }} />
              )}
              {filtered.length === 0 && <p style={{ color: T.dim, fontSize: 13.5 }}>{rows.length === 0 ? 'No orders yet.' : 'No matches.'}</p>}
              {filtered.map((r) => (
                <div key={r.id} style={{ background: T.card, border: `1px solid ${T.line}`, borderRadius: 12, padding: '13px 16px', marginBottom: 9, maxWidth: 640 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8 }}>
                    <div>
                      <p style={{ color: T.white, fontWeight: 600, fontSize: 14, margin: '0 0 2px' }}>
                        {r.buyer} <span style={{ color: T.dim, fontWeight: 400, fontSize: 12.5 }}>· #{r.shortId} · {money(r.total)}</span>
                      </p>
                      <p style={{ color: T.dim, fontSize: 12.5, margin: 0, lineHeight: 1.7 }}>
                        {r.phone ? `${r.phone} · ` : ''}{r.email}<br />
                        {r.tickets} ticket{r.tickets === 1 ? '' : 's'} · {r.checkedIn} in · {new Date(r.at).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                      </p>
                      {r.deliveryError && <p style={{ color: T.redBright, fontSize: 12, margin: '4px 0 0' }}>Delivery issue: {r.deliveryError}</p>}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      <Badge on={r.emailSent} yes="EMAILED" no="NO EMAIL" />
                      {r.phone ? <Badge on={r.smsSent} yes="TEXTED" no="NO SMS" /> : null}
                    </div>
                  </div>
                </div>
              ))}
            </>
          )}
        </>
      )}
    </div>
  );
}

function Events({ adminKey, events, eventId, setEventId, refresh }: any) {
  const [detail, setDetail] = useState<any>(null);
  const [types, setTypes] = useState<any[]>([]);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  const loadDetail = useCallback(() => {
    if (!eventId) return;
    adminApi(adminKey, 'get_event', { eventId })
      .then((d) => { setDetail({ ...d.event }); setTypes(d.ticketTypes); })
      .catch((e) => setErr(e.message));
  }, [adminKey, eventId]);
  useEffect(() => { setDetail(null); loadDetail(); }, [loadDetail]);

  const flash = (m: string) => { setMsg(m); setTimeout(() => setMsg(''), 3500); };

  /* --- create --- */
  const [nw, setNw] = useState({ name: '', date: '', location: '', description: '' });
  const [creating, setCreating] = useState(false);
  const create = async () => {
    setCreating(true); setErr('');
    try {
      const d = await adminApi(adminKey, 'create_event', {
        name: nw.name, location: nw.location, description: nw.description,
        date: nw.date ? new Date(nw.date).toISOString() : null,
      });
      setNw({ name: '', date: '', location: '', description: '' });
      refresh(); setEventId(d.event.id);
      flash(`"${d.event.name}" created — now add a ticket type below so it can sell.`);
    } catch (e: any) { setErr(e.message); }
    finally { setCreating(false); }
  };

  /* --- save edits --- */
  const [saving, setSaving] = useState(false);
  const saveUpsells = async () => {
    setSaving(true); setErr('');
    try {
      await adminApi(adminKey, 'update_event', {
        eventId,
        upsell_bump_enabled: !!detail.upsell_bump_enabled,
        upsell_bump_trigger_qty: Number(detail.upsell_bump_trigger_qty || 2),
        upsell_bump_add_qty: Number(detail.upsell_bump_add_qty || 1),
        upsell_bump_discount: Number(detail.upsell_bump_discount || 0),
        upsell_addon_enabled: !!detail.upsell_addon_enabled,
        upsell_addon_ticket_type_id: detail.upsell_addon_ticket_type_id || '',
        upsell_addon_pitch: detail.upsell_addon_pitch || '',
        button_color: detail.button_color || '',
      });
      refresh(); flash('Saved ✓');
    } catch (e: any) { setErr(e.message); }
    finally { setSaving(false); }
  };

  const save = async () => {
    setSaving(true); setErr('');
    try {
      let lat: number | undefined, lon: number | undefined;
      try {
        const g = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(detail.location)}`).then((r) => r.json());
        if (g?.[0]) { lat = +g[0].lat; lon = +g[0].lon; }
      } catch { /* geocode is best-effort */ }
      await adminApi(adminKey, 'update_event', {
        eventId,
        name: detail.name, location: detail.location,
        description: detail.description || '',
        date: detail.date ? new Date(detail.date).toISOString() : undefined,
        latitude: lat, longitude: lon,
      });
      refresh(); flash('Event saved ✓');
    } catch (e: any) { setErr(e.message); }
    finally { setSaving(false); }
  };

  /* --- ticket types --- */
  const [ttNew, setTtNew] = useState({ name: 'General Admission', price: '25', quantity: '100' });
  const addType = async () => {
    setErr('');
    try {
      await adminApi(adminKey, 'create_ticket_type', { eventId, ...ttNew });
      setTtNew({ name: '', price: '', quantity: '' });
      loadDetail(); flash('Ticket type added ✓');
    } catch (e: any) { setErr(e.message); }
  };
  const saveType = async (t: any) => {
    setErr('');
    try {
      await adminApi(adminKey, 'update_ticket_type', { ticketTypeId: t.id, name: t.name, price: t.price, quantity: t.quantity });
      loadDetail(); flash('Ticket type saved ✓');
    } catch (e: any) { setErr(e.message); }
  };

  /* --- flyer --- */
  const [uploading, setUploading] = useState(false);
  const onFlyer = (file: File | null) => {
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) { setErr('Flyer must be under 8MB'); return; }
    setUploading(true); setErr('');
    const r = new FileReader();
    r.onload = async () => {
      try {
        const d = await adminApi(adminKey, 'upload_flyer', {
          eventId, contentType: file.type,
          fileBase64: String(r.result).split(',')[1],
        });
        setDetail((p: any) => ({ ...p, image_url: d.imageUrl }));
        refresh(); flash('Flyer uploaded ✓ — the event page updates instantly.');
      } catch (e: any) { setErr(e.message); }
      finally { setUploading(false); }
    };
    r.onerror = () => { setErr('Could not read that file'); setUploading(false); };
    r.readAsDataURL(file);
  };
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingMusic, setUploadingMusic] = useState(false);
  const onAsset = (file: File | null, action: string, field: string, urlKey: string, maxMB: number, setBusy: (b: boolean) => void) => {
    if (!file) return;
    if (file.size > maxMB * 1024 * 1024) { setErr(`File must be under ${maxMB}MB`); return; }
    setBusy(true); setErr('');
    const rd = new FileReader();
    rd.onload = async () => {
      try {
        const d = await adminApi(adminKey, action, { eventId, contentType: file.type, fileBase64: String(rd.result).split(',')[1] });
        setDetail((p: any) => ({ ...p, [field]: d[urlKey] }));
        refresh(); flash('Uploaded ✓');
      } catch (e: any) { setErr(e.message); }
      finally { setBusy(false); }
    };
    rd.onerror = () => { setErr('Could not read that file'); setBusy(false); };
    rd.readAsDataURL(file);
  };
  const removeAsset = async (action: string, field: string) => {
    setErr('');
    try { await adminApi(adminKey, action, { eventId }); setDetail((p: any) => ({ ...p, [field]: null })); refresh(); flash('Removed'); }
    catch (e: any) { setErr(e.message); }
  };

  const removeFlyer = async () => {
    setErr('');
    try {
      await adminApi(adminKey, 'remove_flyer', { eventId });
      setDetail((p: any) => ({ ...p, image_url: null }));
      refresh(); flash('Flyer removed');
    } catch (e: any) { setErr(e.message); }
  };

  const pageLink = typeof window !== 'undefined' && detail ? `${window.location.origin}/e?id=${detail.id}` : '';

  return (
    <>
      <H>Events</H>
      {msg && <p style={{ color: T.chrome, fontSize: 13.5, margin: '0 0 14px' }}>{msg}</p>}
      {err && <p style={{ color: T.redBright, fontSize: 13.5, margin: '0 0 14px' }}>{err}</p>}

      {/* create */}
      <div style={{ background: T.card, border: `1px solid ${T.line}`, padding: 20, marginBottom: 26, maxWidth: 640 }}>
        <Sub>Create a new event</Sub>
        <div style={{ display: 'grid', gap: 12 }}>
          <div><label style={LBL}>Event name</label>
            <input style={INP} value={nw.name} onChange={(e) => setNw({ ...nw, name: e.target.value })} placeholder="Desenfocado KC" /></div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div><label style={LBL}>Date &amp; time</label>
              <input style={INP} type="datetime-local" value={nw.date} onChange={(e) => setNw({ ...nw, date: e.target.value })} /></div>
            <div><label style={LBL}>Venue / location</label>
              <input style={INP} value={nw.location} onChange={(e) => setNw({ ...nw, location: e.target.value })} placeholder="The Truman, Kansas City, MO" /></div>
          </div>
          <div><label style={LBL}>Description (one line per paragraph)</label>
            <textarea style={{ ...INP, minHeight: 90, resize: 'vertical' }} value={nw.description} onChange={(e) => setNw({ ...nw, description: e.target.value })} placeholder={'Perreo Electrico takes over KC\n21+ event'} /></div>
        </div>
        <button style={{ ...BTN, marginTop: 16, opacity: creating ? 0.5 : 1 }} disabled={creating} onClick={create}>
          {creating ? 'CREATING…' : 'CREATE EVENT'}
        </button>
      </div>

      {/* edit selected */}
      {!detail ? <Loading /> : (
        <div style={{ background: T.card, border: `1px solid ${T.line}`, padding: 20, maxWidth: 640 }}>
          <Sub>Editing: {detail.name}</Sub>

          {pageLink && (
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', margin: '0 0 18px' }}>
              <code style={{ color: T.chrome, fontSize: 12.5, background: 'rgba(0,0,0,0.6)', padding: '8px 12px', border: `1px solid ${T.line}` }}>{pageLink}</code>
              <button style={GHOST} onClick={() => { navigator.clipboard?.writeText(pageLink); flash('Link copied ✓'); }}>COPY LINK</button>
            </div>
          )}

          <div style={{ display: 'grid', gap: 12 }}>
            <div><label style={LBL}>Event name</label>
              <input style={INP} value={detail.name || ''} onChange={(e) => setDetail({ ...detail, name: e.target.value })} /></div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div><label style={LBL}>Date &amp; time</label>
                <input style={INP} type="datetime-local" value={toLocalInput(detail.date)} onChange={(e) => setDetail({ ...detail, date: e.target.value })} /></div>
              <div><label style={LBL}>Venue / location</label>
                <input style={INP} value={detail.location || ''} onChange={(e) => setDetail({ ...detail, location: e.target.value })} /></div>
            </div>
            <div><label style={LBL}>Description</label>
              <textarea style={{ ...INP, minHeight: 110, resize: 'vertical' }} value={detail.description || ''} onChange={(e) => setDetail({ ...detail, description: e.target.value })} /></div>
          </div>
          <button style={{ ...BTN, marginTop: 16, opacity: saving ? 0.5 : 1 }} disabled={saving} onClick={save}>
            {saving ? 'SAVING…' : 'SAVE EVENT'}
          </button>

          {/* flyer */}
          <Sub>Flyer</Sub>
          {detail.image_url
            ? <img src={detail.image_url} alt="flyer" style={{ maxWidth: 220, display: 'block', border: `1px solid ${T.line}`, marginBottom: 12 }} />
            : <p style={{ color: T.dim, fontSize: 13, margin: '0 0 12px' }}>No flyer yet — the page shows a generated placeholder until you add one.</p>}
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <label style={{ ...GHOST, display: 'inline-block' }}>
              {uploading ? 'UPLOADING…' : detail.image_url ? 'REPLACE FLYER' : 'UPLOAD FLYER'}
              <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" style={{ display: 'none' }}
                disabled={uploading} onChange={(e) => onFlyer(e.target.files?.[0] || null)} />
            </label>
            {detail.image_url && <button style={GHOST} onClick={removeFlyer}>REMOVE</button>}
          </div>
          <p style={{ color: '#6a6060', fontSize: 11.5, margin: '10px 0 0' }}>
            The event page background auto-tints to match the flyer&apos;s colors.
          </p>

          {/* logo */}
          <Sub>Logo (shows on the event page)</Sub>
          {detail.logo_url
            ? <img src={detail.logo_url} alt="logo" style={{ maxHeight: 46, background: '#1a1a1a', padding: 8, borderRadius: 6, marginBottom: 10, display: 'block' }} />
            : <p style={{ color: T.dim, fontSize: 13, margin: '0 0 10px' }}>No logo yet — the page shows the Goza wordmark.</p>}
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <label style={{ ...GHOST, display: 'inline-block' }}>
              {uploadingLogo ? 'UPLOADING…' : detail.logo_url ? 'REPLACE LOGO' : 'UPLOAD LOGO'}
              <input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" style={{ display: 'none' }}
                disabled={uploadingLogo} onChange={(e) => onAsset(e.target.files?.[0] || null, 'upload_logo', 'logo_url', 'logoUrl', 4, setUploadingLogo)} />
            </label>
            {detail.logo_url && <button style={GHOST} onClick={() => removeAsset('remove_logo', 'logo_url')}>REMOVE</button>}
          </div>

          {/* music */}
          <Sub>Event music (press-play on the page)</Sub>
          {detail.music_url
            ? <audio src={detail.music_url} controls style={{ width: '100%', maxWidth: 320, marginBottom: 10 }} />
            : <p style={{ color: T.dim, fontSize: 13, margin: '0 0 10px' }}>No track yet — the play button is hidden until you add one.</p>}
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <label style={{ ...GHOST, display: 'inline-block' }}>
              {uploadingMusic ? 'UPLOADING…' : detail.music_url ? 'REPLACE TRACK' : 'UPLOAD TRACK'}
              <input type="file" accept="audio/mpeg,audio/mp3,audio/mp4,audio/x-m4a,audio/wav,audio/ogg" style={{ display: 'none' }}
                disabled={uploadingMusic} onChange={(e) => onAsset(e.target.files?.[0] || null, 'upload_music', 'music_url', 'musicUrl', 12, setUploadingMusic)} />
            </label>
            {detail.music_url && <button style={GHOST} onClick={() => removeAsset('remove_music', 'music_url')}>REMOVE</button>}
          </div>
          <p style={{ color: '#6a6060', fontSize: 11.5, margin: '10px 0 0' }}>MP3, M4A, or WAV up to 12MB. Loops while they browse.</p>

          {/* upsells */}
          <Sub>Upsells (shown in the cart)</Sub>
          <div style={{ background: 'rgba(0,0,0,0.3)', border: `1px solid ${T.line}`, padding: 16, marginBottom: 12 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, cursor: 'pointer', fontSize: 14 }}>
              <input type="checkbox" checked={!!detail.upsell_bump_enabled} onChange={(e) => setDetail({ ...detail, upsell_bump_enabled: e.target.checked })} style={{ width: 18, height: 18, accentColor: T.red }} />
              <span style={{ color: T.white, fontWeight: 600 }}>Group deal — buy more, save on the batch</span>
            </label>
            {detail.upsell_bump_enabled && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, paddingLeft: 28 }}>
                <div><label style={LBL}>Show at qty</label><input style={INP} type="number" min="1" value={detail.upsell_bump_trigger_qty ?? 2} onChange={(e) => setDetail({ ...detail, upsell_bump_trigger_qty: e.target.value })} /></div>
                <div><label style={LBL}>Add how many</label><input style={INP} type="number" min="1" value={detail.upsell_bump_add_qty ?? 1} onChange={(e) => setDetail({ ...detail, upsell_bump_add_qty: e.target.value })} /></div>
                <div><label style={LBL}>$ off batch</label><input style={INP} type="number" min="0" value={detail.upsell_bump_discount ?? 10} onChange={(e) => setDetail({ ...detail, upsell_bump_discount: e.target.value })} /></div>
              </div>
            )}
          </div>
          <div style={{ background: 'rgba(0,0,0,0.3)', border: `1px solid ${T.line}`, padding: 16, marginBottom: 12 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, cursor: 'pointer', fontSize: 14 }}>
              <input type="checkbox" checked={!!detail.upsell_addon_enabled} onChange={(e) => setDetail({ ...detail, upsell_addon_enabled: e.target.checked })} style={{ width: 18, height: 18, accentColor: T.red }} />
              <span style={{ color: T.white, fontWeight: 600 }}>Add-on — pitch another ticket type</span>
            </label>
            {detail.upsell_addon_enabled && (
              <div style={{ display: 'grid', gap: 10, paddingLeft: 28 }}>
                <div><label style={LBL}>Which ticket type</label>
                  <select style={INP} value={detail.upsell_addon_ticket_type_id || ''} onChange={(e) => setDetail({ ...detail, upsell_addon_ticket_type_id: e.target.value })}>
                    <option value="">Choose…</option>
                    {types.map((t) => <option key={t.id} value={t.id}>{t.name} · ${t.price}</option>)}
                  </select></div>
                <div><label style={LBL}>Pitch line</label><input style={INP} value={detail.upsell_addon_pitch || ''} onChange={(e) => setDetail({ ...detail, upsell_addon_pitch: e.target.value })} placeholder="Make it a night — add a VIP table" /></div>
              </div>
            )}
          </div>

          {/* per-event button color */}
          <Sub>Button color</Sub>
          <div style={{ background: 'rgba(0,0,0,0.3)', border: `1px solid ${T.line}`, padding: 16, marginBottom: 12 }}>
            <p style={{ color: T.dim, fontSize: 12.5, margin: '0 0 12px', lineHeight: 1.5 }}>
              Sets the Get Tickets / Pay buttons for this event. Leave blank to use the site default.
            </p>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 12 }}>
              {['#c25b6e', '#7c3aed', '#2563eb', '#e11d48', '#059669', '#ea580c', '#db2777', '#0891b2'].map((c) => (
                <button key={c} onClick={() => setDetail({ ...detail, button_color: c })}
                  aria-label={c}
                  style={{ width: 34, height: 34, borderRadius: '50%', background: c, border: (detail.button_color || '').toLowerCase() === c ? '3px solid #fff' : '1px solid rgba(255,255,255,0.2)', cursor: 'pointer' }} />
              ))}
            </div>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <input type="color" value={detail.button_color || '#c25b6e'} onChange={(e) => setDetail({ ...detail, button_color: e.target.value })}
                style={{ width: 46, height: 40, background: 'none', border: `1px solid ${T.line}`, cursor: 'pointer', padding: 2 }} />
              <input style={{ ...INP, maxWidth: 140, fontFamily: 'monospace' }} value={detail.button_color || ''} placeholder="#c25b6e"
                onChange={(e) => setDetail({ ...detail, button_color: e.target.value })} />
              {detail.button_color && (
                <button style={GHOST} onClick={() => setDetail({ ...detail, button_color: '' })}>USE SITE DEFAULT</button>
              )}
              <span style={{ display: 'inline-flex', alignItems: 'center', background: detail.button_color || '#c25b6e', color: '#fff', fontSize: 12.5, fontWeight: 700, padding: '9px 16px', borderRadius: 20 }}>Preview</span>
            </div>
          </div>

          <button style={{ ...BTN, opacity: saving ? 0.5 : 1 }} disabled={saving} onClick={saveUpsells}>
            {saving ? 'SAVING…' : 'SAVE UPSELLS + MEDIA'}
          </button>

          {/* ticket types */}
          <Sub>Ticket types</Sub>
          {types.length === 0 && <p style={{ color: T.redBright, fontSize: 13, margin: '0 0 12px' }}>No ticket types yet — the page can&apos;t sell until you add one.</p>}
          {types.map((t, i) => (
            <div key={t.id} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr auto', gap: 8, alignItems: 'end', marginBottom: 10 }}>
              <div>{i === 0 && <label style={LBL}>Name</label>}
                <input style={INP} value={t.name} onChange={(e) => setTypes(types.map((x) => x.id === t.id ? { ...x, name: e.target.value } : x))} /></div>
              <div>{i === 0 && <label style={LBL}>Price $</label>}
                <input style={INP} type="number" step="1" min="0" value={t.price} onChange={(e) => setTypes(types.map((x) => x.id === t.id ? { ...x, price: e.target.value } : x))} /></div>
              <div>{i === 0 && <label style={LBL}>Qty</label>}
                <input style={INP} type="number" step="1" min={t.sold || 0} value={t.quantity} onChange={(e) => setTypes(types.map((x) => x.id === t.id ? { ...x, quantity: e.target.value } : x))} /></div>
              <button style={{ ...GHOST, height: 42 }} onClick={() => saveType(t)}>SAVE</button>
            </div>
          ))}
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr auto', gap: 8, alignItems: 'end', marginTop: 6, paddingTop: 12, borderTop: `1px solid ${T.line}` }}>
            <div><label style={LBL}>New type</label>
              <input style={INP} placeholder="VIP" value={ttNew.name} onChange={(e) => setTtNew({ ...ttNew, name: e.target.value })} /></div>
            <div><label style={LBL}>Price $</label>
              <input style={INP} type="number" placeholder="40" value={ttNew.price} onChange={(e) => setTtNew({ ...ttNew, price: e.target.value })} /></div>
            <div><label style={LBL}>Qty</label>
              <input style={INP} type="number" placeholder="50" value={ttNew.quantity} onChange={(e) => setTtNew({ ...ttNew, quantity: e.target.value })} /></div>
            <button style={{ ...GHOST, height: 42 }} onClick={addType}>ADD</button>
          </div>

          {/* orders for this event, right here in the editor */}
          <EventOrders adminKey={adminKey} eventId={eventId} />
        </div>
      )}

      {/* all events */}
      <Sub>All events</Sub>
      {events.map((e: any) => (
        <button key={e.id} onClick={() => setEventId(e.id)}
          style={{ display: 'flex', width: '100%', maxWidth: 640, justifyContent: 'space-between', alignItems: 'center', textAlign: 'left', background: e.id === eventId ? 'rgba(194,91,110,0.14)' : T.card, border: `1px solid ${e.id === eventId ? 'rgba(194,91,110,0.4)' : T.line}`, borderRadius: 12, padding: '14px 16px', marginBottom: 8, cursor: 'pointer' }}>
          <span>
            <span style={{ color: T.white, fontWeight: 600, fontSize: 14.5, display: 'block' }}>{e.name}</span>
            <span style={{ color: T.dim, fontSize: 12.5 }}>{fmtDate(e.date)} · {e.location}</span>
          </span>
          <span style={{ color: T.dim, fontSize: 12.5, whiteSpace: 'nowrap', marginLeft: 12 }}>{e.totals.sold}/{e.totals.qty} sold</span>
        </button>
      ))}
    </>
  );
}

/* ---------------- DASHBOARD ---------------- */
function Dashboard({ adminKey, eventId }: { adminKey: string; eventId: string }) {
  const [d, setD] = useState<any>(null);
  const [err, setErr] = useState('');
  const load = useCallback(() => {
    setErr(''); setD(null);
    adminApi(adminKey, 'stats', { eventId }).then(setD).catch((e) => setErr(e.message));
  }, [adminKey, eventId]);
  useEffect(() => { load(); const t = setInterval(load, 30000); return () => clearInterval(t); }, [load]);

  if (err) return <><H>Dashboard</H><Err msg={err} retry={load} /></>;
  if (!d) return <><H>Dashboard</H><Loading /></>;

  const cards = [
    { label: 'Gross Sales', value: money(d.gross), hot: true },
    { label: 'Your Payout', value: money(d.payout), hot: true },
    { label: 'Tickets Sold', value: String(d.ticketsSold) },
    { label: 'Checked In', value: `${d.checkedIn} / ${d.ticketsSold}` },
  ];
  return (
    <>
      <H>Dashboard</H>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 26 }}>
        {cards.map((c) => (
          <div key={c.label} style={{ background: T.card, border: `1px solid ${c.hot ? 'rgba(194,91,110,0.4)' : T.line}`, borderRadius: 14, padding: '18px 16px' }}>
            <p style={{ fontFamily: HEAD, fontWeight: 700, fontSize: 10, letterSpacing: 4, textTransform: 'uppercase', color: T.dim, margin: '0 0 8px' }}>{c.label}</p>
            <p style={{ fontFamily: HEAD, fontWeight: 800, fontSize: 30, color: c.hot ? T.redBright : T.white, margin: 0 }}>{c.value}</p>
          </div>
        ))}
      </div>
      <Sub>Fee breakdown</Sub>
      <div style={{ background: T.card, border: `1px solid ${T.line}`, borderRadius: 14, padding: 16, marginBottom: 8, fontSize: 13.5, lineHeight: 2, maxWidth: 520 }}>
        <Row2 l="Face value collected" v={money(d.faceValue)} />
        <Row2 l="Service fees (yours)" v={money(d.serviceFees)} />
        <Row2 l="Tax collected" v={money(d.tax)} />
        <Row2 l="Processing (Stripe's cut)" v={money(d.processingFees)} dim />
      </div>
      <Sub>Ticket types</Sub>
      {d.ticketTypes.map((t: any) => {
        const pct = t.quantity ? Math.min(100, Math.round((t.sold / t.quantity) * 100)) : 0;
        return (
          <div key={t.name} style={{ background: T.card, border: `1px solid ${T.line}`, borderRadius: 12, padding: 16, marginBottom: 10, maxWidth: 520 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ color: T.white, fontWeight: 600, fontSize: 14 }}>{t.name} · {money(t.price)}</span>
              <span style={{ color: T.dim, fontSize: 13 }}>{t.sold} / {t.quantity}</span>
            </div>
            <div style={{ height: 6, background: 'rgba(255,255,255,0.06)' }}>
              <div style={{ height: '100%', width: `${pct}%`, background: `linear-gradient(90deg, ${T.red}, ${T.redBright})` }} />
            </div>
          </div>
        );
      })}
      {d.recentOrders.length > 0 && (
        <>
          <Sub>Recent orders</Sub>
          <div style={{ background: T.card, border: `1px solid ${T.line}`, borderRadius: 14, maxWidth: 520 }}>
            {d.recentOrders.map((o: any) => (
              <div key={o.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '11px 16px', borderBottom: `1px solid ${T.line}`, fontSize: 13.5 }}>
                <span style={{ color: T.white }}>{o.buyer}</span>
                <span style={{ color: T.dim }}>{money(o.total)} · {new Date(o.at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </>
  );
}
function Row2({ l, v, dim }: { l: string; v: string; dim?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
      <span style={{ color: dim ? T.dim : T.text }}>{l}</span>
      <span style={{ color: dim ? T.dim : T.white, fontWeight: 600 }}>{v}</span>
    </div>
  );
}

/* ---------------- ROSTER ---------------- */
function Roster({ adminKey, eventId }: { adminKey: string; eventId: string }) {
  const [rows, setRows] = useState<any[] | null>(null);
  const [q, setQ] = useState('');
  const [err, setErr] = useState('');
  const [resending, setResending] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(() => {
    setErr(''); setRows(null);
    adminApi(adminKey, 'roster', { eventId }).then((d) => setRows(d.roster)).catch((e) => setErr(e.message));
  }, [adminKey, eventId]);
  useEffect(load, [load]);

  const resend = async (orderId: string, buyer: string) => {
    setResending(orderId); setNotice('');
    try { await adminApi(adminKey, 'resend', { eventId, orderId }); setNotice(`Tickets re-sent to ${buyer} ✓`); }
    catch (e: any) { setNotice(`Resend failed: ${e.message}`); }
    finally { setResending(''); }
  };

  if (err) return <><H>Roster</H><Err msg={err} retry={load} /></>;
  if (!rows) return <><H>Roster</H><Loading /></>;

  const needle = q.trim().toLowerCase();
  const filtered = needle ? rows.filter((r) => `${r.buyer} ${r.email} ${r.codeTail}`.toLowerCase().includes(needle)) : rows;

  return (
    <>
      <H>Roster</H>
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="SEARCH NAME, EMAIL, OR CODE"
        style={{ ...INP, maxWidth: 420, letterSpacing: 1.5, marginBottom: 16 }} />
      {notice && <p style={{ color: notice.includes('✓') ? T.chrome : T.redBright, fontSize: 13, margin: '0 0 12px' }}>{notice}</p>}
      {filtered.length === 0 && <p style={{ color: T.dim, fontSize: 13.5 }}>{rows.length === 0 ? 'No paid tickets yet.' : 'No matches.'}</p>}
      {filtered.map((r) => (
        <div key={r.ticketId} style={{ background: T.card, border: `1px solid ${T.line}`, padding: '14px 16px', marginBottom: 10, maxWidth: 640 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
            <div>
              <p style={{ color: T.white, fontWeight: 600, fontSize: 14.5, margin: '0 0 2px' }}>{r.buyer}</p>
              <p style={{ color: T.dim, fontSize: 12.5, margin: 0 }}>{r.email} · code {r.codeTail}</p>
              {r.deliveryError && <p style={{ color: T.redBright, fontSize: 12, margin: '4px 0 0' }}>Delivery issue: {r.deliveryError}</p>}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Badge on={r.checkedIn} yes="IN" no="NOT IN" />
              <button onClick={() => resend(r.orderId, r.buyer)} disabled={resending === r.orderId}
                style={{ ...GHOST, opacity: resending === r.orderId ? 0.5 : 1 }}>
                {resending === r.orderId ? 'SENDING…' : 'RESEND'}
              </button>
            </div>
          </div>
        </div>
      ))}
      <p style={{ color: T.dim, fontSize: 12, letterSpacing: 1 }}>{filtered.length} ticket{filtered.length === 1 ? '' : 's'} shown</p>
    </>
  );
}

/* ---------------- FEES ---------------- */
/* ---------------- APPEARANCE (site-wide defaults) ---------------- */
function Appearance({ adminKey }: { adminKey: string }) {
  const [color, setColor] = useState<string>('#c25b6e');
  const [err, setErr] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const load = useCallback(() => {
    setErr('');
    adminApi(adminKey, 'get_settings', {}).then((d) => setColor(d.settings?.buttonColor || '#c25b6e')).catch((e) => setErr(e.message));
  }, [adminKey]);
  useEffect(load, [load]);

  const save = async () => {
    setSaving(true); setErr(''); setSaved(false);
    try {
      await adminApi(adminKey, 'set_settings', { buttonColor: color });
      setSaved(true); setTimeout(() => setSaved(false), 2500);
    } catch (e: any) { setErr(e.message); }
    finally { setSaving(false); }
  };

  return (
    <>
      <H>Appearance</H>
      <p style={{ color: T.dim, fontSize: 13.5, margin: '0 0 20px', maxWidth: 520, lineHeight: 1.6 }}>
        The default button color for every event. Individual events can override this in their own settings.
      </p>

      <Sub>Default button color</Sub>
      <div style={{ background: T.card, border: `1px solid ${T.line}`, padding: 18, maxWidth: 520 }}>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 16 }}>
          {['#c25b6e', '#7c3aed', '#2563eb', '#e11d48', '#059669', '#ea580c', '#db2777', '#0891b2'].map((c) => (
            <button key={c} onClick={() => setColor(c)} aria-label={c}
              style={{ width: 36, height: 36, borderRadius: '50%', background: c, border: color.toLowerCase() === c ? '3px solid #fff' : '1px solid rgba(255,255,255,0.2)', cursor: 'pointer' }} />
          ))}
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginBottom: 18 }}>
          <input type="color" value={color} onChange={(e) => setColor(e.target.value)}
            style={{ width: 48, height: 42, background: 'none', border: `1px solid ${T.line}`, cursor: 'pointer', padding: 2 }} />
          <input style={{ ...INP, maxWidth: 150, fontFamily: 'monospace' }} value={color} onChange={(e) => setColor(e.target.value)} placeholder="#c25b6e" />
          <span style={{ display: 'inline-flex', alignItems: 'center', background: color, color: '#fff', fontSize: 14, fontWeight: 700, padding: '12px 22px', borderRadius: 26 }}>Get Tickets</span>
        </div>
        {err && <p style={{ color: T.redBright, fontSize: 13, margin: '0 0 12px' }}>{err}</p>}
        <button style={{ ...BTN, opacity: saving ? 0.5 : 1 }} disabled={saving} onClick={save}>
          {saving ? 'SAVING…' : saved ? 'SAVED ✓' : 'SAVE DEFAULT COLOR'}
        </button>
      </div>
    </>
  );
}

function Fees({ adminKey, eventId }: { adminKey: string; eventId: string }) {
  const [f, setF] = useState<any>(null);
  const [err, setErr] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const load = useCallback(() => {
    setErr(''); setF(null);
    adminApi(adminKey, 'get_fees', { eventId }).then((d) => setF(d.fees || {
      service_fee_percent: 5, service_fee_flat: 0, tax_percent: 0,
      processing_percent: 2.9, processing_flat: 0.3,
      pass_fees_to_buyer: true, pass_processing_to_buyer: true,
    })).catch((e) => setErr(e.message));
  }, [adminKey, eventId]);
  useEffect(load, [load]);

  const save = async () => {
    setSaving(true); setErr(''); setSaved(false);
    try { const d = await adminApi(adminKey, 'set_fees', { eventId, fees: f }); setF(d.fees); setSaved(true); }
    catch (e: any) { setErr(e.message); }
    finally { setSaving(false); }
  };

  if (err && !f) return <><H>Fees</H><Err msg={err} retry={load} /></>;
  if (!f) return <><H>Fees</H><Loading /></>;

  const num = (k: string, label: string, hint: string) => (
    <div style={{ marginBottom: 16 }}>
      <label style={LBL}>{label}</label>
      <input type="number" step="0.1" min="0" value={f[k] ?? 0}
        onChange={(e) => { setF({ ...f, [k]: e.target.value }); setSaved(false); }}
        style={{ ...INP, maxWidth: 220 }} />
      <p style={{ color: '#6a6060', fontSize: 11.5, margin: '5px 0 0' }}>{hint}</p>
    </div>
  );
  const toggle = (k: string, label: string) => (
    <label style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, cursor: 'pointer', fontSize: 14 }}>
      <input type="checkbox" checked={!!f[k]} onChange={(e) => { setF({ ...f, [k]: e.target.checked }); setSaved(false); }}
        style={{ width: 18, height: 18, accentColor: T.red }} />
      <span style={{ color: T.text }}>{label}</span>
    </label>
  );

  return (
    <>
      <H>Fees</H>
      <div style={{ background: T.card, border: `1px solid ${T.line}`, padding: 22, maxWidth: 520 }}>
        {num('service_fee_percent', 'Service fee %', 'Your fee, per order. Posh charges ~10%; you started at 5.')}
        {num('service_fee_flat', 'Service fee flat $', 'Optional flat amount added per order.')}
        {num('tax_percent', 'Tax %', 'Leave 0 unless you collect sales tax on tickets.')}
        {num('processing_percent', 'Processing %', "Stripe's cut. Their standard rate is 2.9.")}
        {num('processing_flat', 'Processing flat $', 'Stripe adds $0.30 per transaction.')}
        <div style={{ height: 1, background: T.line, margin: '6px 0 18px' }} />
        {toggle('pass_fees_to_buyer', 'Buyer pays the service fee')}
        {toggle('pass_processing_to_buyer', 'Buyer pays the processing fee')}
        {err && <p style={{ color: T.redBright, fontSize: 13, margin: '0 0 12px' }}>{err}</p>}
        <button onClick={save} disabled={saving} style={{ ...BTN, opacity: saving ? 0.5 : 1 }}>
          {saving ? 'SAVING…' : saved ? 'SAVED ✓' : 'SAVE'}
        </button>
        <p style={{ color: '#6a6060', fontSize: 11.5, margin: '14px 0 0' }}>
          Fees are per-event. Changes apply to the next checkout instantly; paid orders keep their pricing.
        </p>
      </div>
    </>
  );
}


/* ---------------- ORDERS: contacts & purchases per event ---------------- */
function Orders({ adminKey, eventId }: { adminKey: string; eventId: string }) {
  const [rows, setRows] = useState<any[] | null>(null);
  const [q, setQ] = useState('');
  const [err, setErr] = useState('');

  const load = useCallback(() => {
    setErr(''); setRows(null);
    adminApi(adminKey, 'list_orders', { eventId }).then((d) => setRows(d.orders)).catch((e) => setErr(e.message));
  }, [adminKey, eventId]);
  useEffect(load, [load]);

  if (err) return <><H>Orders</H><Err msg={err} retry={load} /></>;
  if (!rows) return <><H>Orders</H><Loading /></>;

  const needle = q.trim().toLowerCase();
  const filtered = needle
    ? rows.filter((r) => `${r.buyer} ${r.email} ${r.phone} ${r.shortId}`.toLowerCase().includes(needle))
    : rows;
  const totalRevenue = rows.reduce((a, r) => a + Number(r.total || 0), 0);

  return (
    <>
      <H>Orders</H>
      <p style={{ color: T.dim, fontSize: 13, margin: '0 0 14px', letterSpacing: 1 }}>
        {rows.length} order{rows.length === 1 ? '' : 's'} · {money(totalRevenue)} collected
      </p>
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="SEARCH NAME, PHONE, EMAIL, OR ORDER #"
        style={{ ...INP, maxWidth: 460, letterSpacing: 1.5, marginBottom: 16 }} />

      {filtered.length === 0 && <p style={{ color: T.dim, fontSize: 13.5 }}>{rows.length === 0 ? 'No orders yet.' : 'No matches.'}</p>}

      {filtered.map((r) => (
        <div key={r.id} style={{ background: T.card, border: `1px solid ${T.line}`, borderRadius: 12, padding: '14px 16px', marginBottom: 10, maxWidth: 720 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8 }}>
            <div>
              <p style={{ color: T.white, fontWeight: 600, fontSize: 14.5, margin: '0 0 2px' }}>
                {r.buyer} <span style={{ color: T.dim, fontWeight: 400, fontSize: 12.5 }}>· #{r.shortId}</span>
              </p>
              <p style={{ color: T.dim, fontSize: 12.5, margin: 0, lineHeight: 1.7 }}>
                {r.phone ? `${r.phone} · ` : ''}{r.email}<br />
                {r.tickets} ticket{r.tickets === 1 ? '' : 's'} · {r.checkedIn} in · {new Date(r.at).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
              </p>
              {r.deliveryError && <p style={{ color: T.redBright, fontSize: 12, margin: '4px 0 0' }}>Delivery issue: {r.deliveryError}</p>}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <Badge on={r.emailSent} yes="EMAILED" no="NO EMAIL" />
              <Badge on={r.smsSent} yes="TEXTED" no="NO SMS" />
              <span style={{ fontFamily: HEAD, fontWeight: 900, fontSize: 16, color: T.white }}>{money(r.total)}</span>
            </div>
          </div>
        </div>
      ))}
    </>
  );
}
