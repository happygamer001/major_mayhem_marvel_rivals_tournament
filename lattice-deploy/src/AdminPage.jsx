import { useState, useEffect } from "react";
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
  return (
    <section className="slide-up">
      <div className="border-2 border-green-400/30 bg-[#131a2a] p-4 mb-8 flex items-center gap-3">
        <Shield className="w-5 h-5 text-green-400" />
        <div>
          <div className="font-mono text-xs text-green-300">AUTHORIZED</div>
          <div className="font-body text-sm text-[#f5f1e8]">
            <span className="font-mono text-yellow-300">@{identity?.username}</span> ·{" "}
            <span className="text-[#c8c2b3]">{modInfo?.role || "mod"}</span>
          </div>
        </div>
      </div>

      <SeedingInterface authToken={authToken} />
    </section>
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
function SeedingInterface({ authToken }) {
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
