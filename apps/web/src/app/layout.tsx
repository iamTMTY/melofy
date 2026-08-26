import type { Metadata, Viewport } from 'next';
import './globals.css';
import { Outfit } from 'next/font/google';
import localFont from 'next/font/local';
import { PostHogProvider } from '@/components/analytics/PostHogProvider';

// Self-hosted + preloaded in the document head so the fonts arrive WITH the page
// (no flash-of-unstyled-text). next/font also injects a metric-adjusted fallback,
// so there's no layout shift when the real face swaps in.
const outfit = Outfit({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-outfit',
  display: 'swap',
});

// Decorative "Melofy" wordmark face (personal-use license).
const bunchBlossoms = localFont({
  src: '../../public/fonts/BunchBlossoms.ttf',
  variable: '--font-brand',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Melofy — Translated Lyrics, Synced',
  description: 'Overcome the language barrier in music. Melofy detects your currently playing song and displays beautifully synced, AI-translated lyrics in your language.',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Melofy',
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#1c1c1e' },
  ],
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning className={`${outfit.variable} ${bunchBlossoms.variable}`}>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var theme = localStorage.getItem('melofy-theme');
                  if (theme === 'dark' || (!theme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
                    document.documentElement.classList.add('dark');
                  } else {
                    document.documentElement.classList.remove('dark');
                  }
                } catch(e) {}
              })();
            `,
          }}
        />
      </head>
      <body className="min-h-[100dvh] bg-white dark:bg-[#1c1c1e] text-gray-900 dark:text-white antialiased font-sans" style={{ fontFamily: 'var(--font-outfit), sans-serif' }}>
        <PostHogProvider>
          <div className="relative flex min-h-[100dvh] flex-col">
            {children}
          </div>
        </PostHogProvider>
      </body>
    </html>
  );
}
