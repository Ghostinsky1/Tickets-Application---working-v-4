'use client';

/*
  ADMIN v2 — Desenfocado chrome style. Multi-event.
  Tabs: Events (create/edit shows, descriptions, ticket types, flyer, page link),
  Dashboard, Roster, Fees — all scoped to the selected event.
  Auth: passcode → x-admin-key → ADMIN_KEY secret. Key in sessionStorage only.
*/

import { useState, useEffect, useCallback } from 'react';
import { BACKEND, DEFAULT_EVENT_ID, money, fmtDate } from '@/lib/api';
import CardCheckout from '@/components/CardCheckout';

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
  { id: 'boxoffice', label: 'Box Office' },
  { id: 'products', label: 'Products' },
  { id: 'dash', label: 'Dashboard' },
  { id: 'orders', label: 'Orders' },
  { id: 'roster', label: 'Roster' },
  { id: 'fees', label: 'Fees' },
  { id: 'appearance', label: 'Appearance' },
] as const;
type Tab = (typeof NAV)[number]['id'];

function Panel({ adminKey, onLogout }: { adminKey: string; onLogout: () => void }) {
  const [tab, setTab] = useState<Tab>('events');
  useEffect(() => {
    // returning from a box-office card charge -> show the Box Office tab
    if (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('boxoffice') === 'done') {
      setTab('boxoffice');
    }
  }, []);
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
        {tab === 'boxoffice' && <BoxOffice adminKey={adminKey} events={events} eventId={eventId} setEventId={setEventId} />}
        {tab === 'dash' && <Dashboard adminKey={adminKey} eventId={eventId} />}
        {tab === 'orders' && <Orders adminKey={adminKey} eventId={eventId} />}
        {tab === 'roster' && <Roster adminKey={adminKey} eventId={eventId} />}
        {tab === 'fees' && <Fees adminKey={adminKey} eventId={eventId} />}
        {tab === 'products' && <Products adminKey={adminKey} />}
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
  const [products, setProducts] = useState<any[]>([]);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  useEffect(() => {
    adminApi(adminKey, 'list_products', {}).then((r) => setProducts(r.products || [])).catch(() => {});
  }, [adminKey]);

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
        accent_color: detail.accent_color || '',
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
        end_date: detail.end_date ? new Date(detail.end_date).toISOString() : '',
        age_restriction: detail.age_restriction || '',
        event_mode: detail.event_mode || 'ticketed',
        drop_at: detail.drop_at ? new Date(detail.drop_at).toISOString() : '',
        drop_headline: detail.drop_headline || '',
        drop_auto_publish: detail.drop_auto_publish !== false,
        max_per_order: Number(detail.max_per_order || 10),
        hide_venue: !!detail.hide_venue,
        hidden_from_home: !!detail.hidden_from_home,
        upsell_product_id: detail.upsell_product_id || '',
        downsell_product_id: detail.downsell_product_id || '',
        video_url: detail.video_url || '',
        faqs: Array.isArray(detail.faqs) ? detail.faqs : [],
        area_label: detail.area_label || '',
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
    if (file.size > 15 * 1024 * 1024) { setErr('Flyer must be under 15MB'); return; }
    setUploading(true); setErr('');
    // OPTIMIZE BEFORE UPLOAD: resize to max 1400px wide + re-encode as JPEG q0.82.
    // A 6MB phone photo becomes ~200-400KB — fans on slow internet load it 15-20x faster.
    const img = new Image();
    const objUrl = URL.createObjectURL(file);
    img.onload = async () => {
      try {
        const MAXW = 1400;
        const scale = Math.min(1, MAXW / img.naturalWidth);
        const w = Math.round(img.naturalWidth * scale);
        const h = Math.round(img.naturalHeight * scale);
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(img, 0, 0, w, h);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.82);
        URL.revokeObjectURL(objUrl);
        const d = await adminApi(adminKey, 'upload_flyer', {
          eventId, contentType: 'image/jpeg',
          fileBase64: dataUrl.split(',')[1],
        });
        setDetail((p: any) => ({ ...p, image_url: d.imageUrl }));
        refresh(); flash('Flyer optimized + uploaded ✓ — the event page updates instantly.');
      } catch (e: any) { setErr(e.message); }
      finally { setUploading(false); }
    };
    img.onerror = () => { URL.revokeObjectURL(objUrl); setErr('Could not read that image'); setUploading(false); };
    img.src = objUrl;
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
              <div><label style={LBL}>Starts</label>
                <input style={INP} type="datetime-local" value={toLocalInput(detail.date)} onChange={(e) => setDetail({ ...detail, date: e.target.value })} /></div>
              <div><label style={LBL}>Ends (optional)</label>
                <input style={INP} type="datetime-local" value={toLocalInput(detail.end_date)} onChange={(e) => setDetail({ ...detail, end_date: e.target.value })} /></div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div><label style={LBL}>Venue / location</label>
                <input style={INP} value={detail.location || ''} onChange={(e) => setDetail({ ...detail, location: e.target.value })} /></div>
              <div><label style={LBL}>Age restriction</label>
                <select style={INP} value={detail.age_restriction || ''} onChange={(e) => setDetail({ ...detail, age_restriction: e.target.value })}>
                  <option value="">No restriction</option>
                  <option value="All ages">All ages</option>
                  <option value="16+">16+</option>
                  <option value="18+">18+</option>
                  <option value="21+">21+</option>
                </select></div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div><label style={LBL}>Event type</label>
                <select style={INP} value={detail.event_mode || 'ticketed'} onChange={(e) => setDetail({ ...detail, event_mode: e.target.value })}>
                  <option value="ticketed">Ticketed (Get Tickets)</option>
                  <option value="rsvp">Guest list / RSVP (free)</option>
                  <option value="drop">Drop / teaser (collect phones before sale)</option>
                </select></div>
              <div><label style={LBL}>Max tickets per order</label>
                <input style={INP} type="number" min={1} max={50} value={detail.max_per_order ?? 10} onChange={(e) => setDetail({ ...detail, max_per_order: e.target.value })} /></div>
            </div>
            {detail.event_mode === 'drop' && (
              <div style={{ background: `${T.redBright}12`, border: `1px solid ${T.redBright}55`, borderRadius: 12, padding: 16, marginTop: 4 }}>
                <p style={{ color: '#fff', fontSize: 14, fontWeight: 700, margin: '0 0 4px' }}>🔒 Drop / teaser settings</p>
                <p style={{ color: T.dim, fontSize: 12.5, margin: '0 0 14px', lineHeight: 1.5 }}>Fans see a countdown + phone signup instead of tickets. When the drop time hits, it can auto-flip to selling — and you can blast the list from the Dashboard tab.</p>
                <label style={LBL}>Tickets go live at</label>
                <input style={{ ...INP, marginBottom: 12 }} type="datetime-local" value={toLocalInput(detail.drop_at)} onChange={(e) => setDetail({ ...detail, drop_at: e.target.value })} />
                <label style={LBL}>Teaser line (optional)</label>
                <input style={{ ...INP, marginBottom: 12 }} value={detail.drop_headline || ''} placeholder="We drop the info to you first. 🔥" onChange={(e) => setDetail({ ...detail, drop_headline: e.target.value })} />
                <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                  <input type="checkbox" checked={detail.drop_auto_publish !== false} onChange={(e) => setDetail({ ...detail, drop_auto_publish: e.target.checked })} style={{ width: 18, height: 18 }} />
                  <span style={{ color: '#fff', fontSize: 13.5 }}>Auto-flip to selling tickets when the drop time hits</span>
                </label>
              </div>
            )}
            <div style={{ background: 'rgba(0,0,0,0.3)', border: `1px solid ${T.line}`, borderRadius: 12, padding: 14, marginTop: 4 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', marginBottom: detail.hide_venue ? 12 : 0 }}>
                <input type="checkbox" checked={!!detail.hide_venue} onChange={(e) => setDetail({ ...detail, hide_venue: e.target.checked })} style={{ width: 18, height: 18 }} />
                <span style={{ color: '#fff', fontSize: 14, fontWeight: 600 }}>Hide exact venue until day of show</span>
              </label>
              {detail.hide_venue && (
                <div>
                  <label style={LBL}>Shown until reveal (area / hint)</label>
                  <input style={INP} value={detail.area_label || ''} placeholder="e.g. The Grove · STL" onChange={(e) => setDetail({ ...detail, area_label: e.target.value })} />
                  <p style={{ color: T.dim, fontSize: 12, margin: '6px 0 0' }}>Buyers see this instead of the address. The real venue auto-reveals on the event date.</p>
                </div>
              )}
            </div>
            <div style={{ background: 'rgba(0,0,0,0.3)', border: `1px solid ${T.line}`, borderRadius: 12, padding: 14, marginTop: 4 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                <input type="checkbox" checked={!!detail.hidden_from_home} onChange={(e) => setDetail({ ...detail, hidden_from_home: e.target.checked })} style={{ width: 18, height: 18 }} />
                <span style={{ color: '#fff', fontSize: 14, fontWeight: 600 }}>Hide from public homepage</span>
              </label>
              <p style={{ color: T.dim, fontSize: 12, margin: '6px 0 0 28px' }}>Event stays live and buyable via its direct link, but won&apos;t show in the public event list. Good for private / unlisted shows.</p>
            </div>
            <div style={{ background: 'rgba(0,0,0,0.3)', border: `1px solid ${T.line}`, borderRadius: 12, padding: 14, marginTop: 4 }}>
              <p style={{ color: '#fff', fontSize: 14, fontWeight: 700, margin: '0 0 4px' }}>💰 One-click offers (after checkout)</p>
              <p style={{ color: T.dim, fontSize: 12.5, margin: '0 0 12px', lineHeight: 1.5 }}>Right after paying, buyers see the upsell (yes = instant charge on their saved card). If they pass, they see the downsell. Create products in the Products tab.</p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div><label style={LBL}>Upsell</label>
                  <select style={INP} value={detail.upsell_product_id || ''} onChange={(e) => setDetail({ ...detail, upsell_product_id: e.target.value })}>
                    <option value="">None</option>
                    {products.map((p: any) => <option key={p.id} value={p.id}>{p.name} (${Number(p.price).toFixed(2)})</option>)}
                  </select></div>
                <div><label style={LBL}>Downsell</label>
                  <select style={INP} value={detail.downsell_product_id || ''} onChange={(e) => setDetail({ ...detail, downsell_product_id: e.target.value })}>
                    <option value="">None</option>
                    {products.map((p: any) => <option key={p.id} value={p.id}>{p.name} (${Number(p.price).toFixed(2)})</option>)}
                  </select></div>
              </div>
            </div>
            <div>
              <label style={LBL}>Vibe video (YouTube / Vimeo / .mp4 link)</label>
              <input style={INP} value={detail.video_url || ''} placeholder="https://youtube.com/watch?v=..." onChange={(e) => setDetail({ ...detail, video_url: e.target.value })} />
              <p style={{ color: T.dim, fontSize: 12, margin: '6px 0 0' }}>Shows as a tap-to-play preview on the event page — recap footage sells the experience. It only loads when tapped, so it never slows the page.</p>
            </div>
            <FaqEditor faqs={Array.isArray(detail.faqs) ? detail.faqs : []} onChange={(f: any[]) => setDetail({ ...detail, faqs: f })} />
            <div><label style={LBL}>Description</label>
              <textarea style={{ ...INP, minHeight: 110, resize: 'vertical' }} value={detail.description || ''} onChange={(e) => setDetail({ ...detail, description: e.target.value })} /></div>
          </div>
          <button style={{ ...BTN, marginTop: 16, opacity: saving ? 0.5 : 1 }} disabled={saving} onClick={save}>
            {saving ? 'SAVING…' : 'SAVE EVENT'}
          </button>

          <DeleteEvent adminKey={adminKey} eventId={eventId} name={detail.name} onDeleted={() => { setEventId(''); refresh(); }} />

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

          {/* per-event accent color */}
          <Sub>Accent color</Sub>
          <div style={{ background: 'rgba(0,0,0,0.3)', border: `1px solid ${T.line}`, borderRadius: 12, padding: 16, marginBottom: 12 }}>
            <p style={{ color: T.dim, fontSize: 12.5, margin: '0 0 12px', lineHeight: 1.5 }}>
              The date text and highlights for this event. Leave blank to use the site default.
            </p>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 12 }}>
              {['#c25b6e', '#831100', '#7c3aed', '#2563eb', '#e11d48', '#059669', '#ea580c', '#db2777', '#0891b2'].map((c) => (
                <button key={c} onClick={() => setDetail({ ...detail, accent_color: c })}
                  aria-label={c}
                  style={{ width: 34, height: 34, borderRadius: '50%', background: c, border: (detail.accent_color || '').toLowerCase() === c ? '3px solid #fff' : '1px solid rgba(255,255,255,0.2)', cursor: 'pointer' }} />
              ))}
            </div>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <input type="color" value={detail.accent_color || '#c25b6e'} onChange={(e) => setDetail({ ...detail, accent_color: e.target.value })}
                style={{ width: 46, height: 40, background: 'none', border: `1px solid ${T.line}`, borderRadius: 10, cursor: 'pointer', padding: 2 }} />
              <input style={{ ...INP, maxWidth: 140, fontFamily: 'monospace' }} value={detail.accent_color || ''} placeholder="#c25b6e"
                onChange={(e) => setDetail({ ...detail, accent_color: e.target.value })} />
              {detail.accent_color && (
                <button style={GHOST} onClick={() => setDetail({ ...detail, accent_color: '' })}>USE SITE DEFAULT</button>
              )}
              <span style={{ display: 'inline-flex', alignItems: 'center', color: detail.accent_color || '#c25b6e', fontSize: 12.5, fontWeight: 700, letterSpacing: 1.5 }}>SAT, AUG 22 · 8PM</span>
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
          <span style={{ color: T.dim, fontSize: 12.5, whiteSpace: 'nowrap', marginLeft: 12 }}>{e.totals.sold}/{e.totals.qty} sold{(e.notifySignups ?? 0) > 0 ? ` · 🔔 ${e.notifySignups}` : ''}</span>
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
    { label: 'Page Views', value: String(d.views ?? 0) },
    { label: 'Unique Views', value: String(d.uniqueViews ?? 0) },
    { label: 'Checked In', value: `${d.checkedIn} / ${d.ticketsSold}` },
    { label: '🔔 Drop Signups', value: String(d.notifySignups ?? 0) },
  ];
  // conversion rate: tickets sold per unique view
  const conv = d.uniqueViews > 0 ? Math.round((d.ticketsSold / d.uniqueViews) * 100) : null;
  const series: any[] = d.dailySeries || [];
  const maxTickets = Math.max(1, ...series.map((s) => s.tickets));
  const maxViews = Math.max(1, ...series.map((s) => s.views));
  return (
    <>
      <H>Dashboard</H>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginBottom: 20 }}>
        {cards.map((c) => (
          <div key={c.label} style={{ background: T.card, border: `1px solid ${c.hot ? 'rgba(194,91,110,0.4)' : T.line}`, borderRadius: 14, padding: '18px 16px' }}>
            <p style={{ fontFamily: HEAD, fontWeight: 700, fontSize: 10, letterSpacing: 4, textTransform: 'uppercase', color: T.dim, margin: '0 0 8px' }}>{c.label}</p>
            <p style={{ fontFamily: HEAD, fontWeight: 800, fontSize: 30, color: c.hot ? T.redBright : T.white, margin: 0 }}>{c.value}</p>
          </div>
        ))}
      </div>

      {conv != null && (
        <div style={{ background: 'rgba(194,91,110,0.1)', border: `1px solid rgba(194,91,110,0.3)`, borderRadius: 12, padding: '12px 16px', marginBottom: 24, maxWidth: 520, fontSize: 13.5, color: T.text }}>
          <strong style={{ color: '#fff' }}>{conv}%</strong> of unique visitors bought a ticket ({d.ticketsSold} sold / {d.uniqueViews} unique views).
        </div>
      )}

      {(d.notifySignups ?? 0) > 0 && (
        <DropBlast adminKey={adminKey} eventId={eventId} signups={d.notifySignups} />
      )}
      {true && (
        <AbandonedList adminKey={adminKey} eventId={eventId} />
      )}

      {(d.otoRevenue ?? 0) > 0 && (
        <div style={{ background: 'rgba(61,220,132,0.08)', border: '1px solid rgba(61,220,132,0.3)', borderRadius: 12, padding: '12px 16px', marginBottom: 24, maxWidth: 520, fontSize: 13.5, color: T.text }}>
          💰 One-click offers: <strong style={{ color: '#fff' }}>{money(d.otoRevenue)}</strong> extra revenue · {d.upsellTaken} took the upsell · {d.downsellTaken} took the downsell
        </div>
      )}

      <Sub>Last {d.rangeDays || 14} days</Sub>
      <div style={{ background: T.card, border: `1px solid ${T.line}`, borderRadius: 14, padding: '20px 16px 12px', marginBottom: 26, maxWidth: 720, overflowX: 'auto' }}>
        <div style={{ display: 'flex', gap: 16, marginBottom: 16, fontSize: 12 }}>
          <span style={{ color: T.redBright }}>■ Tickets sold</span>
          <span style={{ color: '#6f9fd8' }}>■ Views</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 160, minWidth: series.length * 34 }}>
          {series.map((s) => {
            const label = new Date(s.date + 'T12:00').toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' });
            return (
              <div key={s.date} style={{ flex: 1, minWidth: 26, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 130, width: '100%', justifyContent: 'center' }}>
                  <div title={`${s.tickets} tickets`} style={{ width: '42%', height: `${(s.tickets / maxTickets) * 100}%`, minHeight: s.tickets ? 3 : 0, background: T.redBright, borderRadius: '3px 3px 0 0' }} />
                  <div title={`${s.views} views`} style={{ width: '42%', height: `${(s.views / maxViews) * 100}%`, minHeight: s.views ? 3 : 0, background: '#6f9fd8', borderRadius: '3px 3px 0 0' }} />
                </div>
                <span style={{ fontSize: 9.5, color: T.dim, whiteSpace: 'nowrap' }}>{label}</span>
              </div>
            );
          })}
        </div>
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

/* ---------------- ABANDONED CHECKOUTS (started buying, never finished) ---------------- */
function AbandonedList({ adminKey, eventId }: { adminKey: string; eventId: string }) {
  const [data, setData] = useState<any>(null);
  const [err, setErr] = useState('');
  const [busyId, setBusyId] = useState('');
  const load = async () => {
    try {
      const r = await fetch(`${BACKEND}/leads`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-admin-key': adminKey }, body: JSON.stringify({ action: 'list', eventId }) }).then((x) => x.json());
      if (r.error) throw new Error(r.error);
      setData(r);
    } catch (e: any) { setErr(e.message); }
  };
  useEffect(() => { load(); }, [eventId]);
  const nudge = async (leadId: string) => {
    setBusyId(leadId); setErr('');
    try {
      const r = await fetch(`${BACKEND}/leads`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-admin-key': adminKey }, body: JSON.stringify({ action: 'nudge', leadId }) }).then((x) => x.json());
      if (r.error) throw new Error(r.error);
      await load();
    } catch (e: any) { setErr(e.message); }
    finally { setBusyId(''); }
  };
  if (!data || (data.total === 0)) return null;
  return (
    <div style={{ background: 'rgba(255,255,255,0.04)', border: `1px solid ${T.line}`, borderRadius: 14, padding: 18, marginTop: 18 }}>
      <p style={{ color: '#fff', fontSize: 15, fontWeight: 800, margin: '0 0 2px' }}>🛒 Abandoned checkouts</p>
      <p style={{ color: T.dim, fontSize: 12.5, margin: '0 0 12px' }}>
        Started buying but never finished. {data.recovered > 0 ? `${data.recovered} came back and completed on their own. ` : ''}Tap "Text them" to send ONE reminder with the event link (1¢, one per person max).
      </p>
      {err && <p style={{ color: '#ff6b6b', fontSize: 13, margin: '0 0 10px' }}>{err}</p>}
      {data.abandoned.length === 0 && <p style={{ color: T.dim, fontSize: 13, margin: 0 }}>Everyone who started either finished or hasn&apos;t been captured yet. 🎉</p>}
      {data.abandoned.map((l: any) => (
        <div key={l.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, padding: '9px 0', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ minWidth: 0 }}>
            <p style={{ color: '#fff', fontSize: 13.5, fontWeight: 700, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.name || 'No name'} · <span style={{ fontFamily: 'monospace', fontWeight: 400 }}>{l.phone}</span></p>
            <p style={{ color: T.dim, fontSize: 11.5, margin: '2px 0 0' }}>{new Date(l.at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}{l.nudged ? ' · ✓ reminded' : ''}</p>
          </div>
          {!l.nudged && (
            <button onClick={() => nudge(l.id)} disabled={busyId === l.id}
              style={{ background: T.redBright, color: '#fff', border: 'none', borderRadius: 9, padding: '8px 13px', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', flexShrink: 0, opacity: busyId === l.id ? 0.5 : 1 }}>
              {busyId === l.id ? 'Sending…' : 'Text them'}
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

/* ---------------- FAQ EDITOR (Q/A shown on the event page) ---------------- */
function FaqEditor({ faqs, onChange }: { faqs: { q: string; a: string }[]; onChange: (f: { q: string; a: string }[]) => void }) {
  const upd = (i: number, key: 'q' | 'a', val: string) => {
    const next = faqs.map((f, idx) => idx === i ? { ...f, [key]: val } : f);
    onChange(next);
  };
  return (
    <div style={{ background: 'rgba(0,0,0,0.3)', border: `1px solid ${T.line}`, borderRadius: 12, padding: 14, marginTop: 4 }}>
      <p style={{ color: '#fff', fontSize: 14, fontWeight: 700, margin: '0 0 4px' }}>❓ Q/A section</p>
      <p style={{ color: T.dim, fontSize: 12.5, margin: '0 0 12px', lineHeight: 1.5 }}>Answer the questions people always DM you — age limit, dress code, parking, refunds, re-entry. Shows on the event page. Save the event to apply.</p>
      {faqs.map((f, i) => (
        <div key={i} style={{ background: 'rgba(255,255,255,0.04)', border: `1px solid ${T.line}`, borderRadius: 10, padding: 12, marginBottom: 10 }}>
          <input style={{ ...INP, marginBottom: 8 }} value={f.q} placeholder="Question (e.g. Is there an age limit?)" onChange={(e) => upd(i, 'q', e.target.value)} />
          <textarea style={{ ...INP, minHeight: 56, resize: 'vertical', marginBottom: 8 }} value={f.a} placeholder="Answer" onChange={(e) => upd(i, 'a', e.target.value)} />
          <button onClick={() => onChange(faqs.filter((_, idx) => idx !== i))}
            style={{ background: 'transparent', color: '#ff6b6b', border: '1px solid rgba(255,107,107,0.35)', borderRadius: 8, padding: '6px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
            Remove
          </button>
        </div>
      ))}
      <button onClick={() => onChange([...faqs, { q: '', a: '' }])} style={GHOST}>+ Add question</button>
    </div>
  );
}

/* ---------------- PRODUCTS (one-click offer catalog: create / delete) ---------------- */
function Products({ adminKey }: { adminKey: string }) {
  const [list, setList] = useState<any[]>([]);
  const [name, setName] = useState('');
  const [priceStr, setPriceStr] = useState('');
  const [desc, setDesc] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const load = useCallback(async () => {
    try { const r = await adminApi(adminKey, 'list_products', {}); setList(r.products || []); }
    catch (e: any) { setErr(e.message); }
  }, [adminKey]);
  useEffect(() => { load(); }, [load]);

  const create = async () => {
    if (!name.trim() || !(Number(priceStr) >= 0)) { setErr('Name and a price (0 or more) required'); return; }
    setBusy(true); setErr('');
    try {
      await adminApi(adminKey, 'create_product', { name: name.trim(), price: Number(priceStr), description: desc.trim() });
      setName(''); setPriceStr(''); setDesc('');
      await load();
    } catch (e: any) { setErr(e.message); }
    finally { setBusy(false); }
  };
  const del = async (id: string, pname: string) => {
    if (!window.confirm(`Delete "${pname}"? Events using it will have the offer removed.`)) return;
    try { await adminApi(adminKey, 'delete_product', { productId: id }); await load(); }
    catch (e: any) { setErr(e.message); }
  };

  return (
    <div>
      <H>Products</H>
      <Sub>Things you can offer as one-click upsells / downsells after checkout — extra tickets, VIP upgrades, drink tickets, merch. Create them here, then pick them per event in the Events editor.</Sub>

      <div style={{ background: T.card, border: `1px solid ${T.line}`, borderRadius: 14, padding: 18, maxWidth: 520, marginBottom: 26 }}>
        <p style={{ color: '#fff', fontSize: 15, fontWeight: 800, margin: '0 0 12px' }}>New product</p>
        <label style={LBL}>Name</label>
        <input style={{ ...INP, marginBottom: 12 }} value={name} placeholder="+1 GA Ticket (half off)" onChange={(e) => setName(e.target.value)} />
        <label style={LBL}>Price ($)</label>
        <input style={{ ...INP, marginBottom: 12 }} type="number" min={0} step="0.01" value={priceStr} placeholder="12.50" onChange={(e) => setPriceStr(e.target.value)} />
        <label style={LBL}>Pitch (shown on the offer page)</label>
        <textarea style={{ ...INP, minHeight: 60, resize: 'vertical', marginBottom: 12 }} value={desc} placeholder="Bring a friend. One more ticket at half price - this deal only shows once." onChange={(e) => setDesc(e.target.value)} />
        {err && <p style={{ color: T.redBright, fontSize: 13, margin: '0 0 10px' }}>{err}</p>}
        <button style={{ ...BTN, opacity: busy ? 0.6 : 1 }} disabled={busy} onClick={create}>{busy ? 'Creating…' : 'CREATE PRODUCT'}</button>
      </div>

      {list.length === 0 ? (
        <p style={{ color: T.dim, fontSize: 14 }}>No products yet.</p>
      ) : list.map((p) => (
        <div key={p.id} style={{ background: T.card, border: `1px solid ${T.line}`, borderRadius: 12, padding: '14px 16px', maxWidth: 520, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ flex: 1 }}>
            <p style={{ color: '#fff', fontSize: 14.5, fontWeight: 700, margin: '0 0 2px' }}>{p.name} <span style={{ color: T.redBright }}>${Number(p.price).toFixed(2)}</span></p>
            {p.description && <p style={{ color: T.dim, fontSize: 12.5, margin: 0 }}>{p.description}</p>}
          </div>
          <button onClick={() => del(p.id, p.name)}
            style={{ background: 'transparent', color: '#ff6b6b', border: '1px solid rgba(255,107,107,0.4)', borderRadius: 8, padding: '7px 12px', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', flexShrink: 0 }}>
            Delete
          </button>
        </div>
      ))}
    </div>
  );
}

/* ---------------- DELETE EVENT (danger zone) ---------------- */
function DeleteEvent({ adminKey, eventId, name, onDeleted }: { adminKey: string; eventId: string; name: string; onDeleted: () => void }) {
  const [armed, setArmed] = useState(false);
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const del = async () => {
    setBusy(true); setErr('');
    try {
      await adminApi(adminKey, 'delete_event', { eventId, confirm: 'DELETE' });
      onDeleted();
    } catch (e: any) { setErr(e.message); setBusy(false); }
  };

  return (
    <div style={{ marginTop: 28, borderTop: `1px solid ${T.line}`, paddingTop: 20 }}>
      {!armed ? (
        <button onClick={() => setArmed(true)}
          style={{ background: 'transparent', color: '#ff6b6b', border: '1px solid rgba(255,107,107,0.4)', borderRadius: 10, padding: '10px 16px', fontSize: 13.5, fontWeight: 600, cursor: 'pointer' }}>
          Delete this event
        </button>
      ) : (
        <div style={{ background: 'rgba(255,107,107,0.08)', border: '1px solid rgba(255,107,107,0.4)', borderRadius: 12, padding: 16 }}>
          <p style={{ color: '#ff9a9a', fontSize: 14, fontWeight: 700, margin: '0 0 6px' }}>Delete &quot;{name}&quot; permanently?</p>
          <p style={{ color: T.dim, fontSize: 12.5, margin: '0 0 12px', lineHeight: 1.5 }}>
            This removes the event and all its orders, tickets, views, and signups. This cannot be undone. Type <strong style={{ color: '#fff' }}>DELETE</strong> to confirm.
          </p>
          <input value={typed} onChange={(e) => setTyped(e.target.value)} placeholder="DELETE"
            style={{ ...INP, marginBottom: 12 }} />
          {err && <p style={{ color: '#ff8585', fontSize: 13, margin: '0 0 10px' }}>{err}</p>}
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={del} disabled={typed !== 'DELETE' || busy}
              style={{ background: '#e5484d', color: '#fff', border: 'none', borderRadius: 10, padding: '10px 16px', fontSize: 13.5, fontWeight: 700, cursor: typed === 'DELETE' && !busy ? 'pointer' : 'default', opacity: typed === 'DELETE' && !busy ? 1 : 0.5 }}>
              {busy ? 'Deleting…' : 'Permanently delete'}
            </button>
            <button onClick={() => { setArmed(false); setTyped(''); setErr(''); }} style={GHOST}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------------- DROP BLAST (text the notify list tickets are live) ---------------- */
function DropBlast({ adminKey, eventId, signups }: { adminKey: string; eventId: string; signups: number }) {
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [err, setErr] = useState('');
  const [confirm, setConfirm] = useState(false);
  const [list, setList] = useState<any[] | null>(null);
  const [loadingList, setLoadingList] = useState(false);
  const toggleList = async () => {
    if (list) { setList(null); return; }
    setLoadingList(true);
    try { const r = await adminApi(adminKey, 'notify_list', { eventId }); setList(r.signups || []); }
    catch (e: any) { setErr(e.message); }
    finally { setLoadingList(false); }
  };

  const blast = async () => {
    setBusy(true); setErr('');
    try {
      const r = await adminApi(adminKey, 'notify_blast', { eventId, message: msg.trim() || undefined });
      setResult(r); setConfirm(false);
    } catch (e: any) { setErr(e.message); }
    finally { setBusy(false); }
  };

  return (
    <div style={{ background: `${T.redBright}12`, border: `1px solid ${T.redBright}55`, borderRadius: 14, padding: 18, marginBottom: 24, maxWidth: 520 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
        <p style={{ color: '#fff', fontSize: 15, fontWeight: 800, margin: 0 }}>🔔 {signups} on the notify list</p>
        <button onClick={toggleList} style={{ background: 'none', border: 'none', color: T.redBright, fontSize: 12.5, fontWeight: 700, cursor: 'pointer', textDecoration: 'underline' }}>
          {loadingList ? 'Loading…' : list ? 'Hide signups' : 'View signups'}
        </button>
      </div>
      {list && (
        <div style={{ maxHeight: 220, overflowY: 'auto', background: 'rgba(0,0,0,0.35)', borderRadius: 10, padding: '8px 12px', marginBottom: 12 }}>
          {list.length === 0 && <p style={{ color: T.dim, fontSize: 13, margin: '6px 0' }}>No signups yet.</p>}
          {list.map((n: any, i: number) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: i < list.length - 1 ? '1px solid rgba(255,255,255,0.06)' : 'none' }}>
              <span style={{ color: n.dead ? '#777' : '#fff', fontSize: 13.5, fontFamily: 'monospace', textDecoration: n.dead ? 'line-through' : 'none' }}>{n.phone}</span>
              <span style={{ color: T.dim, fontSize: 11.5 }}>
                {new Date(n.at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                {n.dead ? ' · ☠ dead' : n.notified ? ' · ✓ texted' : ' · waiting'}
              </span>
            </div>
          ))}
        </div>
      )}
      <p style={{ color: T.dim, fontSize: 13, margin: '0 0 14px', lineHeight: 1.5 }}>
        Text everyone who signed up that tickets are live. Leave the message blank to send the default &quot;tickets are LIVE&quot; text with the link.
      </p>
      {result ? (
        <div style={{ background: 'rgba(61,220,132,0.12)', border: '1px solid rgba(61,220,132,0.4)', borderRadius: 10, padding: '12px 14px', color: '#b8f5d0', fontSize: 13.5 }}>
          ✓ Sent to {result.sent}{result.failed > 0 ? ` · ${result.failed} failed` : ''}{result.flaggedDead > 0 ? ` · ${result.flaggedDead} dead numbers flagged (never texted again)` : ''}{result.skippedBad > 0 ? ` · ${result.skippedBad} known-dead skipped` : ''}
        </div>
      ) : !confirm ? (
        <>
          <textarea value={msg} onChange={(e) => setMsg(e.target.value)} placeholder="Optional custom message (link added automatically)"
            style={{ ...INP, minHeight: 70, resize: 'vertical', marginBottom: 12 }} />
          {err && <p style={{ color: T.redBright, fontSize: 13, margin: '0 0 10px' }}>{err}</p>}
          <button style={{ ...BTN, opacity: busy ? 0.6 : 1 }} disabled={busy} onClick={() => setConfirm(true)}>
            TEXT THE LIST ({signups})
          </button>
        </>
      ) : (
        <div>
          <p style={{ color: '#fff', fontSize: 14, margin: '0 0 12px' }}>Send to {signups} {signups === 1 ? 'person' : 'people'}? This sends real texts.</p>
          <div style={{ display: 'flex', gap: 10 }}>
            <button style={{ ...BTN, opacity: busy ? 0.6 : 1 }} disabled={busy} onClick={blast}>{busy ? 'Sending…' : 'YES, SEND'}</button>
            <button style={GHOST} onClick={() => setConfirm(false)}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------------- BOX OFFICE (door sales by card) ---------------- */
function BoxOffice({ adminKey, events, eventId, setEventId }: { adminKey: string; events: any[]; eventId: string; setEventId: (id: string) => void }) {
  const [types, setTypes] = useState<any[]>([]);
  const [ttId, setTtId] = useState('');
  const [qty, setQty] = useState(1);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);
  const [pk, setPk] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [done, setDone] = useState(false);
  const [quote, setQuote] = useState<any>(null);

  // if we returned from a successful card charge, show the success state
  useEffect(() => {
    if (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('boxoffice') === 'done') {
      setDone(true);
      // clean the URL so a refresh doesn't re-trigger
      window.history.replaceState({}, '', '/admin');
    }
  }, []);

  // load ticket types for the selected event
  useEffect(() => {
    if (!eventId) return;
    setTypes([]); setTtId(''); setClientSecret(''); setDone(false); setQuote(null);
    adminApi(adminKey, 'get_event', { eventId })
      .then((d) => { const paid = (d.ticketTypes || []).filter((t: any) => Number(t.price) > 0); setTypes(paid); if (paid[0]) setTtId(paid[0].id); })
      .catch((e) => setErr(e.message));
  }, [eventId, adminKey]);

  // live quote from the public checkout quote endpoint
  useEffect(() => {
    if (!eventId || !ttId) { setQuote(null); return; }
    fetch(`${BACKEND}/checkout?eventId=${eventId}&ticketTypeId=${ttId}&quantity=${qty}`)
      .then((r) => r.json()).then((d) => setQuote(d)).catch(() => setQuote(null));
  }, [eventId, ttId, qty]);

  const startCharge = async () => {
    setLoading(true); setErr('');
    try {
      const [cfg, pi] = await Promise.all([
        pk ? Promise.resolve({ publishableKey: pk }) : fetch(`${BACKEND}/box-office?config=1`).then((r) => r.json()),
        fetch(`${BACKEND}/box-office`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-admin-key': adminKey },
          body: JSON.stringify({ eventId, ticketTypeId: ttId, quantity: qty, buyerName: name.trim() || 'Door sale', buyerEmail: email.trim(), buyerPhone: phone.trim() }),
        }).then((r) => r.json()),
      ]);
      if (cfg.error) throw new Error(cfg.error);
      if (pi.error) throw new Error(pi.error);
      setPk(cfg.publishableKey); setClientSecret(pi.clientSecret);
    } catch (e: any) { setErr(e.message); }
    finally { setLoading(false); }
  };

  const reset = () => { setClientSecret(''); setDone(false); setName(''); setEmail(''); setPhone(''); setQty(1); setErr(''); };

  const current = events.find((e) => e.id === eventId);

  if (done) {
    return (
      <>
        <H>Box Office</H>
        <div style={{ background: T.card, border: `1px solid rgba(61,220,132,0.4)`, borderRadius: 16, padding: 28, maxWidth: 460, textAlign: 'center' }}>
          <div style={{ width: 60, height: 60, borderRadius: '50%', background: 'rgba(61,220,132,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', fontSize: 30 }}>✓</div>
          <p style={{ color: '#fff', fontSize: 22, fontWeight: 800, margin: '0 0 6px' }}>Charged &amp; ticket sent</p>
          <p style={{ color: T.dim, fontSize: 14, margin: '0 0 22px' }}>{qty} × ticket{qty > 1 ? 's' : ''}{email ? ` · emailed to ${email}` : ' · no email given (still scannable)'}</p>
          <button style={BTN} onClick={reset}>NEW SALE</button>
        </div>
      </>
    );
  }

  return (
    <>
      <H>Box Office</H>
      <p style={{ color: T.dim, fontSize: 13.5, margin: '0 0 20px', maxWidth: 480, lineHeight: 1.6 }}>
        Sell a ticket at the door by card. The buyer gets a scannable QR — email &amp; phone are optional (leave blank for a quick cash-register style sale; they can still be scanned in).
      </p>

      <div style={{ maxWidth: 480 }}>
        <label style={LBL}>Event</label>
        <select style={{ ...INP, marginBottom: 14 }} value={eventId} onChange={(e) => setEventId(e.target.value)}>
          {events.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
        </select>

        {types.length === 0 ? (
          <p style={{ color: T.dim, fontSize: 14 }}>No paid ticket types on this event.</p>
        ) : (
          <>
            <label style={LBL}>Ticket</label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
              {types.map((t) => (
                <button key={t.id} onClick={() => setTtId(t.id)} disabled={!!clientSecret}
                  style={{ background: ttId === t.id ? T.red : '#141418', color: '#fff', border: `1px solid ${ttId === t.id ? T.red : 'rgba(255,255,255,0.12)'}`, borderRadius: 10, padding: '10px 14px', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
                  {t.name} · {money(+t.price)}
                </button>
              ))}
            </div>

            <label style={LBL}>Quantity</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 14 }}>
              <button onClick={() => setQty(Math.max(1, qty - 1))} disabled={!!clientSecret} style={{ width: 44, height: 44, borderRadius: 10, background: '#141418', border: `1px solid ${T.line}`, color: '#fff', fontSize: 22, cursor: 'pointer' }}>−</button>
              <span style={{ color: '#fff', fontSize: 24, fontWeight: 800, minWidth: 30, textAlign: 'center' }}>{qty}</span>
              <button onClick={() => setQty(Math.min(20, qty + 1))} disabled={!!clientSecret} style={{ width: 44, height: 44, borderRadius: 10, background: '#141418', border: `1px solid ${T.line}`, color: '#fff', fontSize: 22, cursor: 'pointer' }}>+</button>
            </div>

            <label style={LBL}>Buyer name (optional)</label>
            <input style={{ ...INP, marginBottom: 12 }} value={name} disabled={!!clientSecret} onChange={(e) => setName(e.target.value)} placeholder="Door sale" />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 18 }}>
              <div><label style={LBL}>Email (optional)</label>
                <input style={INP} value={email} disabled={!!clientSecret} onChange={(e) => setEmail(e.target.value)} placeholder="for their QR" /></div>
              <div><label style={LBL}>Phone (optional)</label>
                <input style={INP} value={phone} disabled={!!clientSecret} onChange={(e) => setPhone(e.target.value)} placeholder="for SMS" /></div>
            </div>

            {quote && quote.total != null && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', background: '#141418', borderRadius: 12, padding: '14px 16px', marginBottom: 16, border: `1px solid ${T.line}` }}>
                <span style={{ color: T.dim, fontSize: 14 }}>Total to charge</span>
                <span style={{ color: '#fff', fontSize: 24, fontWeight: 800 }}>{money(quote.total)}</span>
              </div>
            )}

            {err && <p style={{ color: T.redBright, fontSize: 13.5, margin: '0 0 14px' }}>{err}</p>}

            {!clientSecret ? (
              <button style={{ ...BTN, width: '100%', opacity: loading || !ttId ? 0.5 : 1 }} disabled={loading || !ttId} onClick={startCharge}>
                {loading ? 'PREPARING…' : quote ? `TAKE PAYMENT · ${money(quote.total)}` : 'TAKE PAYMENT'}
              </button>
            ) : (
              <div style={{ background: '#0e0e12', border: `1px solid ${T.line}`, borderRadius: 14, padding: 18 }}>
                <p style={{ color: '#fff', fontSize: 15, fontWeight: 700, margin: '0 0 14px' }}>Enter card</p>
                <CardCheckout
                  publishableKey={pk}
                  clientSecret={clientSecret}
                  btn={T.red}
                  returnUrl={typeof window !== 'undefined' ? `${window.location.origin}/admin?boxoffice=done` : '/admin'}
                  onError={setErr}
                />
                <button onClick={() => setClientSecret('')} style={{ ...GHOST, width: '100%', marginTop: 12 }}>CANCEL</button>
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}


function Appearance({ adminKey }: { adminKey: string }) {
  const [color, setColor] = useState<string>('#c25b6e');
  const [accent, setAccent] = useState<string>('#c25b6e');
  const [err, setErr] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const load = useCallback(() => {
    setErr('');
    adminApi(adminKey, 'get_settings', {}).then((d) => {
      setColor(d.settings?.buttonColor || '#c25b6e');
      setAccent(d.settings?.accentColor || '#c25b6e');
    }).catch((e) => setErr(e.message));
  }, [adminKey]);
  useEffect(load, [load]);

  const save = async () => {
    setSaving(true); setErr(''); setSaved(false);
    try {
      await adminApi(adminKey, 'set_settings', { buttonColor: color, accentColor: accent });
      setSaved(true); setTimeout(() => setSaved(false), 2500);
    } catch (e: any) { setErr(e.message); }
    finally { setSaving(false); }
  };

  const swatches = ['#c25b6e', '#831100', '#7c3aed', '#2563eb', '#e11d48', '#059669', '#ea580c', '#db2777', '#0891b2'];

  return (
    <>
      <H>Appearance</H>
      <p style={{ color: T.dim, fontSize: 13.5, margin: '0 0 20px', maxWidth: 520, lineHeight: 1.6 }}>
        The default colors for every event. Individual events can override these in their own settings.
      </p>

      <Sub>Default button color</Sub>
      <p style={{ color: T.dim, fontSize: 12.5, margin: '0 0 10px', maxWidth: 520 }}>The Get Tickets / Pay buttons.</p>
      <div style={{ background: T.card, border: `1px solid ${T.line}`, borderRadius: 14, padding: 18, maxWidth: 520, marginBottom: 22 }}>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 16 }}>
          {swatches.map((c) => (
            <button key={c} onClick={() => setColor(c)} aria-label={c}
              style={{ width: 36, height: 36, borderRadius: '50%', background: c, border: color.toLowerCase() === c ? '3px solid #fff' : '1px solid rgba(255,255,255,0.2)', cursor: 'pointer' }} />
          ))}
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <input type="color" value={color} onChange={(e) => setColor(e.target.value)}
            style={{ width: 48, height: 42, background: 'none', border: `1px solid ${T.line}`, borderRadius: 10, cursor: 'pointer', padding: 2 }} />
          <input style={{ ...INP, maxWidth: 150, fontFamily: 'monospace' }} value={color} onChange={(e) => setColor(e.target.value)} placeholder="#c25b6e" />
          <span style={{ display: 'inline-flex', alignItems: 'center', background: color, color: '#fff', fontSize: 14, fontWeight: 700, padding: '12px 22px', borderRadius: 26 }}>Get Tickets</span>
        </div>
      </div>

      <Sub>Default accent color</Sub>
      <p style={{ color: T.dim, fontSize: 12.5, margin: '0 0 10px', maxWidth: 520 }}>The date text, the GOZA label, and other highlights.</p>
      <div style={{ background: T.card, border: `1px solid ${T.line}`, borderRadius: 14, padding: 18, maxWidth: 520 }}>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 16 }}>
          {swatches.map((c) => (
            <button key={c} onClick={() => setAccent(c)} aria-label={c}
              style={{ width: 36, height: 36, borderRadius: '50%', background: c, border: accent.toLowerCase() === c ? '3px solid #fff' : '1px solid rgba(255,255,255,0.2)', cursor: 'pointer' }} />
          ))}
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <input type="color" value={accent} onChange={(e) => setAccent(e.target.value)}
            style={{ width: 48, height: 42, background: 'none', border: `1px solid ${T.line}`, borderRadius: 10, cursor: 'pointer', padding: 2 }} />
          <input style={{ ...INP, maxWidth: 150, fontFamily: 'monospace' }} value={accent} onChange={(e) => setAccent(e.target.value)} placeholder="#c25b6e" />
          <span style={{ display: 'inline-flex', alignItems: 'center', color: accent, fontSize: 13, fontWeight: 700, letterSpacing: 2 }}>SAT, AUG 22 · 8PM</span>
        </div>
      </div>

      {err && <p style={{ color: T.redBright, fontSize: 13, margin: '16px 0 12px' }}>{err}</p>}
      <button style={{ ...BTN, marginTop: 20, opacity: saving ? 0.5 : 1 }} disabled={saving} onClick={save}>
        {saving ? 'SAVING…' : saved ? 'SAVED ✓' : 'SAVE COLORS'}
      </button>
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
