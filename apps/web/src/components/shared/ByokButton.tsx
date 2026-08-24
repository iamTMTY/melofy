'use client';

import { useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { ByokModal } from './ByokModal';

// A trigger that opens the BYOK modal. `onSaved` lets a caller react (e.g. retry
// the translation) once a key is set.
export function ByokButton({
  label = 'Use your own API key',
  className,
  onSaved,
}: {
  label?: string;
  className?: string;
  onSaved?: () => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={className}>
        {label}
      </button>
      <AnimatePresence>
        {open && (
          <ByokModal
            onClose={() => setOpen(false)}
            onSaved={() => {
              setOpen(false);
              onSaved?.();
            }}
          />
        )}
      </AnimatePresence>
    </>
  );
}
