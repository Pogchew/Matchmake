"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import TopBar from "@/components/TopBar";
import BottomNav from "@/components/BottomNav";
import MaterialSymbol from "@/components/MaterialSymbol";

function createInitialPostForm() {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);

  return {
    gameTitle: "Valorant",
    date: tomorrow.toISOString().slice(0, 10),
    startTime: "7:00 PM EST",
    games: "3 Games",
    rankRange: "Diamond - Immortal",
    server: "NA-East",
    notes: "Looking for BO3 on Ascent/Haven.",
  };
}

const filters = [
  { label: "Oct 26", icon: "calendar_month" },
  { label: "Valorant", icon: "sports_esports", active: true, trailing: "keyboard_arrow_down" },
  { label: "Rank: Diamond+", trailing: "keyboard_arrow_down" },
  { label: "Time: Tonight", trailing: "keyboard_arrow_down" },
];

function getInitials(name = "") {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0])
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

function formatScrimTime(value) {
  if (!value) return "Time TBD";

  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function normalizeScrimRequest(scrimRequest) {
  const postingTeam = scrimRequest.posting_team || scrimRequest.teams;
  const organization = postingTeam?.organization || postingTeam?.organizations;

  return {
    id: scrimRequest.id,
    initials: getInitials(postingTeam?.name),
    team: postingTeam?.name || "Unknown Team",
    org: organization?.name || "Independent",
    game: scrimRequest.game_title,
    region: postingTeam?.region || "Region TBD",
    rank: scrimRequest.team_rank || postingTeam?.rank_tier || "Rank TBD",
    rankColor: getRankColor(scrimRequest.team_rank || postingTeam?.rank_tier),
    rating: Number(postingTeam?.scrimgg_rating || 0).toFixed(1),
    time: formatScrimTime(scrimRequest.scheduled_at),
    games: "3 Games",
    verified: Boolean(organization?.verified_flag),
  };
}

function ScrimCard({ scrim }) {
  return (
    <article className="bg-surface-container-lowest rounded-[16px] p-md border border-outline-variant/30 shadow-[0_4px_20px_rgba(0,0,0,0.04)] hover:shadow-[0_8px_24px_rgba(0,0,0,0.08)] transition-shadow">
      <div className="flex items-start justify-between mb-md">
        <div className="flex items-center gap-sm">
          <div className="w-12 h-12 rounded-xl bg-surface-container-high flex items-center justify-center font-headline-2 text-headline-2 text-on-surface font-bold">
            {scrim.initials}
          </div>
          <div>
            <h2 className="font-headline-3 text-headline-3 text-on-surface flex items-center gap-1">
              {scrim.team}
              {scrim.verified && (
                <MaterialSymbol className="text-[16px] text-primary" fill>
                  verified
                </MaterialSymbol>
              )}
            </h2>
            <p className="font-label-small text-label-small text-on-surface-variant">{scrim.org}</p>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-xs mb-md">
        <span className="bg-primary-fixed text-on-primary-fixed font-label-small text-label-small px-2 py-1 rounded-full">
          {scrim.game}
        </span>
        <span className="bg-surface-container-high text-on-surface-variant font-label-small text-label-small px-2 py-1 rounded-full">
          {scrim.region}
        </span>
        <span className="bg-surface-container-high text-on-surface-variant font-label-small text-label-small px-2 py-1 rounded-full flex items-center gap-1">
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: scrim.rankColor }} />
          {scrim.rank}
        </span>
        <span className="bg-surface-container-high text-on-surface-variant font-label-small text-label-small px-2 py-1 rounded-full flex items-center gap-1">
          <MaterialSymbol className="text-[12px] text-[#ffb400]" fill>
            star
          </MaterialSymbol>
          {scrim.rating}
        </span>
      </div>

      <div className="flex items-center justify-between pt-sm border-t border-surface-variant">
        <div className="flex items-center gap-1 text-on-surface-variant font-label-bold text-label-bold">
          <MaterialSymbol className="text-[18px]">schedule</MaterialSymbol>
          {scrim.time} &bull; {scrim.games}
        </div>
        <a
          href={`/scrims/${scrim.id}`}
          className="bg-primary text-on-primary font-label-bold text-label-bold px-lg py-sm rounded-full active:scale-95 transition-transform"
        >
          Scrim
        </a>
      </div>
    </article>
  );
}

function Field({ label, children }) {
  return (
    <label className="flex flex-col gap-sm">
      <span className="font-label-bold text-label-bold text-on-surface-variant uppercase tracking-wider">{label}</span>
      {children}
    </label>
  );
}

function SelectField({ icon, children, ...props }) {
  return (
    <div className="relative">
      <select
        className="w-full bg-surface-container-low text-on-surface font-body-main text-body-main rounded-xl border-none py-md px-md pr-xl appearance-none focus:ring-2 focus:ring-primary"
        {...props}
      >
        {children}
      </select>
      <MaterialSymbol className="absolute right-md top-1/2 -translate-y-1/2 text-on-surface-variant pointer-events-none">
        {icon}
      </MaterialSymbol>
    </div>
  );
}

function TextInput({ icon, ...props }) {
  return (
    <div className="relative">
      <input
        className="w-full bg-surface-container-low text-on-surface font-body-main text-body-main rounded-xl border-none py-md px-md pr-xl focus:ring-2 focus:ring-primary"
        type="text"
        {...props}
      />
      <MaterialSymbol className="absolute right-md top-1/2 -translate-y-1/2 text-on-surface-variant pointer-events-none">
        {icon}
      </MaterialSymbol>
    </div>
  );
}

function getOpponentRankBounds(rankRange) {
  const parts = rankRange.split(" - ").map((part) => part.trim());
  return {
    opponentRankMin: parts[0] || rankRange,
    opponentRankMax: parts[1] || parts[0] || rankRange,
  };
}

function parseScheduledAt(dateValue, timeValue) {
  const timeMatch = timeValue.match(/(\d{1,2})(?::(\d{2}))?\s*(AM|PM)?/i);
  const scheduledAt = new Date(`${dateValue}T00:00:00`);

  if (Number.isNaN(scheduledAt.getTime()) || !timeMatch) {
    return null;
  }

  let hours = Number(timeMatch[1]);
  const minutes = Number(timeMatch[2] || 0);
  const meridiem = timeMatch[3]?.toUpperCase();

  if (meridiem === "PM" && hours < 12) hours += 12;
  if (meridiem === "AM" && hours === 12) hours = 0;

  scheduledAt.setHours(hours, minutes, 0, 0);
  return scheduledAt.toISOString();
}

function PostScrimModal({
  form,
  isOpen,
  isPosting,
  onChange,
  onClose,
  onSubmit,
  postError,
}) {
  if (!isOpen) return null;

  return (
    <>
      <button
        aria-label="Close post scrim modal"
        className="fixed inset-0 bg-black/40 z-40"
        onClick={onClose}
      />

      <div className="fixed bottom-0 left-0 right-0 z-50 md:items-center md:justify-center md:inset-0 md:flex">
        <div className="w-full md:w-[600px] md:mx-auto bg-surface rounded-t-[32px] md:rounded-[32px] shadow-[0_8px_32px_rgba(0,0,0,0.12)] flex flex-col max-h-[90vh] overflow-hidden">
          <div className="flex items-center justify-between px-margin-mobile pt-lg pb-md border-b border-surface-variant relative">
            <div className="md:hidden w-12 h-1.5 bg-outline-variant rounded-full absolute top-3 left-1/2 -translate-x-1/2" />
            <button
              className="text-primary hover:text-on-primary-fixed-variant transition-colors p-sm -ml-sm"
              onClick={onClose}
              type="button"
            >
              <MaterialSymbol className="text-2xl">close</MaterialSymbol>
            </button>
            <h2 className="font-headline-2 text-headline-2 text-on-surface">New Scrim Listing</h2>
            <button
              className="text-primary font-label-bold text-label-bold hover:text-on-primary-fixed-variant transition-colors px-sm py-xs"
              type="button"
            >
              Drafts
            </button>
          </div>

          <form className="overflow-y-auto px-margin-mobile py-lg flex flex-col gap-lg flex-grow" onSubmit={onSubmit}>
            <Field label="Select Game">
              <SelectField icon="expand_more" name="gameTitle" onChange={onChange} value={form.gameTitle}>
                <option>Valorant</option>
                <option>Counter-Strike 2</option>
                <option>League of Legends</option>
                <option>Rocket League</option>
              </SelectField>
            </Field>

            <Field label="Date">
              <input
                className="w-full bg-surface-container-low text-on-surface font-body-main text-body-main rounded-xl border-none py-md px-md focus:ring-2 focus:ring-primary"
                name="date"
                onChange={onChange}
                type="date"
                value={form.date}
              />
            </Field>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-md">
              <Field label="Start Time">
                <TextInput
                  icon="schedule"
                  name="startTime"
                  onChange={onChange}
                  placeholder="e.g., 7:00 PM EST"
                  value={form.startTime}
                />
              </Field>
              <Field label="Number of Games">
                <SelectField icon="expand_more" name="games" onChange={onChange} value={form.games}>
                  <option>1 Game</option>
                  <option>2 Games</option>
                  <option>3 Games</option>
                  <option>4 Games</option>
                  <option>5+ Games</option>
                </SelectField>
              </Field>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-md">
              <Field label="Rank Range">
                <SelectField icon="military_tech" name="rankRange" onChange={onChange} value={form.rankRange}>
                  <option>Diamond - Immortal</option>
                  <option>Platinum - Diamond</option>
                  <option>Immortal - Radiant</option>
                </SelectField>
              </Field>
              <Field label="Server">
                <SelectField icon="public" name="server" onChange={onChange} value={form.server}>
                  <option>NA-East</option>
                  <option>NA-West</option>
                  <option>NA-Central</option>
                  <option>EU-West</option>
                </SelectField>
              </Field>
            </div>

            <Field label="Additional Notes">
              <textarea
                className="w-full bg-surface-container-low text-on-surface font-body-main text-body-main rounded-xl border-none py-md px-md focus:ring-2 focus:ring-primary resize-none"
                name="notes"
                onChange={onChange}
                placeholder="Any specific map requests, format (BO3, BO5), or rules..."
                rows={3}
                value={form.notes}
              />
            </Field>

            {postError && (
              <div className="rounded-xl bg-error-container px-md py-sm font-body-sub text-body-sub text-on-error-container">
                {postError}
              </div>
            )}

            <div className="-mx-margin-mobile -mb-lg px-margin-mobile py-lg border-t border-surface-variant bg-surface">
              <button
                className="w-full bg-primary hover:bg-on-primary-fixed-variant text-on-primary font-headline-3 text-headline-3 rounded-xl py-md px-lg transition-colors flex items-center justify-center gap-sm active:scale-[0.98]"
                disabled={isPosting}
                type="submit"
              >
                <MaterialSymbol className="text-2xl" fill>
                  send
                </MaterialSymbol>
                {isPosting ? "Posting..." : "Post to Scrim Board"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}

export default function ScrimBoardPage() {
  const [isPostModalOpen, setIsPostModalOpen] = useState(false);
  const [activeChip, setActiveChip] = useState("Valorant");
  const [showToast, setShowToast] = useState(false);
  const [scrimRequests, setScrimRequests] = useState([]);
  const [isLoadingScrims, setIsLoadingScrims] = useState(true);
  const [scrimError, setScrimError] = useState("");
  const [postForm, setPostForm] = useState(() => createInitialPostForm());
  const [isPosting, setIsPosting] = useState(false);
  const [postError, setPostError] = useState("");

  async function fetchScrimRequests() {
    setIsLoadingScrims(true);
    setScrimError("");

    const { data, error } = await supabase
      .from("scrim_requests")
      .select(
        `
        id,
        posting_team_id,
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
            verified_flag
          )
        )
      `
      )
      .eq("status", "open")
      .gt("expires_at", new Date().toISOString())
      .order("scheduled_at", { ascending: true });

    if (error) {
      setScrimError(error.message);
      setScrimRequests([]);
    } else {
      setScrimRequests(data || []);
    }

    setIsLoadingScrims(false);
  }

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("post") === "true") {
      setIsPostModalOpen(true);
    }
  }, []);

  useEffect(() => {
    fetchScrimRequests();
  }, []);

  useEffect(() => {
    document.body.style.overflow = isPostModalOpen ? "hidden" : "";

    return () => {
      document.body.style.overflow = "";
    };
  }, [isPostModalOpen]);

  function handlePostFormChange(event) {
    const { name, value } = event.target;
    setPostForm((currentForm) => ({
      ...currentForm,
      [name]: value,
    }));
  }

  async function resolvePostingTeam(userId, gameTitle) {
    const { data: profile, error: profileError } = await supabase
      .from("users")
      .select("id, org_id")
      .eq("id", userId)
      .single();

    if (profileError) {
      console.error("Failed to load user profile for scrim post", profileError);
      throw new Error("We could not load your profile. Please try again.");
    }

    if (!profile?.org_id) {
      throw new Error("Create an organization before posting a scrim.");
    }

    const { data: teams, error: teamsError } = await supabase
      .from("teams")
      .select("id, game_title, rank_tier")
      .eq("org_id", profile.org_id)
      .order("created_at", { ascending: true });

    if (teamsError) {
      console.error("Failed to load teams for scrim post", teamsError);
      throw new Error("We could not load your teams. Please try again.");
    }

    if (!teams?.length) {
      throw new Error("Create a team before posting a scrim.");
    }

    return teams.find((team) => team.game_title === gameTitle) || teams[0];
  }

  async function submitPost(event) {
    event.preventDefault();
    setIsPosting(true);
    setPostError("");

    try {
      const { data: userData, error: userError } = await supabase.auth.getUser();

      if (userError || !userData.user) {
        setPostError("Log in before posting a scrim.");
        return;
      }

      const postingTeam = await resolvePostingTeam(userData.user.id, postForm.gameTitle);
      const scheduledAt = parseScheduledAt(postForm.date, postForm.startTime);

      if (!scheduledAt) {
        setPostError("Enter a valid date and start time.");
        return;
      }

      const { opponentRankMin, opponentRankMax } = getOpponentRankBounds(postForm.rankRange);
      const expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString();

      const { error: insertError } = await supabase.from("scrim_requests").insert({
        posting_team_id: postingTeam.id,
        game_title: postForm.gameTitle,
        scheduled_at: scheduledAt,
        team_rank: postingTeam.rank_tier || postForm.rankRange,
        opponent_rank_min: opponentRankMin,
        opponent_rank_max: opponentRankMax,
        status: "open",
        matched_team_id: null,
        expires_at: expiresAt,
      });

      if (insertError) {
        console.error("Failed to post scrim request", insertError);
        setPostError(insertError.message);
        return;
      }

      setIsPostModalOpen(false);
      setPostForm(createInitialPostForm());
      setShowToast(true);
      window.setTimeout(() => setShowToast(false), 2500);
      await fetchScrimRequests();
    } catch (error) {
      console.error("Failed to post scrim request", error);
      setPostError(error.message || "Something went wrong while posting your scrim.");
    } finally {
      setIsPosting(false);
    }
  }

  return (
    <>
      <TopBar />

      <main className="max-w-[1200px] mx-auto px-margin-mobile md:px-lg pt-lg pb-xl">
        <div className="mb-lg flex items-start justify-between gap-4">
          <div>
            <p className="font-label-bold text-label-bold text-outline uppercase tracking-wider mb-xs">ACTIVE LISTINGS</p>
            <h1 className="font-editorial-large text-editorial-large text-on-surface">Scrim Board</h1>
          </div>
          <button
            className="bg-primary hover:bg-on-primary-fixed-variant text-on-primary font-label-bold text-label-bold px-4 py-2 md:px-lg md:py-3 rounded-full active:scale-95 transition-all shadow-[0_4px_14px_rgba(0,88,188,0.3)] whitespace-nowrap mt-4"
            onClick={() => setIsPostModalOpen(true)}
            type="button"
          >
            Post LF Scrim
          </button>
        </div>

        <div className="flex flex-col gap-sm mb-xl">
          <div className="relative w-full">
            <MaterialSymbol className="absolute left-sm top-1/2 -translate-y-1/2 text-outline">
              search
            </MaterialSymbol>
            <input
              className="w-full bg-surface-container-high border-none rounded-lg py-sm pl-xl pr-sm font-body-sub text-body-sub text-on-surface placeholder:text-outline focus:ring-2 focus:ring-primary focus:bg-surface-container-lowest transition-colors h-[44px]"
              placeholder="Search teams, orgs, or regions..."
              type="text"
            />
          </div>

          <div className="flex items-center gap-xs overflow-x-auto pb-xs scrollbar-hide -mx-margin-mobile px-margin-mobile md:mx-0 md:px-0">
            {filters.map((filter) => {
              const isActive = activeChip === filter.label;

              return (
                <button
                  className={
                    isActive
                      ? "chip whitespace-nowrap bg-primary text-on-primary font-label-bold text-label-bold px-md py-sm rounded-full flex items-center gap-2 shadow-[0_2px_12px_rgba(0,112,235,0.25)] active:scale-95 transition-all"
                      : "chip whitespace-nowrap bg-surface-container-high hover:bg-surface-variant text-on-surface font-label-bold text-label-bold px-md py-sm rounded-full transition-colors flex items-center gap-1 border border-transparent active:scale-95"
                  }
                  key={filter.label}
                  onClick={() => setActiveChip(isActive ? "" : filter.label)}
                  type="button"
                >
                  {filter.icon && (
                    <MaterialSymbol className={isActive ? "text-[20px]" : "text-[20px] text-primary"}>
                      {filter.icon}
                    </MaterialSymbol>
                  )}
                  <span>{filter.label}</span>
                  {filter.trailing && (
                    <MaterialSymbol className={isActive ? "text-[18px] opacity-80" : "text-[16px]"}>
                      {filter.trailing}
                    </MaterialSymbol>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {isLoadingScrims ? (
          <div className="rounded-[16px] border border-outline-variant/30 bg-surface-container-lowest p-md font-body-sub text-body-sub text-on-surface-variant">
            Loading scrims...
          </div>
        ) : scrimError ? (
          <div className="rounded-[16px] border border-outline-variant/30 bg-surface-container-lowest p-md font-body-sub text-body-sub text-on-surface-variant">
            Unable to load scrims: {scrimError}
          </div>
        ) : scrimRequests.length === 0 ? (
          <div className="rounded-[16px] border border-outline-variant/30 bg-surface-container-lowest p-md font-body-sub text-body-sub text-on-surface-variant">
            No active scrims found.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-md">
            {scrimRequests.map((scrimRequest) => (
              <ScrimCard key={scrimRequest.id} scrim={normalizeScrimRequest(scrimRequest)} />
            ))}
          </div>
        )}
      </main>

      <PostScrimModal
        form={postForm}
        isOpen={isPostModalOpen}
        isPosting={isPosting}
        onChange={handlePostFormChange}
        onClose={() => setIsPostModalOpen(false)}
        onSubmit={submitPost}
        postError={postError}
      />

      <BottomNav />

      {showToast && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 bg-on-surface text-inverse-on-surface font-label-bold text-label-bold px-6 py-3 rounded-full shadow-lg z-50 transition-all">
          Posted to Scrim Board
        </div>
      )}
    </>
  );
}
