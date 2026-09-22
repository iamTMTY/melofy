import type { ThemePreset, ReadingPriority } from '@/lib/types';

/**
 * A preset is a named bundle of the look-and-feel knobs. Adding a preset means
 * adding a row here — the views read the config, never the preset name.
 */
export interface PresetConfig {
  label: string;
  hint: string;
  /** Backdrop behind the lyrics. */
  background: 'art' | 'plain' | 'black';
  /** Tint the active line with a colour sampled from the album art. */
  adaptiveAccent: boolean;
  /** Blur non-active lines so the current one is the only thing in focus. */
  focusBlur: boolean;
  align: 'center' | 'left';
  /** Vertical rhythm between lines. */
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

/**
 * Which line leads. `understand` puts the translation first (default),
 * `learn` flips it so the original leads and the translation is the gloss,
 * `both` gives them equal weight.
 */
export interface ReadingLayout {
  /** Field shown in the primary (large) slot. */
  lead: 'translated' | 'original';
  /** Secondary line is shown at the same size rather than as a subtitle. */
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
