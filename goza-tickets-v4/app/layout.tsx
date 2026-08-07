import type { Metadata, Viewport } from 'next';

export const metadata: Metadata = {
  title: 'Goza Entertainment — Tickets',
  description: 'Get your tickets.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1, // stops iOS zooming the scanner view on double-tap
  themeColor: '#050309',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, background: '#050309', WebkitFontSmoothing: 'antialiased' }}>
        {children}
      </body>
    </html>
  );
}
