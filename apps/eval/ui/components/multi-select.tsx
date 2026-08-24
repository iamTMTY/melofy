import * as React from 'react';
import { Check, ChevronsUpDown, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from '@/components/ui/command';

export interface Option {
  value: string;
  label: string;
  hint?: string;
}

export function MultiSelect({
  options,
  selected,
  onChange,
  placeholder = 'Select…',
  disabled,
  emptyText = 'No matches.',
}: {
  options: Option[];
  selected: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  disabled?: boolean;
  emptyText?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const labelFor = (v: string) => options.find((o) => o.value === v)?.label ?? v;
  const toggle = (v: string) =>
    onChange(selected.includes(v) ? selected.filter((x) => x !== v) : [...selected, v]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          className={cn(
            'border-input bg-input/30 hover:bg-input/50 flex min-h-10 w-full items-center justify-between gap-2 rounded-md border px-3 py-2 text-left text-sm outline-none transition-colors',
            'focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50'
          )}
        >
          {selected.length ? (
            <span className="flex flex-1 flex-wrap gap-1.5">
              {selected.map((v) => (
                <Badge
                  key={v}
                  variant="secondary"
                  className="gap-1 pr-1"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    toggle(v);
                  }}
                >
                  {labelFor(v)}
                  <X className="size-3 opacity-60 hover:opacity-100" />
                </Badge>
              ))}
            </span>
          ) : (
            <span className="text-muted-foreground">{placeholder}</span>
          )}
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
                onSelect={() => toggle(o.value)}
              >
                <Check className={cn('size-4', selected.includes(o.value) ? 'opacity-100' : 'opacity-0')} />
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
