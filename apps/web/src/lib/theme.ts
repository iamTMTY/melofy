import type { ThemePreset, ReadingPriority } from '@/lib/types';

export interface PresetConfig {
  label: string;
  hint: string;
  background: 'art' | 'plain' | 'black';
  adaptiveAccent: boolean;
  focusBlur: boolean;
  align: 'center' | 'left';
  density: 'cozy' | 'compact';
}

export const PRESETS: Record<ThemePreset, PresetConfig> = {
  classic: {
    label: 'Classic',
    hint: 'Blurred album art, centered',
    background: 'art',
    adaptiveAccent: false,
    focusBlur: false,
    align: 'center',
    density: 'cozy',
  },
  immersive: {
    label: 'Immersive',
    hint: 'Album colour + focus blur',
    background: 'art',
    adaptiveAccent: true,
    focusBlur: true,
    align: 'center',
    density: 'cozy',
  },
  minimal: {
    label: 'Minimal',
    hint: 'No artwork, high contrast',
    background: 'plain',
    adaptiveAccent: false,
    focusBlur: false,
    align: 'left',
    density: 'compact',
  },
  amoled: {
    label: 'AMOLED',
    hint: 'True black, easy on OLED',
    background: 'black',
    adaptiveAccent: false,
    focusBlur: false,
    align: 'center',
    density: 'cozy',
  },
};

export const PRESET_ORDER: ThemePreset[] = ['classic', 'immersive', 'minimal', 'amoled'];

export function presetConfig(preset: ThemePreset | undefined): PresetConfig {
  return PRESETS[preset ?? 'classic'] ?? PRESETS.classic;
}

export interface ReadingLayout {
  lead: 'translated' | 'original';
  equal: boolean;
}

export const READING_PRIORITIES: Record<ReadingPriority, { label: string; hint: string } & ReadingLayout> = {
  understand: { label: 'Understand', hint: 'Translation leads', lead: 'translated', equal: false },
  learn: { label: 'Learn', hint: 'Original leads', lead: 'original', equal: false },
  both: { label: 'Both', hint: 'Equal weight', lead: 'translated', equal: true },
};

export function readingLayout(priority: ReadingPriority | undefined): ReadingLayout {
  return READING_PRIORITIES[priority ?? 'understand'] ?? READING_PRIORITIES.understand;
}
