"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import MatchmakeLogo from "./MatchmakeLogo";
import MaterialSymbol from "./MaterialSymbol";
import { storeAuthSession } from "@/lib/auth-session";
import { supabaseAuth } from "@/lib/supabase";

const FEATURES = [
  {
    icon: "scoreboard",
    title: "Scrim Board",
    desc: "Browse open scrims from high school teams in your rank window. Filter by game, time, and region. Post your own in under a minute.",
  },
  {
    icon: "auto_awesome",
    title: "Auto Stat Extraction",
    desc: "Upload a post-game scoreboard screenshot to draft visible stats. Coaches review and edit the fields before saving the match review.",
  },
  {
    icon: "groups",
    title: "Team & Org Workspace",
    desc: "Manage rosters, ranks, and school team verification in one place. Coaches see everything; players see only what matters to them.",
  },
  {
    icon: "insights",
    title: "Performance Dashboards",
    desc: "Per-game deep stats with role breakdowns, KDA gaps, and win/loss correlation — built so even non-experts can read them.",
  },
];

const STEPS = [
  {
    n: 1,
    title: "Post or browse",
    desc: "List your high school team's availability or scroll the board for matchups in your rank range.",
  },
  {
    n: 2,
    title: "Match up",
    desc: "Send a request, lock a time, and meet your opponent in-game.",
  },
  {
    n: 3,
    title: "Review the tape",
    desc: "Upload the scoreboard, check the extracted draft, then save the review once the fields look right.",
  },
];

const SCHOOL_SAFETY_POINTS = [
  {
    icon: "admin_panel_settings",
    title: "Coach-led setup",
    desc: "Organizations, teams, rosters, and match reviews are built around school and coach-admin workflows.",
  },
  {
    icon: "visibility",
    title: "Limited public listings",
    desc: "The public board focuses on matchup details while private roster, chat, and review work stays in the right team workflow.",
  },
  {
    icon: "block",
    title: "No student-data ads",
    desc: "Launch privacy language keeps student data tied to the school-authorized service, not targeted ads, data sales, or unrelated commercial profiles.",
  },
];

const GAMES = [
  { name: "Valorant", color: "#FF4655" },
  { name: "Call of Duty", color: "#16A34A" },
  { name: "Counter-Strike 2", color: "#F59E0B" },
  { name: "League of Legends", color: "#C8AA6E" },
  { name: "Rocket League", color: "#2563EB" },
  { name: "Overwatch 2", color: "#F97316" },
  { name: "Marvel Rivals", color: "#B91C1C" },
  { name: "Deadlock", color: "#FF8C42" },
  { name: "Super Smash Bros. Ultimate", color: "#7C3AED" },
  { name: "Honor of Kings", color: "#DC2626" },
];

function scrollToAuthCard() {
  document
    .getElementById("auth-card")
    ?.scrollIntoView({ behavior: "smooth", block: "center" });
}

function Input({ label, ...props }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="font-label-bold text-label-bold text-on-surface-variant">
        {label}
      </span>
      <input
        {...props}
        className="h-[44px] rounded-xl border-none bg-surface-container-low px-md font-body-sub text-body-sub text-on-surface placeholder:text-outline focus:ring-2 focus:ring-primary"
      />
    </label>
  );
}

export default function LandingPage() {
  const router = useRouter();
  const [mode, setMode] = useState("login");
  const [displayName, setDisplayName] = useState("");
  const [orgName, setOrgName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  function jumpTo(nextMode) {
    setMode(nextMode);
    setErrorMessage("");
    scrollToAuthCard();
  }

  async function handleLogin(event) {
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

    router.refresh();
  }

  async function handleSignup(event) {
    event.preventDefault();
    setIsLoading(true);
    setErrorMessage("");

    const { data: authData, error: authError } = await supabaseAuth.auth.signUp({
      email,
      password,
    });

    if (authError) {
      setErrorMessage(authError.message);
      setIsLoading(false);
      return;
    }

    const authUser = authData.user;
    if (!authUser) {
      setErrorMessage("Signup did not return a user. Please log in.");
      setIsLoading(false);
      return;
    }

    if (!authData.session) {
      setErrorMessage("Check your email to confirm your account, then log in.");
      setIsLoading(false);
      return;
    }

    const { error: userError } = await supabaseAuth.from("users").upsert({
      id: authUser.id,
      email: authUser.email || email,
      display_name: displayName,
      account_type: "org",
    });

    if (userError) {
      setErrorMessage(userError.message);
      setIsLoading(false);
      return;
    }

    const { data: orgData, error: orgError } = await supabaseAuth
      .from("organizations")
      .insert({
        name: orgName,
        org_admin_id: authUser.id,
        type: "amateur",
        verified_flag: false,
      })
      .select("id")
      .single();

    if (orgError) {
      setErrorMessage(orgError.message);
      setIsLoading(false);
      return;
    }

    if (orgData?.id) {
      await supabaseAuth
        .from("users")
        .update({ org_id: orgData.id })
        .eq("id", authUser.id);
    }

    try {
      await storeAuthSession(authData.session);
    } catch (sessionError) {
      setErrorMessage(sessionError.message);
      setIsLoading(false);
      return;
    }

    router.push("/team/new");
    router.refresh();
  }

  return (
    <div className="min-h-screen bg-background text-on-background">
      {/* Top nav */}
      <header className="sticky top-0 z-40 backdrop-blur-md bg-surface/80 border-b border-outline-variant/30">
        <div className="max-w-[1200px] mx-auto flex items-center justify-between px-margin-mobile md:px-lg h-16">
          <MatchmakeLogo height={48} />
          <nav className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => jumpTo("login")}
              className="hidden sm:inline-flex font-label-bold text-label-bold text-on-surface-variant hover:text-on-surface px-3 py-2 rounded-full hover:bg-surface-container transition-colors"
            >
              Sign in
            </button>
            <button
              type="button"
              onClick={() => jumpTo("signup")}
              className="bg-primary text-on-primary font-label-bold text-label-bold px-4 py-2 rounded-full hover:bg-on-primary-fixed-variant active:scale-95 transition-all shadow-[0_4px_14px_rgba(0,88,188,0.3)]"
            >
              Request access
            </button>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div
          aria-hidden
          className="absolute inset-0 -z-10"
          style={{
            background:
              "radial-gradient(ellipse at top left, rgba(0,88,188,0.10), transparent 55%), radial-gradient(ellipse at bottom right, rgba(76,74,202,0.08), transparent 60%)",
          }}
        />
        <div className="max-w-[1200px] mx-auto px-margin-mobile md:px-lg pt-12 pb-16 md:py-20 grid grid-cols-1 lg:grid-cols-[1.1fr_1fr] gap-10 lg:gap-16 items-center">
          <div>
            <span className="inline-flex items-center gap-2 bg-primary-fixed text-on-primary-fixed font-label-bold text-label-bold px-3 py-1 rounded-full">
              <MaterialSymbol className="text-[16px]" fill>
                bolt
              </MaterialSymbol>
              Built for high school esports teams
            </span>
            <h1 className="mt-6 font-editorial-large text-[40px] leading-[1.05] md:text-[60px] md:leading-[1.02] tracking-[-0.025em] font-extrabold text-on-surface">
              The scrim board for high school esports teams.
            </h1>
            <p className="mt-5 font-body-main text-body-main md:text-[19px] md:leading-[28px] text-on-surface-variant max-w-[560px]">
              Help coaches and school teams find opponents at the right level,
              lock matches in minutes, and turn post-game screenshots into stats
              without another spreadsheet.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => jumpTo("signup")}
                className="bg-primary text-on-primary font-label-bold text-label-bold px-6 py-3 rounded-full hover:bg-on-primary-fixed-variant active:scale-95 transition-all shadow-[0_8px_24px_rgba(0,88,188,0.3)]"
              >
                Request school access
              </button>
              <a
                href="#features"
                className="inline-flex items-center gap-1 font-label-bold text-label-bold text-on-surface px-4 py-3 rounded-full hover:bg-surface-container transition-colors"
              >
                See how it works
                <MaterialSymbol className="text-[18px]">
                  arrow_forward
                </MaterialSymbol>
              </a>
            </div>
            <div className="mt-8 flex items-center gap-2 text-on-surface-variant font-label-small text-label-small">
              <MaterialSymbol className="text-[16px] text-primary" fill>
                verified
              </MaterialSymbol>
              {"Free for high school esports programs · No credit card required"}
            </div>
          </div>

          {/* Auth card */}
          <div
            id="auth-card"
            className="rounded-[24px] border border-outline-variant/30 bg-surface-container-lowest p-lg md:p-xl shadow-[0_24px_60px_rgba(0,0,0,0.10)]"
          >
            <div className="flex p-1 bg-surface-container rounded-full mb-lg">
              {[
                { id: "login", label: "Log in" },
                { id: "signup", label: "Create account" },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => {
                    setMode(tab.id);
                    setErrorMessage("");
                  }}
                  className={`flex-1 py-2 rounded-full font-label-bold text-label-bold transition-colors ${
                    mode === tab.id
                      ? "bg-surface-container-lowest text-primary shadow-[0_2px_8px_rgba(0,0,0,0.06)]"
                      : "text-on-surface-variant hover:text-on-surface"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <h2 className="font-editorial-large text-[26px] leading-[32px] tracking-[-0.01em] font-extrabold text-on-surface">
              {mode === "login" ? "Welcome back" : "Start your team"}
            </h2>
            <p className="mt-1 font-body-sub text-body-sub text-on-surface-variant">
              {mode === "login"
                ? "Pick up where you left off."
                : "We'll set up your org and team in under a minute."}
            </p>

            <form
              className="mt-md flex flex-col gap-md"
              onSubmit={mode === "login" ? handleLogin : handleSignup}
            >
              {mode === "signup" && (
                <>
                  <Input
                    label="Display name"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Alex Coach"
                    required
                  />
                  <Input
                    label="Organization name"
                    value={orgName}
                    onChange={(e) => setOrgName(e.target.value)}
                    placeholder="Contenders Esports"
                    required
                  />
                </>
              )}
              <Input
                label="Email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
              />
              <Input
                label="Password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={
                  mode === "login" ? "Your password" : "At least 6 characters"
                }
                minLength={mode === "signup" ? 6 : undefined}
                required
              />

              {errorMessage && (
                <div className="rounded-xl bg-error-container px-md py-sm font-body-sub text-body-sub text-on-error-container">
                  {errorMessage}
                </div>
              )}

              <button
                type="submit"
                disabled={isLoading}
                className="mt-2 h-[48px] flex items-center justify-center bg-primary text-on-primary font-label-bold text-label-bold rounded-xl hover:bg-on-primary-fixed-variant disabled:opacity-60 disabled:cursor-not-allowed transition-colors shadow-[0_4px_14px_rgba(0,88,188,0.3)]"
              >
                {isLoading
                  ? "Working..."
                  : mode === "login"
                    ? "Log in"
                    : "Create account"}
              </button>
            </form>

            <p className="mt-md text-center font-body-sub text-body-sub text-on-surface-variant">
              {mode === "login" ? "New to Matchmake?" : "Already have an account?"}{" "}
              <button
                type="button"
                onClick={() => {
                  setMode(mode === "login" ? "signup" : "login");
                  setErrorMessage("");
                }}
                className="font-label-bold text-primary hover:text-on-primary-fixed-variant"
              >
                {mode === "login" ? "Create one" : "Log in"}
              </button>
            </p>
          </div>
        </div>
      </section>

      {/* Game strip */}
      <section className="bg-surface-container-low border-y border-outline-variant/30">
        <div className="max-w-[1200px] mx-auto px-margin-mobile md:px-lg py-8 flex flex-wrap items-center justify-between gap-6">
          <p className="font-label-bold text-label-bold uppercase tracking-wider text-outline">
            Supported games
          </p>
          <div className="flex flex-wrap items-center gap-3">
            {GAMES.map((game) => (
              <span
                key={game.name}
                className="inline-flex items-center gap-2 bg-surface-container-lowest border border-outline-variant/30 px-4 py-2 rounded-full font-label-bold text-label-bold text-on-surface"
              >
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ background: game.color }}
                />
                {game.name}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* School safety */}
      <section className="max-w-[1200px] mx-auto px-margin-mobile md:px-lg py-20">
        <div className="max-w-[720px]">
          <p className="font-label-bold text-label-bold uppercase tracking-wider text-outline mb-2">
            School-safe privacy
          </p>
          <h2 className="font-editorial-large text-[36px] leading-[42px] md:text-[44px] md:leading-[50px] tracking-[-0.02em] font-extrabold text-on-surface">
            Built for coach-supervised esports programs.
          </h2>
          <p className="mt-4 font-body-main text-body-main text-on-surface-variant">
            Matchmake is positioned for school-authorized team operations:
            clear coach ownership, limited public scrim details, and
            student-data commitments that avoid advertising or resale.
          </p>
        </div>
        <div className="mt-10 grid grid-cols-1 md:grid-cols-3 gap-md">
          {SCHOOL_SAFETY_POINTS.map((point) => (
            <article
              key={point.title}
              className="rounded-[24px] border border-outline-variant/30 bg-surface-container-lowest p-lg shadow-[0_4px_20px_rgba(0,0,0,0.04)]"
            >
              <div className="w-12 h-12 rounded-2xl bg-primary-fixed text-primary flex items-center justify-center">
                <MaterialSymbol className="text-[24px]" fill>
                  {point.icon}
                </MaterialSymbol>
              </div>
              <h3 className="mt-md font-headline-2 text-headline-2 text-on-surface">
                {point.title}
              </h3>
              <p className="mt-2 font-body-sub text-body-sub text-on-surface-variant">
                {point.desc}
              </p>
            </article>
          ))}
        </div>
      </section>

      {/* Features */}
      <section
        id="features"
        className="max-w-[1200px] mx-auto px-margin-mobile md:px-lg py-20"
      >
        <div className="max-w-[680px]">
          <p className="font-label-bold text-label-bold uppercase tracking-wider text-outline mb-2">
            What it does
          </p>
          <h2 className="font-editorial-large text-[36px] leading-[42px] md:text-[44px] md:leading-[50px] tracking-[-0.02em] font-extrabold text-on-surface">
            {"Everything between “LF scrim” and the post-game review."}
          </h2>
        </div>
        <div className="mt-12 grid grid-cols-1 md:grid-cols-2 gap-md">
          {FEATURES.map((feature) => (
            <article
              key={feature.title}
              className="rounded-[24px] border border-outline-variant/30 bg-surface-container-lowest p-lg shadow-[0_4px_20px_rgba(0,0,0,0.04)] hover:shadow-[0_12px_32px_rgba(0,0,0,0.08)] transition-shadow"
            >
              <div className="w-12 h-12 rounded-2xl bg-primary-fixed text-primary flex items-center justify-center">
                <MaterialSymbol className="text-[24px]" fill>
                  {feature.icon}
                </MaterialSymbol>
              </div>
              <h3 className="mt-md font-headline-2 text-headline-2 text-on-surface">
                {feature.title}
              </h3>
              <p className="mt-2 font-body-sub text-body-sub text-on-surface-variant">
                {feature.desc}
              </p>
            </article>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="bg-surface-container-low border-y border-outline-variant/30">
        <div className="max-w-[1200px] mx-auto px-margin-mobile md:px-lg py-20">
          <div className="max-w-[680px]">
            <p className="font-label-bold text-label-bold uppercase tracking-wider text-outline mb-2">
              How it works
            </p>
            <h2 className="font-editorial-large text-[36px] leading-[42px] md:text-[44px] md:leading-[50px] tracking-[-0.02em] font-extrabold text-on-surface">
              Three steps from listing to insights.
            </h2>
          </div>
          <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-md">
            {STEPS.map((step) => (
              <div
                key={step.n}
                className="rounded-[24px] bg-surface-container-lowest p-lg border border-outline-variant/30"
              >
                <div className="font-editorial-large text-[40px] leading-[44px] tracking-[-0.02em] text-primary font-extrabold">
                  {`0${step.n}`}
                </div>
                <h3 className="mt-2 font-headline-2 text-headline-2 text-on-surface">
                  {step.title}
                </h3>
                <p className="mt-2 font-body-sub text-body-sub text-on-surface-variant">
                  {step.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="max-w-[1200px] mx-auto px-margin-mobile md:px-lg py-20">
        <div className="rounded-[32px] bg-primary text-on-primary p-xl md:p-[64px] flex flex-col md:flex-row items-start md:items-center justify-between gap-6 shadow-[0_24px_48px_rgba(0,88,188,0.25)]">
          <div className="max-w-[560px]">
            <h2 className="font-editorial-large text-[32px] leading-[38px] md:text-[40px] md:leading-[46px] tracking-[-0.02em] font-extrabold">
              Bring Matchmake to your school esports program.
            </h2>
            <p className="mt-3 font-body-main text-body-main text-on-primary/85">
              Request access, set up a school workspace, and start with one team before expanding.
            </p>
          </div>
          <button
            type="button"
            onClick={() => jumpTo("signup")}
            className="bg-on-primary text-primary font-label-bold text-label-bold px-6 py-3 rounded-full hover:bg-on-primary/90 active:scale-95 transition-all shadow-[0_8px_24px_rgba(0,0,0,0.12)] whitespace-nowrap"
          >
            Request school access
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-outline-variant/30">
        <div className="max-w-[1200px] mx-auto px-margin-mobile md:px-lg py-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <MatchmakeLogo height={36} />
            <span className="font-label-small text-label-small text-outline">
              {`© ${new Date().getFullYear()} Matchmake`}
            </span>
          </div>
          <div className="flex items-center gap-4 font-label-small text-label-small text-on-surface-variant">
            <Link href="/login" className="hover:text-on-surface">
              Sign in
            </Link>
            <Link href="/signup" className="hover:text-on-surface">
              Create account
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
