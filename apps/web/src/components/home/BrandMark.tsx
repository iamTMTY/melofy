export function BrandMark() {
  return (
    <div className="flex flex-col items-center gap-5">
      {/* Logo glyph */}
      <div className="relative flex h-16 w-16 items-center justify-center rounded-[20px] bg-gradient-to-br from-melofy-400 to-melofy-600 shadow-lg shadow-melofy-500/30">
        <div className="absolute inset-0 rounded-[20px] bg-gradient-to-t from-white/0 to-white/20" />
        <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="relative">
          <path d="M9 18V5l12-2v13" />
          <circle cx="6" cy="18" r="3" />
          <circle cx="18" cy="16" r="3" />
        </svg>
      </div>

      {/* Wordmark — solid fill so the script glyphs never clip against a
          background-clip box (they overshoot the line box by design) */}
      <h1 className="brand-wordmark text-6xl sm:text-7xl text-melofy-600 dark:text-melofy-200">
        Melofy
      </h1>
    </div>
  );
}
