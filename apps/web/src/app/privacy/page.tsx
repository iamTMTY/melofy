import type { Metadata } from 'next';
import Link from 'next/link';

// TODO: replace with a mailbox you actually monitor (e.g. an alias on temi.codes).
const CONTACT_EMAIL = 'salaudeen.t@gmail.com';
const LAST_UPDATED = 'August 25, 2026';

export const metadata: Metadata = {
  title: 'Privacy Policy — Melofy',
  description:
    'How Melofy handles data across the web app and the browser extension: what we process, who we share it with, and what we never do.',
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-10">
      <h2 className="text-xl font-semibold text-gray-900 dark:text-white">{title}</h2>
      <div className="mt-3 space-y-3 text-[15px] leading-relaxed text-gray-600 dark:text-gray-300">
        {children}
      </div>
    </section>
  );
}

export default function PrivacyPolicyPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <Link
        href="/"
        className="text-sm text-blue-600 underline-offset-4 hover:underline dark:text-blue-400"
      >
        ← Back to Melofy
      </Link>

      <h1 className="mt-6 text-3xl font-semibold text-gray-900 dark:text-white">Privacy Policy</h1>
      <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">Last updated: {LAST_UPDATED}</p>

      <div className="mt-6 rounded-xl border border-gray-200 bg-gray-50 p-4 text-[15px] leading-relaxed text-gray-700 dark:border-white/10 dark:bg-white/5 dark:text-gray-300">
        <strong className="font-semibold text-gray-900 dark:text-white">TLDR:</strong> Melofy
        has no user accounts and does not sell your data. We process the name of the song you&apos;re
        playing to fetch and translate its lyrics. If you connect Spotify, those tokens stay in your
        browser. If you bring your own API key, it&apos;s encrypted in transit and never stored on our
        servers.
      </div>

      <Section title="Who we are &amp; what this covers">
        <p>
          Melofy detects the song you&apos;re listening to and shows beautifully synced, AI-translated
          lyrics in your language. This policy covers both the <strong>Melofy web app</strong> (at
          this site) and the <strong>Melofy browser extension</strong> for YouTube Music.
        </p>
      </Section>

      <Section title="Information we process">
        <ul className="list-disc space-y-3 pl-6">
          <li>
            <strong className="text-gray-900 dark:text-white">Track &amp; lyrics data.</strong> The
            artist and title of the currently playing song are sent to{' '}
            <a
              className="text-blue-600 underline-offset-4 hover:underline dark:text-blue-400"
              href="https://lrclib.net"
              target="_blank"
              rel="noreferrer noopener"
            >
              LRCLIB
            </a>{' '}
            to look up lyrics, and to our translation provider to translate them. Translated lyrics
            are cached so repeat plays are faster and cheaper.
          </li>
          <li>
            <strong className="text-gray-900 dark:text-white">Spotify connection (optional).</strong>{' '}
            If you connect Spotify, we request permission to read your profile and playback state and
            to control playback. The resulting access and refresh tokens are stored{' '}
            <strong>in your own browser</strong> (localStorage) — they are <strong>not</strong> saved
            on our servers. Token refreshes pass through our API but are not retained. Disconnect any
            time by clearing your browser data.
          </li>
          <li>
            <strong className="text-gray-900 dark:text-white">Your own API key (BYOK).</strong> If you
            choose to use your own Google Gemini or OpenRouter key, it is encrypted in your browser
            with our public key (RSA-OAEP) before being sent, used only to serve your request, and{' '}
            <strong>never written to storage</strong> on our side.
          </li>
          <li>
            <strong className="text-gray-900 dark:text-white">Rate-limiting &amp; technical data.</strong>{' '}
            To prevent abuse of the free translation quota, we derive an identifier from your IP
            address. We <strong>never store your raw IP</strong> — it is salted and hashed, and only
            that hash (plus a daily counter) is kept.
          </li>
          <li>
            <strong className="text-gray-900 dark:text-white">Anonymous usage analytics.</strong> We
            may record basic product events (e.g. a translation was requested) via PostHog to
            understand and improve the product. These events are tied only to the anonymous hashed-IP
            identifier above — not to a name, email, or account.
          </li>
          <li>
            <strong className="text-gray-900 dark:text-white">Extension local storage.</strong> The
            extension stores your preferences (target language, widget on/off) and a per-track
            translation cache <strong>on your device</strong>. It reads the now-playing track on{' '}
            <code className="rounded bg-gray-100 px-1 py-0.5 text-[13px] dark:bg-white/10">
              music.youtube.com
            </code>{' '}
            to know what to translate.
          </li>
        </ul>
      </Section>

      <Section title="What we don't do">
        <ul className="list-disc space-y-2 pl-6">
          <li>No user accounts, passwords, or profiles.</li>
          <li>We do not sell or rent your data, and we do not show ads.</li>
          <li>We do not track you across other websites.</li>
          <li>The extension contains no remote code — everything is bundled and reviewed.</li>
        </ul>
      </Section>

      <Section title="Third-party services">
        <p>To provide the service, data is shared with these providers only as needed:</p>
        <ul className="list-disc space-y-2 pl-6">
          <li>
            <strong className="text-gray-900 dark:text-white">LRCLIB</strong> — community lyrics
            lookup (receives the track&apos;s artist/title).
          </li>
          <li>
            <strong className="text-gray-900 dark:text-white">OpenRouter</strong> and its underlying
            model providers (e.g. Google) — perform the lyric translation.
          </li>
          <li>
            <strong className="text-gray-900 dark:text-white">Spotify</strong> — only if you connect
            it, for playback detection and control.
          </li>
          <li>
            <strong className="text-gray-900 dark:text-white">PostHog</strong> — anonymous product
            analytics.
          </li>
          <li>
            <strong className="text-gray-900 dark:text-white">Our hosting provider</strong> — runs the
            app and its cache database.
          </li>
        </ul>
        <p>
          Lyrics are sourced from LRCLIB for personal, non-commercial listening. Melofy is not
          affiliated with, endorsed by, or sponsored by YouTube, Google, or Spotify.
        </p>
      </Section>

      <Section title="Cookies &amp; local storage">
        <p>
          We use your browser&apos;s local storage for essential preferences (theme, target language,
          Spotify tokens, and translation caches). Analytics may set a cookie or use local storage to
          count usage anonymously. We do not use advertising cookies.
        </p>
      </Section>

      <Section title="Data retention">
        <ul className="list-disc space-y-2 pl-6">
          <li>Cached translations are kept to speed up future plays and may be cleared periodically.</li>
          <li>Rate-limiting counters reset daily; the salted-IP hash is not linked to any identity.</li>
          <li>
            Anything stored in your browser (preferences, Spotify tokens, caches) stays until you
            clear your browser data or remove the extension.
          </li>
        </ul>
      </Section>

      <Section title="Children">
        <p>
          Melofy is not directed to children under 13 (or the minimum age in your country), and we do
          not knowingly collect their data.
        </p>
      </Section>

      <Section title="Your rights">
        <p>
          Because Melofy holds no account and stores no personal identifiers, most of &quot;your
          data&quot; lives on your own device and is fully within your control — clear your browser
          storage or uninstall the extension to remove it. If you have questions about the anonymized
          cache or believe we hold data about you, contact us and we&apos;ll help. Depending on where
          you live (e.g. the EEA or California), you may have rights to access or delete personal data.
        </p>
      </Section>

      <Section title="Changes to this policy">
        <p>
          We may update this policy as the product evolves. Material changes will be reflected by the
          &quot;Last updated&quot; date above.
        </p>
      </Section>

      <Section title="Contact">
        <p>
          Questions about privacy? Email{' '}
          <a
            className="text-blue-600 underline-offset-4 hover:underline dark:text-blue-400"
            href={`mailto:${CONTACT_EMAIL}`}
          >
            {CONTACT_EMAIL}
          </a>
          .
        </p>
      </Section>
    </main>
  );
}
