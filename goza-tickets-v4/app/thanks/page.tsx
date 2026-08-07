'use client';

/*
  Post-purchase page, Posh-styled. Deliberately shows NO QR code:
  the webhook issues tickets and may finish seconds after this page loads.
  The email is the source of truth.
*/
export default function Thanks() {
  return (
    <main style={{ minHeight: '100vh', background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, fontFamily: 'Helvetica Neue,Helvetica,Arial,sans-serif' }}>
      <div style={{ maxWidth: 420, textAlign: 'center' }}>
        <div style={{ width: 76, height: 76, borderRadius: '50%', background: '#c25b6e', color: '#000', fontSize: 38, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 26px' }}>✓</div>
        <h1 style={{ color: '#fff', fontSize: 34, fontWeight: 800, margin: '0 0 14px' }}>YOU&apos;RE IN.</h1>
        <p style={{ color: '#9aa0ab', fontSize: 16.5, lineHeight: 1.55, margin: '0 0 18px' }}>
          Your tickets are on the way to your email — one QR code per ticket, so everyone in your group can walk in separately.
        </p>
        <p style={{ color: '#6f747d', fontSize: 13, lineHeight: 1.6, margin: 0 }}>
          Give it a minute. Nothing there? Check spam, then email <span style={{ color: '#fff' }}>support@gozaentertainment.com</span>.
        </p>
      </div>
    </main>
  );
}
