// Waveform logo: bars step by a CONSTANT amount from the tall outer edges down to
// a centre valley and back up, so every edge sits on a perfectly straight slant.
// Lit from the top-left, with a single slightly-slanted drop shadow. Static.
const BARS = [34, 29, 24, 19, 14, 19, 24, 29, 34];

export function BrandMark() {
  return (
    <div className="flex flex-col items-center gap-5">
      <div className="melofy-wave" role="img" aria-label="Melofy">
        {BARS.map((h, i) => (
          <span key={i} className="melofy-bar" style={{ height: h }} />
        ))}
      </div>

      {/* Wordmark — solid fill so the script glyphs never clip against a
          background-clip box (they overshoot the line box by design) */}
      <h1 className="brand-wordmark text-6xl sm:text-7xl text-melofy-600 dark:text-melofy-200">
        Melofy
      </h1>
    </div>
  );
}
