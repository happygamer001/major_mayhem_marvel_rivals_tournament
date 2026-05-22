import { useState, useEffect } from "react";
import SiteFooter from "./Footer.jsx";

/**
 * /leaderboard — public team standings table.
 *
 * Aggregates the bracket data (same /api/bracket source as the bracket page)
 * into per-team stats: wins, losses, status, last match, next match.
 *
 * Built in the same defensive style as BracketPage v2:
 *   - String(...) coercion before rendering
 *   - No useMemo
 *   - Inline aggregation
 *   - Polls every 30s
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
`;

const STATUS_RANK = {
  champion: 0,
  runner_up: 1,
  active_wb: 2,
  active_lb: 3,
  pending: 4,
  eliminated: 5,
};

const STATUS_LABELS = {
  champion: "Champion",
  runner_up: "Runner-up",
  active_wb: "Active · WB",
  active_lb: "Active · LB",
  pending: "Pending",
  eliminated: "Eliminated",
};

const STATUS_COLORS = {
  champion: "bg-yellow-400/20 text-yellow-300 border-yellow-400/50",
  runner_up: "bg-orange-400/15 text-orange-300 border-orange-400/40",
  active_wb: "bg-green-400/15 text-green-300 border-green-400/40",
  active_lb: "bg-red-400/10 text-red-300 border-red-400/30",
  pending: "bg-[#f5f1e8]/5 text-[#c8c2b3] border-[#f5f1e8]/15",
  eliminated: "bg-[#f5f1e8]/3 text-[#6b7280] border-[#f5f1e8]/8",
};

/**
 * Aggregate bracket data into per-team standings.
 * Pure function — no React, no side effects, easy to test.
 */
function buildStandings(bracket) {
  if (!Array.isArray(bracket) || bracket.length === 0) return [];

  const teams = {}; // teamId → { teamId, teamName, wins, losses, lastMatch, nextMatch, isInLB }

  // Pass 1: discover all teams (skipping BYE)
  for (const m of bracket) {
    const aId = String(m.team_a_id || "");
    const bId = String(m.team_b_id || "");
    const aLabel = String(m.team_a_label || "");
    const bLabel = String(m.team_b_label || "");

    if (aId && aId !== "__BYE__" && !teams[aId]) {
      teams[aId] = {
        teamId: aId,
        teamName: aLabel,
        wins: 0,
        losses: 0,
        lastMatch: null,
        nextMatch: null,
        isInLB: false,
        droppedToLB: false,
      };
    }
    if (bId && bId !== "__BYE__" && !teams[bId]) {
      teams[bId] = {
        teamId: bId,
        teamName: bLabel,
        wins: 0,
        losses: 0,
        lastMatch: null,
        nextMatch: null,
        isInLB: false,
        droppedToLB: false,
      };
    }
  }

  // Pass 2: count W/L from completed matches (NOT completed-bye)
  for (const m of bracket) {
    if (String(m.status) !== "completed") continue;
    const winnerId = String(m.winner_id || "");
    const loserId = String(m.loser_id || "");
    if (winnerId && winnerId !== "__BYE__" && teams[winnerId]) {
      teams[winnerId].wins += 1;
    }
    if (loserId && loserId !== "__BYE__" && teams[loserId]) {
      teams[loserId].losses += 1;
      // Track LB drop: if they lost in a WB match, they drop to LB
      const round = String(m.round || "");
      if (round.startsWith("WB-")) {
        teams[loserId].droppedToLB = true;
      }
    }
  }

  // Pass 3: determine if currently in LB (has 1 loss but not eliminated)
  // and find lastMatch (most recent completed match) and nextMatch (next ready/pending)
  for (const m of bracket) {
    const aId = String(m.team_a_id || "");
    const bId = String(m.team_b_id || "");
    const status = String(m.status);
    const matchId = String(m.match_id || "");
    const round = String(m.round || "");
    const updatedAt = m.updated_at || "";

    [aId, bId].forEach((tid) => {
      if (!tid || tid === "__BYE__" || !teams[tid]) return;

      // Track LB participation
      if (round.startsWith("LB-") && (status === "ready" || status === "completed" || status === "pending")) {
        teams[tid].isInLB = true;
      }

      // Last completed match (manually completed, not BYE)
      if (status === "completed") {
        const opp = aId === tid ? bId : aId;
        const oppLabel = aId === tid ? String(m.team_b_label || "") : String(m.team_a_label || "");
        const myScore = aId === tid ? m.team_a_score : m.team_b_score;
        const oppScore = aId === tid ? m.team_b_score : m.team_a_score;
        const winnerId = String(m.winner_id || "");
        const won = winnerId === tid;
        const candidate = {
          matchId,
          round,
          opponent: oppLabel || "—",
          opponentIsBye: opp === "__BYE__",
          myScore: myScore === "" || myScore == null ? "" : String(myScore),
          oppScore: oppScore === "" || oppScore == null ? "" : String(oppScore),
          won,
          updatedAt,
        };
        // Keep the most recent
        if (
          !teams[tid].lastMatch ||
          String(updatedAt) > String(teams[tid].lastMatch.updatedAt)
        ) {
          teams[tid].lastMatch = candidate;
        }
      }

      // Next match: ready (preferred) or pending with both slots filled
      if (status === "ready" || (status === "pending" && aId && bId)) {
        const opp = aId === tid ? bId : aId;
        const oppLabel = aId === tid ? String(m.team_b_label || "") : String(m.team_a_label || "");
        if (!teams[tid].nextMatch) {
          teams[tid].nextMatch = {
            matchId,
            round,
            opponent: oppLabel || "TBD",
            opponentIsBye: opp === "__BYE__",
            isReady: status === "ready",
          };
        }
      }
    });
  }

  // Pass 4: compute final status
  // Champion / Runner-up: derive from GF-1 and GF-2
  let championId = null;
  let runnerUpId = null;
  for (const m of bracket) {
    if (String(m.status) !== "completed") continue;
    if (m.feeds_winner_to === "CHAMPION" && m.winner_id) {
      championId = String(m.winner_id);
      // Runner-up is whoever lost this match — but only if no GF-2 was triggered
      // We figure that out below by checking if GF-2 also has a winner
      runnerUpId = String(m.loser_id || "");
    }
  }
  // If GF-2 has a champion, that overrides GF-1's
  for (const m of bracket) {
    if (
      String(m.match_id) === "GF-2" &&
      String(m.status) === "completed" &&
      m.winner_id
    ) {
      championId = String(m.winner_id);
      runnerUpId = String(m.loser_id || "");
    }
  }

  const result = [];
  for (const tid in teams) {
    const t = teams[tid];
    let status;
    if (tid === championId) {
      status = "champion";
    } else if (tid === runnerUpId) {
      status = "runner_up";
    } else if (t.losses >= 2) {
      status = "eliminated";
    } else if (t.losses === 1 && t.droppedToLB) {
      status = "active_lb";
    } else if (t.wins === 0 && t.losses === 0) {
      status = "pending";
    } else {
      status = "active_wb";
    }
    result.push({
      teamId: t.teamId,
      teamName: t.teamName,
      wins: t.wins,
      losses: t.losses,
      status,
      lastMatch: t.lastMatch,
      nextMatch: status === "champion" || status === "runner_up" || status === "eliminated" ? null : t.nextMatch,
    });
  }

  return result;
}

export default function LeaderboardPage() {
  const [bracket, setBracket] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [sortBy, setSortBy] = useState("default"); // default | wins | losses | name
  const [sortDir, setSortDir] = useState("desc");

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch("/api/bracket");
        const result = await res.json();
        if (cancelled) return;
        if (!result.ok) {
          setError(String(result.error || "Could not load standings."));
          setLoading(false);
          return;
        }
        setBracket(Array.isArray(result.bracket) ? result.bracket : []);
        setError(null);
        setLoading(false);
      } catch (err) {
        if (cancelled) return;
        setError("Network error loading standings.");
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

  // Build standings on every render — small dataset, simpler than memoizing
  const standings = bracket ? buildStandings(bracket) : [];

  // Apply sort
  const sorted = standings.slice().sort((a, b) => {
    let cmp = 0;
    if (sortBy === "wins") cmp = a.wins - b.wins;
    else if (sortBy === "losses") cmp = a.losses - b.losses;
    else if (sortBy === "name")
      cmp = String(a.teamName).localeCompare(String(b.teamName));
    else {
      // default: status rank, then wins desc, then name asc
      const aRank = STATUS_RANK[a.status] ?? 99;
      const bRank = STATUS_RANK[b.status] ?? 99;
      if (aRank !== bRank) return aRank - bRank;
      if (a.wins !== b.wins) return b.wins - a.wins;
      return String(a.teamName).localeCompare(String(b.teamName));
    }
    if (sortDir === "desc") cmp = -cmp;
    return cmp;
  });

  const toggleSort = (col) => {
    if (sortBy === col) {
      setSortDir(sortDir === "desc" ? "asc" : "desc");
    } else {
      setSortBy(col);
      setSortDir(col === "name" ? "asc" : "desc");
    }
  };

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
        <main className="max-w-5xl mx-auto px-4 sm:px-8 pt-12 pb-24">
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
              / / TOURNAMENT STANDINGS
            </div>
            <h1
              className="font-display text-4xl sm:text-5xl text-[#f5f1e8]"
              style={{ textShadow: "3px 3px 0 #facc15, 6px 6px 0 #ef4444" }}
            >
              THE
              <br />
              <span className="text-yellow-400">LEADERBOARD</span>
            </h1>
          </header>

          {loading && (
            <div className="font-mono text-sm text-[#c8c2b3] animate-pulse">
              Loading standings…
            </div>
          )}

          {!loading && error && (
            <div className="border-l-4 border-red-500 bg-red-500/10 p-4 max-w-xl">
              <div className="font-display text-lg mb-1">
                Standings unavailable
              </div>
              <p className="font-body text-sm text-red-300">{String(error)}</p>
            </div>
          )}

          {!loading && !error && standings.length === 0 && (
            <div className="border-2 border-yellow-400/30 bg-[#131a2a] p-8 max-w-xl">
              <div className="font-display text-2xl mb-2">
                No teams registered yet
              </div>
              <p className="font-body text-[#c8c2b3]">
                The leaderboard fills in once mods seed the bracket.
              </p>
            </div>
          )}

          {!loading && !error && standings.length > 0 && (
            <>
              {/* Desktop / wide table */}
              <div className="hidden md:block">
                <DesktopTable
                  rows={sorted}
                  sortBy={sortBy}
                  sortDir={sortDir}
                  onSort={toggleSort}
                />
              </div>

              {/* Mobile / narrow card list */}
              <div className="md:hidden space-y-2">
                {sorted.map((row) => (
                  <MobileCard key={String(row.teamId)} row={row} />
                ))}
              </div>

              <div className="mt-6 font-mono text-[10px] text-[#6b7280]">
                Auto-refreshes every 30 seconds. Standings derive from completed
                matches only — BYE wins don't count.
              </div>
            </>
          )}
        </main>
      </div>
      <SiteFooter mode="fixed" />
    </div>
  );
}

/* ────────────────── DESKTOP TABLE ────────────────── */

function DesktopTable({ rows, sortBy, sortDir, onSort }) {
  return (
    <div className="border-2 border-[#f5f1e8]/15 overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="bg-[#131a2a] border-b-2 border-[#f5f1e8]/15">
            <th className="text-left px-4 py-3 font-mono text-[10px] text-[#c8c2b3] tracking-widest">
              <button
                onClick={() => onSort("name")}
                className="hover:text-yellow-400 transition-colors uppercase"
              >
                Team {sortBy === "name" ? (sortDir === "asc" ? "▲" : "▼") : ""}
              </button>
            </th>
            <th className="text-left px-4 py-3 font-mono text-[10px] text-[#c8c2b3] tracking-widest uppercase">
              Status
            </th>
            <th className="text-center px-4 py-3 font-mono text-[10px] text-[#c8c2b3] tracking-widest">
              <button
                onClick={() => onSort("wins")}
                className="hover:text-yellow-400 transition-colors uppercase"
              >
                W {sortBy === "wins" ? (sortDir === "asc" ? "▲" : "▼") : ""}
              </button>
            </th>
            <th className="text-center px-4 py-3 font-mono text-[10px] text-[#c8c2b3] tracking-widest">
              <button
                onClick={() => onSort("losses")}
                className="hover:text-yellow-400 transition-colors uppercase"
              >
                L {sortBy === "losses" ? (sortDir === "asc" ? "▲" : "▼") : ""}
              </button>
            </th>
            <th className="text-left px-4 py-3 font-mono text-[10px] text-[#c8c2b3] tracking-widest uppercase">
              Last Match
            </th>
            <th className="text-left px-4 py-3 font-mono text-[10px] text-[#c8c2b3] tracking-widest uppercase">
              Next
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, idx) => (
            <tr
              key={String(row.teamId)}
              className={`border-b border-[#f5f1e8]/8 ${
                idx % 2 === 0 ? "bg-[#0a0e1a]/40" : "bg-[#131a2a]/40"
              } ${row.status === "champion" ? "bg-yellow-400/10" : ""}`}
            >
              <td className="px-4 py-3">
                <div className="flex items-center gap-2">
                  {row.status === "champion" && (
                    <span title="Champion">🏆</span>
                  )}
                  <span
                    className={`font-body text-sm ${
                      row.status === "champion"
                        ? "text-yellow-300 font-semibold"
                        : row.status === "eliminated"
                        ? "text-[#6b7280] line-through"
                        : "text-[#f5f1e8]"
                    }`}
                  >
                    {String(row.teamName || "—")}
                  </span>
                </div>
              </td>
              <td className="px-4 py-3">
                <StatusBadge status={row.status} />
              </td>
              <td className="px-4 py-3 text-center font-mono text-sm text-[#f5f1e8]">
                {row.wins}
              </td>
              <td className="px-4 py-3 text-center font-mono text-sm text-[#c8c2b3]">
                {row.losses}
              </td>
              <td className="px-4 py-3 font-mono text-xs">
                <LastMatchCell match={row.lastMatch} />
              </td>
              <td className="px-4 py-3 font-mono text-xs">
                <NextMatchCell match={row.nextMatch} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function StatusBadge({ status }) {
  const cls = STATUS_COLORS[status] || STATUS_COLORS.pending;
  return (
    <span
      className={`font-mono text-[9px] px-2 py-0.5 border tracking-widest uppercase ${cls}`}
    >
      {String(STATUS_LABELS[status] || status)}
    </span>
  );
}

function LastMatchCell({ match }) {
  if (!match) {
    return <span className="text-[#6b7280]">—</span>;
  }
  const won = match.won;
  return (
    <div>
      <span className={won ? "text-green-300" : "text-red-300"}>
        {won ? "W" : "L"}
      </span>
      <span className="text-[#c8c2b3] mx-1">vs.</span>
      <span className="text-[#f5f1e8]">{String(match.opponent)}</span>
      {match.myScore !== "" && match.oppScore !== "" && (
        <span className="text-[#6b7280] ml-2">
          ({String(match.myScore)}–{String(match.oppScore)})
        </span>
      )}
    </div>
  );
}

function NextMatchCell({ match }) {
  if (!match) {
    return <span className="text-[#6b7280]">—</span>;
  }
  return (
    <div>
      {match.isReady ? (
        <span className="text-yellow-300">Ready</span>
      ) : (
        <span className="text-[#c8c2b3]">Upcoming</span>
      )}
      <span className="text-[#c8c2b3] mx-1">vs.</span>
      <span className="text-[#f5f1e8]">{String(match.opponent)}</span>
    </div>
  );
}

/* ────────────────── MOBILE CARD ────────────────── */

function MobileCard({ row }) {
  return (
    <div
      className={`border-2 p-3 ${
        row.status === "champion"
          ? "border-yellow-400/50 bg-yellow-400/10"
          : row.status === "eliminated"
          ? "border-[#f5f1e8]/8 bg-[#131a2a] opacity-60"
          : "border-[#f5f1e8]/15 bg-[#131a2a]"
      }`}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          {row.status === "champion" && <span>🏆</span>}
          <span
            className={`font-body text-sm ${
              row.status === "champion"
                ? "text-yellow-300 font-semibold"
                : row.status === "eliminated"
                ? "text-[#6b7280] line-through"
                : "text-[#f5f1e8]"
            }`}
          >
            {String(row.teamName || "—")}
          </span>
        </div>
        <StatusBadge status={row.status} />
      </div>
      <div className="flex items-center gap-4 font-mono text-xs">
        <span>
          <span className="text-[#c8c2b3]">W </span>
          <span className="text-[#f5f1e8]">{row.wins}</span>
        </span>
        <span>
          <span className="text-[#c8c2b3]">L </span>
          <span className="text-[#f5f1e8]">{row.losses}</span>
        </span>
      </div>
      {row.lastMatch && (
        <div className="font-mono text-[11px] text-[#c8c2b3] mt-2">
          Last: <LastMatchCell match={row.lastMatch} />
        </div>
      )}
      {row.nextMatch && (
        <div className="font-mono text-[11px] text-[#c8c2b3] mt-1">
          Next: <NextMatchCell match={row.nextMatch} />
        </div>
      )}
    </div>
  );
}
