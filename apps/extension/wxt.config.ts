import { defineConfig } from 'wxt';
import tailwindcss from '@tailwindcss/vite';
import { MELOFY_MATCH_PATTERNS } from './lib/config';

export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  manifest: ({ browser }) => ({
    name: 'Melofy: Lyrics & Translation',
    description:
      'Synced, AI-translated lyrics for YouTube Music, and the now-playing bridge for the Melofy web app.',
    action: {
      default_title: 'Melofy',
      default_icon: { '16': 'icon/16.png', '32': 'icon/32.png', '48': 'icon/48.png', '128': 'icon/128.png' },
    },
    permissions: ['storage'],
    host_permissions: [
      '*://music.youtube.com/*',
      'https://lrclib.net/*',
      ...MELOFY_MATCH_PATTERNS,
    ],
    // Firefox requires a stable extension ID for AMO signing/distribution.
    ...(browser === 'firefox'
      ? { browser_specific_settings: { gecko: { id: 'melofy@melofy.app' } } }
      : {}),
  }),
  vite: () => ({
    plugins: [tailwindcss()],
  }),
});
