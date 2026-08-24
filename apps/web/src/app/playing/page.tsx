'use client';

import { MelofyProvider } from '@/hooks/useMelofy';
import { PlayingView } from '@/components/playing/PlayingView';

export default function PlayingPageWrapper() {
  return (
    <MelofyProvider>
      <PlayingView />
    </MelofyProvider>
  );
}
