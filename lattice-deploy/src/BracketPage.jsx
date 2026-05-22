import { useState, useEffect } from "react";
import SiteFooter from "./Footer.jsx";

/**
 * /bracket — public read-only bracket view (rebuilt v2).
 *
 * Built on top of the diagnostic-confirmed working minimal version with:
 *   - String(...) coercion for every rendered value (defensive)
 *   - No useMemo (was sometimes part of the bug surface)
 *   - Inline rendering, no nested component decomposition
 *   - Champion banner + live indicators + mobile list view
 *
 * Polls /api/bracket every 30 seconds.
 */

const FONT_STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Bungee&family=Manrope:wght@400;500;600;700;800&family=Space+Mono:wght@400;700&display=swap');
  .font-display { font-family: 'Bungee', system-ui, sans-serif; letter-spacing: 0.02em; }
  .font-mono    { font-family: 'Space Mono', ui-monospace, monospace; }
  .font-body    { font-family: 'Manrope', system-ui, sans-serif; }
  .halftone {
    background-image: radial-gradient(circle at 1px 1px, rgba(251,191,36,0.07) 1px, transparent 0);
    background-size: 22px 22px;
  }
  .hazard-stripes {
    background: repeating-linear-gradient(-45deg, #facc15 0, #facc15 14px, #0a0e1a 14px, #0a0e1a 28px);
  }
  @keyframes wobble {
    0%, 100% { transform: rotate(11deg); }
    25%      { transform: rotate(13deg); }
    50%      { transform: rotate(10deg); }
    75%      { transform: rotate(12deg); }
  }
  .tape-wobble { animation: wobble 4.4s ease-in-out infinite; }
  @keyframes liveDot {
    0%, 100% { opacity: 1; }
    50%      { opacity: 0.4; }
  }
  .live-dot { animation: liveDot 1.2s ease-in-out infinite; }
`;

// Round buckets in order, used to lay out columns
const WB_ROUNDS = ["WB-R1", "WB-QF", "WB-SF", "WB-F"];
const LB_ROUNDS = ["LB-R1", "LB-R2", "LB-R3", "LB-R4", "LB-SF", "LB-F"];
const GF_ROUNDS = ["GF-1", "GF-2"];

const ROUND_LABELS = {
  "WB-R1": "WB · R1",
  "WB-QF": "WB · QF",
  "WB-SF": "WB · SF",
  "WB-F": "WB · F",
  "LB-R1": "LB · R1",
  "LB-R2": "LB · R2",
  "LB-R3": "LB · R3",
  "LB-R4": "LB · R4",
  "LB-SF": "LB · SF",
  "LB-F": "LB · F",
  "GF-1": "Grand Finals",
  "GF-2": "GF · Reset",
};

export default function BracketPage() {
  const [bracket, setBracket] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [view, setView] = useState("bracket"); // "bracket" or "list"

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

  // Derive champion (if any). Done inline — no useMemo.
  let championLabel = null;
  if (bracket) {
    for (const m of bracket) {
      if (
        m.feeds_winner_to === "CHAMPION" &&
        m.winner_id &&
        m.status === "completed"
      ) {
        championLabel =
          m.team_a_id === m.winner_id
            ? String(m.team_a_label || "")
            : String(m.team_b_label || "");
        break;
      }
    }
  }

  // Group matches by round. Done inline.
  const byRound = {};
  if (bracket) {
    for (const m of bracket) {
      const r = String(m.round || "");
      if (!byRound[r]) byRound[r] = [];
      byRound[r].push(m);
    }
    for (const r in byRound) {
      byRound[r].sort((a, b) =>
        String(a.match_id).localeCompare(String(b.match_id))
      );
    }
  }

  return (
    <div className="font-body min-h-screen w-full bg-[#0a0e1a] text-[#f5f1e8] relative overflow-hidden">
      <style>{FONT_STYLES}</style>
      <div className="absolute inset-0 halftone pointer-events-none" />

      {/* Under-construction tape */}
      <div className="fixed top-0 right-0 z-50 pointer-events-none select-none">
        <div className="relative" style={{ width: 280, height: 180 }}>
          <div
            className="tape-wobble absolute"
            style={{ top: 38, right: -38, width: 320, transformOrigin: "center" }}
          >
            <div className="hazard-stripes py-2 px-4 shadow-2xl border-y-2 border-black flex items-center justify-center gap-2">
              <span
                className="font-display text-black text-sm tracking-wider"
                style={{ textShadow: "1px 1px 0 #facc15" }}
              >
                ⚠ UNDER CONSTRUCTION ⚠
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="relative z-10">
        <main className="max-w-[1600px] mx-auto px-4 sm:px-8 pt-12 pb-24">
          <button
            onClick={() => {
              window.location.href = "/";
            }}
            className="font-mono text-xs text-[#c8c2b3] hover:text-yellow-400 mb-6 tracking-wider"
          >
            ← BACK TO HOME
          </button>

          <header className="mb-8">
            <div className="font-mono text-xs text-yellow-400 mb-2 tracking-widest">
              / / LIVE TOURNAMENT
            </div>
            <h1
              className="font-display text-4xl sm:text-5xl text-[#f5f1e8]"
              style={{ textShadow: "3px 3px 0 #facc15, 6px 6px 0 #ef4444" }}
            >
              THE
              <br />
              <span className="text-yellow-400">BRACKET</span>
            </h1>
          </header>

          {loading && (
            <div className="font-mono text-sm text-[#c8c2b3] animate-pulse">
              Loading bracket…
            </div>
          )}

          {!loading && error && (
            <div className="border-l-4 border-red-500 bg-red-500/10 p-4 max-w-xl">
              <div className="font-display text-lg mb-1">Bracket unavailable</div>
              <p className="font-body text-sm text-red-300">{String(error)}</p>
            </div>
          )}

          {!loading && !error && bracket && bracket.length === 0 && (
            <div className="border-2 border-yellow-400/30 bg-[#131a2a] p-8 max-w-xl">
              <div className="font-display text-2xl mb-2">
                Tournament hasn't started yet
              </div>
              <p className="font-body text-[#c8c2b3]">
                The bracket will appear here once mods seed teams.
              </p>
            </div>
          )}

          {!loading && !error && bracket && bracket.length > 0 && (
            <>
              {championLabel && (
                <div className="border-2 border-yellow-400 bg-gradient-to-r from-yellow-400/30 via-yellow-400/10 to-transparent p-6 mb-8 relative overflow-hidden">
                  <div className="absolute inset-0 hazard-stripes opacity-5 pointer-events-none" />
                  <div className="relative">
                    <div className="font-mono text-[11px] text-yellow-300 tracking-widest mb-1">
                      🏆 CHAMPION
                    </div>
                    <div
                      className="font-display text-3xl sm:text-4xl text-yellow-400"
                      style={{ textShadow: "2px 2px 0 #ef4444, 4px 4px 0 #000" }}
                    >
                      {String(championLabel)}
                    </div>
                  </div>
                </div>
              )}

              {/* View toggle (mobile-relevant, but also useful as a "switch to list" on desktop) */}
              <div className="mb-4 flex items-center gap-2">
                <button
                  onClick={() => setView("bracket")}
                  className={`font-mono text-[10px] tracking-wider px-3 py-1.5 border ${
                    view === "bracket"
                      ? "bg-yellow-400 text-black border-yellow-400"
                      : "border-[#f5f1e8]/20 text-[#c8c2b3] hover:border-yellow-400 hover:text-yellow-400"
                  }`}
                >
                  BRACKET
                </button>
                <button
                  onClick={() => setView("list")}
                  className={`font-mono text-[10px] tracking-wider px-3 py-1.5 border ${
                    view === "list"
                      ? "bg-yellow-400 text-black border-yellow-400"
                      : "border-[#f5f1e8]/20 text-[#c8c2b3] hover:border-yellow-400 hover:text-yellow-400"
                  }`}
                >
                  MATCH LIST
                </button>
              </div>

              {view === "bracket" && (
                <BracketView byRound={byRound} />
              )}

              {view === "list" && (
                <MatchListView bracket={bracket} />
              )}
            </>
          )}
        </main>
      </div>
      <SiteFooter mode="fixed" />
    </div>
  );
}

/* ───────────────── BRACKET VIEW (inline component) ───────────────── */

function BracketView({ byRound }) {
  return (
    <div className="overflow-x-auto pb-4">
      {/* WB section header */}
      <div className="mb-2 font-mono text-[11px] text-yellow-300 tracking-widest">
        WINNERS BRACKET
      </div>
      <div className="flex gap-4 mb-10 min-w-fit">
        {WB_ROUNDS.map((r) => (
          <Column
            key={r}
            label={ROUND_LABELS[r] || r}
            matches={byRound[r] || []}
          />
        ))}

        {/* Grand Finals — center vertically with WB */}
        <div className="border-l-2 border-dashed border-yellow-400/30 ml-2 pl-4 flex flex-col gap-3 self-center">
          {GF_ROUNDS.map((r) => (
            <Column
              key={r}
              label={ROUND_LABELS[r] || r}
              matches={byRound[r] || []}
              standalone
            />
          ))}
        </div>
      </div>

      {/* LB section header */}
      <div className="mb-2 font-mono text-[11px] text-red-300 tracking-widest">
        LOSERS BRACKET
      </div>
      <div className="flex gap-4 min-w-fit">
        {LB_ROUNDS.map((r) => (
          <Column
            key={r}
            label={ROUND_LABELS[r] || r}
            matches={byRound[r] || []}
          />
        ))}
      </div>
    </div>
  );
}

function Column({ label, matches, standalone }) {
  if (!matches || matches.length === 0) return null;
  return (
    <div
      className="flex flex-col gap-3 flex-shrink-0"
      style={{ width: 220, minHeight: standalone ? "auto" : 480 }}
    >
      <div className="font-mono text-[10px] text-[#c8c2b3] tracking-widest pb-1 border-b border-[#f5f1e8]/10">
        {String(label)}
      </div>
      <div className="flex-1 flex flex-col justify-around gap-3">
        {matches.map((m) => (
          <Card key={String(m.match_id)} match={m} />
        ))}
      </div>
    </div>
  );
}

/* ───────────────── MATCH CARD ───────────────── */

function Card({ match }) {
  const id = String(match.match_id || "");
  const status = String(match.status || "");
  const teamA = String(match.team_a_label || "—");
  const teamB = String(match.team_b_label || "—");
  const scoreA = match.team_a_score === "" || match.team_a_score == null ? "" : String(match.team_a_score);
  const scoreB = match.team_b_score === "" || match.team_b_score == null ? "" : String(match.team_b_score);
  const streamUrl = match.streaming_url ? String(match.streaming_url) : "";
  const winnerId = String(match.winner_id || "");
  const teamAId = String(match.team_a_id || "");
  const teamBId = String(match.team_b_id || "");
  const isWinnerA = winnerId !== "" && winnerId === teamAId && winnerId !== "__BYE__";
  const isWinnerB = winnerId !== "" && winnerId === teamBId && winnerId !== "__BYE__";
  const teamAIsBye = teamAId === "__BYE__";
  const teamBIsBye = teamBId === "__BYE__";

  let borderClass = "border-[#f5f1e8]/15";
  if (streamUrl) borderClass = "border-red-400";
  else if (status === "ready") borderClass = "border-yellow-400/50";
  else if (status === "completed") borderClass = "border-green-400/30";
  else if (status === "pending" || status === "completed-bye") borderClass = "border-[#f5f1e8]/8 opacity-60";

  return (
    <div className={`bg-[#131a2a] border-2 ${borderClass} p-2.5 transition-all`}>
      <div className="flex items-center justify-between mb-1.5">
        <div className="font-mono text-[9px] text-yellow-400 tracking-wider">
          {id}
        </div>
        {streamUrl ? (
          <a
            href={streamUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 px-1.5 py-0.5 bg-red-500/30 border border-red-400 hover:bg-red-500/50"
          >
            <span className="w-1.5 h-1.5 bg-red-400 rounded-full live-dot" />
            <span className="font-mono text-[9px] text-red-200 tracking-wider">
              LIVE
            </span>
          </a>
        ) : status === "completed" ? (
          <span className="font-mono text-[9px] text-green-300 tracking-wider">✓</span>
        ) : null}
      </div>

      <Row label={teamA} score={scoreA} isBye={teamAIsBye} isWinner={isWinnerA} />
      <div className="text-[8px] text-[#6b7280] my-0.5 text-center font-mono">vs</div>
      <Row label={teamB} score={scoreB} isBye={teamBIsBye} isWinner={isWinnerB} />
    </div>
  );
}

function Row({ label, score, isBye, isWinner }) {
  return (
    <div
      className={`flex items-center justify-between px-1.5 py-1 ${
        isWinner
          ? "bg-yellow-400/15 border-l-2 border-yellow-400"
          : "bg-[#0a0e1a]/60"
      } ${isBye ? "opacity-50 italic" : ""}`}
    >
      <span
        className={`text-[11px] truncate ${
          isWinner ? "text-yellow-300 font-semibold" : "text-[#f5f1e8]"
        }`}
      >
        {String(label)}
      </span>
      {score !== "" && (
        <span
          className={`font-mono text-[11px] ml-2 ${
            isWinner ? "text-yellow-300" : "text-[#c8c2b3]"
          }`}
        >
          {String(score)}
        </span>
      )}
    </div>
  );
}

/* ───────────────── MATCH LIST VIEW (mobile-friendly) ───────────────── */

function MatchListView({ bracket }) {
  // Bucket matches by category for the list
  const live = [];
  const ready = [];
  const completed = [];
  const pending = [];
  for (const m of bracket) {
    if (m.streaming_url) {
      live.push(m);
    } else if (m.status === "ready") {
      ready.push(m);
    } else if (m.status === "completed") {
      completed.push(m);
    } else if (m.status === "pending") {
      pending.push(m);
    }
    // "completed-bye" intentionally hidden from the list
  }

  return (
    <div className="space-y-6 max-w-3xl">
      {live.length > 0 && (
        <div>
          <div className="font-mono text-[11px] text-red-300 tracking-widest mb-2">
            🔴 LIVE NOW ({live.length})
          </div>
          <div className="space-y-2">
            {live.map((m) => (
              <ListRow key={String(m.match_id)} match={m} />
            ))}
          </div>
        </div>
      )}
      {ready.length > 0 && (
        <div>
          <div className="font-mono text-[11px] text-yellow-300 tracking-widest mb-2">
            UP NEXT ({ready.length})
          </div>
          <div className="space-y-2">
            {ready.map((m) => (
              <ListRow key={String(m.match_id)} match={m} />
            ))}
          </div>
        </div>
      )}
      {completed.length > 0 && (
        <div>
          <div className="font-mono text-[11px] text-green-300 tracking-widest mb-2">
            COMPLETED ({completed.length})
          </div>
          <div className="space-y-2">
            {completed.slice().reverse().map((m) => (
              <ListRow key={String(m.match_id)} match={m} />
            ))}
          </div>
        </div>
      )}
      {pending.length > 0 && (
        <div>
          <div className="font-mono text-[11px] text-[#c8c2b3] tracking-widest mb-2">
            WAITING ({pending.length})
          </div>
          <div className="space-y-2 opacity-60">
            {pending.slice(0, 6).map((m) => (
              <ListRow key={String(m.match_id)} match={m} />
            ))}
            {pending.length > 6 && (
              <div className="font-mono text-[10px] text-[#6b7280] text-center pt-1">
                +{pending.length - 6} more pending matches
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function ListRow({ match }) {
  const id = String(match.match_id || "");
  const round = String(match.round || "");
  const teamA = String(match.team_a_label || "TBD");
  const teamB = String(match.team_b_label || "TBD");
  const scoreA = match.team_a_score === "" || match.team_a_score == null ? "" : String(match.team_a_score);
  const scoreB = match.team_b_score === "" || match.team_b_score == null ? "" : String(match.team_b_score);
  const streamUrl = match.streaming_url ? String(match.streaming_url) : "";
  const status = String(match.status || "");
  const winnerId = String(match.winner_id || "");
  const teamAId = String(match.team_a_id || "");
  const teamBId = String(match.team_b_id || "");
  const isWinnerA = winnerId !== "" && winnerId === teamAId && winnerId !== "__BYE__";
  const isWinnerB = winnerId !== "" && winnerId === teamBId && winnerId !== "__BYE__";
  const teamAIsBye = teamAId === "__BYE__";
  const teamBIsBye = teamBId === "__BYE__";
  const roundLabel = ROUND_LABELS[round] || round;

  let borderColor = "border-[#f5f1e8]/15";
  if (streamUrl) borderColor = "border-red-400";
  else if (status === "ready") borderColor = "border-yellow-400/40";
  else if (status === "completed") borderColor = "border-green-400/30";

  return (
    <div className={`border-2 ${borderColor} bg-[#131a2a] p-3`}>
      <div className="flex items-center justify-between mb-2">
        <div className="font-mono text-[10px] text-yellow-400 tracking-wider">
          {id} · {String(roundLabel)}
        </div>
        {streamUrl && (
          <a
            href={streamUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 px-2 py-0.5 bg-red-500/30 border border-red-400 hover:bg-red-500/50"
          >
            <span className="w-1.5 h-1.5 bg-red-400 rounded-full live-dot" />
            <span className="font-mono text-[10px] text-red-200 tracking-wider">
              WATCH
            </span>
          </a>
        )}
      </div>
      <div className="space-y-1">
        <Row label={teamA} score={scoreA} isBye={teamAIsBye} isWinner={isWinnerA} />
        <Row label={teamB} score={scoreB} isBye={teamBIsBye} isWinner={isWinnerB} />
      </div>
    </div>
  );
}
