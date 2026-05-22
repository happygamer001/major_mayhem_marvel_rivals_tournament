import { useState, useEffect } from "react";
import SiteFooter from "./Footer.jsx";

/**
 * /streamers — public Streamer Hub page.
 *
 * Sections:
 *   1. Hero with tagline + upper-right SIGN UP CTA
 *   2. Featured streamers carousel (auto-rotates if >1 featured)
 *   3. Featured clips grid (Twitch embeds with attribution)
 *   4. Full streamer directory (all approved)
 *
 * Signup flow: Discord OAuth (return_to=streamers) → form modal → POST to
 * /api/streamers/submit → status "pending" until mod approves.
 *
 * Polls /api/streamers and /api/clips every 60s (less frequent than bracket
 * since this data changes much slower).
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
  @keyframes carousel-fade {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
  }
`;

/**
 * Parse a Twitch clip URL and extract the clip slug.
 * Handles multiple URL formats:
 *   - https://clips.twitch.tv/SLUG
 *   - https://clips.twitch.tv/SLUG?parameter=...
 *   - https://www.twitch.tv/CHANNEL/clip/SLUG
 *   - https://m.twitch.tv/clip/SLUG
 * Returns null if the URL doesn't look like a Twitch clip.
 */
function parseClipSlug(url) {
  if (!url || typeof url !== "string") return null;
  const cleanUrl = url.trim();

  // Format 1: clips.twitch.tv/SLUG
  let match = cleanUrl.match(/clips\.twitch\.tv\/([A-Za-z0-9_-]+)/);
  if (match) return match[1];

  // Format 2: twitch.tv/SOMETHING/clip/SLUG (with or without www/m subdomain)
  match = cleanUrl.match(/twitch\.tv\/[^\/]+\/clip\/([A-Za-z0-9_-]+)/);
  if (match) return match[1];

  // Format 3: twitch.tv/clip/SLUG (no channel name)
  match = cleanUrl.match(/twitch\.tv\/clip\/([A-Za-z0-9_-]+)/);
  if (match) return match[1];

  return null;
}

export default function StreamersPage() {
  const [streamers, setStreamers] = useState(null);
  const [clips, setClips] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [signupOpen, setSignupOpen] = useState(false);
  const [authToken, setAuthToken] = useState(null);
  const [discordIdentity, setDiscordIdentity] = useState(null);
  const [featuredIdx, setFeaturedIdx] = useState(0);

  // Pick up auth token if returning from Discord OAuth
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
      window.history.replaceState({}, "", "/streamers");
      // Auto-open the signup modal since they came back specifically to sign up
      setSignupOpen(true);
    }
  }, []);

  // Fetch data
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const [sRes, cRes] = await Promise.all([
          fetch("/api/streamers"),
          fetch("/api/clips"),
        ]);
        const sData = await sRes.json();
        const cData = await cRes.json();
        if (cancelled) return;
        if (!sData.ok) {
          setError(String(sData.error || "Could not load streamers."));
          setLoading(false);
          return;
        }
        setStreamers(Array.isArray(sData.streamers) ? sData.streamers : []);
        setClips(cData.ok && Array.isArray(cData.clips) ? cData.clips : []);
        setError(null);
        setLoading(false);
      } catch (err) {
        if (cancelled) return;
        setError("Network error loading hub.");
        setLoading(false);
      }
    };
    load();
    const interval = setInterval(load, 60000); // 60s polling
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  // Featured streamer carousel auto-advance
  const featuredStreamers = streamers
    ? streamers.filter((s) => s.featured)
    : [];
  useEffect(() => {
    if (featuredStreamers.length <= 1) return;
    const interval = setInterval(() => {
      setFeaturedIdx((idx) => (idx + 1) % featuredStreamers.length);
    }, 5000);
    return () => clearInterval(interval);
  }, [featuredStreamers.length]);

  // Featured clips: marked Featured=Yes; fallback to most recent if none featured
  const featuredClips = clips ? clips.filter((c) => c.featured) : [];
  const displayedClips =
    featuredClips.length > 0 ? featuredClips : clips ? clips.slice(0, 6) : [];

  const handleSignupClick = () => {
    if (authToken) {
      setSignupOpen(true);
    } else {
      // Send to Discord OAuth, return_to=streamers
      window.location.href = "/api/discord/auth?return_to=streamers";
    }
  };

  return (
    <div className="font-body min-h-screen w-full bg-[#0a0e1a] text-[#f5f1e8] relative overflow-hidden">
      <style>{FONT_STYLES}</style>
      <div className="absolute inset-0 halftone pointer-events-none" />

      <div className="fixed top-0 right-0 z-40 pointer-events-none select-none">
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
        <main className="max-w-6xl mx-auto px-4 sm:px-8 pt-12 pb-24">
          <div className="flex items-start justify-between gap-4 mb-6 flex-wrap">
            <button
              onClick={() => {
                window.location.href = "/";
              }}
              className="font-mono text-xs text-[#c8c2b3] hover:text-yellow-400 tracking-wider"
            >
              ← BACK TO HOME
            </button>
            <button
              onClick={handleSignupClick}
              className="font-display text-sm bg-yellow-400 text-black border-2 border-yellow-400 hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[4px_4px_0_0_#ef4444] px-4 py-2 transition-all"
            >
              SIGN UP TO STREAM
            </button>
          </div>

          <header className="mb-10">
            <div className="font-mono text-xs text-yellow-400 mb-2 tracking-widest">
              / / STREAMER HUB
            </div>
            <h1
              className="font-display text-4xl sm:text-5xl text-[#f5f1e8] mb-4"
              style={{ textShadow: "3px 3px 0 #facc15, 6px 6px 0 #ef4444" }}
            >
              CONTENT
              <br />
              <span className="text-yellow-400">CREATORS</span>
            </h1>
            <p className="font-body text-[#c8c2b3] max-w-2xl text-base">
              Looking for the greatest small streamers in the Marvel Rivals
              universe. Cover the Lattice Open, build your audience, and
              connect with the community.
            </p>
          </header>

          {loading && (
            <div className="font-mono text-sm text-[#c8c2b3] animate-pulse">
              Loading hub…
            </div>
          )}

          {!loading && error && (
            <div className="border-l-4 border-red-500 bg-red-500/10 p-4 max-w-xl">
              <div className="font-display text-lg mb-1">Hub unavailable</div>
              <p className="font-body text-sm text-red-300">{String(error)}</p>
            </div>
          )}

          {!loading && !error && streamers && (
            <>
              {/* Featured streamers carousel */}
              {featuredStreamers.length > 0 && (
                <FeaturedBanner
                  streamers={featuredStreamers}
                  currentIdx={featuredIdx % featuredStreamers.length}
                />
              )}

              {/* Featured clips */}
              {displayedClips.length > 0 && (
                <section className="mb-12">
                  <h2 className="font-display text-2xl mb-4 text-[#f5f1e8]">
                    {featuredClips.length > 0 ? "Featured Clips" : "Recent Clips"}
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {displayedClips.slice(0, 6).map((clip, i) => (
                      <ClipCard key={String(clip.clipUrl) + i} clip={clip} />
                    ))}
                  </div>
                </section>
              )}

              {/* Full directory */}
              <section>
                <h2 className="font-display text-2xl mb-4 text-[#f5f1e8]">
                  All Streamers
                  <span className="ml-2 font-mono text-sm text-[#6b7280]">
                    {streamers.length}
                  </span>
                </h2>
                {streamers.length === 0 ? (
                  <div className="border-2 border-yellow-400/30 bg-[#131a2a] p-6 max-w-xl">
                    <p className="font-body text-[#c8c2b3] mb-3">
                      No streamers yet. Be the first.
                    </p>
                    <button
                      onClick={handleSignupClick}
                      className="font-mono text-xs px-3 py-2 border border-yellow-400 text-yellow-400 hover:bg-yellow-400 hover:text-black"
                    >
                      SIGN UP TO STREAM
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                    {streamers.map((s) => (
                      <DirectoryCard key={String(s.discordId)} streamer={s} />
                    ))}
                  </div>
                )}
              </section>
            </>
          )}
        </main>
      </div>

      <SiteFooter mode="fixed" />

      {signupOpen && (
        <SignupModal
          authToken={authToken}
          identity={discordIdentity}
          onClose={() => setSignupOpen(false)}
          onSuccess={() => {
            setSignupOpen(false);
            // Reload data to reflect any cached version (will still show as pending until mod approves, so the user won't see themselves yet)
          }}
        />
      )}
    </div>
  );
}

/* ────────────────── FEATURED CAROUSEL ────────────────── */

function FeaturedBanner({ streamers, currentIdx }) {
  const current = streamers[currentIdx] || streamers[0];
  if (!current) return null;
  return (
    <section className="mb-12">
      <div className="font-mono text-[11px] text-yellow-300 tracking-widest mb-3">
        ★ FEATURED STREAMERS
      </div>
      <a
        href={String(current.twitchUrl || "#")}
        target="_blank"
        rel="noopener noreferrer"
        className="block border-2 border-yellow-400 bg-gradient-to-r from-yellow-400/25 via-yellow-400/10 to-transparent p-6 sm:p-8 transition-all hover:translate-x-[-3px] hover:translate-y-[-3px] hover:shadow-[6px_6px_0_0_#ef4444]"
      >
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <div
              className="font-display text-3xl sm:text-4xl text-yellow-400 mb-1"
              style={{ textShadow: "2px 2px 0 #ef4444, 4px 4px 0 #000" }}
            >
              {String(current.streamerName || "—")}
            </div>
            <div className="flex items-center gap-2 mb-2">
              {current.familyFriendly && (
                <span className="font-mono text-[9px] tracking-widest px-2 py-0.5 bg-green-400/15 text-green-300 border border-green-400/40">
                  FAMILY FRIENDLY
                </span>
              )}
            </div>
            <div className="font-mono text-xs text-[#c8c2b3] truncate max-w-xs">
              {String(current.twitchUrl || "")}
            </div>
          </div>
          <div className="font-display text-lg text-[#f5f1e8] bg-[#0a0e1a]/60 border border-yellow-400/40 px-4 py-2">
            ▶ WATCH
          </div>
        </div>
      </a>
      {streamers.length > 1 && (
        <div className="flex justify-center gap-2 mt-3">
          {streamers.map((_, i) => (
            <span
              key={i}
              className={`block w-2 h-2 rounded-full transition-colors ${
                i === currentIdx ? "bg-yellow-400" : "bg-[#f5f1e8]/20"
              }`}
            />
          ))}
        </div>
      )}
    </section>
  );
}

/* ────────────────── CLIP CARD ────────────────── */

function ClipCard({ clip }) {
  const slug = parseClipSlug(clip.clipUrl);
  const parent =
    typeof window !== "undefined" ? window.location.hostname : "localhost";
  const embedUrl = slug
    ? `https://clips.twitch.tv/embed?clip=${encodeURIComponent(
        slug
      )}&parent=${encodeURIComponent(parent)}`
    : null;

  return (
    <div className="border-2 border-[#f5f1e8]/15 bg-[#131a2a] overflow-hidden">
      {embedUrl ? (
        <div className="relative" style={{ paddingBottom: "56.25%" }}>
          <iframe
            src={embedUrl}
            title={String(clip.caption || "Clip")}
            allowFullScreen
            className="absolute inset-0 w-full h-full"
            sandbox="allow-scripts allow-same-origin allow-popups"
          />
        </div>
      ) : (
        <div className="aspect-video bg-[#0a0e1a] flex items-center justify-center">
          <a
            href={String(clip.clipUrl)}
            target="_blank"
            rel="noopener noreferrer"
            className="font-mono text-xs text-yellow-400 hover:text-yellow-300 underline"
          >
            Watch on Twitch →
          </a>
        </div>
      )}
      <div className="p-3">
        {clip.caption && (
          <div className="text-sm text-[#f5f1e8] mb-2 leading-snug">
            {String(clip.caption)}
          </div>
        )}
        <div className="font-mono text-[10px] text-[#c8c2b3]">
          by{" "}
          {clip.streamerTwitchUrl ? (
            <a
              href={String(clip.streamerTwitchUrl)}
              target="_blank"
              rel="noopener noreferrer"
              className="text-yellow-400 hover:text-yellow-300 underline"
            >
              {String(clip.streamerName || "Unknown")}
            </a>
          ) : (
            <span>{String(clip.streamerName || "Unknown")}</span>
          )}
        </div>
      </div>
    </div>
  );
}

/* ────────────────── DIRECTORY CARD ────────────────── */

function DirectoryCard({ streamer }) {
  return (
    <a
      href={String(streamer.twitchUrl || "#")}
      target="_blank"
      rel="noopener noreferrer"
      className="border-2 border-[#f5f1e8]/15 bg-[#131a2a] p-3 transition-all hover:border-yellow-400 hover:translate-x-[-1px] hover:translate-y-[-1px] block"
    >
      <div className="flex items-center justify-between gap-2 mb-1">
        <div className="font-display text-base text-[#f5f1e8] truncate">
          {String(streamer.streamerName || "—")}
        </div>
        {streamer.featured && (
          <span className="font-mono text-[8px] text-yellow-300" title="Featured">
            ★
          </span>
        )}
      </div>
      <div className="font-mono text-[10px] text-[#c8c2b3] truncate">
        {String(streamer.twitchUrl || "")}
      </div>
      {streamer.familyFriendly && (
        <div className="mt-2">
          <span className="font-mono text-[8px] tracking-widest px-1.5 py-0.5 bg-green-400/15 text-green-300 border border-green-400/30">
            FAMILY FRIENDLY
          </span>
        </div>
      )}
    </a>
  );
}

/* ────────────────── SIGNUP MODAL ────────────────── */

function SignupModal({ authToken, identity, onClose, onSuccess }) {
  const [streamerName, setStreamerName] = useState(identity?.username || "");
  const [twitchUrl, setTwitchUrl] = useState("");
  const [familyFriendly, setFamilyFriendly] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  // Close on Escape
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape" && !submitting) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, submitting]);

  const trimmedUrl = twitchUrl.trim();
  const urlValid = trimmedUrl && /^https?:\/\//i.test(trimmedUrl);
  const nameValid = streamerName.trim().length >= 2;
  const canSubmit = !submitting && nameValid && urlValid;

  const handleSubmit = async () => {
    setError("");
    setSubmitting(true);
    try {
      const res = await fetch("/api/streamers/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          authToken,
          streamerName: streamerName.trim(),
          twitchUrl: trimmedUrl,
          familyFriendly,
        }),
      });
      const result = await res.json();
      if (!result.ok) {
        setError(String(result.error || "Submission failed."));
        setSubmitting(false);
        return;
      }
      setSuccess(true);
      setSubmitting(false);
      // Auto-close after a beat
      setTimeout(() => {
        if (typeof onSuccess === "function") onSuccess();
      }, 2000);
    } catch (err) {
      setError("Network error. Try again.");
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      onClick={() => !submitting && onClose()}
    >
      <div
        className="bg-[#131a2a] border-2 border-yellow-400/30 max-w-md w-full p-6 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4 pb-3 border-b border-[#f5f1e8]/15">
          <h3 className="font-display text-lg text-[#f5f1e8]">
            Streamer Application
          </h3>
          <button
            onClick={onClose}
            disabled={submitting}
            className="text-[#c8c2b3] hover:text-yellow-400 disabled:opacity-50"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {success ? (
          <div className="text-center py-8">
            <div className="font-display text-2xl text-yellow-400 mb-2">
              Submitted!
            </div>
            <p className="font-body text-sm text-[#c8c2b3]">
              Your application is pending mod review. You'll appear on the hub
              once approved.
            </p>
          </div>
        ) : (
          <>
            <div className="mb-4 text-sm text-[#c8c2b3] leading-relaxed">
              Signed in as{" "}
              <span className="font-mono text-yellow-300">
                @{String(identity?.username || "—")}
              </span>
              . Your application will be sent to mods for approval.
            </div>

            <div className="font-mono text-[11px] text-[#c8c2b3] mb-1">
              STREAMER NAME
            </div>
            <input
              type="text"
              value={streamerName}
              onChange={(e) => setStreamerName(e.target.value)}
              placeholder="Your channel display name"
              maxLength={60}
              className="w-full bg-[#0a0e1a] border-2 border-[#f5f1e8]/15 text-[#f5f1e8] px-3 py-2 font-mono text-sm focus:outline-none focus:border-yellow-400 mb-4"
            />

            <div className="font-mono text-[11px] text-[#c8c2b3] mb-1">
              TWITCH URL
            </div>
            <input
              type="url"
              value={twitchUrl}
              onChange={(e) => setTwitchUrl(e.target.value)}
              placeholder="https://twitch.tv/your_channel"
              className="w-full bg-[#0a0e1a] border-2 border-[#f5f1e8]/15 text-[#f5f1e8] px-3 py-2 font-mono text-sm focus:outline-none focus:border-yellow-400 mb-2"
            />
            {twitchUrl && !urlValid && (
              <div className="font-mono text-[11px] text-red-300 mb-3">
                URL must start with http:// or https://
              </div>
            )}

            <label className="flex items-start gap-2 cursor-pointer mt-4 select-none">
              <input
                type="checkbox"
                checked={familyFriendly}
                onChange={(e) => setFamilyFriendly(e.target.checked)}
                className="mt-1 accent-yellow-400"
              />
              <span className="text-sm text-[#f5f1e8]">
                <span className="font-semibold">Family-friendly content</span>
                <span className="block text-[11px] text-[#c8c2b3] mt-0.5 leading-snug">
                  Tick if your stream is suitable for younger audiences (no
                  adult themes, restricted language, etc.).
                </span>
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
                {submitting ? "SUBMITTING…" : "SUBMIT"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
