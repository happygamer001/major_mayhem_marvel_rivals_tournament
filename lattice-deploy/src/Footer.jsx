import { useState, useEffect } from "react";

/**
 * <TickerFooter mode="footer" /> — scrolling news-ticker style footer.
 *
 * Two display modes:
 *   - "footer" (default): renders in normal flow, scrolled into view at the
 *     bottom of the page like a regular footer.
 *   - "fixed": position:fixed at the bottom of the viewport, always visible.
 *     Used on the "broadcast" pages (/bracket, /leaderboard) for a more
 *     news-channel / arena-jumbotron feel.
 *
 * Content sources (all fetched independently, gracefully degrade if any fail):
 *   - Active sponsors (sponsor name + optional promo)
 *   - Currently-live matches (status=ready AND streaming_url is set)
 *   - Recent results (last 5 completed matches, newest first)
 *
 * Empty state: shows a single placeholder item.
 *
 * Accessibility: animation respects prefers-reduced-motion; pauses on hover.
 *
 * IMPORTANT: this component intentionally exports as both `default` and
 * `SiteFooter` for backwards-compat with code still importing the old name.
 */

const TICKER_STYLES = `
  @keyframes ticker-scroll {
    from { transform: translateX(0); }
    to   { transform: translateX(-50%); }
  }
  .ticker-track {
    display: inline-flex;
    align-items: center;
    animation: ticker-scroll 60s linear infinite;
    white-space: nowrap;
    will-change: transform;
  }
  .ticker-track:hover { animation-play-state: paused; }
  @media (prefers-reduced-motion: reduce) {
    .ticker-track { animation: none; }
  }
  .ticker-label {
    background: repeating-linear-gradient(-45deg, #facc15 0, #facc15 6px, #fbbf24 6px, #fbbf24 12px);
  }
  .ticker-dot {
    width: 6px;
    height: 6px;
    background: #facc15;
    display: inline-block;
    border-radius: 50%;
    margin: 0 16px;
    opacity: 0.5;
  }
  @keyframes live-pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.3; }
  }
  .ticker-live-dot {
    display: inline-block;
    width: 8px;
    height: 8px;
    background: #ef4444;
    border-radius: 50%;
    margin-right: 6px;
    animation: live-pulse 1.4s ease-in-out infinite;
  }
`;

export default function TickerFooter({ mode = "footer" }) {
  const [sponsors, setSponsors] = useState([]);
  const [bracket, setBracket] = useState([]);
  const [loaded, setLoaded] = useState(false);

  // Fetch sponsors
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
        // Silent — ticker degrades gracefully
      }
    };
    load();
    // Refresh sponsors every 5 min — they change rarely
    const interval = setInterval(load, 300000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  // Fetch bracket (for live matches + recent results)
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch("/api/bracket");
        const result = await res.json();
        if (cancelled) return;
        if (result.ok && Array.isArray(result.bracket)) {
          setBracket(result.bracket);
        }
        setLoaded(true);
      } catch (err) {
        setLoaded(true);
      }
    };
    load();
    // Refresh bracket every 60s for live updates
    const interval = setInterval(load, 60000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  // Build the ticker items list — inline, no useMemo (defensive pattern)
  const items = [];

  // Live matches (matches that are ready AND have a streaming_url)
  const liveMatches = bracket.filter(
    (m) =>
      m &&
      m.status === "ready" &&
      m.streaming_url &&
      String(m.streaming_url).trim().length > 0
  );
  liveMatches.forEach((m) => {
    items.push({
      kind: "live",
      key: "live-" + String(m.match_id),
      text:
        String(m.team_a_label || "—") +
        " vs " +
        String(m.team_b_label || "—") +
        " (" +
        String(m.match_id) +
        ")",
      url: String(m.streaming_url),
    });
  });

  // Recent results — sort completed matches by updated_at descending, take 5
  const completedMatches = bracket
    .filter((m) => m && m.status === "completed" && m.winner_id)
    .slice()
    .sort((a, b) => {
      // updated_at is a string from the sheet; newer dates sort later in default string compare
      const at = String(a.updated_at || "");
      const bt = String(b.updated_at || "");
      if (at < bt) return 1;
      if (at > bt) return -1;
      return 0;
    });
  const recentResults = completedMatches.slice(0, 5);
  recentResults.forEach((m) => {
    const winnerLabel =
      m.winner_id === m.team_a_id ? m.team_a_label : m.team_b_label;
    const loserLabel =
      m.winner_id === m.team_a_id ? m.team_b_label : m.team_a_label;
    let scoreText = "";
    if (
      m.team_a_score !== "" &&
      m.team_b_score !== "" &&
      m.team_a_score !== null &&
      m.team_b_score !== null
    ) {
      const wScore =
        m.winner_id === m.team_a_id ? m.team_a_score : m.team_b_score;
      const lScore =
        m.winner_id === m.team_a_id ? m.team_b_score : m.team_a_score;
      scoreText = " " + String(wScore) + "–" + String(lScore);
    }
    items.push({
      kind: "result",
      key: "result-" + String(m.match_id),
      text:
        String(winnerLabel || "—") +
        " def. " +
        String(loserLabel || "—") +
        scoreText +
        " (" +
        String(m.match_id) +
        ")",
    });
  });

  // Sponsors
  sponsors.forEach((s, i) => {
    if (!s || !s.name) return;
    const promo = s.promoCode
      ? " — code " + String(s.promoCode)
      : "";
    items.push({
      kind: "sponsor",
      key: "sponsor-" + String(s.name) + "-" + i,
      text: String(s.name) + promo,
      url: s.websiteUrl ? String(s.websiteUrl) : null,
    });
  });

  // Empty state
  const showPlaceholder = loaded && items.length === 0;

  // Determine container class based on mode
  const containerClass =
    mode === "fixed"
      ? "fixed bottom-0 left-0 right-0 z-30 bg-[#0a0e1a]/95 backdrop-blur-sm border-t-2 border-yellow-400/60 shadow-[0_-4px_12px_rgba(0,0,0,0.5)]"
      : "relative z-10 bg-[#0a0e1a] border-t-2 border-yellow-400/60 mt-12";

  return (
    <footer className={containerClass}>
      <style>{TICKER_STYLES}</style>
      <div className="flex items-stretch">
        {/* Left-side label */}
        <div className="ticker-label flex items-center px-3 py-2 flex-shrink-0 border-r-2 border-black">
          <span
            className="font-display text-xs sm:text-sm text-black tracking-widest"
            style={{ textShadow: "1px 1px 0 #facc15" }}
          >
            ⚡ LATTICE OPEN
          </span>
        </div>

        {/* Scrolling ticker content */}
        <div className="flex-1 overflow-hidden relative">
          <div className="ticker-track py-2">
            {showPlaceholder ? (
              <TickerPlaceholder />
            ) : (
              <>
                {/* Render content twice for seamless loop */}
                <TickerItems items={items} />
                <TickerItems items={items} ariaHidden />
              </>
            )}
          </div>
          {/* Fade-out gradient on the right edge */}
          <div
            className="absolute top-0 right-0 bottom-0 w-12 pointer-events-none"
            style={{
              background:
                "linear-gradient(to right, transparent, #0a0e1a 80%)",
            }}
          />
        </div>

        {/* Right-side "VIEW ALL SPONSORS" link */}
        <a
          href="/sponsors"
          className="hidden sm:flex items-center px-3 py-2 flex-shrink-0 border-l border-yellow-400/30 font-mono text-[10px] text-yellow-400 hover:text-yellow-300 hover:bg-yellow-400/10 transition-colors tracking-wider"
        >
          SPONSORS →
        </a>
      </div>
    </footer>
  );
}

/* ──────────────── TICKER ITEMS ──────────────── */

function TickerItems({ items, ariaHidden }) {
  return (
    <span aria-hidden={ariaHidden ? "true" : undefined}>
      {items.map((item, idx) => (
        <span key={item.key + (ariaHidden ? "-dup" : "")} className="inline-flex items-center">
          <TickerItem item={item} />
          {idx < items.length - 1 && <span className="ticker-dot" />}
          {idx === items.length - 1 && <span className="ticker-dot" />}
        </span>
      ))}
    </span>
  );
}

function TickerItem({ item }) {
  if (item.kind === "live") {
    const content = (
      <span className="inline-flex items-center font-display text-sm text-[#f5f1e8]">
        <span className="ticker-live-dot" />
        <span className="text-red-300 font-bold mr-2 tracking-wider">LIVE:</span>
        {item.text}
      </span>
    );
    return item.url ? (
      <a
        href={item.url}
        target="_blank"
        rel="noopener noreferrer"
        className="hover:text-yellow-400"
      >
        {content}
      </a>
    ) : (
      content
    );
  }

  if (item.kind === "result") {
    return (
      <span className="inline-flex items-center font-body text-sm text-[#f5f1e8]">
        <span className="font-mono text-[10px] text-green-400 mr-2 tracking-wider">
          FINAL
        </span>
        <span className="text-[#c8c2b3]">{item.text}</span>
      </span>
    );
  }

  if (item.kind === "sponsor") {
    const content = (
      <span className="inline-flex items-center font-body text-sm">
        <span className="font-mono text-[10px] text-yellow-400 mr-2 tracking-wider">
          PARTNER
        </span>
        <span className="text-[#f5f1e8]">{item.text}</span>
      </span>
    );
    return item.url ? (
      <a
        href={item.url}
        target="_blank"
        rel="noopener noreferrer"
        className="hover:text-yellow-400 transition-colors"
      >
        {content}
      </a>
    ) : (
      content
    );
  }

  return null;
}

function TickerPlaceholder() {
  return (
    <span className="font-mono text-sm text-[#c8c2b3] tracking-wider px-4">
      🟡 LATTICE OPEN · MARVEL RIVALS TOURNAMENT · TOURNAMENT IN SETUP
    </span>
  );
}

/* Backwards-compat — some pages still import SiteFooter (default) */
export { TickerFooter as SiteFooter };
