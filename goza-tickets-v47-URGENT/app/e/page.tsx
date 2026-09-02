'use client';

/*
  Per-event page: /e?id=<eventId>
  Query-param routing keeps this statically exportable while supporting
  unlimited events — every show gets its own shareable link from admin.
*/
import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import EventPage from '@/components/EventPage';

function Inner() {
  const id = useSearchParams().get('id') || undefined;
  return <EventPage eventId={id} />;
}

export default function E() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', background: '#000' }} />}>
      <Inner />
    </Suspense>
  );
}
