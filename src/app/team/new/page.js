"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useState } from "react";
import BottomNav from "@/components/BottomNav";
import MaterialSymbol from "@/components/MaterialSymbol";
import TopBar from "@/components/TopBar";
import { getCurrentUser } from "@/lib/auth-session";
import { GAME_OPTIONS, TEAM_LOCATION_OPTIONS, getDefaultModeForGame, getDefaultRankForGame, getModesForGame, getRanksForGame } from "@/lib/game-options";
import { supabase } from "@/lib/supabase";

const initialForm = {
  name: "",
  gameTitle: "Valorant",
  mode: "5v5",
  rankTier: getDefaultRankForGame("Valorant"),
  region: "East Coast",
  rosterNames: "",
};

function mergeIds(existingIds = [], nextId) {
  return Array.from(new Set([...(existingIds || []), nextId].filter(Boolean)));
}

function Field({ label, children }) {
  return (
    <label className="flex flex-col gap-sm">
      <span className="font-label-bold text-label-bold text-on-surface-variant">{label}</span>
      {children}
    </label>
  );
}

function inputClassName() {
  return "h-[48px] rounded-xl border-none bg-surface-container-low px-md font-body-main text-body-main text-on-surface placeholder:text-outline focus:ring-2 focus:ring-primary";
}

export default function NewTeamPage() {
  const router = useRouter();
  const [form, setForm] = useState(initialForm);
  const [errorMessage, setErrorMessage] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  function handleChange(event) {
    const { name, value } = event.target;
    setForm((currentForm) => ({
      ...currentForm,
      [name]: value,
      ...(name === "gameTitle"
        ? {
            mode: getDefaultModeForGame(value),
            rankTier: getDefaultRankForGame(value),
          }
        : {}),
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setIsSaving(true);
    setErrorMessage("");

    try {
      const { data: userData, error: userError } = await getCurrentUser();

      if (userError || !userData.user) {
        router.push("/login");
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from("users")
        .select("id, org_id, team_ids")
        .eq("id", userData.user.id)
        .single();

      if (profileError) {
        console.error("Failed to load profile before creating team", profileError);
        setErrorMessage("We could not load your profile. Please try again.");
        return;
      }

      if (!profile?.org_id) {
        setErrorMessage("Create an organization before adding a team.");
        return;
      }

      const { data: team, error: teamError } = await supabase
        .from("teams")
        .insert({
          org_id: profile.org_id,
          name: form.name,
          game_title: form.gameTitle,
          mode: form.mode,
          roster: [],
          captain_id: userData.user.id,
          coach_poc_id: userData.user.id,
          rank_tier: form.rankTier,
          rank_verification_type: "coach_declared",
          rank_updated_at: new Date().toISOString(),
          scrimgg_rating: 5.0,
          region: form.region,
        })
        .select("id")
        .single();

      if (teamError) {
        console.error("Failed to create team", teamError);
        setErrorMessage(teamError.message);
        return;
      }

      const nextUserTeamIds = mergeIds(profile.team_ids, team.id);
      const { error: updateUserError } = await supabase
        .from("users")
        .update({
          team_ids: nextUserTeamIds,
          updated_at: new Date().toISOString(),
        })
        .eq("id", userData.user.id);

      if (updateUserError) {
        console.error("Failed to update user team ids", updateUserError);
        setErrorMessage(updateUserError.message);
        return;
      }

      const { data: organization, error: organizationError } = await supabase
        .from("organizations")
        .select("team_ids")
        .eq("id", profile.org_id)
        .single();

      if (organizationError) {
        console.error("Failed to load organization team ids", organizationError);
        setErrorMessage(organizationError.message);
        return;
      }

      const { error: updateOrganizationError } = await supabase
        .from("organizations")
        .update({
          team_ids: mergeIds(organization?.team_ids, team.id),
          updated_at: new Date().toISOString(),
        })
        .eq("id", profile.org_id);

      if (updateOrganizationError) {
        console.error("Failed to update organization team ids", updateOrganizationError);
        setErrorMessage(updateOrganizationError.message);
        return;
      }

      router.push("/org");
      router.refresh();
    } catch (error) {
      console.error("Failed to create team", error);
      setErrorMessage(error.message || "Something went wrong while creating your team.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <>
      <TopBar />

      <main className="max-w-[720px] mx-auto px-margin-mobile md:px-lg pt-lg pb-xl">
        <div className="mb-lg">
          <p className="font-label-bold text-label-bold text-outline uppercase tracking-wider mb-xs">Team Setup</p>
          <h1 className="font-editorial-large text-editorial-large text-on-surface">Create your team</h1>
          <p className="mt-sm font-body-sub text-body-sub text-on-surface-variant">
            Add the roster your organization will use to post and request scrims.
          </p>
        </div>

        <form
          className="rounded-[16px] border border-outline-variant/30 bg-surface-container-lowest p-lg shadow-[0_8px_28px_rgba(0,0,0,0.06)] flex flex-col gap-lg"
          onSubmit={handleSubmit}
        >
          <Field label="Team name">
            <input
              className={inputClassName()}
              name="name"
              onChange={handleChange}
              placeholder="Rocket Rams"
              required
              type="text"
              value={form.name}
            />
          </Field>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-md">
            <Field label="Game">
              <select
                className={inputClassName()}
                name="gameTitle"
                onChange={handleChange}
                value={form.gameTitle}
              >
                {GAME_OPTIONS.map((game) => (
                  <option key={game}>{game}</option>
                ))}
              </select>
            </Field>

            <Field label="Mode">
              <select className={inputClassName()} name="mode" onChange={handleChange} value={form.mode}>
                {getModesForGame(form.gameTitle).map((mode) => (
                  <option key={mode}>{mode}</option>
                ))}
              </select>
            </Field>
          </div>

          <Field label="Roster names (optional)">
            <textarea
              className="min-h-[96px] rounded-xl border-none bg-surface-container-low px-md py-sm font-body-main text-body-main text-on-surface placeholder:text-outline focus:ring-2 focus:ring-primary resize-none"
              name="rosterNames"
              onChange={handleChange}
              placeholder="Player One, Player Two, Player Three"
              value={form.rosterNames}
            />
            <p className="font-label-small text-label-small text-outline">
              Player accounts are not built yet, so names are for setup reference only.
            </p>
          </Field>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-md">
            <Field label="Rank tier">
              <select
                className={inputClassName()}
                name="rankTier"
                onChange={handleChange}
                required
                value={form.rankTier}
              >
                {getRanksForGame(form.gameTitle).map((rank) => (
                  <option key={rank}>{rank}</option>
                ))}
              </select>
            </Field>

            <Field label="Team location">
              <select className={inputClassName()} name="region" onChange={handleChange} value={form.region}>
                {TEAM_LOCATION_OPTIONS.map((location) => (
                  <option key={location}>{location}</option>
                ))}
              </select>
            </Field>
          </div>

          {errorMessage && (
            <div className="rounded-xl bg-error-container px-md py-sm font-body-sub text-body-sub text-on-error-container">
              {errorMessage}
              {errorMessage.includes("organization") && (
                <div className="mt-sm">
                  <Link className="font-label-bold text-on-error-container underline" href="/org/new">
                    Create organization
                  </Link>
                </div>
              )}
            </div>
          )}

          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-sm border-t border-surface-variant pt-lg">
            <button
              className="rounded-xl bg-surface-container-high px-lg py-sm font-label-bold text-label-bold text-on-surface-variant transition-colors hover:bg-surface-variant"
              onClick={() => router.push("/org")}
              type="button"
            >
              Cancel
            </button>
            <button
              className="rounded-xl bg-primary px-lg py-sm font-label-bold text-label-bold text-on-primary shadow-[0_4px_14px_rgba(0,88,188,0.3)] transition-colors hover:bg-on-primary-fixed-variant disabled:cursor-not-allowed disabled:opacity-60 flex items-center justify-center gap-xs"
              disabled={isSaving}
              type="submit"
            >
              <MaterialSymbol className="text-[18px]" fill>
                group_add
              </MaterialSymbol>
              {isSaving ? "Creating..." : "Create Team"}
            </button>
          </div>
        </form>
      </main>

      <BottomNav />
    </>
  );
}
