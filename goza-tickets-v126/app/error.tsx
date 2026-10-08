'use client';

/* Shows what actually broke instead of a blank white page.
   A white screen tells nobody anything; this tells us the component and the
   message, and gives the visitor a way out. */

import { useEffect } from 'react';

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // also push it to the console for anyone who can open devtools
    console.error('Goza page error:', error);
  }, [error]);

  return (
    <div style={{
      minHeight: '100vh', background: '#07080C', color: '#fff',
      fontFamily: "'Saira Condensed','Arial Narrow',Helvetica,sans-serif",
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '28px 20px',
    }}>
      <div style={{ maxWidth: 460, width: '100%' }}>
        <p style={{
          fontFamily: "'Chakra Petch','Trebuchet MS',sans-serif", fontWeight: 700,
          fontSize: 10.5, letterSpacing: 3, color: '#1140F0', textTransform: 'uppercase', margin: '0 0 8px',
        }}>Tickets OS</p>

        <h1 style={{
          fontFamily: "'Archivo Black',Impact,sans-serif", fontSize: 30,
          textTransform: 'uppercase', margin: '0 0 10px', lineHeight: 1,
        }}>Something broke</h1>

        <p style={{ color: '#9AA5B5', fontSize: 15, lineHeight: 1.55, margin: '0 0 20px' }}>
          Not your fault. Try again — if it keeps happening, screenshot this and send it over.
        </p>

        <button onClick={reset} style={{
          width: '100%', background: '#1140F0', color: '#fff', border: 'none', borderRadius: 999,
          padding: '16px 0', fontFamily: "'Chakra Petch','Trebuchet MS',sans-serif", fontWeight: 700,
          fontSize: 14.5, letterSpacing: 1.1, textTransform: 'uppercase', cursor: 'pointer',
          boxShadow: '0 8px 22px rgba(17,64,240,.4)', marginBottom: 10,
        }}>Try again</button>

        <a href="/" style={{
          display: 'block', textAlign: 'center', textDecoration: 'none', color: '#9AA5B5',
          fontSize: 13.5, padding: '10px 0 18px',
        }}>Back to all events</a>

        {/* the part that actually helps: what broke */}
        <div style={{
          background: '#0E1116', border: '1px solid #232936', borderRadius: 14,
          padding: '14px 15px', fontFamily: 'ui-monospace,Menlo,monospace',
        }}>
          <p style={{
            margin: '0 0 8px', fontFamily: "'Chakra Petch','Trebuchet MS',sans-serif",
            fontWeight: 700, fontSize: 9.5, letterSpacing: 2, textTransform: 'uppercase', color: '#6d7787',
          }}>What broke</p>
          <p style={{ margin: 0, color: '#FF8585', fontSize: 12.5, lineHeight: 1.6, wordBreak: 'break-word' }}>
            {error?.message || 'Unknown error'}
          </p>
          {error?.digest && (
            <p style={{ margin: '8px 0 0', color: '#6d7787', fontSize: 11.5 }}>ref {error.digest}</p>
          )}
          {error?.stack && (
            <p style={{ margin: '8px 0 0', color: '#6d7787', fontSize: 11, lineHeight: 1.5, wordBreak: 'break-word', maxHeight: 140, overflow: 'auto' }}>
              {error.stack.split('\n').slice(1, 5).join('\n')}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
