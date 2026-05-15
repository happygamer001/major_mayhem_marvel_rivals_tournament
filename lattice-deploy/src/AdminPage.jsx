import { useState, useEffect, useCallback } from "react";
import {
  Construction,
  Hammer,
  Check,
  AlertTriangle,
  ChevronLeft,
  Lock,
  Trophy,
  GripVertical,
  Users,
  Shield,
  RotateCcw,
  Crown,
  Swords,
  X,
  RefreshCw,
  Radio,
  Star,
  Trash2,
  Plus,
  ExternalLink,
  UserCheck,
  UserX,
} from "lucide-react";

/**
 * /admin — mod-only tournament management page.
 * Chunk 1 capability: drag-and-drop seeding of 16 teams into the bracket.
 *
 * Three states:
 *   1. Not signed in            → Discord sign-in
 *   2. Signed in, not a mod     → Unauthorized message
 *   3. Signed in as mod         → Seeding interface
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
  @keyframes slideUp {
    from { opacity: 0; transform: translateY(12px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  .slide-up { animation: slideUp 0.35s ease-out both; }
`;

export default function AdminPage() {
  const [authToken, setAuthToken] = useState(null);
  const [discordIdentity, setDiscordIdentity] = useState(null);
  const [modStatus, setModStatus] = useState("checking"); // checking | mod | not_mod | error
  const [modInfo, setModInfo] = useState(null);

  // Same auth-token pickup as the registration flow
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("auth");
    if (token) {
      setAuthToken(token);
      try {
        const payload = JSON.parse(
          atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"))
        );
        setDiscordIdentity({
          id: payload.sub,
          username: payload.global_name || payload.username,
        });
      } catch (e) {
        console.error("Could not decode auth token:", e);
      }
      // Strip the auth param from URL but keep us on /admin
      window.history.replaceState({}, "", "/admin");
    }
  }, []);

  // Once we have an auth token, check if user is a mod
  useEffect(() => {
    if (!authToken) {
      setModStatus("checking");
      return;
    }
    (async () => {
      try {
        const res = await fetch("/api/admin/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ authToken }),
        });
        const result = await res.json();
        if (!result.ok) {
          setModStatus("error");
          return;
        }
        if (result.isMod) {
          setModInfo(result);
          setModStatus("mod");
        } else {
          setModStatus("not_mod");
        }
      } catch (err) {
        console.error("Mod check failed:", err);
        setModStatus("error");
      }
    })();
  }, [authToken]);

  const goHome = () => {
    window.location.href = "/";
  };
  const signIn = () => {
    // Use a state param so OAuth callback knows to return us to /admin
    window.location.href = "/api/discord/auth?return_to=admin";
  };

  return (
    <div className="font-body min-h-screen w-full bg-[#0a0e1a] text-[#f5f1e8] relative overflow-hidden">
      <style>{FONT_STYLES}</style>
      <div className="absolute inset-0 halftone pointer-events-none" />
      <UnderConstructionTape />

      <div className="relative z-10">
        <main className="max-w-5xl mx-auto px-6 sm:px-10 pt-16 pb-24">
          <button
            onClick={goHome}
            className="font-mono text-xs text-[#c8c2b3] hover:text-yellow-400 flex items-center gap-1.5 tracking-wider mb-6"
          >
            <ChevronLeft className="w-4 h-4" /> BACK TO HOME
          </button>

          <header className="mb-10">
            <div className="font-mono text-xs text-yellow-400 mb-2 tracking-widest">
              / / TOURNAMENT ADMIN
            </div>
            <h1
              className="font-display text-4xl sm:text-5xl text-[#f5f1e8]"
              style={{ textShadow: "3px 3px 0 #facc15, 6px 6px 0 #ef4444" }}
            >
              MISSION
              <br />
              <span className="text-yellow-400">CONTROL</span>
            </h1>
          </header>

          {!authToken && <SignInPrompt onSignIn={signIn} />}
          {authToken && modStatus === "checking" && <CheckingState />}
          {authToken && modStatus === "not_mod" && (
            <NotAuthorizedState identity={discordIdentity} onHome={goHome} />
          )}
          {authToken && modStatus === "error" && <ErrorState onRetry={() => window.location.reload()} />}
          {authToken && modStatus === "mod" && (
            <ModDashboard
              authToken={authToken}
              identity={discordIdentity}
              modInfo={modInfo}
            />
          )}
        </main>
      </div>
    </div>
  );
}

/* ────────────────────── STATE COMPONENTS ────────────────────── */

function SignInPrompt({ onSignIn }) {
  return (
    <section className="slide-up max-w-xl">
      <div className="border-2 border-[#5865F2]/40 bg-[#131a2a] p-8">
        <Lock className="w-10 h-10 text-yellow-400 mb-4" />
        <h2 className="font-display text-2xl mb-2">Mods only.</h2>
        <p className="font-body text-[#c8c2b3] mb-6 leading-relaxed">
          This area is restricted to Tournament Organizers. Sign in with
          Discord and we'll check whether you have access.
        </p>
        <button
          onClick={onSignIn}
          className="bg-[#5865F2] hover:bg-[#4752c4] text-white font-display py-3 px-6 transition-colors"
        >
          SIGN IN WITH DISCORD
        </button>
      </div>
    </section>
  );
}

function CheckingState() {
  return (
    <div className="font-mono text-sm text-[#c8c2b3] animate-pulse">
      Verifying mod status…
    </div>
  );
}

function ErrorState({ onRetry }) {
  return (
    <div className="border-l-4 border-red-500 bg-red-500/10 p-4 max-w-xl">
      <div className="font-display text-lg mb-1">Something went wrong</div>
      <p className="font-body text-sm text-red-300 mb-4">
        We couldn't verify your mod status. This is usually a temporary
        connectivity issue.
      </p>
      <button
        onClick={onRetry}
        className="font-mono text-xs px-3 py-2 border border-red-300 text-red-300 hover:bg-red-500/20"
      >
        RETRY
      </button>
    </div>
  );
}

function NotAuthorizedState({ identity, onHome }) {
  return (
    <section className="slide-up max-w-xl">
      <div className="border-2 border-yellow-400/30 bg-[#131a2a] p-8">
        <AlertTriangle className="w-10 h-10 text-yellow-400 mb-4" />
        <h2 className="font-display text-2xl mb-2">Not on the mod list.</h2>
        <p className="font-body text-[#c8c2b3] mb-2">
          You're signed in as{" "}
          <span className="font-mono text-yellow-300">
            @{identity?.username}
          </span>
          , but this Discord account isn't authorized to access the admin area.
        </p>
        <p className="font-body text-sm text-[#6b7280] mb-6">
          If you believe this is a mistake, contact a Tournament Organizer to
          have your Discord ID added to the mod list.
        </p>
        <button
          onClick={onHome}
          className="font-mono text-xs px-4 py-2 border border-[#c8c2b3] text-[#c8c2b3] hover:border-yellow-400 hover:text-yellow-400"
        >
          BACK TO HOME
        </button>
      </div>
    </section>
  );
}

/* ────────────────────── MOD DASHBOARD (CHUNK 1: SEEDING) ────────────────────── */

function ModDashboard({ authToken, identity, modInfo }) {
  const [bracket, setBracket] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [forceSeedView, setForceSeedView] = useState(false);
  const [activeTab, setActiveTab] = useState("bracket"); // "bracket" | "streamers"

  const fetchBracket = useCallback(async () => {
    try {
      const res = await fetch("/api/bracket");
      const result = await res.json();
      if (!result.ok) {
        setError(result.error || "Could not load bracket.");
        setLoading(false);
        return;
      }
      setBracket(result.bracket || []);
      setError(null);
      setLoading(false);
    } catch (err) {
      setError("Network error loading bracket.");
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBracket();
  }, [fetchBracket]);

  // Poll every 10 seconds while page is open (so multi-mod ops stay in sync).
  // Only poll when the bracket tab is active — streamer hub has its own polling.
  useEffect(() => {
    if (loading || error || activeTab !== "bracket") return;
    const interval = setInterval(fetchBracket, 10000);
    return () => clearInterval(interval);
  }, [loading, error, fetchBracket, activeTab]);

  const showSeedingView = forceSeedView || !bracket || bracket.length === 0;

  return (
    <section className="slide-up">
      <div className="border-2 border-green-400/30 bg-[#131a2a] p-4 mb-6 flex items-center gap-3">
        <Shield className="w-5 h-5 text-green-400" />
        <div>
          <div className="font-mono text-xs text-green-300">AUTHORIZED</div>
          <div className="font-body text-sm text-[#f5f1e8]">
            <span className="font-mono text-yellow-300">@{identity?.username}</span> ·{" "}
            <span className="text-[#c8c2b3]">{modInfo?.role || "mod"}</span>
          </div>
        </div>
      </div>

      {/* Tab navigation */}
      <div className="flex items-center gap-2 mb-6 border-b border-[#f5f1e8]/15">
        <TabButton
          active={activeTab === "bracket"}
          onClick={() => setActiveTab("bracket")}
        >
          BRACKET
        </TabButton>
        <TabButton
          active={activeTab === "streamers"}
          onClick={() => setActiveTab("streamers")}
        >
          STREAMER HUB
        </TabButton>
      </div>

      {activeTab === "bracket" && (
        <>
          {loading && (
            <div className="font-mono text-sm text-[#c8c2b3] animate-pulse">
              Loading bracket state…
            </div>
          )}

          {!loading && error && (
            <div className="border-l-4 border-red-500 bg-red-500/10 p-4 max-w-xl">
              <div className="font-display text-lg mb-1">Couldn't load bracket</div>
              <p className="font-body text-sm text-red-300 mb-4">{error}</p>
              <button
                onClick={fetchBracket}
                className="font-mono text-xs px-3 py-2 border border-red-300 text-red-300 hover:bg-red-500/20"
              >
                RETRY
              </button>
            </div>
          )}

          {!loading && !error && showSeedingView && (
            <SeedingInterface
              authToken={authToken}
              onSeeded={() => {
                setForceSeedView(false);
                fetchBracket();
              }}
            />
          )}

          {!loading && !error && !showSeedingView && (
            <MatchManagement
              authToken={authToken}
              identity={identity}
              bracket={bracket}
              onChanged={fetchBracket}
              onResetBracket={() => setForceSeedView(true)}
            />
          )}
        </>
      )}

      {activeTab === "streamers" && (
        <StreamerHubAdmin authToken={authToken} identity={identity} />
      )}
    </section>
  );
}

function TabButton({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`font-mono text-xs tracking-widest px-4 py-2 border-b-2 -mb-px transition-colors ${
        active
          ? "border-yellow-400 text-yellow-400"
          : "border-transparent text-[#c8c2b3] hover:text-[#f5f1e8]"
      }`}
    >
      {children}
    </button>
  );
}

/**
 * Drag-and-drop team ordering for bracket initialization.
 *
 * For Chunk 1 we keep this minimal: mods enter team data manually as 16 lines
 * of "TeamID:TeamName" pairs (one per line) and click "Initialize Bracket."
 * The drag-and-drop UI for ordering registered teams will land in a polish
 * pass — for now we ship the data-entry version so the data-model end-to-end
 * is testable.
 */
function SeedingInterface({ authToken, onSeeded }) {
  const [rawInput, setRawInput] = useState("");
  const [status, setStatus] = useState("idle"); // idle | submitting | success | error
  const [errorMsg, setErrorMsg] = useState("");

  const parsed = parseTeams(rawInput);

  const handleSubmit = async () => {
    setErrorMsg("");
    if (parsed.error) {
      setErrorMsg(parsed.error);
      return;
    }
    setStatus("submitting");
    try {
      const res = await fetch("/api/admin/init-bracket", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          authToken,
          seededTeams: parsed.teams,
        }),
      });
      const result = await res.json();
      if (!result.ok) {
        setStatus("error");
        setErrorMsg(result.error || "Initialization failed.");
        return;
      }
      setStatus("success");
      // Small delay so the success message is visible before swap
      setTimeout(() => {
        if (typeof onSeeded === "function") onSeeded();
      }, 800);
    } catch (err) {
      setStatus("error");
      setErrorMsg("Network error. Try again.");
    }
  };

  return (
    <div>
      <div className="mb-6 flex items-center gap-2 font-mono text-xs text-yellow-300">
        <Trophy className="w-4 h-4" />
        BRACKET SEEDING · DOUBLE ELIMINATION · 16 TEAMS
      </div>

      <h2 className="font-display text-3xl mb-2">Seed the bracket</h2>
      <p className="font-body text-[#c8c2b3] mb-8 max-w-2xl">
        Enter your teams in seed order, one per line in the format{" "}
        <code className="font-mono text-yellow-300 bg-[#0a0e1a] px-1.5 py-0.5">
          TeamID:Team Name
        </code>
        . Up to 16 teams. Any unused slots become BYEs — top seeds will
        auto-advance through them. Pairs of consecutive lines play each other
        in WB-R1.
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <label className="block">
            <span className="font-mono text-[11px] text-[#c8c2b3] tracking-widest uppercase mb-1.5 block">
              SEEDED TEAMS · 2 TO 16 LINES
            </span>
            <textarea
              value={rawInput}
              onChange={(e) => setRawInput(e.target.value)}
              spellCheck={false}
              rows={18}
              placeholder={
                "team-001:Apex Predators\n" +
                "team-002:Cosmic Voyagers\n" +
                "team-003:Quantum Heralds\n" +
                "...\n(16 total)"
              }
              className="w-full bg-[#0a0e1a] border-2 border-[#f5f1e8]/15 text-[#f5f1e8] px-3 py-2.5 font-mono text-sm focus:outline-none focus:border-yellow-400 transition-colors placeholder:text-[#6b7280]"
            />
          </label>
        </div>

        <div className="border-2 border-[#f5f1e8]/15 bg-[#131a2a] p-4 self-start">
          <div className="font-mono text-[10px] text-[#c8c2b3] tracking-widest mb-3">
            LIVE PREVIEW
          </div>
          <div className="font-mono text-xs space-y-1 mb-4">
            <div className="flex justify-between">
              <span className="text-[#c8c2b3]">Teams entered:</span>
              <span
                className={
                  parsed.teams.length >= 2 && parsed.teams.length <= 16
                    ? "text-green-300"
                    : "text-yellow-300"
                }
              >
                {parsed.teams.length}
              </span>
            </div>
            {parsed.teams.length > 0 && parsed.teams.length < 16 && (
              <div className="flex justify-between">
                <span className="text-[#c8c2b3]">BYEs added:</span>
                <span className="text-yellow-300">{16 - parsed.teams.length}</span>
              </div>
            )}
            {parsed.error && (
              <div className="text-red-300 mt-2 leading-snug">
                {parsed.error}
              </div>
            )}
          </div>
          {parsed.teams.length > 0 && (
            <div className="space-y-1.5 max-h-80 overflow-y-auto">
              {Array.from({ length: 8 }).map((_, i) => {
                const a = parsed.teams[i * 2];
                const b = parsed.teams[i * 2 + 1];
                const isByeMatch = !a && !b;
                return (
                  <div
                    key={i}
                    className={`border p-2 ${
                      isByeMatch
                        ? "border-[#f5f1e8]/5 bg-[#0a0e1a]/40 opacity-50"
                        : "border-[#f5f1e8]/10 bg-[#0a0e1a]"
                    }`}
                  >
                    <div className="font-mono text-[9px] text-yellow-400 mb-1">
                      WB-R1-M{i + 1}
                    </div>
                    <div className="text-xs truncate text-[#f5f1e8]">
                      {a?.teamName || (
                        <em className="text-yellow-400/60">(BYE)</em>
                      )}
                    </div>
                    <div className="text-xs text-[#6b7280] my-0.5">vs.</div>
                    <div className="text-xs truncate text-[#f5f1e8]">
                      {b?.teamName || (
                        <em className="text-yellow-400/60">(BYE)</em>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {errorMsg && (
        <div className="mt-6 border-l-4 border-red-500 bg-red-500/10 p-3 font-body text-sm text-red-300">
          {errorMsg}
        </div>
      )}

      {status === "success" && (
        <div className="mt-6 border-l-4 border-green-400 bg-green-400/10 p-3 font-body text-sm text-green-300 flex items-center gap-2">
          <Check className="w-4 h-4" strokeWidth={3} />
          Bracket initialized. The Bracket tab in your sheet now has all 31 matches.
        </div>
      )}

      <div className="mt-6 flex items-center gap-3">
        <button
          onClick={handleSubmit}
          disabled={status === "submitting" || parsed.teams.length < 2 || parsed.teams.length > 16}
          className={`font-display px-7 py-3 border-2 transition-all flex items-center gap-2 ${
            status !== "submitting" && parsed.teams.length >= 2 && parsed.teams.length <= 16
              ? "bg-yellow-400 text-black border-yellow-400 hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[4px_4px_0_0_#ef4444] cursor-pointer"
              : "bg-transparent text-[#6b7280] border-[#6b7280] cursor-not-allowed"
          }`}
        >
          {status === "submitting" ? "INITIALIZING…" : "INITIALIZE BRACKET"}
        </button>
        <span className="font-mono text-[10px] text-[#6b7280]">
          ⚠ Re-running this WIPES any in-progress bracket data
        </span>
      </div>

      <div className="mt-12 border-l-4 border-yellow-400/60 bg-yellow-400/5 p-4 font-mono text-[11px] text-[#c8c2b3] leading-relaxed">
        DEV NOTE (Chunk 1): seeding is text-input only for now. The
        drag-and-drop interface that pulls registered teams from the
        Registrations tab lands in a polish pass after Chunks 2-4. This minimal
        version tests the data model end-to-end — bracket structure, mod auth,
        progression metadata — before we invest in the fancy UI.
      </div>
    </div>
  );
}

/* ────────────────────── MATCH MANAGEMENT (CHUNK 2) ────────────────────── */

const ROUND_GROUPS = [
  { id: "WB-R1", label: "Winners Bracket — Round 1", section: "wb" },
  { id: "WB-QF", label: "Winners Bracket — Quarterfinals", section: "wb" },
  { id: "WB-SF", label: "Winners Bracket — Semifinals", section: "wb" },
  { id: "WB-F", label: "Winners Bracket — Final", section: "wb" },
  { id: "LB-R1", label: "Losers Bracket — Round 1", section: "lb" },
  { id: "LB-R2", label: "Losers Bracket — Round 2", section: "lb" },
  { id: "LB-R3", label: "Losers Bracket — Round 3", section: "lb" },
  { id: "LB-R4", label: "Losers Bracket — Round 4", section: "lb" },
  { id: "LB-SF", label: "Losers Bracket — Semifinal", section: "lb" },
  { id: "LB-F", label: "Losers Bracket — Final", section: "lb" },
  { id: "GF-1", label: "Grand Finals — Match 1", section: "gf" },
  { id: "GF-2", label: "Grand Finals — Match 2 (Reset)", section: "gf" },
];

function MatchManagement({
  authToken,
  identity,
  bracket,
  onChanged,
  onResetBracket,
}) {
  const [resultModal, setResultModal] = useState(null); // { match }
  const [revertModal, setRevertModal] = useState(null); // { match }
  const [streamModal, setStreamModal] = useState(null); // { match }
  const [confirmReset, setConfirmReset] = useState(false);

  // Detect champion (a match with feeds_winner_to=CHAMPION and a winner_id)
  const champion = bracket.find(
    (m) =>
      m.feeds_winner_to === "CHAMPION" &&
      m.winner_id &&
      m.status === "completed"
  );
  const championMatch = champion;
  // Find their team label from the match
  const championLabel =
    championMatch &&
    (championMatch.team_a_id === championMatch.winner_id
      ? championMatch.team_a_label
      : championMatch.team_b_label);

  const groupedRounds = ROUND_GROUPS.map((rg) => ({
    ...rg,
    matches: bracket.filter((m) => m.round === rg.id),
  })).filter((rg) => rg.matches.length > 0);

  return (
    <div>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div className="flex items-center gap-2 font-mono text-xs text-yellow-300">
          <Swords className="w-4 h-4" />
          MATCH MANAGEMENT · DOUBLE ELIMINATION
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onChanged}
            className="font-mono text-[10px] tracking-wider px-3 py-1.5 border border-[#f5f1e8]/20 text-[#c8c2b3] hover:border-yellow-400 hover:text-yellow-400 flex items-center gap-1.5"
            title="Refresh bracket data"
          >
            <RefreshCw className="w-3 h-3" /> REFRESH
          </button>
          <button
            onClick={() => setConfirmReset(true)}
            className="font-mono text-[10px] tracking-wider px-3 py-1.5 border border-red-400/40 text-red-300 hover:bg-red-500/10"
          >
            RE-SEED BRACKET
          </button>
        </div>
      </div>

      {champion && championLabel && (
        <div className="border-2 border-yellow-400 bg-gradient-to-r from-yellow-400/20 to-transparent p-6 mb-8">
          <div className="flex items-center gap-3">
            <Crown className="w-8 h-8 text-yellow-400" />
            <div>
              <div className="font-mono text-[11px] text-yellow-300 tracking-widest">
                CHAMPION
              </div>
              <div
                className="font-display text-3xl text-yellow-400"
                style={{ textShadow: "2px 2px 0 #ef4444" }}
              >
                {championLabel}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-8">
        {groupedRounds.map((rg) => (
          <div key={rg.id}>
            <h3 className="font-display text-lg mb-3 text-[#f5f1e8]">
              {rg.label}
              <span className="ml-2 font-mono text-xs text-[#6b7280]">
                {rg.matches.filter((m) => m.status === "completed").length}/
                {rg.matches.length} done
              </span>
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {rg.matches.map((m) => (
                <MatchCard
                  key={m.match_id}
                  match={m}
                  onClickResult={() => setResultModal({ match: m })}
                  onClickRevert={() => setRevertModal({ match: m })}
                  onClickStream={() => setStreamModal({ match: m })}
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      {resultModal && (
        <ResultModal
          authToken={authToken}
          match={resultModal.match}
          onClose={() => setResultModal(null)}
          onSuccess={() => {
            setResultModal(null);
            onChanged();
          }}
        />
      )}

      {revertModal && (
        <RevertModal
          authToken={authToken}
          match={revertModal.match}
          onClose={() => setRevertModal(null)}
          onSuccess={() => {
            setRevertModal(null);
            onChanged();
          }}
        />
      )}

      {streamModal && (
        <StreamModal
          authToken={authToken}
          match={streamModal.match}
          onClose={() => setStreamModal(null)}
          onSuccess={() => {
            setStreamModal(null);
            onChanged();
          }}
        />
      )}

      {confirmReset && (
        <ModalShell onClose={() => setConfirmReset(false)} title="Re-seed bracket?">
          <p className="font-body text-sm text-[#c8c2b3] mb-4 leading-relaxed">
            This will <strong className="text-red-300">wipe all match results</strong>{" "}
            and let you enter a new team list. The Bracket tab in your sheet
            will be cleared. Audit log entries in the Matches tab are preserved.
          </p>
          <p className="font-mono text-[11px] text-yellow-300 mb-6">
            Use this only if the tournament has been cancelled or you set up
            the wrong teams. There is no undo.
          </p>
          <div className="flex gap-2 justify-end">
            <button
              onClick={() => setConfirmReset(false)}
              className="font-mono text-xs px-4 py-2 border border-[#c8c2b3] text-[#c8c2b3] hover:border-yellow-400 hover:text-yellow-400"
            >
              CANCEL
            </button>
            <button
              onClick={() => {
                setConfirmReset(false);
                onResetBracket();
              }}
              className="font-mono text-xs px-4 py-2 bg-red-500/30 border border-red-400 text-red-200 hover:bg-red-500/50"
            >
              YES, WIPE & RE-SEED
            </button>
          </div>
        </ModalShell>
      )}
    </div>
  );
}

function MatchCard({ match, onClickResult, onClickRevert, onClickStream }) {
  const isCompleted = match.status === "completed";
  const isBye = match.status === "completed-bye";
  const isReady = match.status === "ready";
  const isPending = match.status === "pending";
  const hasStream = !!match.streaming_url;

  const teamAIsBye = match.team_a_id === "__BYE__";
  const teamBIsBye = match.team_b_id === "__BYE__";
  const winnerIsA = isCompleted && match.winner_id === match.team_a_id;
  const winnerIsB = isCompleted && match.winner_id === match.team_b_id;

  // Stream button is available on ready (live now) and completed (set retroactively)
  // matches that have real teams. Not for BYE matches or pending matches.
  const canSetStream = (isReady || isCompleted) && !teamAIsBye && !teamBIsBye;

  let statusBadge = null;
  let borderClass = "border-[#f5f1e8]/15";
  let interactionProps = {};

  if (isPending) {
    statusBadge = <StatusBox color="grey" label="WAITING" />;
    borderClass = "border-[#f5f1e8]/10 opacity-60";
  } else if (isReady) {
    statusBadge = <StatusBox color="yellow" label="READY" />;
    borderClass = hasStream
      ? "border-red-400 cursor-pointer"
      : "border-yellow-400/40 hover:border-yellow-400 cursor-pointer";
    interactionProps = { onClick: onClickResult };
  } else if (isCompleted) {
    statusBadge = <StatusBox color="green" label="DONE" />;
    borderClass = "border-green-400/30 hover:border-green-400 cursor-pointer";
    interactionProps = { onClick: onClickRevert };
  } else if (isBye) {
    statusBadge = <StatusBox color="grey" label="BYE" />;
    borderClass = "border-[#f5f1e8]/5 opacity-50";
  }

  const handleStreamClick = (e) => {
    e.stopPropagation();
    if (onClickStream) onClickStream();
  };

  return (
    <div
      {...interactionProps}
      className={`bg-[#131a2a] border-2 ${borderClass} p-3 transition-colors`}
    >
      <div className="flex items-center justify-between mb-2 gap-1">
        <div className="font-mono text-[10px] text-yellow-400 tracking-wider">
          {match.match_id}
        </div>
        <div className="flex items-center gap-1">
          {hasStream && (
            <span
              className="flex items-center gap-1 px-1.5 py-0.5 bg-red-500/30 border border-red-400"
              title="Currently being broadcast"
            >
              <Radio className="w-2.5 h-2.5 text-red-200" />
              <span className="font-mono text-[9px] text-red-200 tracking-wider">
                LIVE
              </span>
            </span>
          )}
          {statusBadge}
        </div>
      </div>

      <TeamRow
        label={match.team_a_label || "—"}
        score={isCompleted && match.team_a_score !== "" ? match.team_a_score : null}
        isBye={teamAIsBye}
        isWinner={winnerIsA}
      />
      <div className="text-[10px] text-[#6b7280] my-1 text-center font-mono">
        vs.
      </div>
      <TeamRow
        label={match.team_b_label || "—"}
        score={isCompleted && match.team_b_score !== "" ? match.team_b_score : null}
        isBye={teamBIsBye}
        isWinner={winnerIsB}
      />

      <div className="mt-2 flex items-center justify-between gap-2">
        {isReady && !teamAIsBye && !teamBIsBye && (
          <span className="font-mono text-[9px] text-yellow-400/80">
            ↳ click for result
          </span>
        )}
        {isCompleted && (
          <span className="font-mono text-[9px] text-green-400/80">
            ↳ click to revert
          </span>
        )}
        {!isReady && !isCompleted && <span />}

        {canSetStream && (
          <button
            onClick={handleStreamClick}
            className={`font-mono text-[9px] tracking-wider px-1.5 py-0.5 border transition-colors flex items-center gap-1 ${
              hasStream
                ? "bg-red-500/20 border-red-400 text-red-200 hover:bg-red-500/40"
                : "border-[#f5f1e8]/20 text-[#c8c2b3] hover:border-yellow-400 hover:text-yellow-400"
            }`}
            title={hasStream ? "Currently broadcasting — click to change/clear" : "Mark as broadcasting"}
          >
            <Radio className="w-2.5 h-2.5" />
            {hasStream ? "EDIT" : "STREAM"}
          </button>
        )}
      </div>
    </div>
  );
}

function TeamRow({ label, score, isBye, isWinner }) {
  return (
    <div
      className={`flex items-center justify-between px-2 py-1.5 ${
        isWinner
          ? "bg-yellow-400/15 border-l-2 border-yellow-400"
          : "bg-[#0a0e1a]/60"
      } ${isBye ? "opacity-50 italic" : ""}`}
    >
      <span
        className={`text-sm truncate ${
          isWinner ? "text-yellow-300 font-semibold" : "text-[#f5f1e8]"
        }`}
      >
        {label}
      </span>
      {score !== null && score !== undefined && score !== "" && (
        <span
          className={`font-mono text-sm ${
            isWinner ? "text-yellow-300" : "text-[#c8c2b3]"
          }`}
        >
          {score}
        </span>
      )}
    </div>
  );
}

function StatusBox({ color, label }) {
  const colorMap = {
    yellow: "bg-yellow-400/20 text-yellow-300 border-yellow-400/40",
    green: "bg-green-400/15 text-green-300 border-green-400/40",
    grey: "bg-[#f5f1e8]/5 text-[#6b7280] border-[#f5f1e8]/10",
    red: "bg-red-500/15 text-red-300 border-red-400/40",
  };
  return (
    <span
      className={`font-mono text-[9px] px-1.5 py-0.5 border tracking-widest ${colorMap[color] || colorMap.grey}`}
    >
      {label}
    </span>
  );
}

function ResultModal({ authToken, match, onClose, onSuccess }) {
  const [winnerId, setWinnerId] = useState("");
  const [scoreA, setScoreA] = useState("");
  const [scoreB, setScoreB] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const teamAIsBye = match.team_a_id === "__BYE__";
  const teamBIsBye = match.team_b_id === "__BYE__";

  // Score validation: if either is filled, both must be valid numbers and unequal
  const aNum = scoreA !== "" ? Number(scoreA) : null;
  const bNum = scoreB !== "" ? Number(scoreB) : null;
  const bothFilled = aNum !== null && bNum !== null;
  const eitherFilled = aNum !== null || bNum !== null;
  let scoreError = null;
  let scoreImpliedWinner = null;
  if (eitherFilled && !bothFilled) {
    scoreError = "Enter both scores or leave both empty.";
  } else if (bothFilled) {
    if (Number.isNaN(aNum) || Number.isNaN(bNum)) {
      scoreError = "Scores must be numbers.";
    } else if (aNum < 0 || bNum < 0) {
      scoreError = "Scores can't be negative.";
    } else if (aNum === bNum) {
      scoreError = "Scores can't be tied.";
    } else {
      scoreImpliedWinner = aNum > bNum ? match.team_a_id : match.team_b_id;
    }
  }

  // If user has entered scores AND picked a winner, they must agree
  const winnerScoreMismatch =
    winnerId && scoreImpliedWinner && winnerId !== scoreImpliedWinner;

  const canSubmit =
    !submitting &&
    winnerId &&
    !scoreError &&
    !winnerScoreMismatch &&
    !teamAIsBye &&
    !teamBIsBye;

  const handleSubmit = async () => {
    setError("");
    setSubmitting(true);
    try {
      const body = {
        authToken,
        matchId: match.match_id,
        winnerId,
        notes,
      };
      if (bothFilled) {
        body.teamAScore = aNum;
        body.teamBScore = bNum;
      }
      const res = await fetch("/api/admin/submit-result", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const result = await res.json();
      if (!result.ok) {
        setError(result.error || "Submission failed.");
        setSubmitting(false);
        return;
      }
      onSuccess();
    } catch (err) {
      setError("Network error. Try again.");
      setSubmitting(false);
    }
  };

  return (
    <ModalShell onClose={onClose} title={`Enter result · ${match.match_id}`}>
      {(teamAIsBye || teamBIsBye) && (
        <div className="border-l-4 border-yellow-400 bg-yellow-400/10 p-3 mb-4 font-mono text-xs text-yellow-200">
          This match contains a BYE and should have auto-resolved. If you're
          seeing it as "ready", refresh the page first.
        </div>
      )}

      <div className="font-mono text-[11px] text-[#c8c2b3] mb-1">WINNER</div>
      <div className="space-y-2 mb-5">
        <WinnerOption
          label={match.team_a_label}
          isBye={teamAIsBye}
          selected={winnerId === match.team_a_id}
          onSelect={() => setWinnerId(match.team_a_id)}
        />
        <WinnerOption
          label={match.team_b_label}
          isBye={teamBIsBye}
          selected={winnerId === match.team_b_id}
          onSelect={() => setWinnerId(match.team_b_id)}
        />
      </div>

      <div className="font-mono text-[11px] text-[#c8c2b3] mb-1">
        SERIES SCORE <span className="text-[#6b7280]">(optional)</span>
      </div>
      <div className="grid grid-cols-2 gap-3 mb-2">
        <div>
          <div className="text-xs text-[#c8c2b3] truncate mb-1">
            {match.team_a_label}
          </div>
          <input
            type="number"
            min="0"
            value={scoreA}
            onChange={(e) => setScoreA(e.target.value)}
            placeholder="—"
            className="w-full bg-[#0a0e1a] border-2 border-[#f5f1e8]/15 text-[#f5f1e8] px-3 py-2 font-mono text-sm focus:outline-none focus:border-yellow-400"
          />
        </div>
        <div>
          <div className="text-xs text-[#c8c2b3] truncate mb-1">
            {match.team_b_label}
          </div>
          <input
            type="number"
            min="0"
            value={scoreB}
            onChange={(e) => setScoreB(e.target.value)}
            placeholder="—"
            className="w-full bg-[#0a0e1a] border-2 border-[#f5f1e8]/15 text-[#f5f1e8] px-3 py-2 font-mono text-sm focus:outline-none focus:border-yellow-400"
          />
        </div>
      </div>
      {scoreError && (
        <div className="font-mono text-[11px] text-red-300 mb-3">
          {scoreError}
        </div>
      )}
      {winnerScoreMismatch && (
        <div className="font-mono text-[11px] text-red-300 mb-3">
          Score implies a different winner than the one you picked.
        </div>
      )}

      <div className="font-mono text-[11px] text-[#c8c2b3] mt-3 mb-1">
        NOTES <span className="text-[#6b7280]">(optional)</span>
      </div>
      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        rows={2}
        placeholder="Forfeit, DQ, etc."
        className="w-full bg-[#0a0e1a] border-2 border-[#f5f1e8]/15 text-[#f5f1e8] px-3 py-2 font-mono text-xs focus:outline-none focus:border-yellow-400 mb-4"
      />

      {error && (
        <div className="border-l-4 border-red-500 bg-red-500/10 p-3 font-mono text-xs text-red-300 mb-4">
          {error}
        </div>
      )}

      <div className="flex gap-2 justify-end">
        <button
          onClick={onClose}
          disabled={submitting}
          className="font-mono text-xs px-4 py-2 border border-[#c8c2b3] text-[#c8c2b3] hover:border-yellow-400 hover:text-yellow-400 disabled:opacity-50"
        >
          CANCEL
        </button>
        <button
          onClick={handleSubmit}
          disabled={!canSubmit}
          className={`font-display px-5 py-2 border-2 transition-all ${
            canSubmit
              ? "bg-yellow-400 text-black border-yellow-400 hover:translate-x-[-1px] hover:translate-y-[-1px] hover:shadow-[3px_3px_0_0_#ef4444]"
              : "bg-transparent text-[#6b7280] border-[#6b7280] cursor-not-allowed"
          }`}
        >
          {submitting ? "SUBMITTING…" : "SUBMIT RESULT"}
        </button>
      </div>
    </ModalShell>
  );
}

function WinnerOption({ label, isBye, selected, onSelect }) {
  return (
    <button
      onClick={onSelect}
      disabled={isBye}
      className={`w-full text-left px-3 py-2 border-2 transition-colors flex items-center gap-2 ${
        selected
          ? "bg-yellow-400/15 border-yellow-400 text-yellow-200"
          : isBye
          ? "border-[#f5f1e8]/5 bg-[#0a0e1a]/40 text-[#6b7280] italic cursor-not-allowed"
          : "border-[#f5f1e8]/15 bg-[#0a0e1a] text-[#f5f1e8] hover:border-yellow-400/60"
      }`}
    >
      {selected && <Check className="w-3 h-3" strokeWidth={3} />}
      <span className="text-sm truncate">{label}</span>
    </button>
  );
}

function RevertModal({ authToken, match, onClose, onSuccess }) {
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const winnerLabel =
    match.winner_id === match.team_a_id
      ? match.team_a_label
      : match.team_b_label;
  const scoreText =
    match.team_a_score !== "" && match.team_b_score !== ""
      ? `${match.team_a_label} ${match.team_a_score} – ${match.team_b_score} ${match.team_b_label}`
      : `Winner: ${winnerLabel}`;

  const handleRevert = async () => {
    setError("");
    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/revert-result", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          authToken,
          matchId: match.match_id,
          notes,
        }),
      });
      const result = await res.json();
      if (!result.ok) {
        setError(result.error || "Revert failed.");
        setSubmitting(false);
        return;
      }
      onSuccess();
    } catch (err) {
      setError("Network error. Try again.");
      setSubmitting(false);
    }
  };

  return (
    <ModalShell onClose={onClose} title={`Revert result · ${match.match_id}`}>
      <div className="border-l-4 border-yellow-400 bg-yellow-400/10 p-3 mb-4">
        <div className="font-mono text-[11px] text-yellow-200 mb-1">
          CURRENT RESULT
        </div>
        <div className="font-body text-sm text-[#f5f1e8]">{scoreText}</div>
      </div>

      <p className="font-body text-sm text-[#c8c2b3] mb-4 leading-relaxed">
        Reverting this match clears the result and resets the next round's slots.
        If any downstream match is already completed, the revert will be refused
        — you'll need to revert downstream matches first.
      </p>

      <div className="font-mono text-[11px] text-[#c8c2b3] mb-1">
        REASON <span className="text-[#6b7280]">(optional, logged)</span>
      </div>
      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        rows={2}
        placeholder="Wrong winner entered, score corrected, etc."
        className="w-full bg-[#0a0e1a] border-2 border-[#f5f1e8]/15 text-[#f5f1e8] px-3 py-2 font-mono text-xs focus:outline-none focus:border-yellow-400 mb-4"
      />

      {error && (
        <div className="border-l-4 border-red-500 bg-red-500/10 p-3 font-mono text-xs text-red-300 mb-4">
          {error}
        </div>
      )}

      <div className="flex gap-2 justify-end">
        <button
          onClick={onClose}
          disabled={submitting}
          className="font-mono text-xs px-4 py-2 border border-[#c8c2b3] text-[#c8c2b3] hover:border-yellow-400 hover:text-yellow-400 disabled:opacity-50"
        >
          CANCEL
        </button>
        <button
          onClick={handleRevert}
          disabled={submitting}
          className="font-mono text-xs px-4 py-2 bg-red-500/30 border border-red-400 text-red-200 hover:bg-red-500/50 flex items-center gap-1.5"
        >
          <RotateCcw className="w-3 h-3" />
          {submitting ? "REVERTING…" : "REVERT RESULT"}
        </button>
      </div>
    </ModalShell>
  );
}

function StreamModal({ authToken, match, onClose, onSuccess }) {
  const [url, setUrl] = useState(match.streaming_url || "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const hasExisting = !!match.streaming_url;
  const trimmed = url.trim();
  const isValid = !trimmed || /^https?:\/\//i.test(trimmed);
  const willClear = !trimmed && hasExisting;

  const submit = async (newUrl) => {
    setError("");
    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/set-stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          authToken,
          matchId: match.match_id,
          url: newUrl,
        }),
      });
      const result = await res.json();
      if (!result.ok) {
        setError(result.error || "Could not save stream URL.");
        setSubmitting(false);
        return;
      }
      onSuccess();
    } catch (err) {
      setError("Network error. Try again.");
      setSubmitting(false);
    }
  };

  return (
    <ModalShell onClose={onClose} title={`Stream URL · ${match.match_id}`}>
      <p className="font-body text-sm text-[#c8c2b3] mb-4 leading-relaxed">
        Paste the URL of the live broadcast for this match. The bracket page
        will show a "🔴 LIVE" badge that links here. The URL clears
        automatically when this match completes.
      </p>

      <div className="font-mono text-[11px] text-[#c8c2b3] mb-1">
        BROADCAST URL
      </div>
      <input
        type="url"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        placeholder="https://twitch.tv/major_mayhem"
        className="w-full bg-[#0a0e1a] border-2 border-[#f5f1e8]/15 text-[#f5f1e8] px-3 py-2 font-mono text-sm focus:outline-none focus:border-yellow-400 mb-2"
      />
      {!isValid && (
        <div className="font-mono text-[11px] text-red-300 mb-3">
          URL must start with http:// or https://
        </div>
      )}

      {error && (
        <div className="border-l-4 border-red-500 bg-red-500/10 p-3 font-mono text-xs text-red-300 mb-4">
          {error}
        </div>
      )}

      <div className="flex flex-wrap gap-2 justify-end mt-4">
        <button
          onClick={onClose}
          disabled={submitting}
          className="font-mono text-xs px-4 py-2 border border-[#c8c2b3] text-[#c8c2b3] hover:border-yellow-400 hover:text-yellow-400 disabled:opacity-50"
        >
          CANCEL
        </button>
        {hasExisting && (
          <button
            onClick={() => submit("")}
            disabled={submitting}
            className="font-mono text-xs px-4 py-2 bg-red-500/30 border border-red-400 text-red-200 hover:bg-red-500/50 disabled:opacity-50"
            title="Clear the live indicator"
          >
            CLEAR
          </button>
        )}
        <button
          onClick={() => submit(trimmed)}
          disabled={submitting || !isValid || (!trimmed && !hasExisting)}
          className={`font-display px-5 py-2 border-2 transition-all ${
            !submitting && isValid && (trimmed || willClear)
              ? "bg-yellow-400 text-black border-yellow-400 hover:translate-x-[-1px] hover:translate-y-[-1px] hover:shadow-[3px_3px_0_0_#ef4444]"
              : "bg-transparent text-[#6b7280] border-[#6b7280] cursor-not-allowed"
          }`}
        >
          {submitting ? "SAVING…" : hasExisting ? "UPDATE" : "GO LIVE"}
        </button>
      </div>
    </ModalShell>
  );
}

function ModalShell({ children, onClose, title }) {
  // Close on Escape key
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-[#131a2a] border-2 border-yellow-400/30 max-w-md w-full p-6 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4 pb-3 border-b border-[#f5f1e8]/15">
          <h3 className="font-display text-lg text-[#f5f1e8]">{title}</h3>
          <button
            onClick={onClose}
            className="text-[#c8c2b3] hover:text-yellow-400"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

/* ──────────────────────────── STREAMER HUB ADMIN ──────────────────────────── */

function StreamerHubAdmin({ authToken, identity }) {
  const [streamers, setStreamers] = useState(null);
  const [clips, setClips] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [busyId, setBusyId] = useState(""); // tracks per-row busy state
  const [addClipOpen, setAddClipOpen] = useState(false);

  const fetchAll = useCallback(async () => {
    setError(null);
    try {
      const [sRes, cRes] = await Promise.all([
        fetch("/api/admin/streamers/list", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ authToken }),
        }),
        fetch("/api/admin/clips/list", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ authToken }),
        }),
      ]);
      const sData = await sRes.json();
      const cData = await cRes.json();
      if (!sData.ok) {
        setError(String(sData.error || "Could not load streamers."));
        setLoading(false);
        return;
      }
      setStreamers(Array.isArray(sData.streamers) ? sData.streamers : []);
      setClips(cData.ok && Array.isArray(cData.clips) ? cData.clips : []);
      setLoading(false);
    } catch (err) {
      setError("Network error.");
      setLoading(false);
    }
  }, [authToken]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const handleDecision = async (discordId, decision) => {
    setBusyId(discordId);
    try {
      const res = await fetch("/api/admin/streamers/decision", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ authToken, discordId, decision }),
      });
      const result = await res.json();
      if (!result.ok) {
        setError(String(result.error || "Action failed."));
      }
      await fetchAll();
    } catch (err) {
      setError("Network error.");
    } finally {
      setBusyId("");
    }
  };

  const handleToggleFeatured = async (discordId) => {
    setBusyId(discordId);
    try {
      const res = await fetch("/api/admin/streamers/feature", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ authToken, discordId }),
      });
      const result = await res.json();
      if (!result.ok) {
        setError(String(result.error || "Action failed."));
      }
      await fetchAll();
    } catch (err) {
      setError("Network error.");
    } finally {
      setBusyId("");
    }
  };

  const handleClipAction = async (clipUrl, action) => {
    setBusyId(clipUrl);
    try {
      const res = await fetch("/api/admin/clips/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ authToken, clipUrl, action }),
      });
      const result = await res.json();
      if (!result.ok) {
        setError(String(result.error || "Action failed."));
      }
      await fetchAll();
    } catch (err) {
      setError("Network error.");
    } finally {
      setBusyId("");
    }
  };

  if (loading) {
    return (
      <div className="font-mono text-sm text-[#c8c2b3] animate-pulse">
        Loading streamer hub…
      </div>
    );
  }

  if (error && !streamers) {
    return (
      <div className="border-l-4 border-red-500 bg-red-500/10 p-4 max-w-xl">
        <div className="font-display text-lg mb-1">Couldn't load hub</div>
        <p className="font-body text-sm text-red-300 mb-4">{String(error)}</p>
        <button
          onClick={fetchAll}
          className="font-mono text-xs px-3 py-2 border border-red-300 text-red-300 hover:bg-red-500/20"
        >
          RETRY
        </button>
      </div>
    );
  }

  const pending = streamers.filter((s) => s.status === "pending");
  const approved = streamers.filter((s) => s.status === "approved");
  const rejected = streamers.filter((s) => s.status === "rejected");

  return (
    <div>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <div className="font-mono text-xs text-yellow-400 tracking-widest mb-1">
            STREAMER HUB
          </div>
          <div className="font-display text-2xl text-[#f5f1e8]">
            Application Queue
          </div>
        </div>
        <button
          onClick={fetchAll}
          className="font-mono text-xs tracking-wider px-3 py-2 border border-[#f5f1e8]/20 text-[#c8c2b3] hover:border-yellow-400 hover:text-yellow-400 flex items-center gap-1.5"
        >
          <RefreshCw className="w-3 h-3" /> REFRESH
        </button>
      </div>

      {error && (
        <div className="border-l-4 border-red-500 bg-red-500/10 p-3 mb-4 font-mono text-xs text-red-300 max-w-xl">
          {String(error)}
        </div>
      )}

      {/* PENDING APPLICATIONS */}
      <section className="mb-10">
        <div className="font-mono text-[11px] text-yellow-300 tracking-widest mb-3 flex items-center gap-2">
          PENDING APPLICATIONS
          <span className="text-[#6b7280]">({pending.length})</span>
        </div>
        {pending.length === 0 ? (
          <div className="font-body text-sm text-[#c8c2b3] italic">
            No applications waiting for review.
          </div>
        ) : (
          <div className="space-y-2">
            {pending.map((s) => (
              <StreamerRow
                key={String(s.discordId)}
                streamer={s}
                section="pending"
                busy={busyId === s.discordId}
                onApprove={() => handleDecision(s.discordId, "approve")}
                onReject={() => handleDecision(s.discordId, "reject")}
              />
            ))}
          </div>
        )}
      </section>

      {/* APPROVED STREAMERS */}
      <section className="mb-10">
        <div className="font-mono text-[11px] text-green-300 tracking-widest mb-3 flex items-center gap-2">
          APPROVED STREAMERS
          <span className="text-[#6b7280]">({approved.length})</span>
        </div>
        {approved.length === 0 ? (
          <div className="font-body text-sm text-[#c8c2b3] italic">
            No approved streamers yet.
          </div>
        ) : (
          <div className="space-y-2">
            {approved.map((s) => (
              <StreamerRow
                key={String(s.discordId)}
                streamer={s}
                section="approved"
                busy={busyId === s.discordId}
                onToggleFeatured={() => handleToggleFeatured(s.discordId)}
                onReject={() => handleDecision(s.discordId, "reject")}
              />
            ))}
          </div>
        )}
      </section>

      {/* REJECTED — collapsed by default visually (just a faint list) */}
      {rejected.length > 0 && (
        <section className="mb-10">
          <div className="font-mono text-[11px] text-[#6b7280] tracking-widest mb-3">
            REJECTED ({rejected.length})
          </div>
          <div className="space-y-2 opacity-60">
            {rejected.map((s) => (
              <StreamerRow
                key={String(s.discordId)}
                streamer={s}
                section="rejected"
                busy={busyId === s.discordId}
                onApprove={() => handleDecision(s.discordId, "approve")}
              />
            ))}
          </div>
        </section>
      )}

      {/* CLIPS */}
      <section>
        <div className="flex items-center justify-between mb-3 flex-wrap gap-3">
          <div className="font-mono text-[11px] text-yellow-300 tracking-widest flex items-center gap-2">
            CLIPS
            <span className="text-[#6b7280]">({clips ? clips.length : 0})</span>
          </div>
          <button
            onClick={() => setAddClipOpen(true)}
            disabled={approved.length === 0}
            className={`font-mono text-xs tracking-wider px-3 py-2 border flex items-center gap-1.5 ${
              approved.length === 0
                ? "border-[#6b7280] text-[#6b7280] cursor-not-allowed"
                : "border-yellow-400 text-yellow-400 hover:bg-yellow-400 hover:text-black"
            }`}
            title={
              approved.length === 0
                ? "Approve at least one streamer first"
                : "Add a clip"
            }
          >
            <Plus className="w-3 h-3" /> ADD CLIP
          </button>
        </div>

        {clips && clips.length === 0 ? (
          <div className="font-body text-sm text-[#c8c2b3] italic">
            No clips yet. Click ADD CLIP to upload one.
          </div>
        ) : (
          <div className="space-y-2">
            {clips &&
              clips.map((c, i) => (
                <ClipRow
                  key={String(c.clipUrl) + i}
                  clip={c}
                  busy={busyId === c.clipUrl}
                  onToggleFeatured={() => handleClipAction(c.clipUrl, "feature")}
                  onRemove={() => handleClipAction(c.clipUrl, "remove")}
                />
              ))}
          </div>
        )}
      </section>

      {addClipOpen && (
        <AddClipModal
          authToken={authToken}
          streamers={approved}
          onClose={() => setAddClipOpen(false)}
          onSuccess={() => {
            setAddClipOpen(false);
            fetchAll();
          }}
        />
      )}
    </div>
  );
}

function StreamerRow({
  streamer,
  section,
  busy,
  onApprove,
  onReject,
  onToggleFeatured,
}) {
  const name = String(streamer.streamerName || "—");
  const twitch = String(streamer.twitchUrl || "");
  const discord = String(streamer.discordUsername || "");
  const family = !!streamer.familyFriendly;
  const featured = !!streamer.featured;
  const hasReg = !!streamer.hasTournamentRegistration;

  return (
    <div className="border-2 border-[#f5f1e8]/15 bg-[#131a2a] p-3">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="font-display text-base text-[#f5f1e8] truncate">
              {name}
            </span>
            {featured && (
              <span
                title="Featured"
                className="font-mono text-[9px] tracking-widest px-1.5 py-0.5 bg-yellow-400/20 text-yellow-300 border border-yellow-400/40 flex items-center gap-1"
              >
                <Star className="w-2.5 h-2.5" /> FEATURED
              </span>
            )}
            {family && (
              <span className="font-mono text-[9px] tracking-widest px-1.5 py-0.5 bg-green-400/15 text-green-300 border border-green-400/30">
                FAMILY FRIENDLY
              </span>
            )}
            {!hasReg && section === "pending" && (
              <span
                className="font-mono text-[9px] tracking-widest px-1.5 py-0.5 bg-orange-400/15 text-orange-300 border border-orange-400/40"
                title="This applicant is not registered for the tournament"
              >
                ⚠ NOT REGISTERED
              </span>
            )}
          </div>
          <div className="font-mono text-[11px] text-[#c8c2b3] flex items-center gap-2 flex-wrap">
            <span>@{discord}</span>
            {twitch && (
              <>
                <span className="text-[#6b7280]">·</span>
                <a
                  href={twitch}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-yellow-400 hover:text-yellow-300 underline truncate inline-flex items-center gap-1"
                >
                  {twitch.replace(/^https?:\/\//, "")}
                  <ExternalLink className="w-2.5 h-2.5" />
                </a>
              </>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {section === "pending" && (
            <>
              <button
                onClick={onApprove}
                disabled={busy}
                className="font-mono text-xs tracking-wider px-3 py-2 border-2 border-green-400 text-green-300 hover:bg-green-400 hover:text-black disabled:opacity-50 flex items-center gap-1.5"
              >
                <UserCheck className="w-3 h-3" />
                {busy ? "…" : "APPROVE"}
              </button>
              <button
                onClick={onReject}
                disabled={busy}
                className="font-mono text-xs tracking-wider px-3 py-2 border-2 border-red-400/60 text-red-300 hover:bg-red-400 hover:text-black disabled:opacity-50 flex items-center gap-1.5"
              >
                <UserX className="w-3 h-3" />
                {busy ? "…" : "REJECT"}
              </button>
            </>
          )}
          {section === "approved" && (
            <>
              <button
                onClick={onToggleFeatured}
                disabled={busy}
                className={`font-mono text-xs tracking-wider px-3 py-2 border-2 disabled:opacity-50 flex items-center gap-1.5 ${
                  featured
                    ? "border-yellow-400 bg-yellow-400/20 text-yellow-300"
                    : "border-[#f5f1e8]/20 text-[#c8c2b3] hover:border-yellow-400 hover:text-yellow-400"
                }`}
                title={featured ? "Currently featured" : "Mark as featured"}
              >
                <Star className="w-3 h-3" />
                {busy ? "…" : featured ? "UNFEATURE" : "FEATURE"}
              </button>
              <button
                onClick={onReject}
                disabled={busy}
                className="font-mono text-xs tracking-wider px-3 py-2 border-2 border-red-400/40 text-red-300/80 hover:bg-red-400/20 disabled:opacity-50"
                title="Remove from hub (reject)"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </>
          )}
          {section === "rejected" && (
            <button
              onClick={onApprove}
              disabled={busy}
              className="font-mono text-xs tracking-wider px-3 py-2 border border-green-400/60 text-green-300/80 hover:bg-green-400/20 disabled:opacity-50"
              title="Re-approve"
            >
              {busy ? "…" : "RE-APPROVE"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function ClipRow({ clip, busy, onToggleFeatured, onRemove }) {
  const caption = String(clip.caption || "");
  const url = String(clip.clipUrl || "");
  const streamer = String(clip.streamerName || "—");
  const streamerUrl = String(clip.streamerTwitchUrl || "");
  const featured = !!clip.featured;

  return (
    <div className="border-2 border-[#f5f1e8]/15 bg-[#131a2a] p-3">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="font-body text-sm text-[#f5f1e8] line-clamp-1">
              {caption || "(no caption)"}
            </span>
            {featured && (
              <span className="font-mono text-[9px] tracking-widest px-1.5 py-0.5 bg-yellow-400/20 text-yellow-300 border border-yellow-400/40 flex items-center gap-1">
                <Star className="w-2.5 h-2.5" /> FEATURED
              </span>
            )}
          </div>
          <div className="font-mono text-[10px] text-[#c8c2b3] flex items-center gap-2 flex-wrap">
            <span>
              by{" "}
              {streamerUrl ? (
                <a
                  href={streamerUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-yellow-400 hover:text-yellow-300 underline"
                >
                  {streamer}
                </a>
              ) : (
                <span>{streamer}</span>
              )}
            </span>
            <span className="text-[#6b7280]">·</span>
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#c8c2b3] hover:text-yellow-400 underline truncate inline-flex items-center gap-1"
            >
              clip
              <ExternalLink className="w-2.5 h-2.5" />
            </a>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={onToggleFeatured}
            disabled={busy}
            className={`font-mono text-xs tracking-wider px-3 py-2 border-2 disabled:opacity-50 flex items-center gap-1.5 ${
              featured
                ? "border-yellow-400 bg-yellow-400/20 text-yellow-300"
                : "border-[#f5f1e8]/20 text-[#c8c2b3] hover:border-yellow-400 hover:text-yellow-400"
            }`}
          >
            <Star className="w-3 h-3" />
            {busy ? "…" : featured ? "UNFEATURE" : "FEATURE"}
          </button>
          <button
            onClick={onRemove}
            disabled={busy}
            className="font-mono text-xs tracking-wider px-3 py-2 border-2 border-red-400/60 text-red-300 hover:bg-red-400 hover:text-black disabled:opacity-50"
            title="Remove clip"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      </div>
    </div>
  );
}

function AddClipModal({ authToken, streamers, onClose, onSuccess }) {
  const [selectedDiscordId, setSelectedDiscordId] = useState(
    streamers[0]?.discordId || ""
  );
  const [clipUrl, setClipUrl] = useState("");
  const [caption, setCaption] = useState("");
  const [featured, setFeatured] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  // Close on Escape
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape" && !submitting) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, submitting]);

  const selectedStreamer = streamers.find(
    (s) => s.discordId === selectedDiscordId
  );
  const trimmedUrl = clipUrl.trim();
  const urlValid = trimmedUrl && /^https?:\/\//i.test(trimmedUrl);
  const canSubmit = !submitting && urlValid && selectedStreamer;

  const handleSubmit = async () => {
    setError("");
    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/clips/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          authToken,
          clipUrl: trimmedUrl,
          streamerName: selectedStreamer.streamerName,
          streamerTwitchUrl: selectedStreamer.twitchUrl,
          caption: caption.trim(),
          featured,
        }),
      });
      const result = await res.json();
      if (!result.ok) {
        setError(String(result.error || "Could not add clip."));
        setSubmitting(false);
        return;
      }
      if (typeof onSuccess === "function") onSuccess();
    } catch (err) {
      setError("Network error.");
      setSubmitting(false);
    }
  };

  return (
    <ModalShell onClose={onClose} title="Add Clip">
      <div className="font-mono text-[11px] text-[#c8c2b3] mb-1">
        STREAMER
      </div>
      <select
        value={selectedDiscordId}
        onChange={(e) => setSelectedDiscordId(e.target.value)}
        className="w-full bg-[#0a0e1a] border-2 border-[#f5f1e8]/15 text-[#f5f1e8] px-3 py-2 font-mono text-sm focus:outline-none focus:border-yellow-400 mb-4"
      >
        {streamers.map((s) => (
          <option key={String(s.discordId)} value={String(s.discordId)}>
            {String(s.streamerName)} ({String(s.discordUsername || "")})
          </option>
        ))}
      </select>

      <div className="font-mono text-[11px] text-[#c8c2b3] mb-1">
        TWITCH CLIP URL
      </div>
      <input
        type="url"
        value={clipUrl}
        onChange={(e) => setClipUrl(e.target.value)}
        placeholder="https://clips.twitch.tv/..."
        className="w-full bg-[#0a0e1a] border-2 border-[#f5f1e8]/15 text-[#f5f1e8] px-3 py-2 font-mono text-sm focus:outline-none focus:border-yellow-400 mb-2"
      />
      {clipUrl && !urlValid && (
        <div className="font-mono text-[11px] text-red-300 mb-3">
          URL must start with http:// or https://
        </div>
      )}

      <div className="font-mono text-[11px] text-[#c8c2b3] mb-1 mt-4">
        CAPTION (optional)
      </div>
      <input
        type="text"
        value={caption}
        onChange={(e) => setCaption(e.target.value)}
        placeholder="Short description"
        maxLength={120}
        className="w-full bg-[#0a0e1a] border-2 border-[#f5f1e8]/15 text-[#f5f1e8] px-3 py-2 font-mono text-sm focus:outline-none focus:border-yellow-400 mb-4"
      />

      <label className="flex items-center gap-2 cursor-pointer select-none mt-2">
        <input
          type="checkbox"
          checked={featured}
          onChange={(e) => setFeatured(e.target.checked)}
          className="accent-yellow-400"
        />
        <span className="text-sm text-[#f5f1e8]">
          Feature this clip on the hub
        </span>
      </label>

      {error && (
        <div className="border-l-4 border-red-500 bg-red-500/10 p-3 font-mono text-xs text-red-300 mt-4">
          {error}
        </div>
      )}

      <div className="flex gap-2 justify-end mt-6">
        <button
          onClick={onClose}
          disabled={submitting}
          className="font-mono text-xs px-4 py-2 border border-[#c8c2b3] text-[#c8c2b3] hover:border-yellow-400 hover:text-yellow-400 disabled:opacity-50"
        >
          CANCEL
        </button>
        <button
          onClick={handleSubmit}
          disabled={!canSubmit}
          className={`font-display px-5 py-2 border-2 transition-all ${
            canSubmit
              ? "bg-yellow-400 text-black border-yellow-400 hover:translate-x-[-1px] hover:translate-y-[-1px] hover:shadow-[3px_3px_0_0_#ef4444]"
              : "bg-transparent text-[#6b7280] border-[#6b7280] cursor-not-allowed"
          }`}
        >
          {submitting ? "ADDING…" : "ADD CLIP"}
        </button>
      </div>
    </ModalShell>
  );
}

/* ──────────────────────────── END STREAMER HUB ADMIN ──────────────────────────── */

/**
 * Parse the textarea input into a list of { teamId, teamName } objects.
 * Returns { teams: [...], error: string|null }.
 */
function parseTeams(raw) {
  if (!raw.trim()) return { teams: [], error: null };

  const lines = raw
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  const teams = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const colonIdx = line.indexOf(":");
    if (colonIdx === -1) {
      return {
        teams: [],
        error: `Line ${i + 1} is missing the colon separator. Use TeamID:TeamName format.`,
      };
    }
    const teamId = line.slice(0, colonIdx).trim();
    const teamName = line.slice(colonIdx + 1).trim();
    if (!teamId || !teamName) {
      return {
        teams: [],
        error: `Line ${i + 1} has an empty TeamID or Team Name.`,
      };
    }
    teams.push({ teamId, teamName });
  }

  if (teams.length > 16) {
    return {
      teams,
      error: `Too many teams (${teams.length}). The bracket holds at most 16.`,
    };
  }
  if (teams.length === 1) {
    return {
      teams,
      error: "Need at least 2 teams to run a bracket.",
    };
  }

  return { teams, error: null };
}

/* ────────────────────── UNDER CONSTRUCTION TAPE ────────────────────── */

function UnderConstructionTape() {
  return (
    <div className="fixed top-0 right-0 z-50 pointer-events-none select-none">
      <div className="relative" style={{ width: 280, height: 180 }}>
        <div
          className="tape-wobble absolute"
          style={{ top: 38, right: -38, width: 320, transformOrigin: "center" }}
        >
          <div className="hazard-stripes py-2 px-4 shadow-2xl border-y-2 border-black flex items-center justify-center gap-2">
            <Construction className="w-5 h-5 text-black" strokeWidth={3} />
            <span
              className="font-display text-black text-sm tracking-wider"
              style={{ textShadow: "1px 1px 0 #facc15" }}
            >
              UNDER CONSTRUCTION
            </span>
            <Hammer className="w-5 h-5 text-black" strokeWidth={3} />
          </div>
        </div>
      </div>
    </div>
  );
}
