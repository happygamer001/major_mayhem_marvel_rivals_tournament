import { useState, useEffect, useRef } from "react";
import SiteFooter from "./Footer.jsx";
import AdminLink from "./AdminLink.jsx";

/**
 * /sponsors — public Sponsors page.
 *
 * Sections:
 *   1. Hero header
 *   2. Title sponsor(s) — large prominent cards
 *   3. Partners — grid of smaller cards
 *   4. "Become a Sponsor" inquiry form (no auth, Turnstile-gated)
 *
 * Built defensively (String() coercion, no useMemo, inline rendering).
 * Polls /api/sponsors every 120s — sponsor data changes very rarely.
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

const TURNSTILE_SITE_KEY =
  (typeof import.meta !== "undefined" &&
    import.meta.env &&
    import.meta.env.VITE_TURNSTILE_SITE_KEY) ||
  "";

export default function SponsorsPage() {
  const [sponsors, setSponsors] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch("/api/sponsors");
        const result = await res.json();
        if (cancelled) return;
        if (!result.ok) {
          setError(String(result.error || "Could not load sponsors."));
          setLoading(false);
          return;
        }
        setSponsors(Array.isArray(result.sponsors) ? result.sponsors : []);
        setError(null);
        setLoading(false);
      } catch (err) {
        if (cancelled) return;
        setError("Network error loading sponsors.");
        setLoading(false);
      }
    };
    load();
    const interval = setInterval(load, 120000); // 2 min polling
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  // Split sponsors by tier — inline, no useMemo
  const titleSponsors = sponsors
    ? sponsors.filter((s) => s.tier === "title")
    : [];
  const partnerSponsors = sponsors
    ? sponsors.filter((s) => s.tier !== "title")
    : [];

  const scrollToForm = () => {
    const el = document.getElementById("become-a-sponsor");
    if (el) el.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div className="font-body min-h-screen w-full bg-[#0a0e1a] text-[#f5f1e8] relative overflow-hidden">
      <style>{FONT_STYLES}</style>
      <div className="absolute inset-0 halftone pointer-events-none" />

      <AdminLink />

      {/* Under-construction tape */}
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
        <main className="max-w-5xl mx-auto px-4 sm:px-8 pt-12 pb-24">
          <button
            onClick={() => {
              window.location.href = "/";
            }}
            className="font-mono text-xs text-[#c8c2b3] hover:text-yellow-400 mb-6 tracking-wider"
          >
            ← BACK TO HOME
          </button>

          <header className="mb-10">
            <div className="font-mono text-xs text-yellow-400 mb-2 tracking-widest">
              / / PARTNERS
            </div>
            <h1
              className="font-display text-4xl sm:text-5xl text-[#f5f1e8] mb-4"
              style={{ textShadow: "3px 3px 0 #facc15, 6px 6px 0 #ef4444" }}
            >
              THE
              <br />
              <span className="text-yellow-400">SPONSORS</span>
            </h1>
            <p className="font-body text-[#c8c2b3] max-w-2xl text-base mb-4">
              Thanks to the partners making the Lattice Open possible. Want to
              see your brand here?
            </p>
            <button
              onClick={scrollToForm}
              className="font-display text-sm bg-yellow-400 text-black border-2 border-yellow-400 hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[4px_4px_0_0_#ef4444] px-4 py-2 transition-all"
            >
              BECOME A SPONSOR ↓
            </button>
          </header>

          {loading && (
            <div className="font-mono text-sm text-[#c8c2b3] animate-pulse">
              Loading sponsors…
            </div>
          )}

          {!loading && error && (
            <div className="border-l-4 border-red-500 bg-red-500/10 p-4 max-w-xl">
              <div className="font-display text-lg mb-1">
                Sponsors unavailable
              </div>
              <p className="font-body text-sm text-red-300">{String(error)}</p>
            </div>
          )}

          {!loading && !error && sponsors && (
            <>
              {/* Title sponsors */}
              {titleSponsors.length > 0 && (
                <section className="mb-12">
                  <TierHeading>TITLE SPONSOR</TierHeading>
                  <div className="space-y-4">
                    {titleSponsors.map((s, i) => (
                      <TitleSponsorCard key={String(s.name) + i} sponsor={s} />
                    ))}
                  </div>
                </section>
              )}

              {/* Partner sponsors */}
              {partnerSponsors.length > 0 && (
                <section className="mb-12">
                  <TierHeading>PARTNERS</TierHeading>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                    {partnerSponsors.map((s, i) => (
                      <PartnerCard key={String(s.name) + i} sponsor={s} />
                    ))}
                  </div>
                </section>
              )}

              {/* Empty state */}
              {sponsors.length === 0 && (
                <div className="border-2 border-yellow-400/30 bg-[#131a2a] p-8 max-w-xl mb-12">
                  <div className="font-display text-2xl mb-2">
                    Sponsorship spots open
                  </div>
                  <p className="font-body text-[#c8c2b3]">
                    The Lattice Open is looking for founding partners. Get in
                    touch using the form below.
                  </p>
                </div>
              )}
            </>
          )}

          {/* Become a sponsor form */}
          <InquiryForm />
        </main>
      </div>
      <SiteFooter mode="fixed" />
    </div>
  );
}

/* ────────────────── TIER HEADING ────────────────── */

function TierHeading({ children }) {
  return (
    <div className="flex items-center gap-3 mb-5">
      <div className="h-px flex-1 bg-yellow-400/30" />
      <div className="font-mono text-[11px] text-yellow-300 tracking-widest">
        {children}
      </div>
      <div className="h-px flex-1 bg-yellow-400/30" />
    </div>
  );
}

/* ────────────────── TITLE SPONSOR CARD ────────────────── */

function TitleSponsorCard({ sponsor }) {
  const name = String(sponsor.name || "—");
  const logo = String(sponsor.logoUrl || "");
  const website = String(sponsor.websiteUrl || "");
  const description = String(sponsor.description || "");
  const promoCode = String(sponsor.promoCode || "");
  const promoDetails = String(sponsor.promoDetails || "");

  const inner = (
    <div className="border-2 border-yellow-400 bg-gradient-to-r from-yellow-400/20 via-yellow-400/8 to-transparent p-6 sm:p-8 transition-all hover:translate-x-[-3px] hover:translate-y-[-3px] hover:shadow-[6px_6px_0_0_#ef4444]">
      <div className="flex flex-col sm:flex-row items-center gap-6">
        {logo && (
          <div className="flex-shrink-0 bg-[#0a0e1a]/60 border border-yellow-400/30 p-4 flex items-center justify-center" style={{ minWidth: 180, minHeight: 120 }}>
            <img
              src={logo}
              alt={name + " logo"}
              className="max-h-24 max-w-[200px] object-contain"
              onError={(e) => {
                e.currentTarget.style.display = "none";
              }}
            />
          </div>
        )}
        <div className="flex-1 text-center sm:text-left">
          <div
            className="font-display text-2xl sm:text-3xl text-yellow-400 mb-2"
            style={{ textShadow: "2px 2px 0 #ef4444" }}
          >
            {name}
          </div>
          {description && (
            <p className="font-body text-sm text-[#f5f1e8] mb-3 leading-relaxed">
              {description}
            </p>
          )}
          {promoCode && (
            <div className="inline-block border border-yellow-400/40 bg-[#0a0e1a]/60 px-3 py-1.5 mb-3">
              <span className="font-mono text-xs text-[#c8c2b3]">
                Promo:{" "}
              </span>
              <span className="font-mono text-sm text-yellow-300 font-bold">
                {promoCode}
              </span>
              {promoDetails && (
                <span className="font-mono text-[11px] text-[#c8c2b3] ml-2">
                  {promoDetails}
                </span>
              )}
            </div>
          )}
          {website && (
            <div>
              <span className="font-display text-sm text-[#f5f1e8] bg-[#0a0e1a]/60 border border-yellow-400/40 px-4 py-2 inline-block">
                VISIT SITE →
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  if (website) {
    return (
      <a href={website} target="_blank" rel="noopener noreferrer" className="block">
        {inner}
      </a>
    );
  }
  return inner;
}

/* ────────────────── PARTNER CARD ────────────────── */

function PartnerCard({ sponsor }) {
  const name = String(sponsor.name || "—");
  const logo = String(sponsor.logoUrl || "");
  const website = String(sponsor.websiteUrl || "");
  const description = String(sponsor.description || "");
  const promoCode = String(sponsor.promoCode || "");

  const inner = (
    <div className="border-2 border-[#f5f1e8]/15 bg-[#131a2a] p-4 h-full transition-all hover:border-yellow-400 hover:translate-x-[-1px] hover:translate-y-[-1px]">
      {logo ? (
        <div className="bg-[#0a0e1a]/60 border border-[#f5f1e8]/10 p-3 mb-3 flex items-center justify-center h-24">
          <img
            src={logo}
            alt={name + " logo"}
            className="max-h-16 max-w-full object-contain"
            onError={(e) => {
              e.currentTarget.style.display = "none";
            }}
          />
        </div>
      ) : (
        <div className="bg-[#0a0e1a]/60 border border-[#f5f1e8]/10 p-3 mb-3 flex items-center justify-center h-24">
          <span className="font-display text-lg text-[#f5f1e8]">{name}</span>
        </div>
      )}
      <div className="font-display text-base text-[#f5f1e8] mb-1">{name}</div>
      {description && (
        <p className="font-body text-xs text-[#c8c2b3] mb-2 leading-snug">
          {description}
        </p>
      )}
      {promoCode && (
        <div className="font-mono text-[10px] text-yellow-300 mb-2">
          Promo: <span className="font-bold">{promoCode}</span>
        </div>
      )}
      {website && (
        <div className="font-mono text-[10px] text-yellow-400">VISIT SITE →</div>
      )}
    </div>
  );

  if (website) {
    return (
      <a href={website} target="_blank" rel="noopener noreferrer" className="block h-full">
        {inner}
      </a>
    );
  }
  return inner;
}

/* ────────────────── INQUIRY FORM ────────────────── */

function InquiryForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [interest, setInterest] = useState("Title Sponsor");
  const [budget, setBudget] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState("");
  const turnstileRef = useRef(null);
  const widgetIdRef = useRef(null);

  // Load Turnstile script + render the widget
  useEffect(() => {
    if (!TURNSTILE_SITE_KEY) return; // No captcha configured — skip

    const renderWidget = () => {
      if (
        window.turnstile &&
        turnstileRef.current &&
        widgetIdRef.current === null
      ) {
        widgetIdRef.current = window.turnstile.render(turnstileRef.current, {
          sitekey: TURNSTILE_SITE_KEY,
          callback: (token) => setTurnstileToken(token),
          "expired-callback": () => setTurnstileToken(""),
          "error-callback": () => setTurnstileToken(""),
          theme: "dark",
        });
      }
    };

    if (window.turnstile) {
      renderWidget();
    } else {
      const existing = document.querySelector(
        'script[src*="challenges.cloudflare.com/turnstile"]'
      );
      if (!existing) {
        const script = document.createElement("script");
        script.src =
          "https://challenges.cloudflare.com/turnstile/v0/api.js";
        script.async = true;
        script.defer = true;
        script.onload = renderWidget;
        document.head.appendChild(script);
      } else {
        existing.addEventListener("load", renderWidget);
      }
    }
  }, []);

  const emailValid = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim());
  const nameValid = name.trim().length >= 2;
  const captchaOk = !TURNSTILE_SITE_KEY || !!turnstileToken;
  const canSubmit =
    !submitting && nameValid && emailValid && captchaOk;

  const handleSubmit = async () => {
    setError("");
    setSubmitting(true);
    try {
      const res = await fetch("/api/sponsors/inquiry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          company: company.trim(),
          interest,
          budget: budget.trim(),
          message: message.trim(),
          turnstileToken,
        }),
      });
      const result = await res.json();
      if (!result.ok) {
        setError(String(result.error || "Could not submit inquiry."));
        setSubmitting(false);
        // Reset Turnstile so they can retry
        if (window.turnstile && widgetIdRef.current !== null) {
          window.turnstile.reset(widgetIdRef.current);
          setTurnstileToken("");
        }
        return;
      }
      setSuccess(true);
      setSubmitting(false);
    } catch (err) {
      setError("Network error. Try again.");
      setSubmitting(false);
    }
  };

  return (
    <section
      id="become-a-sponsor"
      className="border-2 border-yellow-400/40 bg-[#131a2a] p-6 sm:p-8 mt-8"
    >
      <div className="font-mono text-xs text-yellow-400 mb-2 tracking-widest">
        / / GET IN TOUCH
      </div>
      <h2 className="font-display text-2xl sm:text-3xl text-[#f5f1e8] mb-3">
        Become a Sponsor
      </h2>
      <p className="font-body text-sm text-[#c8c2b3] mb-6 max-w-2xl leading-relaxed">
        The Lattice Open reaches a focused, engaged Marvel Rivals community.
        Tell us a bit about your brand and what you're looking for — we'll get
        back to you with sponsorship options.
      </p>

      {success ? (
        <div className="border-l-4 border-green-400 bg-green-400/10 p-5">
          <div className="font-display text-xl text-green-300 mb-1">
            Inquiry sent!
          </div>
          <p className="font-body text-sm text-[#c8c2b3]">
            Thanks for your interest. We'll be in touch at the email you
            provided.
          </p>
        </div>
      ) : (
        <div className="space-y-4 max-w-xl">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <div className="font-mono text-[11px] text-[#c8c2b3] mb-1">
                YOUR NAME *
              </div>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={80}
                className="w-full bg-[#0a0e1a] border-2 border-[#f5f1e8]/15 text-[#f5f1e8] px-3 py-2 font-mono text-sm focus:outline-none focus:border-yellow-400"
              />
            </div>
            <div>
              <div className="font-mono text-[11px] text-[#c8c2b3] mb-1">
                EMAIL *
              </div>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                maxLength={120}
                className="w-full bg-[#0a0e1a] border-2 border-[#f5f1e8]/15 text-[#f5f1e8] px-3 py-2 font-mono text-sm focus:outline-none focus:border-yellow-400"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <div className="font-mono text-[11px] text-[#c8c2b3] mb-1">
                COMPANY / ORGANIZATION
              </div>
              <input
                type="text"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                maxLength={100}
                className="w-full bg-[#0a0e1a] border-2 border-[#f5f1e8]/15 text-[#f5f1e8] px-3 py-2 font-mono text-sm focus:outline-none focus:border-yellow-400"
              />
            </div>
            <div>
              <div className="font-mono text-[11px] text-[#c8c2b3] mb-1">
                INTEREST
              </div>
              <select
                value={interest}
                onChange={(e) => setInterest(e.target.value)}
                className="w-full bg-[#0a0e1a] border-2 border-[#f5f1e8]/15 text-[#f5f1e8] px-3 py-2 font-mono text-sm focus:outline-none focus:border-yellow-400"
              >
                <option>Title Sponsor</option>
                <option>Partner</option>
                <option>Not sure yet</option>
              </select>
            </div>
          </div>

          <div>
            <div className="font-mono text-[11px] text-[#c8c2b3] mb-1">
              BUDGET RANGE (optional)
            </div>
            <input
              type="text"
              value={budget}
              onChange={(e) => setBudget(e.target.value)}
              placeholder="e.g. $50–100, or 'flexible'"
              maxLength={60}
              className="w-full bg-[#0a0e1a] border-2 border-[#f5f1e8]/15 text-[#f5f1e8] px-3 py-2 font-mono text-sm focus:outline-none focus:border-yellow-400"
            />
          </div>

          <div>
            <div className="font-mono text-[11px] text-[#c8c2b3] mb-1">
              MESSAGE
            </div>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={4}
              maxLength={1000}
              placeholder="Tell us about your brand and what you're looking for."
              className="w-full bg-[#0a0e1a] border-2 border-[#f5f1e8]/15 text-[#f5f1e8] px-3 py-2 font-mono text-sm focus:outline-none focus:border-yellow-400 resize-y"
            />
          </div>

          {email && !emailValid && (
            <div className="font-mono text-[11px] text-red-300">
              Please enter a valid email address.
            </div>
          )}

          {/* Turnstile widget mounts here */}
          {TURNSTILE_SITE_KEY && (
            <div ref={turnstileRef} className="my-2" />
          )}

          {error && (
            <div className="border-l-4 border-red-500 bg-red-500/10 p-3 font-mono text-xs text-red-300">
              {error}
            </div>
          )}

          <button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className={`font-display px-6 py-2.5 border-2 transition-all ${
              canSubmit
                ? "bg-yellow-400 text-black border-yellow-400 hover:translate-x-[-1px] hover:translate-y-[-1px] hover:shadow-[3px_3px_0_0_#ef4444]"
                : "bg-transparent text-[#6b7280] border-[#6b7280] cursor-not-allowed"
            }`}
          >
            {submitting ? "SENDING…" : "SEND INQUIRY"}
          </button>
        </div>
      )}
    </section>
  );
}
