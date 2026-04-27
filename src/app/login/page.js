"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import MaterialSymbol from "@/components/MaterialSymbol";
import { storeAuthSession } from "@/lib/auth-session";
import { supabase } from "@/lib/supabase";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setIsLoading(true);
    setErrorMessage("");

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setErrorMessage(error.message);
      setIsLoading(false);
      return;
    }

    storeAuthSession(data.session);
    router.push("/");
    router.refresh();
  }

  return (
    <main className="min-h-screen bg-background px-margin-mobile py-xl text-on-background">
      <section className="mx-auto flex min-h-[calc(100vh-64px)] max-w-[440px] flex-col justify-center">
        <div className="mb-xl flex items-center gap-sm">
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-primary-fixed text-primary">
            <MaterialSymbol fill>sports_esports</MaterialSymbol>
          </div>
          <span className="text-xl font-bold tracking-tight text-on-surface">ScrimGG</span>
        </div>

        <div className="rounded-[16px] border border-outline-variant/30 bg-surface-container-lowest p-lg shadow-[0_8px_28px_rgba(0,0,0,0.06)]">
          <p className="mb-xs font-label-bold text-label-bold uppercase tracking-wider text-outline">
            Welcome Back
          </p>
          <h1 className="font-editorial-large text-editorial-large text-on-surface">Log in</h1>
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
            New to ScrimGG?{" "}
            <Link className="font-label-bold text-primary hover:text-on-primary-fixed-variant" href="/signup">
              Create an account
            </Link>
          </p>
        </div>
      </section>
    </main>
  );
}
