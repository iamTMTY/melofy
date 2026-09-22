const BARS = [34, 29, 24, 19, 14, 19, 24, 29, 34];

export function BrandMark() {
  return (
    <div className="flex flex-col items-center gap-5">
      <div className="melofy-wave" role="img" aria-label="Melofy">
        {BARS.map((h, i) => (
          <span key={i} className="melofy-bar" style={{ height: h }} />
        ))}
      </div>

      <h1 className="brand-wordmark text-6xl sm:text-7xl text-melofy-600 dark:text-melofy-200">
        Melofy
      </h1>
    </div>
  );
}
