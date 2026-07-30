"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import MatchmakeLogo from "@/components/MatchmakeLogo";
import MaterialSymbol from "@/components/MaterialSymbol";
import { signInWithPasswordSafely } from "@/lib/auth-login";
import { storeAuthSession } from "@/lib/auth-session";
import { supabaseAuth } from "@/lib/supabase";

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setIsLoading(true);
    setErrorMessage("");

    const { data, error } = await signInWithPasswordSafely(supabaseAuth, { email, password });

    if (error || !data.session) {
      setErrorMessage(error?.message || "We could not start an owner session.");
      setIsLoading(false);
      return;
    }

    const { data: ownerAccess, error: ownerError } = await supabaseAuth.rpc("is_matchmake_owner");

    if (ownerError || ownerAccess !== true) {
      await supabaseAuth.auth.signOut();
      setErrorMessage("This account is not approved for Matchmake owner access.");
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

    router.push("/admin");
    router.refresh();
  }

  return (
    <main className="grid min-h-screen place-items-center bg-[#06142b] px-margin-mobile py-xl text-white">
      <section className="w-full max-w-[440px] rounded-[20px] border border-white/10 bg-[#0b1c37] p-lg shadow-[0_28px_90px_rgba(0,0,0,0.34)]">
        <div className="flex items-center justify-between border-b border-white/10 pb-md">
          <div className="flex items-center gap-sm">
            <MatchmakeLogo height={46} />
            <div>
              <p className="font-headline-3 text-[18px] font-semibold">Owner admin</p>
              <p className="font-label-small text-[11px] text-white/55">Restricted operations access</p>
            </div>
          </div>
          <MaterialSymbol className="text-[24px] text-[#4aa3ff]" fill>shield_lock</MaterialSymbol>
        </div>

        <div className="py-lg">
          <h1 className="font-headline-1 text-[28px] text-white">Sign in to Live Ops</h1>
          <p className="mt-xs font-body-sub text-[14px] leading-5 text-white/60">
            Only explicitly approved owner accounts can open this dashboard.
          </p>
        </div>

        <form className="space-y-md" onSubmit={handleSubmit}>
          <label className="block">
            <span className="mb-xs block font-label-bold text-[12px] text-white/70">Owner email</span>
            <input
              autoComplete="username"
              className="h-12 w-full rounded-xl border border-white/10 bg-white/5 px-md text-[15px] text-white placeholder:text-white/30 focus:border-[#4aa3ff] focus:ring-2 focus:ring-[#4aa3ff]/25"
              onChange={(event) => setEmail(event.target.value)}
              placeholder="owner@matchmake.gg"
              required
              type="email"
              value={email}
            />
          </label>

          <label className="block">
            <span className="mb-xs block font-label-bold text-[12px] text-white/70">Password</span>
            <input
              autoComplete="current-password"
              className="h-12 w-full rounded-xl border border-white/10 bg-white/5 px-md text-[15px] text-white placeholder:text-white/30 focus:border-[#4aa3ff] focus:ring-2 focus:ring-[#4aa3ff]/25"
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Your owner password"
              required
              type="password"
              value={password}
            />
          </label>

          {errorMessage && (
            <div className="rounded-xl border border-[#ff8b86]/30 bg-[#5a1117]/40 px-md py-sm text-[13px] text-[#ffd9d6]" role="alert">
              {errorMessage}
            </div>
          )}

          <button
            className="flex h-12 w-full items-center justify-center gap-sm rounded-xl bg-[#0878eb] font-label-bold text-[14px] text-white shadow-[0_8px_24px_rgba(0,119,235,0.28)] transition hover:bg-[#1685f4] disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isLoading}
            type="submit"
          >
            <MaterialSymbol className="text-[19px]" fill>admin_panel_settings</MaterialSymbol>
            {isLoading ? "Checking owner access..." : "Open admin dashboard"}
          </button>
        </form>

        <Link className="mt-lg flex items-center justify-center gap-xs text-[13px] text-white/55 hover:text-white" href="/login">
          <MaterialSymbol className="text-[17px]">arrow_back</MaterialSymbol>
          Return to Matchmake
        </Link>
      </section>
    </main>
  );
}
