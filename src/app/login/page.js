"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import MatchmakeLogo from "@/components/MatchmakeLogo";
import MaterialSymbol from "@/components/MaterialSymbol";
import { storeAuthSession } from "@/lib/auth-session";
import { GAME_OPTIONS } from "@/lib/game-options";
import { supabaseAuth } from "@/lib/supabase";

const painPoints = [
  { icon: "groups", title: "Availability is unclear", body: "Who's free?" },
  { icon: "forum", title: "Requests get lost", body: "Buried in chat" },
  { icon: "event_busy", title: "Times drift", body: "No shared schedule" },
  { icon: "rule", title: "Status is fuzzy", body: "Open or confirmed?" },
  { icon: "image", title: "Stats go missing", body: "No record anywhere" },
];

const practiceTools = [
  { icon: "manage_search", title: "Open Listings", body: "Find matches" },
  { icon: "swap_horiz", title: "Request States", body: "Track replies" },
  { icon: "event", title: "Shared Calendar", body: "Know times" },
  { icon: "auto_awesome", title: "Screenshot Drafts", body: "Review stats" },
  { icon: "query_stats", title: "Form Trends", body: "Spot patterns" },
  { icon: "notifications", title: "Team Updates", body: "Stay synced" },
];

const extractionNotes = [
  {
    icon: "upload_file",
    title: "Upload the scoreboard",
    body: "Use a post-game scoreboard screenshot after the match. Crop out unrelated windows, chats, and personal information before upload.",
  },
  {
    icon: "auto_awesome",
    title: "Get a stats draft",
    body: "Matchmake reads visible rows, scores, characters, maps, and match details, then places them into an editable review.",
  },
  {
    icon: "fact_check",
    title: "Coach reviews before saving",
    body: "Extraction can miss or misread details. Coaches should check the fields, fix mistakes, and keep the source screenshot until the saved review looks right.",
  },
];

const schoolSafetyNotes = [
  {
    icon: "admin_panel_settings",
    title: "Coach-led workspaces",
    body: "Team setup, rosters, scrims, chat, and match reviews are organized around school and coach-admin workflows.",
  },
  {
    icon: "visibility",
    title: "Limited public details",
    body: "Public scrim listings focus on matchup details. Private roster, chat, and match-review work stays in the appropriate team workflow.",
  },
  {
    icon: "block",
    title: "No student-data ads",
    body: "Launch privacy language commits student data to the school-authorized Matchmake service, not targeted ads, data sales, or unrelated commercial profiles.",
  },
];

const gameDisplayNames = {
  SSBU: "Super Smash Bros. Ultimate",
};

const supportedGames = GAME_OPTIONS.map((game) => gameDisplayNames[game] || game);

function PreviewCard({ children, className = "", icon, title }) {
  return (
    <div className={`rounded-[14px] border border-outline-variant/35 bg-surface-container-lowest/95 p-md shadow-[0_8px_24px_rgba(15,35,70,0.06)] ${className}`}>
      <div className="mb-sm flex items-center gap-xs">
        <MaterialSymbol className="text-[22px] text-primary">{icon}</MaterialSymbol>
        <h3 className="font-label-bold text-label-bold text-on-surface">{title}</h3>
      </div>
      {children}
    </div>
  );
}

function FeatureTile({ body, icon, title }) {
  return (
    <div className="flex min-h-[118px] flex-col items-center justify-center rounded-[12px] border border-outline-variant/35 bg-surface-container-lowest px-md py-md text-center shadow-[0_8px_24px_rgba(15,35,70,0.03)]">
      <MaterialSymbol className="mb-xs text-[32px] text-primary">{icon}</MaterialSymbol>
      <h3 className="font-label-bold text-label-bold text-on-surface">{title}</h3>
      {body && <p className="mt-1 max-w-[150px] font-label-small text-[11px] leading-4 text-on-surface-variant">{body}</p>}
    </div>
  );
}

function ProductPreview() {
  return (
    <div className="grid gap-sm rounded-[22px] border border-outline-variant/30 bg-surface-container-lowest/70 p-sm shadow-[0_18px_50px_rgba(0,48,110,0.10)] backdrop-blur md:grid-cols-2">
      <PreviewCard icon="hub" title="Scrim Board">
        <div className="grid gap-xs">
          <div className="rounded-xl bg-surface-container-low p-sm">
            <div className="flex items-center justify-between">
              <span className="font-label-bold text-label-bold text-on-surface">Valorant</span>
              <span className="rounded-full bg-primary-fixed px-sm py-1 font-label-small text-[10px] text-primary">Open</span>
            </div>
            <p className="mt-xs font-label-small text-label-small text-on-surface-variant">Diamond · Today · 3 Games</p>
          </div>
          <div className="h-2 rounded-full bg-surface-container-low" />
          <div className="h-2 w-3/4 rounded-full bg-surface-container-low" />
        </div>
      </PreviewCard>

      <PreviewCard icon="calendar_month" title="Calendar">
        <div className="grid grid-cols-7 gap-xs">
          {[28, 29, 30, 1, 2, 3, 4].map((day) => (
            <div className={`flex aspect-square items-center justify-center rounded-lg font-label-small text-[10px] ${
              day === 1 ? "bg-primary text-on-primary" : "bg-surface-container-low text-on-surface-variant"
            }`} key={day}>
              {day}
            </div>
          ))}
        </div>
        <div className="mt-sm rounded-xl bg-surface-container-low p-sm font-label-small text-label-small text-on-surface">
          7:00 PM · Confirmed scrim
        </div>
      </PreviewCard>

      <PreviewCard icon="reviews" title="Post-game dashboard">
        <div className="flex items-center justify-between rounded-xl bg-surface-container-low p-sm">
          <div>
            <p className="font-label-small text-[10px] text-on-surface-variant">Game 1 of 3</p>
            <p className="font-headline-3 text-headline-3 text-on-surface">13 - 8</p>
          </div>
          <span className="rounded-full bg-[#e3f9e5] px-sm py-1 font-label-small text-[10px] text-[#1b5e20]">Victory</span>
        </div>
        <div className="mt-sm grid grid-cols-2 gap-xs">
          <div className="h-2 rounded-full bg-primary-fixed" />
          <div className="h-2 rounded-full bg-primary-fixed" />
          <div className="h-2 w-2/3 rounded-full bg-primary" />
          <div className="h-2 w-1/2 rounded-full bg-primary" />
        </div>
      </PreviewCard>

      <PreviewCard icon="query_stats" title="Team stats">
        <div className="grid grid-cols-3 gap-xs text-center">
          <div className="rounded-lg bg-surface-container-low p-xs"><p className="font-headline-3 text-headline-3 text-primary">8</p><p className="font-label-small text-[10px]">Reviews</p></div>
          <div className="rounded-lg bg-surface-container-low p-xs"><p className="font-headline-3 text-headline-3 text-primary">6W</p><p className="font-label-small text-[10px]">Record</p></div>
          <div className="rounded-lg bg-surface-container-low p-xs"><p className="font-headline-3 text-headline-3 text-primary">75%</p><p className="font-label-small text-[10px]">Rate</p></div>
        </div>
        <div className="mt-sm flex h-12 items-end gap-2 rounded-lg bg-primary-fixed/50 px-sm py-xs">
          {[30, 44, 34, 58, 50, 70].map((height, index) => (
            <span className="flex-1 rounded-t bg-primary" key={index} style={{ height: `${height}%` }} />
          ))}
        </div>
      </PreviewCard>
    </div>
  );
}

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const emailInputRef = useRef(null);
  const loginDialogRef = useRef(null);
  const loginTriggerRef = useRef(null);

  useEffect(() => {
    if (!isLoginOpen) return;

    emailInputRef.current?.focus();

    function handleDialogKeyDown(event) {
      if (event.key === "Escape") {
        setIsLoginOpen(false);
        return;
      }

      if (event.key !== "Tab") return;

      const focusableElements = Array.from(
        loginDialogRef.current?.querySelectorAll(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        ) || []
      ).filter((element) => !element.hasAttribute("disabled") && element.getAttribute("aria-hidden") !== "true");

      if (focusableElements.length === 0) return;

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      if (event.shiftKey && document.activeElement === firstElement) {
        event.preventDefault();
        lastElement.focus();
      } else if (!event.shiftKey && document.activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus();
      }
    }

    window.addEventListener("keydown", handleDialogKeyDown);
    return () => {
      window.removeEventListener("keydown", handleDialogKeyDown);
      loginTriggerRef.current?.focus?.();
    };
  }, [isLoginOpen]);

  async function handleSubmit(event) {
    event.preventDefault();
    setIsLoading(true);
    setErrorMessage("");

    const { data, error } = await supabaseAuth.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setErrorMessage(error.message);
      setIsLoading(false);
      return;
    }

    try {
      await storeAuthSession(data.session);
    } catch (sessionError) {
      setErrorMessage(sessionError.message);
      setIsLoading(false);
      return;
    }

    router.push("/");
    router.refresh();
  }

  function openLogin() {
    setErrorMessage("");
    loginTriggerRef.current = document.activeElement;
    setIsLoginOpen(true);
  }

  return (
    <main className="bg-background text-on-background">
      <header className="border-b border-outline-variant/30 bg-surface/90">
        <div className="mx-auto flex max-w-[1200px] items-center justify-between px-margin-mobile py-md md:px-lg">
          <Link className="flex items-center gap-sm" href="/login" aria-label="Matchmake login page">
            <MatchmakeLogo height={42} />
          </Link>
          <nav className="hidden items-center gap-lg font-label-bold text-label-bold text-on-surface md:flex">
            <button className="hover:text-primary" onClick={openLogin} type="button">Login</button>
            <Link className="rounded-lg bg-primary px-md py-sm text-on-primary shadow-[0_6px_18px_rgba(0,88,188,0.25)]" href="/signup">
              Request school access
            </Link>
          </nav>
          <button className="rounded-lg bg-primary px-md py-sm font-label-bold text-label-bold text-on-primary md:hidden" onClick={openLogin} type="button">
            Login
          </button>
        </div>
      </header>

      <section className="mx-auto grid max-w-[1200px] gap-xl px-margin-mobile py-xl md:grid-cols-[1fr_560px] md:px-lg md:py-[72px]">
        <div className="flex flex-col justify-center">
          <h1 className="max-w-[650px] font-editorial-large text-[42px] font-black leading-[1.05] text-on-surface md:text-[58px]">
            Find better high school scrims.<br />
            <span className="text-primary">Learn from every game.</span>
          </h1>
          <p className="mt-md max-w-[520px] font-body-main text-body-main text-on-surface-variant md:text-[18px] md:leading-7">
            Matchmake helps high school esports teams schedule scrims, manage requests, and turn post-game screenshots into team performance dashboards.
          </p>
          <div className="mt-lg flex flex-col gap-sm sm:flex-row">
            <Link className="inline-flex h-12 items-center justify-center rounded-lg bg-primary px-xl font-label-bold text-label-bold text-on-primary shadow-[0_6px_18px_rgba(0,88,188,0.25)]" href="/signup">
              Request school access
            </Link>
            <button className="inline-flex h-12 items-center justify-center rounded-lg border border-primary bg-surface-container-lowest px-xl font-label-bold text-label-bold text-primary" onClick={openLogin} type="button">
              Log In
            </button>
          </div>
          <p className="mt-lg flex items-center gap-sm font-label-bold text-label-bold text-on-surface-variant">
            <MaterialSymbol className="text-[20px] text-outline" fill>shield</MaterialSymbol>
            Built for high school esports programs.
          </p>
        </div>

        <ProductPreview />
      </section>

      <section className="border-y border-outline-variant/25 bg-surface-container-lowest px-margin-mobile py-lg md:px-lg">
        <div className="mx-auto flex max-w-[1200px] flex-col gap-md md:flex-row md:items-center md:justify-between">
          <div>
            <p className="font-label-bold text-label-bold uppercase tracking-wider text-outline">Supported games</p>
            <h2 className="mt-xs font-headline-3 text-headline-3 text-on-surface">
              Built for the games high school teams are already scheduling.
            </h2>
          </div>
          <div className="flex flex-wrap gap-xs md:max-w-[680px] md:justify-end">
            {supportedGames.map((game) => (
              <span className="rounded-full border border-outline-variant/35 bg-surface-container-low px-sm py-1 font-label-bold text-label-bold text-on-surface" key={game}>
                {game}
              </span>
            ))}
          </div>
        </div>
      </section>

      <section className="px-margin-mobile py-xl md:px-lg">
        <div className="mx-auto max-w-[1200px]">
          <div className="max-w-[680px]">
            <p className="font-label-bold text-label-bold uppercase tracking-wider text-outline">Screenshot extraction</p>
            <h2 className="mt-xs font-headline-2 text-headline-2 text-on-surface">
              A faster starting point, not an official scorebook.
            </h2>
            <p className="mt-sm font-body-sub text-body-sub text-on-surface-variant">
              Matchmake turns visible scoreboard screenshots into editable match-review drafts. Coaches stay responsible for checking the data before saving or using it for team decisions.
            </p>
          </div>
          <div className="mt-md grid grid-cols-1 gap-sm md:grid-cols-3">
            {extractionNotes.map((item) => (
              <article className="rounded-[14px] border border-outline-variant/35 bg-surface-container-lowest p-md shadow-[0_8px_24px_rgba(15,35,70,0.03)]" key={item.title}>
                <MaterialSymbol className="text-[28px] text-primary">{item.icon}</MaterialSymbol>
                <h3 className="mt-sm font-headline-3 text-headline-3 text-on-surface">{item.title}</h3>
                <p className="mt-xs font-body-sub text-body-sub text-on-surface-variant">{item.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="border-y border-outline-variant/25 bg-surface-container-lowest/80 px-margin-mobile py-xl md:px-lg">
        <div className="mx-auto max-w-[1200px]">
          <div className="max-w-[720px]">
            <p className="font-label-bold text-label-bold uppercase tracking-wider text-outline">School-safe privacy</p>
            <h2 className="mt-xs font-headline-2 text-headline-2 text-on-surface">
              Built for coach-supervised esports programs.
            </h2>
            <p className="mt-sm font-body-sub text-body-sub text-on-surface-variant">
              Matchmake is positioned for school-authorized team operations: clear coach ownership, limited public scrim details, and student-data commitments that avoid advertising or resale.
            </p>
          </div>
          <div className="mt-md grid grid-cols-1 gap-sm md:grid-cols-3">
            {schoolSafetyNotes.map((item) => (
              <article className="rounded-[14px] border border-outline-variant/35 bg-surface-container-lowest p-md shadow-[0_8px_24px_rgba(15,35,70,0.03)]" key={item.title}>
                <MaterialSymbol className="text-[28px] text-primary">{item.icon}</MaterialSymbol>
                <h3 className="mt-sm font-headline-3 text-headline-3 text-on-surface">{item.title}</h3>
                <p className="mt-xs font-body-sub text-body-sub text-on-surface-variant">{item.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="border-y border-outline-variant/25 bg-surface-container-lowest/80 px-margin-mobile py-lg md:px-lg" id="features">
        <div className="mx-auto max-w-[1200px]">
          <h2 className="text-center font-headline-2 text-headline-2 text-on-surface">The usual high school scrim problems are easy to miss.</h2>
          <div className="mt-md grid grid-cols-1 gap-sm sm:grid-cols-2 lg:grid-cols-5">
            {painPoints.map((item) => <FeatureTile key={item.title} {...item} />)}
          </div>
        </div>
      </section>

      <section className="px-margin-mobile pb-xl pt-lg md:px-lg" id="practice">
        <div className="mx-auto max-w-[1200px]">
          <h2 className="text-center font-headline-2 text-headline-2 text-on-surface">Small tools for the whole high school practice loop.</h2>
          <div className="mt-md grid grid-cols-1 gap-sm sm:grid-cols-2 lg:grid-cols-6">
            {practiceTools.map((item) => <FeatureTile key={item.title} {...item} />)}
          </div>
        </div>
      </section>

      <section className="border-y border-outline-variant/25 bg-primary px-margin-mobile py-xl text-on-primary md:px-lg">
        <div className="mx-auto flex max-w-[1200px] flex-col gap-md md:flex-row md:items-center md:justify-between">
          <div className="max-w-[700px]">
            <p className="font-label-bold text-label-bold uppercase tracking-wider text-on-primary/75">Fall pilot access</p>
            <h2 className="mt-xs font-headline-2 text-headline-2 text-on-primary">
              Bring Matchmake to your school esports program.
            </h2>
            <p className="mt-sm font-body-sub text-body-sub text-on-primary/85">
              Coaches and school esports leads can request access, set up a school workspace, and start with one team before expanding.
            </p>
          </div>
          <Link className="inline-flex h-12 items-center justify-center rounded-lg bg-on-primary px-xl font-label-bold text-label-bold text-primary shadow-[0_8px_24px_rgba(0,0,0,0.18)]" href="/signup">
            Request school access
          </Link>
        </div>
      </section>

      {isLoginOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#07162f]/45 px-margin-mobile py-lg backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="login-title">
          <button className="absolute inset-0 cursor-default" aria-label="Close login" onClick={() => setIsLoginOpen(false)} type="button" />
          <section className="relative w-full max-w-[440px] rounded-[18px] border border-outline-variant/30 bg-surface-container-lowest p-lg shadow-[0_22px_70px_rgba(0,20,60,0.28)]" ref={loginDialogRef}>
            <button
              className="absolute right-md top-md flex h-9 w-9 items-center justify-center rounded-full bg-surface-container text-on-surface-variant hover:bg-surface-container-high"
              onClick={() => setIsLoginOpen(false)}
              type="button"
              aria-label="Close"
            >
              <MaterialSymbol className="text-[20px]">close</MaterialSymbol>
            </button>

            <p className="mb-xs font-label-bold text-label-bold uppercase tracking-wider text-outline">Welcome Back</p>
            <h1 className="font-editorial-large text-editorial-large text-on-surface" id="login-title">Log in</h1>
            <p className="mt-sm font-body-sub text-body-sub text-on-surface-variant">
              Access your scrim board, requests, and team workspace.
            </p>

            <form className="mt-xl flex flex-col gap-md" onSubmit={handleSubmit}>
              <label className="flex flex-col gap-sm">
                <span className="font-label-bold text-label-bold text-on-surface-variant">Email</span>
                <input
                  className="h-[48px] rounded-xl border-none bg-surface-container-low px-md font-body-main text-body-main text-on-surface placeholder:text-outline focus:ring-2 focus:ring-primary"
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="you@example.com"
                  ref={emailInputRef}
                  required
                  type="email"
                  value={email}
                />
              </label>

              <label className="flex flex-col gap-sm">
                <span className="font-label-bold text-label-bold text-on-surface-variant">Password</span>
                <input
                  className="h-[48px] rounded-xl border-none bg-surface-container-low px-md font-body-main text-body-main text-on-surface placeholder:text-outline focus:ring-2 focus:ring-primary"
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Your password"
                  required
                  type="password"
                  value={password}
                />
              </label>

              {errorMessage && (
                <div className="rounded-xl bg-error-container px-md py-sm font-body-sub text-body-sub text-on-error-container">
                  {errorMessage}
                </div>
              )}

              <button
                className="mt-sm flex h-[48px] items-center justify-center rounded-xl bg-primary px-lg font-label-bold text-label-bold text-on-primary shadow-[0_4px_14px_rgba(0,88,188,0.3)] transition-colors hover:bg-on-primary-fixed-variant disabled:cursor-not-allowed disabled:opacity-60"
                disabled={isLoading}
                type="submit"
              >
                {isLoading ? "Logging in..." : "Log in"}
              </button>
            </form>

            <p className="mt-lg text-center font-body-sub text-body-sub text-on-surface-variant">
              New to Matchmake?{" "}
              <Link className="font-label-bold text-primary hover:text-on-primary-fixed-variant" href="/signup">
                Create an account
              </Link>
            </p>
          </section>
        </div>
      )}
    </main>
  );
}
