"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import MaterialSymbol from "@/components/MaterialSymbol";

// ─── helpers (mirrored from page.js) ────────────────────────────────────────

function getInitials(name = "") {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

function getRankColor(rank = "") {
  if (rank.includes("Immortal") || rank.includes("Radiant")) return "#ff2d55";
  if (rank.includes("Ascendant") || rank.includes("Diamond")) return "#00e676";
  if (rank.includes("Platinum")) return "#2979ff";
  if (rank.includes("Faceit")) return "#ff6d00";
  return "#717786";
}

function formatDateTime(value) {
  if (!value) return "Time TBD";
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatTime(value) {
  if (!value) return "TBD";
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

// ─── sub-components ──────────────────────────────────────────────────────────

function TeamAvatar({ initials, size = "lg" }) {
  const dim = size === "lg" ? "w-20 h-20 md:w-24 md:h-24 text-2xl" : "w-12 h-12 text-base";
  return (
    <div
      className={`${dim} rounded-full bg-surface-container-high flex items-center justify-center font-bold text-on-surface border-2 border-outline-variant/20 shrink-0`}
    >
      {initials}
    </div>
  );
}

function DetailRow({ icon, label, value, last = false }) {
  return (
    <div
      className={`flex items-center justify-between ${
        !last ? "border-b border-surface-container-highest pb-md" : ""
      }`}
    >
      <div className="flex items-center gap-sm text-on-surface-variant">
        <MaterialSymbol>{icon}</MaterialSymbol>
        <span className="font-body-main text-body-main">{label}</span>
      </div>
      <span className="font-body-main text-body-main font-medium text-on-surface">{value}</span>
    </div>
  );
}

// ─── loading skeleton ─────────────────────────────────────────────────────────

function Skeleton({ className }) {
  return <div className={`bg-surface-container-high animate-pulse rounded-lg ${className}`} />;
}

function LoadingSkeleton() {
  return (
    <main className="max-w-[1200px] mx-auto px-margin-mobile md:px-lg py-lg space-y-lg pb-32">
      <div className="bg-surface-container-lowest rounded-xl p-lg border border-surface-container-highest space-y-lg">
        <div className="flex items-center justify-center gap-lg">
          <div className="flex flex-col items-center gap-sm flex-1">
            <Skeleton className="w-20 h-20 rounded-full" />
            <Skeleton className="h-5 w-28" />
          </div>
          <Skeleton className="h-4 w-8 shrink-0" />
          <div className="flex flex-col items-center gap-sm flex-1">
            <Skeleton className="w-20 h-20 rounded-full" />
            <Skeleton className="h-5 w-28" />
          </div>
        </div>
        <div className="flex justify-center">
          <Skeleton className="h-8 w-32 rounded-full" />
        </div>
        <div className="text-center space-y-sm">
          <Skeleton className="h-6 w-48 mx-auto" />
          <div className="flex justify-center gap-sm">
            <Skeleton className="h-6 w-20 rounded-full" />
            <Skeleton className="h-6 w-20 rounded-full" />
            <Skeleton className="h-6 w-20 rounded-full" />
          </div>
        </div>
      </div>
      <Skeleton className="h-14 w-full rounded-xl" />
      <div className="bg-surface-container-lowest rounded-xl p-lg border border-surface-container-highest space-y-md">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-8 w-full" />
        ))}
      </div>
    </main>
  );
}

// ─── page ─────────────────────────────────────────────────────────────────────

export default function ScrimDetailPage() {
  const { id } = useParams();
  const [scrim, setScrim] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [requested, setRequested] = useState(false);

  useEffect(() => {
    if (!id) return;

    async function fetchScrim() {
      setLoading(true);
      setError("");

      const { data, error: err } = await supabase
        .from("scrim_requests")
        .select(
          `
          id,
          game_title,
          scheduled_at,
          team_rank,
          opponent_rank_min,
          opponent_rank_max,
          status,
          expires_at,
          posting_team:teams!scrim_requests_posting_team_id_fkey (
            id,
            name,
            region,
            rank_tier,
            scrimgg_rating,
            organization:organizations!teams_org_id_fkey (
              id,
              name,
              verified_flag,
              type
            )
          )
        `
        )
        .eq("id", id)
        .single();

      if (err) {
        setError(err.code === "PGRST116" ? "Scrim not found." : err.message);
      } else {
        setScrim(data);
      }

      setLoading(false);
    }

    fetchScrim();
  }, [id]);

  // ── derived display values ──────────────────────────────────────────────────
  const postingTeam = scrim?.posting_team;
  const org = postingTeam?.organization;

  const teamName = postingTeam?.name ?? "Unknown Team";
  const teamInitials = getInitials(teamName);
  const orgName = org?.name ?? "Independent";
  const verified = Boolean(org?.verified_flag);

  const game = scrim?.game_title ?? "—";
  const rank = scrim?.team_rank ?? postingTeam?.rank_tier ?? "Rank TBD";
  const rankColor = getRankColor(rank);
  const opponentMin = scrim?.opponent_rank_min;
  const opponentMax = scrim?.opponent_rank_max;
  const rankRange =
    opponentMin && opponentMax
      ? `${opponentMin} – ${opponentMax}`
      : opponentMin ?? opponentMax ?? "Open";
  const region = postingTeam?.region ?? "Region TBD";
  const rating = Number(postingTeam?.scrimgg_rating ?? 0).toFixed(1);
  const dateTime = formatDateTime(scrim?.scheduled_at);
  const timeOnly = formatTime(scrim?.scheduled_at);

  const isExpired = scrim?.expires_at
    ? new Date(scrim.expires_at) < new Date()
    : false;
  const isOpen = scrim?.status === "open" && !isExpired;

  // ── render ──────────────────────────────────────────────────────────────────
  return (
    <div className="bg-background text-on-background min-h-screen">
      {/* TopAppBar */}
      <header className="bg-white/80 backdrop-blur-md top-0 sticky z-50 shadow-[0_4px_20px_0_rgba(0,0,0,0.04)] flex justify-between items-center w-full px-5 h-14">
        <Link
          href="/"
          className="text-primary hover:bg-surface-container transition-colors active:scale-95 w-10 h-10 flex items-center justify-center rounded-full"
        >
          <MaterialSymbol>arrow_back</MaterialSymbol>
        </Link>
        <h1 className="text-lg font-black tracking-tighter text-on-surface">Scrim Detail</h1>
        <button className="text-on-surface-variant hover:bg-surface-container transition-colors active:scale-95 w-10 h-10 flex items-center justify-center rounded-full">
          <MaterialSymbol>more_vert</MaterialSymbol>
        </button>
      </header>

      {/* Content */}
      {loading ? (
        <LoadingSkeleton />
      ) : error ? (
        <main className="max-w-[1200px] mx-auto px-margin-mobile py-xl text-center">
          <MaterialSymbol className="text-[48px] text-outline mb-md block">sentiment_dissatisfied</MaterialSymbol>
          <h2 className="font-headline-2 text-headline-2 text-on-surface mb-sm">{error}</h2>
          <Link href="/" className="text-primary font-label-bold underline">
            Back to Scrim Board
          </Link>
        </main>
      ) : (
        <main className="max-w-[1200px] mx-auto px-margin-mobile md:px-lg py-lg space-y-lg pb-32">

          {/* ── Matchup card ──────────────────────────────────────── */}
          <section className="bg-surface-container-lowest rounded-xl p-lg shadow-[0_4px_20px_0_rgba(0,0,0,0.04)] border border-surface-container-highest">
            <div className="flex items-center justify-center gap-lg">

              {/* Posting team */}
              <div className="flex flex-col items-center gap-sm flex-1 min-w-0">
                <TeamAvatar initials={teamInitials} />
                <div className="text-center">
                  <p className="font-headline-3 text-headline-3 text-on-surface leading-tight break-words w-full flex items-center justify-center gap-1">
                    {teamName}
                    {verified && (
                      <MaterialSymbol className="text-[16px] text-primary shrink-0" fill>
                        verified
                      </MaterialSymbol>
                    )}
                  </p>
                  <p className="font-label-small text-label-small text-on-surface-variant mt-1">{orgName}</p>
                </div>
              </div>

              {/* VS */}
              <div className="flex flex-col items-center shrink-0 px-sm">
                <span className="font-label-bold text-label-bold text-outline uppercase tracking-widest">VS</span>
              </div>

              {/* Challenger slot */}
              <div className="flex flex-col items-center gap-sm flex-1 min-w-0">
                <div className="w-20 h-20 md:w-24 md:h-24 rounded-full bg-surface-container-high border-2 border-dashed border-outline-variant flex items-center justify-center shrink-0">
                  <MaterialSymbol className="text-[32px] text-outline">group_add</MaterialSymbol>
                </div>
                <div className="text-center">
                  <p className="font-headline-3 text-headline-3 text-on-surface-variant leading-tight">
                    Your Team
                  </p>
                  <p className="font-label-small text-label-small text-outline mt-1">Challenger</p>
                </div>
              </div>
            </div>

            {/* Status */}
            <div className="flex justify-center mt-md">
              {isOpen ? (
                <span className="inline-flex items-center gap-1 bg-primary-fixed text-on-primary-fixed font-label-bold text-label-bold px-4 py-1.5 rounded-full">
                  <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                  Open · Looking for Scrim
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 bg-surface-container text-on-surface-variant font-label-bold text-label-bold px-4 py-1.5 rounded-full">
                  <MaterialSymbol className="text-[14px]">lock</MaterialSymbol>
                  {isExpired ? "Expired" : scrim?.status}
                </span>
              )}
            </div>

            {/* Time + tags */}
            <div className="mt-lg text-center">
              <p className="font-headline-2 text-headline-2 text-on-surface">{dateTime}</p>
              <div className="flex flex-wrap justify-center gap-sm mt-md">
                <span className="inline-flex items-center px-3 py-1 rounded-full bg-primary-fixed text-on-primary-fixed font-label-small text-label-small">
                  <MaterialSymbol className="text-[14px] mr-1">sports_esports</MaterialSymbol>
                  {game}
                </span>
                <span className="inline-flex items-center px-3 py-1 rounded-full bg-surface-container-highest text-on-surface font-label-small text-label-small">
                  <span className="w-2 h-2 rounded-full mr-1.5" style={{ backgroundColor: rankColor }} />
                  {rank}
                </span>
                <span className="inline-flex items-center px-3 py-1 rounded-full bg-surface-container-highest text-on-surface-variant font-label-small text-label-small">
                  <MaterialSymbol className="text-[14px] mr-1">public</MaterialSymbol>
                  {region}
                </span>
              </div>
            </div>
          </section>

          {/* ── CTA ───────────────────────────────────────────────── */}
          <section>
            {requested ? (
              <div className="w-full bg-[#E3F9E5] text-[#1B5E20] rounded-xl py-4 flex items-center justify-center gap-sm">
                <MaterialSymbol fill>check_circle</MaterialSymbol>
                <span className="font-headline-3 text-headline-3">Request Sent!</span>
              </div>
            ) : (
              <button
                disabled={!isOpen}
                onClick={() => setRequested(true)}
                className={`w-full rounded-xl py-4 flex items-center justify-center gap-sm transition-all active:scale-[0.98] shadow-sm font-headline-3 text-headline-3 ${
                  isOpen
                    ? "bg-primary text-on-primary hover:opacity-90"
                    : "bg-surface-container text-on-surface-variant cursor-not-allowed"
                }`}
              >
                <MaterialSymbol fill={isOpen}>swords</MaterialSymbol>
                {isOpen ? "Request This Scrim" : "No Longer Available"}
              </button>
            )}
          </section>

          {/* ── Match details ─────────────────────────────────────── */}
          <section className="bg-surface-container-lowest rounded-xl p-lg shadow-[0_4px_20px_0_rgba(0,0,0,0.04)] border border-surface-container-highest">
            <h2 className="font-headline-3 text-headline-3 mb-md">Match Details</h2>
            <div className="space-y-md">
              <DetailRow icon="sports_esports" label="Game"          value={game} />
              <DetailRow icon="schedule"       label="Time"          value={`${dateTime} EST`} />
              <DetailRow icon="military_tech"  label="Posting Rank"  value={rank} />
              <DetailRow icon="swap_vert"      label="Opponent Rank" value={rankRange} />
              <DetailRow icon="public"         label="Region"        value={region} />
              <DetailRow
                icon="star"
                label="ScrimGG Rating"
                value={`${rating} / 5.0`}
                last
              />
            </div>
          </section>

          {/* ── About the org ─────────────────────────────────────── */}
          <section className="bg-surface-container-lowest rounded-xl p-lg shadow-[0_4px_20px_0_rgba(0,0,0,0.04)] border border-surface-container-highest">
            <h2 className="font-headline-3 text-headline-3 mb-md">About the Team</h2>
            <div className="flex items-center gap-md">
              <div className="w-12 h-12 rounded-xl bg-surface-container-high flex items-center justify-center font-headline-2 text-headline-2 text-on-surface font-bold shrink-0">
                {teamInitials}
              </div>
              <div>
                <p className="font-label-bold text-label-bold text-on-surface flex items-center gap-1">
                  {teamName}
                  {verified && (
                    <MaterialSymbol className="text-[14px] text-primary" fill>verified</MaterialSymbol>
                  )}
                </p>
                <p className="font-label-small text-label-small text-on-surface-variant">{orgName}</p>
                {org?.type && (
                  <p className="font-label-small text-label-small text-outline capitalize mt-0.5">
                    {org.type.replace("_", " ")}
                  </p>
                )}
              </div>
            </div>
          </section>

        </main>
      )}
    </div>
  );
}
