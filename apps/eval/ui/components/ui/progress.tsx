import * as React from 'react';
import { cn } from '@/lib/utils';

function Progress({ value = 0, className, ...props }: React.ComponentProps<'div'> & { value?: number }) {
  return (
    <div
      data-slot="progress"
      role="progressbar"
      aria-valuenow={Math.round(value)}
      aria-valuemin={0}
      aria-valuemax={100}
      className={cn('bg-secondary relative h-2 w-full overflow-hidden rounded-full', className)}
      {...props}
    >
      <div
        data-slot="progress-indicator"
        className="bg-primary h-full rounded-full transition-[width] duration-300 ease-out"
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
      />
    </div>
  );
}

export { Progress };
