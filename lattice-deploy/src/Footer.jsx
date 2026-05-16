import { useState, useEffect } from "react";

/**
 * <SiteFooter /> — shared footer for public pages.
 *
 * Shows small partner logos (active sponsors) plus a "View All Sponsors →"
 * link. Renders nothing if the sponsor fetch fails — a footer is not worth
 * showing an error over.
 *
 * NOT used on /admin (that's not a public-facing page).
 *
 * Self-contained: fetches /api/sponsors on its own so any page can drop
 * <SiteFooter /> in without wiring up data.
 */

export default function SiteFooter() {
  const [sponsors, setSponsors] = useState([]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch("/api/sponsors");
        const result = await res.json();
        if (cancelled) return;
        if (result.ok && Array.isArray(result.sponsors)) {
          setSponsors(result.sponsors);
        }
      } catch (err) {
        // Silent — footer is decorative, not critical
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  // Only sponsors with a logo are worth showing in the strip
  const withLogos = sponsors.filter((s) => s.logoUrl);

  return (
    <footer className="relative z-10 border-t border-[#f5f1e8]/10 bg-[#0a0e1a]/80 mt-12">
      <div className="max-w-6xl mx-auto px-4 sm:px-8 py-8">
        {withLogos.length > 0 && (
          <div className="mb-6">
            <div className="font-mono text-[10px] text-[#6b7280] tracking-widest mb-3 text-center">
              POWERED BY OUR PARTNERS
            </div>
            <div className="flex flex-wrap items-center justify-center gap-6">
              {withLogos.slice(0, 8).map((s, i) => {
                const inner = (
                  <img
                    src={String(s.logoUrl)}
                    alt={String(s.name || "Sponsor")}
                    className="h-8 max-w-[120px] object-contain opacity-60 hover:opacity-100 transition-opacity"
                    onError={(e) => {
                      e.currentTarget.style.display = "none";
                    }}
                  />
                );
                return s.websiteUrl ? (
                  <a
                    key={String(s.name) + i}
                    href={String(s.websiteUrl)}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {inner}
                  </a>
                ) : (
                  <span key={String(s.name) + i}>{inner}</span>
                );
              })}
            </div>
          </div>
        )}

        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="font-mono text-[10px] text-[#6b7280]">
            Lattice Open · Marvel Rivals Tournament
          </div>
          <div className="flex items-center gap-4">
            <a
              href="/sponsors"
              className="font-mono text-[10px] text-yellow-400 hover:text-yellow-300 tracking-wider"
            >
              VIEW ALL SPONSORS →
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
