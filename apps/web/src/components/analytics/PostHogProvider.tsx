'use client';

import { Suspense, useEffect } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { initAnalytics, capturePageview } from '@/lib/analytics/client';

// Initializes PostHog once and emits a manual $pageview on every App-Router
// navigation. The pageview tracker reads useSearchParams, which must sit inside a
// Suspense boundary in the App Router, so it's isolated below.

function PageviewTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (!pathname) return;
    let url = window.origin + pathname;
    const qs = searchParams?.toString();
    if (qs) url += `?${qs}`;
    capturePageview(url);
  }, [pathname, searchParams]);

  return null;
}

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    initAnalytics();
  }, []);

  return (
    <>
      {children}
      <Suspense fallback={null}>
        <PageviewTracker />
      </Suspense>
    </>
  );
}
