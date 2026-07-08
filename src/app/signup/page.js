"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import MatchmakeLogo from "@/components/MatchmakeLogo";
import { storeAuthSession } from "@/lib/auth-session";
import { trackLaunchAnalyticsEvent } from "@/lib/launch-analytics";
import { supabaseAuth } from "@/lib/supabase";

export default function SignupPage() {
  const router = useRouter();
  const [displayName, setDisplayName] = useState("");
  const [orgName, setOrgName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(event) {
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
      setErrorMessage("Signup did not return a user. Please try logging in.");
      setIsLoading(false);
      return;
    }

    if (!authData.session) {
      setErrorMessage("Check your email to confirm your account, then log in to finish setup.");
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
      const { error: updateUserError } = await supabaseAuth
        .from("users")
        .update({ org_id: orgData.id })
        .eq("id", authUser.id);

      if (updateUserError) {
        setErrorMessage(updateUserError.message);
        setIsLoading(false);
        return;
      }
    }

    try {
      await storeAuthSession(authData.session);
    } catch (sessionError) {
      setErrorMessage(sessionError.message);
      setIsLoading(false);
      return;
    }

    await trackLaunchAnalyticsEvent({
      eventName: "signup_completed",
      status: "success",
      targetLabel: "Organization signup",
      entityId: orgData?.id || null,
      details: "Signup completed",
      metadata: {
        account_type: "org",
        has_org: Boolean(orgData?.id),
      },
    });

    router.push("/team/new");
    router.refresh();
  }

  return (
    <main className="min-h-screen bg-background px-margin-mobile py-xl text-on-background">
      <section className="mx-auto flex min-h-[calc(100vh-64px)] max-w-[480px] flex-col justify-center">
        <div className="mb-xl flex items-center">
          <MatchmakeLogo height={72} />
        </div>

        <div className="rounded-[16px] border border-outline-variant/30 bg-surface-container-lowest p-lg shadow-[0_8px_28px_rgba(0,0,0,0.06)]">
          <p className="mb-xs font-label-bold text-label-bold uppercase tracking-wider text-outline">
            Team Workspace
          </p>
          <h1 className="font-editorial-large text-editorial-large text-on-surface">Create account</h1>
          <p className="mt-sm font-body-sub text-body-sub text-on-surface-variant">
            Set up your organization account and start scheduling scrims.
          </p>

          <form className="mt-xl flex flex-col gap-md" onSubmit={handleSubmit}>
            <label className="flex flex-col gap-sm">
              <span className="font-label-bold text-label-bold text-on-surface-variant">Display name</span>
              <input
                className="h-[48px] rounded-xl border-none bg-surface-container-low px-md font-body-main text-body-main text-on-surface placeholder:text-outline focus:ring-2 focus:ring-primary"
                onChange={(event) => setDisplayName(event.target.value)}
                placeholder="Alex Coach"
                required
                type="text"
                value={displayName}
              />
            </label>

            <label className="flex flex-col gap-sm">
              <span className="font-label-bold text-label-bold text-on-surface-variant">Organization name</span>
              <input
                className="h-[48px] rounded-xl border-none bg-surface-container-low px-md font-body-main text-body-main text-on-surface placeholder:text-outline focus:ring-2 focus:ring-primary"
                onChange={(event) => setOrgName(event.target.value)}
                placeholder="Contenders Esports"
                required
                type="text"
                value={orgName}
              />
            </label>

            <label className="flex flex-col gap-sm">
              <span className="font-label-bold text-label-bold text-on-surface-variant">Email</span>
              <input
                className="h-[48px] rounded-xl border-none bg-surface-container-low px-md font-body-main text-body-main text-on-surface placeholder:text-outline focus:ring-2 focus:ring-primary"
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
                required
                type="email"
                value={email}
              />
            </label>

            <label className="flex flex-col gap-sm">
              <span className="font-label-bold text-label-bold text-on-surface-variant">Password</span>
              <input
                className="h-[48px] rounded-xl border-none bg-surface-container-low px-md font-body-main text-body-main text-on-surface placeholder:text-outline focus:ring-2 focus:ring-primary"
                minLength={6}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="At least 6 characters"
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
              {isLoading ? "Creating account..." : "Create account"}
            </button>
          </form>

          <p className="mt-lg text-center font-body-sub text-body-sub text-on-surface-variant">
            Already have an account?{" "}
            <Link className="font-label-bold text-primary hover:text-on-primary-fixed-variant" href="/login">
              Log in
            </Link>
          </p>
        </div>
      </section>
    </main>
  );
}
