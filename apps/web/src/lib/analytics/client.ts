'use client';

import posthog from 'posthog-js';

let started = false;

export function initAnalytics(): void {
  if (started || typeof window === 'undefined') return;
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (!key) return;
  posthog.init(key, {
    api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST || '/ingest',
    ui_host: process.env.NEXT_PUBLIC_POSTHOG_UI_HOST || 'https://us.posthog.com',
    autocapture: false,
    capture_pageview: false,
    capture_pageleave: true,
    disable_session_recording: true,
    person_profiles: 'identified_only',
  });
  started = true;
}

export function track(event: string, properties?: Record<string, unknown>): void {
  if (!started) return;
  try {
    posthog.capture(event, { surface: 'web', ...properties });
  } catch {}
}

export function capturePageview(url?: string): void {
  if (!started) return;
  try {
    posthog.capture('$pageview', { surface: 'web', ...(url ? { $current_url: url } : {}) });
  } catch {}
}
