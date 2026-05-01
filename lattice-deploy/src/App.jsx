import { useState, useEffect } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Check,
  AlertTriangle,
  Trophy,
  Users,
  User,
  UserPlus,
  Crown,
  CreditCard,
  Radio,
  Hammer,
  Construction,
  Sparkles,
  Lock,
  ShieldCheck,
} from "lucide-react";
import { submitRegistration } from "./submitRegistration";

/* ──────────────────────────────────────────────────────────────
   LATTICE OPEN TOURNAMENT — Major Mayhem
   Frontend framework v0.1
   - Landing → Registration → (conditional TOS branch) → Payment
   - "Under Construction" tape persists until app is fully wired
   ────────────────────────────────────────────────────────────── */

const FONT_STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Bungee&family=Manrope:wght@400;500;600;700;800&family=Space+Mono:wght@400;700&display=swap');

  .font-display { font-family: 'Bungee', system-ui, sans-serif; letter-spacing: 0.02em; }
  .font-mono    { font-family: 'Space Mono', ui-monospace, monospace; }
  .font-body    { font-family: 'Manrope', system-ui, sans-serif; }

  .halftone {
    background-image: radial-gradient(circle at 1px 1px, rgba(251,191,36,0.07) 1px, transparent 0);
    background-size: 22px 22px;
  }
  .grain {
    background-image:
      radial-gradient(circle at 20% 10%, rgba(251,191,36,0.05), transparent 40%),
      radial-gradient(circle at 80% 90%, rgba(239,68,68,0.04), transparent 45%);
  }
  .hazard-stripes {
    background: repeating-linear-gradient(
      -45deg,
      #facc15 0,
      #facc15 14px,
      #0a0e1a 14px,
      #0a0e1a 28px
    );
  }
  @keyframes wobble {
    0%, 100% { transform: rotate(11deg) translate(0, 0); }
    25%      { transform: rotate(13deg) translate(-2px, 1px); }
    50%      { transform: rotate(10deg) translate(1px, -1px); }
    75%      { transform: rotate(12deg) translate(-1px, 0); }
  }
  .tape-wobble { animation: wobble 4.4s ease-in-out infinite; }

  @keyframes flicker {
    0%, 100% { opacity: 1; }
    47% { opacity: 1; }
    48% { opacity: 0.6; }
    49% { opacity: 1; }
  }
  .flicker { animation: flicker 6s infinite; }

  @keyframes slideUp {
    from { opacity: 0; transform: translateY(12px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  .slide-up { animation: slideUp 0.35s ease-out both; }
`;

/* ────────────────────── DATA ────────────────────── */

const RANKS = [
  "Bronze",
  "Silver",
  "Gold",
  "Platinum",
  "Diamond",
  "Grandmaster",
  "Eternity",
  "One Above All",
  "Unranked / Just started",
];

const SERVERS = [
  "NA East",
  "NA Central",
  "NA West",
  "EU",
  "Asia",
  "OCE / SEA",
  "South America",
];

/* TOS summaries — paraphrased from the project PDFs.
   The full PDFs remain the authoritative legal documents. */
const DISCORD_TOS = {
  title: "Discord Server Terms",
  version: "v1.0",
  bullets: [
    "Dedicated team voice + text chats are provisioned for every registered team and visible only to that team and the moderation staff.",
    "The server hosts community guides, theory-crafting channels, and an opt-in cosmetic leaderboard updated the week of the event.",
    "Streamers identified at registration receive official badges to display on their broadcasts.",
    "Zero-tolerance policy: no gambling of any kind, and any harassment, hate speech, or bullying results in immediate removal.",
    "Moderators reserve the right to remove any content or user that violates the spirit of an inclusive community.",
  ],
};

const TOURNAMENT_TOS = {
  title: "Casual Tournament Terms of Service",
  version: "v1.1",
  bullets: [
    "By registering you agree to these terms. This is a casual-focused event — sportsmanship and positive interaction take precedence over high-stakes optimization.",
    "All players need a Marvel Rivals account in good standing. Active bans on the game platform may result in disqualification.",
    "Hate speech, harassment, intentional throwing, or griefing will result in an immediate and permanent ban from current and future events.",
    "Disconnections: teams should wait up to 3 minutes for a reconnect. Matches will not be replayed for standard latency.",
    "Refunds available up to 48 hours before the tournament. Inside 48 hours, refund eligibility follows the Random Player Matchmaking Agreement.",
    "Organizers are not responsible for game server outages, platform-wide issues, or individual hardware failures.",
  ],
};

const RPMA_TOS = {
  title: "Random Player Matchmaking Agreement",
  version: "v1.0",
  bullets: [
    "This agreement governs solo players and incomplete teams (fewer than 6). The tournament experience relies on cooperative play.",
    "Reporting unsportsmanlike conduct is the responsibility of individual players and team captains. Verified reports may result in immediate disqualification without refund.",
    "Matchmaking criteria: rank parity, registration preference / role, and confirmed availability during the matchmaking window.",
    "Reserve players designate a primary team at registration, but may be re-routed on tournament day to fill any team needing a 6th.",
    "Final matchmaking decisions are at the sole discretion of Tournament Moderators. Matchmaking opens 7 days prior to event start.",
    "If your matched random player no-shows and no standby is available, your team may withdraw for a full refund — notify a Moderator immediately.",
  ],
};

const BROADCAST_TOS = {
  title: "Streaming & Media Release",
  version: "v1.0",
  bullets: [
    "Tournament Organizers hold the primary right to broadcast the event. The tournament will stream live and may be recorded for promotional use.",
    "Spectator accounts belonging to organizers and casters may join any match. Your IGN, hero choices, gameplay, and stats will be visible to the audience.",
    "Players may be invited to voluntary pre/post-match interviews. Participating grants permission to broadcast your voice and (if camera is on) likeness.",
    "You may stream your own POV. A 3-minute minimum delay is strongly recommended to prevent stream sniping.",
    "You grant a non-exclusive, worldwide, royalty-free license to use captured footage and audio for broadcast, highlight reels, and social promotion.",
  ],
};

const ENTRY_FEE_USD = 30; // per team — adjustable

/* ────────────────────── ROOT ────────────────────── */

export default function App() {
  const [view, setView] = useState("landing"); // landing | register | brackets | leaderboards | streamers
  const [submitted, setSubmitted] = useState(null);

  return (
    <div className="font-body min-h-screen w-full bg-[#0a0e1a] text-[#f5f1e8] relative overflow-hidden">
      <style>{FONT_STYLES}</style>
      <div className="absolute inset-0 halftone pointer-events-none" />
      <div className="absolute inset-0 grain pointer-events-none" />

      <UnderConstructionTape />

      <div className="relative z-10">
        {view === "landing" && <Landing onPick={(v) => setView(v)} />}
        {view === "register" && (
          <Registration
            onBack={() => setView("landing")}
            onComplete={(data) => {
              setSubmitted(data);
              setView("landing");
            }}
          />
        )}
        {(view === "brackets" || view === "leaderboards" || view === "streamers") && (
          <ComingSoon kind={view} onBack={() => setView("landing")} />
        )}
      </div>

      {submitted && (
        <SubmissionToast data={submitted} onDismiss={() => setSubmitted(null)} />
      )}
    </div>
  );
}

/* ────────────────────── UNDER CONSTRUCTION ────────────────────── */

function UnderConstructionTape() {
  return (
    <div className="fixed top-0 right-0 z-50 pointer-events-none select-none">
      <div className="relative" style={{ width: 280, height: 180 }}>
        <div
          className="tape-wobble absolute"
          style={{
            top: 38,
            right: -38,
            width: 320,
            transformOrigin: "center",
          }}
        >
          <div className="hazard-stripes py-2 px-4 shadow-2xl border-y-2 border-black flex items-center justify-center gap-2">
            <Construction className="w-5 h-5 text-black" strokeWidth={3} />
            <span
              className="font-display text-black text-sm tracking-wider"
              style={{ textShadow: "1px 1px 0 #facc15" }}
            >
              UNDER CONSTRUCTION
            </span>
            <Hammer className="w-5 h-5 text-black flicker" strokeWidth={3} />
          </div>
          <div className="text-center mt-1">
            <span className="font-mono text-[10px] text-yellow-300 bg-black/70 px-2 py-0.5 rounded-sm">
              v0.1 · pls excuse the dust
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ────────────────────── LANDING ────────────────────── */

function Landing({ onPick }) {
  const tiles = [
    {
      key: "register",
      label: "Register Here",
      sub: "Solo, partial, or full team",
      icon: UserPlus,
      live: true,
      accent: "yellow",
    },
    {
      key: "brackets",
      label: "Tournament Brackets",
      sub: "Live bracket once seeding closes",
      icon: Trophy,
      live: false,
      accent: "cream",
    },
    {
      key: "leaderboards",
      label: "Leaderboards",
      sub: "Scrim performance + opt-in rankings",
      icon: Sparkles,
      live: false,
      accent: "cream",
    },
    {
      key: "streamers",
      label: "Streamer Hub",
      sub: "Badges, overlays, schedule",
      icon: Radio,
      live: false,
      accent: "cream",
    },
  ];

  return (
    <main className="max-w-6xl mx-auto px-6 sm:px-10 pt-20 pb-24 slide-up">
      <header className="mb-14">
        <div className="font-mono text-xs text-yellow-400 mb-3 tracking-widest">
          / / PRESENTED BY MAJOR MAYHEM
        </div>
        <h1
          className="font-display text-5xl sm:text-7xl md:text-8xl leading-[0.95] text-[#f5f1e8]"
          style={{
            textShadow: "4px 4px 0 #facc15, 8px 8px 0 #ef4444",
          }}
        >
          THE LATTICE
          <br />
          <span className="text-yellow-400">OPEN</span>
        </h1>
        <p className="font-body text-lg sm:text-xl text-[#c8c2b3] max-w-2xl mt-6 leading-relaxed">
          A casual Marvel Rivals invitational. Sixteen teams, ninety-six heroes,
          one ten-hour broadcast. Show up, throw down, have fun.
        </p>
        <div className="mt-6 flex flex-wrap gap-3 font-mono text-xs">
          <span className="px-3 py-1 border border-yellow-400/40 text-yellow-300">
            EVENT DAY · JUN 20
          </span>
          <span className="px-3 py-1 border border-[#f5f1e8]/20 text-[#c8c2b3]">
            16 TEAMS
          </span>
          <span className="px-3 py-1 border border-[#f5f1e8]/20 text-[#c8c2b3]">
            ${ENTRY_FEE_USD} / TEAM ENTRY
          </span>
        </div>
      </header>

      <section className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        {tiles.map((t, i) => (
          <Tile
            key={t.key}
            tile={t}
            onClick={() => t.live && onPick(t.key)}
            disabled={!t.live}
            delay={i * 80}
          />
        ))}
      </section>

      <footer className="mt-16 font-mono text-xs text-[#6b7280] flex flex-wrap gap-x-6 gap-y-1">
        <span>© Major Mayhem · Lattice Open</span>
        <span>Not affiliated with NetEase or Marvel Games</span>
        <span className="text-yellow-400">PHASE 1 BUILD</span>
      </footer>
    </main>
  );
}

function Tile({ tile, onClick, disabled, delay }) {
  const Icon = tile.icon;
  const live = tile.live;
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`group relative text-left p-7 sm:p-8 border-2 transition-all duration-200 slide-up ${
        live
          ? "border-yellow-400 bg-yellow-400 text-black hover:translate-x-[-3px] hover:translate-y-[-3px] hover:shadow-[6px_6px_0_0_#ef4444] cursor-pointer"
          : "border-[#f5f1e8]/15 bg-[#131a2a] text-[#c8c2b3] cursor-not-allowed opacity-70"
      }`}
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="flex items-start justify-between mb-6">
        <Icon className="w-8 h-8" strokeWidth={2.25} />
        {!live && (
          <span className="font-mono text-[10px] tracking-widest border border-current px-2 py-0.5">
            COMING SOON
          </span>
        )}
        {live && (
          <span className="font-mono text-[10px] tracking-widest bg-black text-yellow-400 px-2 py-0.5">
            ▸ OPEN
          </span>
        )}
      </div>
      <div className="font-display text-2xl sm:text-3xl mb-1.5">{tile.label}</div>
      <div className="font-body text-sm">{tile.sub}</div>
    </button>
  );
}

/* ────────────────────── COMING SOON SCREEN ────────────────────── */

function ComingSoon({ kind, onBack }) {
  const labels = {
    brackets: "Tournament Brackets",
    leaderboards: "Leaderboards",
    streamers: "Streamer Hub",
  };
  return (
    <main className="max-w-3xl mx-auto px-6 sm:px-10 pt-20 pb-24 slide-up">
      <BackButton onClick={onBack} />
      <div className="mt-8 border-2 border-dashed border-yellow-400/50 bg-[#131a2a] p-12 text-center">
        <Construction className="w-12 h-12 text-yellow-400 mx-auto mb-4" />
        <h2 className="font-display text-3xl sm:text-4xl mb-2">{labels[kind]}</h2>
        <p className="font-mono text-yellow-400 text-sm mb-3">// NOT YET WIRED UP</p>
        <p className="font-body text-[#c8c2b3] max-w-md mx-auto">
          This section unlocks once registration closes and the bracket / scrim data
          starts flowing. Check back soon.
        </p>
      </div>
    </main>
  );
}

/* ────────────────────── REGISTRATION ────────────────────── */

const TOTAL_STEPS = 7;

function Registration({ onBack, onComplete }) {
  const [step, setStep] = useState(1);
  const [data, setData] = useState({
    fullName: "",
    discordName: "",
    ign: "",
    rank: "",
    servers: [],
    isStreamer: false,
    agreedDiscordTOS: false,
    agreedTournamentTOS: false,
    teamType: "", // 'solo' | 'partial' | 'full'
    agreedRPMA: false,
    confirmedCaptain: false,
    acknowledgedCaptainResponsibility: false,
    teamName: "",
    agreedBroadcastTOS: false,
  });

  const set = (patch) => setData((d) => ({ ...d, ...patch }));

  const isFullTeam = data.teamType === "full";
  const isIncomplete = data.teamType === "solo" || data.teamType === "partial";

  // Step 5 is the conditional branch — render either RPMA or Captain, but it
  // counts as a single step in the progress bar either way.
  const stepIsValid = (() => {
    switch (step) {
      case 1:
        return (
          data.fullName.trim() &&
          data.discordName.trim() &&
          data.ign.trim() &&
          data.rank &&
          data.servers.length > 0
        );
      case 2:
        return data.agreedDiscordTOS;
      case 3:
        return data.agreedTournamentTOS;
      case 4:
        return data.teamType !== "";
      case 5:
        if (isIncomplete) return data.agreedRPMA;
        if (isFullTeam)
          return (
            data.confirmedCaptain &&
            data.acknowledgedCaptainResponsibility &&
            data.teamName.trim().length >= 2
          );
        return false;
      case 6:
        return data.agreedBroadcastTOS;
      case 7:
        return true; // payment screen handles its own state
      default:
        return false;
    }
  })();

  const next = () => stepIsValid && setStep((s) => Math.min(s + 1, TOTAL_STEPS));
  const prev = () => (step === 1 ? onBack() : setStep((s) => s - 1));

  return (
    <main className="max-w-3xl mx-auto px-6 sm:px-10 pt-16 pb-24">
      <BackButton onClick={prev} label={step === 1 ? "Back to home" : "Previous step"} />
      <ProgressBar step={step} total={TOTAL_STEPS} />

      <div className="mt-8 slide-up" key={step}>
        {step === 1 && <StepBasicInfo data={data} set={set} />}
        {step === 2 && (
          <StepTOS
            tos={DISCORD_TOS}
            agreed={data.agreedDiscordTOS}
            onChange={(v) => set({ agreedDiscordTOS: v })}
            ribbon="STEP 2 OF 7"
            heading="Discord Community Terms"
            subhead="Read and acknowledge how the tournament Discord operates."
          />
        )}
        {step === 3 && (
          <StepTOS
            tos={TOURNAMENT_TOS}
            agreed={data.agreedTournamentTOS}
            onChange={(v) => set({ agreedTournamentTOS: v })}
            ribbon="STEP 3 OF 7"
            heading="Tournament Terms of Service"
            subhead="The casual-tournament ground rules. Read carefully."
          />
        )}
        {step === 4 && <StepTeamType data={data} set={set} />}
        {step === 5 && isIncomplete && (
          <StepTOS
            tos={RPMA_TOS}
            agreed={data.agreedRPMA}
            onChange={(v) => set({ agreedRPMA: v })}
            ribbon="STEP 5 OF 7 · SOLO / PARTIAL"
            heading="Random Player Matchmaking Agreement"
            subhead="Required for any registration that isn't a full 6-person team."
          />
        )}
        {step === 5 && isFullTeam && <StepCaptain data={data} set={set} />}
        {step === 6 && (
          <StepTOS
            tos={BROADCAST_TOS}
            agreed={data.agreedBroadcastTOS}
            onChange={(v) => set({ agreedBroadcastTOS: v })}
            ribbon="STEP 6 OF 7"
            heading="Broadcasting & Media Release"
            subhead="The tournament will be broadcast. This is your media release."
          />
        )}
        {step === 7 && (
          <StepPayment
            data={data}
            onSuccess={() => onComplete(data)}
          />
        )}
      </div>

      {step !== 7 && (
        <div className="mt-10 flex items-center justify-between gap-4">
          <button
            onClick={prev}
            className="font-mono text-sm text-[#c8c2b3] hover:text-yellow-400 flex items-center gap-1.5"
          >
            <ChevronLeft className="w-4 h-4" /> {step === 1 ? "BACK" : "PREVIOUS"}
          </button>
          <button
            onClick={next}
            disabled={!stepIsValid}
            className={`font-display px-7 py-3 border-2 transition-all flex items-center gap-2 ${
              stepIsValid
                ? "bg-yellow-400 text-black border-yellow-400 hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[4px_4px_0_0_#ef4444] cursor-pointer"
                : "bg-transparent text-[#6b7280] border-[#6b7280] cursor-not-allowed"
            }`}
          >
            CONTINUE <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </main>
  );
}

function ProgressBar({ step, total }) {
  return (
    <div className="mt-6">
      <div className="flex items-center justify-between font-mono text-[11px] text-[#c8c2b3] mb-2">
        <span>STEP {String(step).padStart(2, "0")} / {String(total).padStart(2, "0")}</span>
        <span className="text-yellow-400">REGISTRATION</span>
      </div>
      <div className="h-1 bg-[#131a2a] relative overflow-hidden">
        <div
          className="absolute inset-y-0 left-0 bg-yellow-400 transition-all duration-500"
          style={{ width: `${(step / total) * 100}%` }}
        />
      </div>
    </div>
  );
}

function BackButton({ onClick, label = "Back" }) {
  return (
    <button
      onClick={onClick}
      className="font-mono text-xs text-[#c8c2b3] hover:text-yellow-400 flex items-center gap-1.5 tracking-wider"
    >
      <ChevronLeft className="w-4 h-4" /> {label.toUpperCase()}
    </button>
  );
}

/* ────────────────────── STEP 1: BASIC INFO ────────────────────── */

function StepBasicInfo({ data, set }) {
  const toggleServer = (s) =>
    set({
      servers: data.servers.includes(s)
        ? data.servers.filter((x) => x !== s)
        : [...data.servers, s],
    });

  return (
    <section>
      <Ribbon text="STEP 1 OF 7" />
      <h2 className="font-display text-3xl sm:text-4xl mt-3 mb-2">Who are you?</h2>
      <p className="font-body text-[#c8c2b3] mb-8">
        The basics. We use this to seed brackets and build your team chat.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <Field label="Full Name" required>
          <input
            type="text"
            value={data.fullName}
            onChange={(e) => set({ fullName: e.target.value })}
            placeholder="Peter Parker"
            className={inputClass}
          />
        </Field>
        <Field label="Discord Username" required hint="e.g. spideysense_24">
          <input
            type="text"
            value={data.discordName}
            onChange={(e) => set({ discordName: e.target.value })}
            placeholder="username"
            className={inputClass}
          />
        </Field>
        <Field label="In-Game Name (IGN)" required>
          <input
            type="text"
            value={data.ign}
            onChange={(e) => set({ ign: e.target.value })}
            placeholder="Your Marvel Rivals IGN"
            className={inputClass}
          />
        </Field>
        <Field label="Current Rank" required>
          <select
            value={data.rank}
            onChange={(e) => set({ rank: e.target.value })}
            className={inputClass}
          >
            <option value="">Select rank…</option>
            {RANKS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <div className="mt-6">
        <Field
          label="Servers You Typically Play On"
          required
          hint="Pick all that apply"
        >
          <div className="flex flex-wrap gap-2 mt-1">
            {SERVERS.map((s) => {
              const active = data.servers.includes(s);
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => toggleServer(s)}
                  className={`font-mono text-xs px-3 py-2 border-2 transition-colors ${
                    active
                      ? "bg-yellow-400 border-yellow-400 text-black"
                      : "bg-transparent border-[#f5f1e8]/20 text-[#c8c2b3] hover:border-yellow-400/60"
                  }`}
                >
                  {s}
                </button>
              );
            })}
          </div>
        </Field>
      </div>

      <div className="mt-6">
        <label className="flex items-start gap-3 cursor-pointer group">
          <input
            type="checkbox"
            checked={data.isStreamer}
            onChange={(e) => set({ isStreamer: e.target.checked })}
            className="mt-1 w-5 h-5 accent-yellow-400 cursor-pointer"
          />
          <span className="font-body text-sm text-[#c8c2b3] group-hover:text-[#f5f1e8]">
            <strong className="text-[#f5f1e8]">I'm a streamer.</strong> I'd like a
            Streamer Badge and to be featured in the Streamer Hub. (You can update
            this later.)
          </span>
        </label>
      </div>
    </section>
  );
}

/* ────────────────────── STEP 4: TEAM TYPE ────────────────────── */

function StepTeamType({ data, set }) {
  const options = [
    {
      key: "solo",
      title: "Solo Player",
      sub: "I'm flying in alone — match me with a team.",
      icon: User,
    },
    {
      key: "partial",
      title: "Partial Team (2–5)",
      sub: "We've got a stack but need fills to hit 6.",
      icon: Users,
    },
    {
      key: "full",
      title: "Full Team of 6",
      sub: "We're locked, loaded, and rolling deep.",
      icon: Crown,
    },
  ];
  return (
    <section>
      <Ribbon text="STEP 4 OF 7" />
      <h2 className="font-display text-3xl sm:text-4xl mt-3 mb-2">How are you rolling?</h2>
      <p className="font-body text-[#c8c2b3] mb-8">
        This determines what extra agreements you'll need to sign and whether
        you submit a team name.
      </p>
      <div className="grid grid-cols-1 gap-4">
        {options.map((o) => {
          const Icon = o.icon;
          const active = data.teamType === o.key;
          return (
            <button
              key={o.key}
              onClick={() => set({ teamType: o.key })}
              className={`text-left p-5 border-2 transition-all flex items-start gap-4 ${
                active
                  ? "border-yellow-400 bg-yellow-400/10"
                  : "border-[#f5f1e8]/15 bg-[#131a2a] hover:border-yellow-400/50"
              }`}
            >
              <div
                className={`flex-shrink-0 p-2.5 ${
                  active ? "bg-yellow-400 text-black" : "bg-[#0a0e1a] text-[#c8c2b3]"
                }`}
              >
                <Icon className="w-6 h-6" />
              </div>
              <div className="flex-1">
                <div className="font-display text-xl mb-0.5">{o.title}</div>
                <div className="font-body text-sm text-[#c8c2b3]">{o.sub}</div>
              </div>
              <div
                className={`w-5 h-5 border-2 flex-shrink-0 mt-1 flex items-center justify-center ${
                  active ? "bg-yellow-400 border-yellow-400" : "border-[#f5f1e8]/40"
                }`}
              >
                {active && <Check className="w-3.5 h-3.5 text-black" strokeWidth={4} />}
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}

/* ────────────────────── STEP 5 (full team): CAPTAIN ────────────────────── */

function StepCaptain({ data, set }) {
  return (
    <section>
      <Ribbon text="STEP 5 OF 7 · TEAM CAPTAIN" />
      <h2 className="font-display text-3xl sm:text-4xl mt-3 mb-2">
        You're the captain now.
      </h2>
      <p className="font-body text-[#c8c2b3] mb-8">
        Full teams need a designated point of contact. That's you. Read the
        responsibility statement carefully — captains are the first line for any
        team conduct issues.
      </p>

      <div className="border-2 border-yellow-400/40 bg-[#131a2a] p-6 mb-6">
        <div className="flex items-start gap-3">
          <ShieldCheck className="w-6 h-6 text-yellow-400 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="font-display text-lg mb-2">Captain Responsibility</h3>
            <p className="font-body text-sm text-[#c8c2b3] leading-relaxed mb-3">
              As Team Captain you are the primary point of contact between your
              roster and Tournament Organizers. You will be held responsible{" "}
              <span className="text-yellow-300">first</span> for any disruptive,
              behavioral, or rules-violation issues originating from your team.
              This includes communicating with mods, ensuring your roster checks in
              on time, and reporting unsportsmanlike conduct per the Casual TOS.
            </p>
            <label className="flex items-start gap-3 cursor-pointer group mt-3">
              <input
                type="checkbox"
                checked={data.confirmedCaptain}
                onChange={(e) => set({ confirmedCaptain: e.target.checked })}
                className="mt-1 w-5 h-5 accent-yellow-400 cursor-pointer"
              />
              <span className="font-body text-sm text-[#f5f1e8]">
                I confirm I am the Team Captain for this roster.
              </span>
            </label>
            <label className="flex items-start gap-3 cursor-pointer group mt-2">
              <input
                type="checkbox"
                checked={data.acknowledgedCaptainResponsibility}
                onChange={(e) =>
                  set({ acknowledgedCaptainResponsibility: e.target.checked })
                }
                className="mt-1 w-5 h-5 accent-yellow-400 cursor-pointer"
              />
              <span className="font-body text-sm text-[#f5f1e8]">
                I acknowledge that I am held responsible first for any disruptive
                or behavioral issues within my team.
              </span>
            </label>
          </div>
        </div>
      </div>

      <Field label="Team Name" required hint="2 characters minimum">
        <input
          type="text"
          value={data.teamName}
          onChange={(e) => set({ teamName: e.target.value })}
          placeholder="e.g. Nova Praetors"
          className={inputClass}
          maxLength={48}
        />
      </Field>

      <div className="mt-4 border-l-4 border-yellow-400 bg-yellow-400/5 p-4">
        <div className="flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-yellow-400 flex-shrink-0 mt-0.5" />
          <p className="font-body text-xs text-[#c8c2b3] leading-relaxed">
            <strong className="text-yellow-300">Heads up:</strong> All team names
            are reviewed by Tournament Organizers. If your name doesn't meet the
            event's name regulations, we'll reach out to you directly to request a
            change before brackets are seeded.
          </p>
        </div>
      </div>
    </section>
  );
}

/* ────────────────────── TOS COMPONENT ────────────────────── */

function StepTOS({ tos, agreed, onChange, ribbon, heading, subhead }) {
  return (
    <section>
      <Ribbon text={ribbon} />
      <h2 className="font-display text-3xl sm:text-4xl mt-3 mb-2">{heading}</h2>
      <p className="font-body text-[#c8c2b3] mb-6">{subhead}</p>

      <div className="border-2 border-[#f5f1e8]/15 bg-[#131a2a] p-6 mb-5">
        <div className="flex items-center justify-between mb-4 pb-3 border-b border-[#f5f1e8]/10">
          <h3 className="font-display text-lg">{tos.title}</h3>
          <span className="font-mono text-[10px] text-yellow-400 bg-black/40 px-2 py-1">
            {tos.version}
          </span>
        </div>
        <ul className="space-y-3">
          {tos.bullets.map((b, i) => (
            <li key={i} className="flex items-start gap-3 font-body text-sm text-[#c8c2b3] leading-relaxed">
              <span className="font-mono text-yellow-400 text-xs mt-0.5">
                {String(i + 1).padStart(2, "0")}
              </span>
              <span>{b}</span>
            </li>
          ))}
        </ul>
        <p className="font-mono text-[10px] text-[#6b7280] mt-5 pt-3 border-t border-[#f5f1e8]/10">
          Summary above is for screen readability. The full PDF is the authoritative document.
        </p>
      </div>

      <label className="flex items-start gap-3 cursor-pointer group p-4 border-2 border-dashed border-yellow-400/40 hover:border-yellow-400 transition-colors">
        <input
          type="checkbox"
          checked={agreed}
          onChange={(e) => onChange(e.target.checked)}
          className="mt-1 w-5 h-5 accent-yellow-400 cursor-pointer flex-shrink-0"
        />
        <span className="font-body text-sm text-[#f5f1e8]">
          I have read and agree to the{" "}
          <strong className="text-yellow-300">{tos.title}</strong>.
        </span>
      </label>
    </section>
  );
}

/* ────────────────────── STEP 7: PAYMENT ────────────────────── */

function StepPayment({ data, onSuccess }) {
  const [status, setStatus] = useState("idle"); // idle | redirecting | success | error
  const isFullTeam = data.teamType === "full";

  // PLACEHOLDER PAYPAL HANDOFF
  // In production this should POST registration to your backend, get back a
  // PayPal order ID, then either redirect to PayPal or render the official
  // PayPal Buttons (https://developer.paypal.com/sdk/js/).
  //
  // Right now: simulates a 1.4s PayPal redirect, then logs the registration
  // to the Google Sheet via Apps Script (see submitRegistration.js).
  const handlePay = async () => {
    setStatus("redirecting");
    await new Promise((r) => setTimeout(r, 1400));

    // Log registration to Google Sheet. Failure here doesn't block success —
    // worst case the organizer reconciles from PayPal records.
    const result = await submitRegistration({
      ...data,
      paymentStatus: "paid_mock", // change to "paid" once real PayPal is wired
    });
    if (!result.ok) {
      console.warn("Sheet submission failed but continuing:", result.error);
    }

    setStatus("success");
    setTimeout(onSuccess, 1100);
  };

  return (
    <section>
      <Ribbon text="STEP 7 OF 7 · PAYMENT" />
      <h2 className="font-display text-3xl sm:text-4xl mt-3 mb-2">Entry Fee</h2>
      <p className="font-body text-[#c8c2b3] mb-8">
        Secure checkout via PayPal. Refund eligibility follows the Tournament TOS
        you just agreed to.
      </p>

      <div className="border-2 border-yellow-400 bg-[#131a2a] p-6 mb-6">
        <div className="flex items-center justify-between mb-4 pb-4 border-b border-[#f5f1e8]/10">
          <div>
            <div className="font-mono text-xs text-[#c8c2b3] mb-1">REGISTRATION TYPE</div>
            <div className="font-display text-xl">
              {data.teamType === "solo" && "Solo Player"}
              {data.teamType === "partial" && "Partial Team (2–5)"}
              {data.teamType === "full" && `Full Team — ${data.teamName}`}
            </div>
          </div>
          <div className="text-right">
            <div className="font-mono text-xs text-[#c8c2b3] mb-1">TOTAL</div>
            <div className="font-display text-3xl text-yellow-400">${ENTRY_FEE_USD}</div>
          </div>
        </div>
        <div className="space-y-2 font-body text-sm text-[#c8c2b3]">
          <Row k="Player" v={data.fullName} />
          <Row k="Discord" v={data.discordName} />
          <Row k="IGN" v={data.ign} />
          <Row k="Rank" v={data.rank} />
          <Row k="Servers" v={data.servers.join(", ")} />
        </div>
      </div>

      <button
        onClick={handlePay}
        disabled={status !== "idle"}
        className={`w-full font-display text-lg py-4 border-2 transition-all flex items-center justify-center gap-3 ${
          status === "idle"
            ? "bg-yellow-400 text-black border-yellow-400 hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[4px_4px_0_0_#ef4444] cursor-pointer"
            : "bg-[#131a2a] text-[#c8c2b3] border-[#c8c2b3] cursor-wait"
        }`}
      >
        {status === "idle" && (
          <>
            <CreditCard className="w-5 h-5" /> PAY WITH PAYPAL · ${ENTRY_FEE_USD}
          </>
        )}
        {status === "redirecting" && (
          <>
            <Lock className="w-5 h-5 animate-pulse" /> CONNECTING TO PAYPAL…
          </>
        )}
        {status === "success" && (
          <>
            <Check className="w-5 h-5" /> REGISTRATION COMPLETE
          </>
        )}
      </button>

      <p className="font-mono text-[10px] text-[#6b7280] mt-4 text-center">
        🔒 Payments processed securely via PayPal. We never see your card details.
      </p>

      <div className="mt-8 border-l-4 border-yellow-400/60 bg-yellow-400/5 p-4 font-mono text-[11px] text-[#c8c2b3] leading-relaxed">
        DEV NOTE: this button currently runs a mock PayPal handoff. Wire the
        PayPal JS SDK <code className="text-yellow-300">@paypal/react-paypal-js</code>{" "}
        in here, or POST to <code className="text-yellow-300">/api/register</code> →{" "}
        <code className="text-yellow-300">/api/paypal/create-order</code> on the
        backend before going live.
      </div>
    </section>
  );
}

function Row({ k, v }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-[#6b7280] font-mono text-xs uppercase tracking-wider">{k}</span>
      <span className="text-right truncate">{v || "—"}</span>
    </div>
  );
}

/* ────────────────────── SHARED PRIMITIVES ────────────────────── */

const inputClass =
  "w-full bg-[#0a0e1a] border-2 border-[#f5f1e8]/15 text-[#f5f1e8] px-3 py-2.5 font-body text-sm focus:outline-none focus:border-yellow-400 transition-colors placeholder:text-[#6b7280]";

function Field({ label, required, hint, children }) {
  return (
    <label className="block">
      <div className="flex items-baseline justify-between mb-1.5">
        <span className="font-mono text-[11px] text-[#c8c2b3] tracking-widest uppercase">
          {label}
          {required && <span className="text-yellow-400 ml-1">*</span>}
        </span>
        {hint && <span className="font-mono text-[10px] text-[#6b7280]">{hint}</span>}
      </div>
      {children}
    </label>
  );
}

function Ribbon({ text }) {
  return (
    <div className="inline-block bg-yellow-400 text-black font-mono text-[11px] tracking-widest px-3 py-1">
      {text}
    </div>
  );
}

function SubmissionToast({ data, onDismiss }) {
  useEffect(() => {
    const t = setTimeout(onDismiss, 6500);
    return () => clearTimeout(t);
  }, [onDismiss]);
  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 max-w-md w-[92%] slide-up">
      <div className="bg-yellow-400 text-black border-2 border-black p-4 shadow-[6px_6px_0_0_#ef4444]">
        <div className="flex items-start gap-3">
          <Check className="w-5 h-5 flex-shrink-0 mt-0.5" strokeWidth={3} />
          <div className="font-body text-sm">
            <div className="font-display text-base mb-1">YOU'RE IN.</div>
            <div>
              {data.fullName}, your registration was received. Check your Discord
              DMs from a Tournament Mod within 24 hours.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
