import { useState, useEffect } from "react";

/**
 * /bracket — minimal, defensive version. No fancy CSS Grid layout.
 * Just shows the data as a plain list to confirm the data fetch works.
 * If this renders, we know the issue was in the more complex layout code.
 */

const FONT_STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Bungee&family=Manrope:wght@400;500;600;700;800&family=Space+Mono:wght@400;700&display=swap');
  .font-display { font-family: 'Bungee', system-ui, sans-serif; letter-spacing: 0.02em; }
  .font-mono    { font-family: 'Space Mono', ui-monospace, monospace; }
  .font-body    { font-family: 'Manrope', system-ui, sans-serif; }
`;

export default function BracketPage() {
  const [bracket, setBracket] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch("/api/bracket");
        const result = await res.json();
        if (cancelled) return;
        if (!result.ok) {
          setError(String(result.error || "Could not load bracket."));
          setLoading(false);
          return;
        }
        setBracket(Array.isArray(result.bracket) ? result.bracket : []);
        setError(null);
        setLoading(false);
      } catch (err) {
        if (cancelled) return;
        setError("Network error loading bracket.");
        setLoading(false);
      }
    };
    load();
    const interval = setInterval(load, 30000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  return (
    <div className="font-body min-h-screen w-full bg-[#0a0e1a] text-[#f5f1e8] p-6">
      <style>{FONT_STYLES}</style>

      <button
        onClick={() => { window.location.href = "/"; }}
        className="font-mono text-xs text-[#c8c2b3] hover:text-yellow-400 mb-4"
      >
        ← BACK TO HOME
      </button>

      <h1
        className="font-display text-4xl mb-6 text-yellow-400"
        style={{ textShadow: "3px 3px 0 #ef4444" }}
      >
        THE BRACKET
      </h1>

      {loading && <div className="font-mono text-sm">Loading…</div>}
      {error && (
        <div className="border-l-4 border-red-500 bg-red-500/10 p-3 max-w-xl">
          <p className="font-body text-sm text-red-300">{error}</p>
        </div>
      )}

      {!loading && !error && bracket && bracket.length === 0 && (
        <div className="font-body text-[#c8c2b3]">
          Tournament hasn't started yet. Check back later.
        </div>
      )}

      {!loading && !error && bracket && bracket.length > 0 && (
        <div className="space-y-2 max-w-2xl">
          {bracket.map((m) => {
            const id = String(m.match_id || "");
            const round = String(m.round || "");
            const status = String(m.status || "");
            const teamA = String(m.team_a_label || "—");
            const teamB = String(m.team_b_label || "—");
            const scoreA = m.team_a_score === "" || m.team_a_score == null ? "" : String(m.team_a_score);
            const scoreB = m.team_b_score === "" || m.team_b_score == null ? "" : String(m.team_b_score);
            const streamUrl = m.streaming_url ? String(m.streaming_url) : "";
            const winnerId = String(m.winner_id || "");
            const isWinnerA = winnerId !== "" && winnerId === String(m.team_a_id || "");
            const isWinnerB = winnerId !== "" && winnerId === String(m.team_b_id || "");

            const borderColor = streamUrl
              ? "border-red-400"
              : status === "ready"
              ? "border-yellow-400/40"
              : status === "completed"
              ? "border-green-400/30"
              : "border-[#f5f1e8]/15";

            return (
              <div
                key={id}
                className={`bg-[#131a2a] border-2 ${borderColor} p-3`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="font-mono text-xs text-yellow-400">
                    {id} · {round}
                  </div>
                  <div className="flex items-center gap-2">
                    {streamUrl && (
                      <a
                        href={streamUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-mono text-[10px] px-2 py-0.5 bg-red-500/30 border border-red-400 text-red-200"
                      >
                        🔴 LIVE
                      </a>
                    )}
                    <span className="font-mono text-[10px] text-[#c8c2b3]">
                      {status}
                    </span>
                  </div>
                </div>
                <div className={`px-2 py-1 ${isWinnerA ? "bg-yellow-400/15 border-l-2 border-yellow-400 text-yellow-300" : "bg-[#0a0e1a]"} flex justify-between text-sm`}>
                  <span>{teamA}</span>
                  {scoreA !== "" && <span className="font-mono">{scoreA}</span>}
                </div>
                <div className={`px-2 py-1 mt-1 ${isWinnerB ? "bg-yellow-400/15 border-l-2 border-yellow-400 text-yellow-300" : "bg-[#0a0e1a]"} flex justify-between text-sm`}>
                  <span>{teamB}</span>
                  {scoreB !== "" && <span className="font-mono">{scoreB}</span>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
