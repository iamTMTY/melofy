'use client';

import { Suspense } from 'react';
import { MelofyProvider } from '@/hooks/useMelofy';
import { Dashboard } from '@/components/home/Dashboard';

export default function HomePage() {
  return (
    <MelofyProvider>
      <Suspense fallback={<div className="min-h-screen bg-[#1c1c1e]" />}>
        <Dashboard />
      </Suspense>
    </MelofyProvider>
  );
}
