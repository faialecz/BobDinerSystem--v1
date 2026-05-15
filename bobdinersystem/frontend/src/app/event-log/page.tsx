'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function EventLogRoutePage() {
  const router = useRouter();
  useEffect(() => {
    try {
      localStorage.setItem('activeTab', 'Event Log');
      window.dispatchEvent(new CustomEvent('app:navigate', { detail: { tab: 'Event Log' } }));
    } catch { /* ignore */ }
    // Return to root app shell which will read activeTab
    router.push('/');
  }, [router]);
  return null;
}
