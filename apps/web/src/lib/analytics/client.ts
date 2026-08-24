'use client';

import posthog from 'posthog-js';

// Client-side product analytics for the web funnel (pageviews + a few key UI
// moments). Privacy-conscious: autocapture OFF (explicit events only, so no
// accidental PII), session recording OFF, no person profiles for anonymous
// visitors, and traffic reverse-proxied through /ingest (see next.config.js) to
// dodge ad-blockers. The heavy, reliable events (translations, rate limits) are
// captured server-side; this layer is just the funnel.
//
// No-op unless NEXT_PUBLIC_POSTHOG_KEY is set.

let started = false;

export function initAnalytics(): void {
  if (started || typeof window === 'undefined') return;
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (!key) return;
  posthog.init(key, {
    // Relative path → hits the Next.js rewrite that proxies to PostHog cloud.
    api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST || '/ingest',
    ui_host: process.env.NEXT_PUBLIC_POSTHOG_UI_HOST || 'https://us.posthog.com',
    autocapture: false,
    capture_pageview: false, // we send $pageview manually on route change
    capture_pageleave: true,
    disable_session_recording: true,
    person_profiles: 'identified_only',
  });
  started = true;
}

/** Capture a client funnel event. Safe to call before init (no-ops). */
export function track(event: string, properties?: Record<string, unknown>): void {
  if (!started) return;
  try {
    posthog.capture(event, { surface: 'web', ...properties });
  } catch {
    /* best-effort */
  }
}

export function capturePageview(url?: string): void {
  if (!started) return;
  try {
    posthog.capture('$pageview', { surface: 'web', ...(url ? { $current_url: url } : {}) });
  } catch {
    /* best-effort */
  }
}
