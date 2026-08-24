import * as React from 'react';
import { Check, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import type { Option } from '@/components/multi-select';

export function Combobox({
  options,
  value,
  onChange,
  placeholder = 'Select…',
  disabled,
  emptyText = 'No matches.',
}: {
  options: Option[];
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  disabled?: boolean;
  emptyText?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const current = options.find((o) => o.value === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          className={cn(
            'border-input bg-input/30 hover:bg-input/50 flex h-10 w-full items-center justify-between gap-2 rounded-md border px-3 py-2 text-left text-sm outline-none transition-colors',
            'focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50'
          )}
        >
          <span className={cn('truncate', !current && 'text-muted-foreground')}>
            {current ? current.label : placeholder}
          </span>
          <ChevronsUpDown className="size-4 shrink-0 opacity-50" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
        <Command>
          <CommandInput placeholder="Search…" />
          <CommandList>
            <CommandEmpty>{emptyText}</CommandEmpty>
            {options.map((o) => (
              <CommandItem
                key={o.value}
                value={`${o.label} ${o.value} ${o.hint ?? ''}`}
                onSelect={() => {
                  onChange(o.value);
                  setOpen(false);
                }}
              >
                <Check className={cn('size-4', value === o.value ? 'opacity-100' : 'opacity-0')} />
                <span className="flex-1 truncate">{o.label}</span>
                {o.hint && <span className="text-muted-foreground shrink-0 text-xs tabular-nums">{o.hint}</span>}
              </CommandItem>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
