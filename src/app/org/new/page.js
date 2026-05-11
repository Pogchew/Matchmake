"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import BottomNav from "@/components/BottomNav";
import MaterialSymbol from "@/components/MaterialSymbol";
import TopBar from "@/components/TopBar";
import { TEAM_LOCATION_OPTIONS } from "@/lib/game-options";
import { supabase } from "@/lib/supabase";

const initialForm = {
  name: "",
  type: "amateur",
  region: "East Coast",
};

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

function getFallbackDisplayName(email = "") {
  return email.split("@")[0] || "Matchmake User";
}

export default function NewOrgPage() {
  const router = useRouter();
  const [form, setForm] = useState(initialForm);
  const [errorMessage, setErrorMessage] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  function handleChange(event) {
    const { name, value } = event.target;
    setForm((currentForm) => ({
      ...currentForm,
      [name]: value,
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setIsSaving(true);
    setErrorMessage("");

    try {
      const { data: userData, error: userError } = await supabase.auth.getUser();

      if (userError || !userData.user) {
        router.push("/login");
        return;
      }

      const authUser = userData.user;

      const { data: existingProfile, error: profileError } = await supabase
        .from("users")
        .select("id, org_id, display_name")
        .eq("id", authUser.id)
        .maybeSingle();

      if (profileError) {
        console.error("Failed to load profile before creating organization", profileError);
        setErrorMessage("We could not load your profile. Please try again.");
        return;
      }

      if (existingProfile?.org_id) {
        router.push("/org");
        router.refresh();
        return;
      }

      const { error: userUpsertError } = await supabase.from("users").upsert({
        id: authUser.id,
        email: authUser.email,
        account_type: "org",
        display_name: existingProfile?.display_name || getFallbackDisplayName(authUser.email),
        updated_at: new Date().toISOString(),
      });

      if (userUpsertError) {
        console.error("Failed to prepare profile before creating organization", userUpsertError);
        setErrorMessage(userUpsertError.message);
        return;
      }

      const { data: organization, error: orgError } = await supabase
        .from("organizations")
        .insert({
          name: form.name,
          type: form.type,
          region: form.region,
          verified_flag: false,
          org_admin_id: authUser.id,
        })
        .select("id")
        .single();

      if (orgError) {
        console.error("Failed to create organization", orgError);
        setErrorMessage(orgError.message);
        return;
      }

      const { error: updateUserError } = await supabase
        .from("users")
        .update({
          org_id: organization.id,
          updated_at: new Date().toISOString(),
        })
        .eq("id", authUser.id);

      if (updateUserError) {
        console.error("Failed to attach organization to profile", updateUserError);
        setErrorMessage(updateUserError.message);
        return;
      }

      router.push("/team/new");
      router.refresh();
    } catch (error) {
      console.error("Failed to create organization", error);
      setErrorMessage(error.message || "Something went wrong while creating your organization.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <>
      <TopBar />

      <main className="max-w-[720px] mx-auto px-margin-mobile md:px-lg pt-lg pb-xl">
        <div className="mb-lg">
          <p className="font-label-bold text-label-bold text-outline uppercase tracking-wider mb-xs">Organization Setup</p>
          <h1 className="font-editorial-large text-editorial-large text-on-surface">Create your organization</h1>
          <p className="mt-sm font-body-sub text-body-sub text-on-surface-variant">
            Add the organization that owns your teams and scrim listings.
          </p>
        </div>

        <form
          className="rounded-[16px] border border-outline-variant/30 bg-surface-container-lowest p-lg shadow-[0_8px_28px_rgba(0,0,0,0.06)] flex flex-col gap-lg"
          onSubmit={handleSubmit}
        >
          <Field label="Organization name">
            <input
              className={inputClassName()}
              name="name"
              onChange={handleChange}
              placeholder="Contenders Esports"
              required
              type="text"
              value={form.name}
            />
          </Field>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-md">
            <Field label="Organization type">
              <select className={inputClassName()} name="type" onChange={handleChange} value={form.type}>
                <option value="amateur">Amateur</option>
                <option value="collegiate">Collegiate</option>
                <option value="high_school">High School</option>
              </select>
            </Field>

            <Field label="Organization location">
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
                domain_add
              </MaterialSymbol>
              {isSaving ? "Creating..." : "Create Organization"}
            </button>
          </div>
        </form>
      </main>

      <BottomNav />
    </>
  );
}
