"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import MaterialSymbol from "./MaterialSymbol";
import MatchmakeLogo from "./MatchmakeLogo";
import { clearAuthSession } from "@/lib/auth-session";
import { supabase } from "@/lib/supabase";

const navItems = [
  { label: "Scrims",   href: "/" },
  { label: "Org",      href: "/org" },
  { label: "Requests", href: "/requests" },
  { label: "Calendar", href: "/calendar" },
];

export default function TopBar({ right }) {
  const pathname = usePathname();
  const router = useRouter();
  const [pendingRequestCount, setPendingRequestCount] = useState(0);

  useEffect(() => {
    let isMounted = true;

    async function fetchPendingRequestCount() {
      const { data: userData } = await supabase.auth.getUser();

      if (!userData.user) {
        if (isMounted) setPendingRequestCount(0);
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from("users")
        .select("org_id")
        .eq("id", userData.user.id)
        .single();

      if (profileError || !profile?.org_id) {
        if (isMounted) setPendingRequestCount(0);
        return;
      }

      const { data: teams, error: teamsError } = await supabase
        .from("teams")
        .select("id")
        .eq("org_id", profile.org_id);

      if (teamsError || !teams?.length) {
        if (isMounted) setPendingRequestCount(0);
        return;
      }

      const { count, error: countError } = await supabase
        .from("scrim_requests")
        .select("id", { count: "exact", head: true })
        .in("posting_team_id", teams.map((team) => team.id))
        .eq("status", "pending")
        .not("matched_team_id", "is", null);

      if (!isMounted) return;
      setPendingRequestCount(countError ? 0 : count || 0);
    }

    fetchPendingRequestCount();

    const intervalId = window.setInterval(fetchPendingRequestCount, 30000);

    return () => {
      isMounted = false;
      window.clearInterval(intervalId);
    };
  }, [pathname]);

  async function handleLogout() {
    await supabase.auth.signOut();
    clearAuthSession();
    router.push("/login");
    router.refresh();
  }

  return (
    <header className="bg-white/80 backdrop-blur-md text-on-surface w-full top-0 sticky z-50 border-b border-surface-variant flex items-center justify-between px-5 h-16">
      {/* Left: logo */}
      <Link href="/" className="flex items-center active:scale-95 transition-transform" aria-label="Matchmake home">
        <MatchmakeLogo height={52} />
      </Link>

      {/* Centre: desktop nav */}
      <nav className="hidden md:flex items-center gap-1" aria-label="Primary navigation">
        {navItems.map((item) => {
          const isActive =
            item.href === "/"
              ? pathname === "/"
              : pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.label}
              href={item.href}
              className={
                isActive
                  ? "text-primary font-label-bold font-bold bg-primary-fixed px-3 py-2 rounded-lg"
                  : "text-on-surface-variant font-label-bold hover:bg-surface-container transition-colors px-3 py-2 rounded-lg"
              }
            >
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Right: slot (defaults to notifications bell) */}
      <div className="flex items-center gap-sm">
        {right ?? (
          <Link
            className="relative w-10 h-10 flex items-center justify-center rounded-full hover:bg-surface-container transition-colors active:scale-95"
            href="/requests"
            title={pendingRequestCount > 0 ? `${pendingRequestCount} pending scrim request${pendingRequestCount === 1 ? "" : "s"}` : "No pending scrim requests"}
          >
            <MaterialSymbol className="text-on-surface-variant">notifications</MaterialSymbol>
            {pendingRequestCount > 0 && (
              <span className="absolute right-1 top-1 flex min-w-5 items-center justify-center rounded-full bg-error px-1 text-[11px] font-bold leading-5 text-on-error">
                {pendingRequestCount > 9 ? "9+" : pendingRequestCount}
              </span>
            )}
          </Link>
        )}
        <button
          className="rounded-full bg-surface-container-high px-md py-sm font-label-bold text-label-bold text-on-surface-variant transition-colors hover:bg-surface-variant"
          onClick={handleLogout}
          type="button"
        >
          Log out
        </button>
      </div>
    </header>
  );
}
