"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import MaterialSymbol from "./MaterialSymbol";
import MatchmakeLogo from "./MatchmakeLogo";
import ThemeToggle from "./ThemeToggle";
import { clearAuthSession } from "@/lib/auth-session";
import { supabase } from "@/lib/supabase";

const navItems = [
  { label: "Find Scrims", icon: "sports_esports", href: "/" },
  { label: "My Org", icon: "corporate_fare", href: "/org" },
  { label: "Requests", icon: "pending_actions", href: "/requests" },
  { label: "Schedule", icon: "calendar_month", href: "/calendar" },
];

function formatNotificationTime(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const diffMs = Date.now() - date.getTime();
  if (diffMs < 0) {
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(date);
  }

  const diffMinutes = Math.floor(diffMs / 60000);
  if (diffMinutes < 1) return "Just now";
  if (diffMinutes < 60) return `${diffMinutes}m ago`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(date);
}

function getTeamName(team) {
  return team?.name || "Unknown Team";
}

function buildScrimTitle(scrim) {
  return `${getTeamName(scrim?.posting_team)} vs ${getTeamName(scrim?.matched_team)}`;
}

export default function TopBar({ actions, right }) {
  const pathname = usePathname();
  const router = useRouter();
  const notificationRef = useRef(null);
  const [notifications, setNotifications] = useState([]);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function fetchNotifications() {
      const { data: userData } = await supabase.auth.getUser();

      if (!userData.user) {
        if (isMounted) setNotifications([]);
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from("users")
        .select("org_id")
        .eq("id", userData.user.id)
        .single();

      if (profileError || !profile?.org_id) {
        if (isMounted) setNotifications([]);
        return;
      }

      const { data: teams, error: teamsError } = await supabase
        .from("teams")
        .select("id, name")
        .eq("org_id", profile.org_id);

      if (teamsError || !teams?.length) {
        if (isMounted) setNotifications([]);
        return;
      }

      const teamIds = teams.map((team) => team.id);
      const [postedResult, matchedResult] = await Promise.all([
        supabase
          .from("scrim_requests")
          .select(`
            id,
            posting_team_id,
            matched_team_id,
            game_title,
            scheduled_at,
            status,
            posting_team:teams!scrim_requests_posting_team_id_fkey (id, name),
            matched_team:teams!scrim_requests_matched_team_id_fkey (id, name)
          `)
          .in("posting_team_id", teamIds)
          .in("status", ["pending", "confirmed"])
          .not("matched_team_id", "is", null)
          .order("scheduled_at", { ascending: true }),
        supabase
          .from("scrim_requests")
          .select(`
            id,
            posting_team_id,
            matched_team_id,
            game_title,
            scheduled_at,
            status,
            posting_team:teams!scrim_requests_posting_team_id_fkey (id, name),
            matched_team:teams!scrim_requests_matched_team_id_fkey (id, name)
          `)
          .in("matched_team_id", teamIds)
          .in("status", ["pending", "confirmed"])
          .order("scheduled_at", { ascending: true }),
      ]);

      if (postedResult.error || matchedResult.error) {
        console.warn("Failed to load notification scrims", postedResult.error || matchedResult.error);
        if (isMounted) setNotifications([]);
        return;
      }

      const scrimsById = new Map([
        ...(postedResult.data || []),
        ...(matchedResult.data || []),
      ].map((scrim) => [scrim.id, scrim]));
      const scrims = [...scrimsById.values()];
      const requestItems = scrims
        .filter((scrim) => scrim.status === "pending")
        .map((scrim) => {
          const isInbound = teamIds.includes(scrim.posting_team_id);
          return {
            id: `request:${scrim.id}:${isInbound ? "in" : "out"}`,
            href: `/scrims/${scrim.id}`,
            icon: isInbound ? "pending_actions" : "outgoing_mail",
            title: isInbound
              ? `${getTeamName(scrim.matched_team)} requested your scrim`
              : `Request pending with ${getTeamName(scrim.posting_team)}`,
            body: `${scrim.game_title} · ${formatNotificationTime(scrim.scheduled_at) || "Time TBD"}`,
            timestamp: scrim.scheduled_at,
            tone: isInbound ? "primary" : "neutral",
          };
        });

      let messageItems = [];
      const chatScrimIds = scrims.map((scrim) => scrim.id);
      if (chatScrimIds.length) {
        const { data: messages, error: messagesError } = await supabase
          .from("scrim_messages")
          .select("id, scrim_request_id, sender_user_id, sender_display_name, body, created_at")
          .in("scrim_request_id", chatScrimIds)
          .neq("sender_user_id", userData.user.id)
          .order("created_at", { ascending: false })
          .limit(8);

        if (messagesError) {
          console.warn("Failed to load notification messages", messagesError);
        } else {
          messageItems = (messages || []).map((message) => {
            const scrim = scrimsById.get(message.scrim_request_id);
            return {
              id: `message:${message.id}`,
              href: `/scrims/${message.scrim_request_id}/chat`,
              icon: "chat_bubble",
              title: `New message from ${message.sender_display_name || "Opponent"}`,
              body: `${buildScrimTitle(scrim)} · ${message.body || "Open chat"}`,
              timestamp: message.created_at,
              tone: "primary",
            };
          });
        }
      }

      const confirmedItems = scrims
        .filter((scrim) => scrim.status === "confirmed")
        .slice(0, 3)
        .map((scrim) => ({
          id: `confirmed:${scrim.id}`,
          href: `/scrims/${scrim.id}`,
          icon: "event_available",
          title: "Confirmed scrim coming up",
          body: `${buildScrimTitle(scrim)} · ${formatNotificationTime(scrim.scheduled_at) || "Time TBD"}`,
          timestamp: scrim.scheduled_at,
          tone: "neutral",
        }));

      const nextNotifications = [...messageItems, ...requestItems, ...confirmedItems]
        .sort((first, second) => new Date(second.timestamp || 0) - new Date(first.timestamp || 0))
        .slice(0, 8);

      if (!isMounted) return;
      setNotifications(nextNotifications);
    }

    fetchNotifications();

    const intervalId = window.setInterval(fetchNotifications, 30000);

    return () => {
      isMounted = false;
      window.clearInterval(intervalId);
    };
  }, [pathname]);

  useEffect(() => {
    function handlePointerDown(event) {
      if (!notificationRef.current?.contains(event.target)) {
        setIsNotificationsOpen(false);
      }
    }

    if (isNotificationsOpen) {
      document.addEventListener("pointerdown", handlePointerDown);
    }

    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [isNotificationsOpen]);

  const notificationCount = notifications.length;

  async function handleLogout() {
    await supabase.auth.signOut();
    clearAuthSession();
    router.push("/login");
    router.refresh();
  }

  return (
    <header className="grid h-16 w-full grid-cols-[minmax(170px,1fr)_auto_minmax(170px,1fr)] items-center border-b border-surface-variant bg-surface/85 px-5 text-on-surface backdrop-blur-md sticky top-0 z-50">
      {/* Left: logo */}
      <Link
        href="/"
        className="flex w-fit items-center rounded-xl transition-colors active:scale-95 hover:bg-surface-container"
        aria-label="Matchmake home"
        title="Matchmake home"
      >
        <MatchmakeLogo height={52} />
      </Link>

      {/* Centre: desktop nav */}
      <nav className="hidden items-center justify-center gap-xs lg:flex" aria-label="Primary navigation">
        {navItems.map((item) => {
          const isActive =
            item.href === "/"
              ? pathname === "/"
              : pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.label}
              href={item.href}
              title={item.label}
              className={
                isActive
                  ? "flex h-10 items-center gap-xs rounded-xl bg-primary px-md font-label-bold text-label-bold text-on-primary shadow-[0_6px_18px_rgba(0,88,188,0.22)]"
                  : "flex h-10 items-center gap-xs rounded-xl border border-outline-variant/25 bg-surface-container-lowest px-md font-label-bold text-label-bold text-on-surface-variant transition-colors hover:border-primary/35 hover:bg-surface-container hover:text-primary"
              }
            >
              <MaterialSymbol className="text-[18px]" fill={isActive}>{item.icon}</MaterialSymbol>
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Right: slot (defaults to notifications bell) */}
      <div className="flex items-center justify-end gap-sm">
        {actions}
        <ThemeToggle />
        {right ?? (
          <div className="relative" ref={notificationRef}>
            <button
              aria-expanded={isNotificationsOpen}
              aria-haspopup="menu"
              className="relative w-10 h-10 flex items-center justify-center rounded-full hover:bg-surface-container transition-colors active:scale-95"
              onClick={() => setIsNotificationsOpen((current) => !current)}
              title={notificationCount > 0 ? `${notificationCount} notification${notificationCount === 1 ? "" : "s"}` : "No notifications"}
              type="button"
            >
              <MaterialSymbol className="text-on-surface-variant">notifications</MaterialSymbol>
              {notificationCount > 0 && (
                <span className="absolute right-1 top-1 flex min-w-5 items-center justify-center rounded-full bg-error px-1 text-[11px] font-bold leading-5 text-on-error">
                  {notificationCount > 9 ? "9+" : notificationCount}
                </span>
              )}
            </button>

            {isNotificationsOpen && (
              <div className="absolute right-0 top-12 z-[80] w-[min(360px,calc(100vw-24px))] overflow-hidden rounded-2xl border border-outline-variant/30 bg-surface-container-lowest shadow-[0_18px_60px_rgba(0,0,0,0.16)]">
                <div className="border-b border-outline-variant/20 px-md py-sm">
                  <p className="font-headline-3 text-headline-3 text-on-surface">Notifications</p>
                  <p className="font-label-small text-label-small text-on-surface-variant">
                    Requests, messages, and scrim updates.
                  </p>
                </div>

                {notifications.length === 0 ? (
                  <div className="p-lg text-center">
                    <MaterialSymbol className="mx-auto mb-xs block text-[34px] text-outline">notifications_off</MaterialSymbol>
                    <p className="font-label-bold text-label-bold text-on-surface">Nothing new</p>
                    <p className="mt-xs font-body-sub text-body-sub text-on-surface-variant">
                      New requests and chat messages will show up here.
                    </p>
                  </div>
                ) : (
                  <div className="max-h-[420px] overflow-y-auto py-xs">
                    {notifications.map((item) => (
                      <Link
                        className="flex gap-sm px-md py-sm transition-colors hover:bg-surface-container-low"
                        href={item.href}
                        key={item.id}
                        onClick={() => setIsNotificationsOpen(false)}
                      >
                        <span className={`mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
                          item.tone === "primary" ? "bg-primary-fixed text-primary" : "bg-surface-container text-on-surface-variant"
                        }`}>
                          <MaterialSymbol className="text-[19px]" fill={item.tone === "primary"}>{item.icon}</MaterialSymbol>
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-label-bold text-label-bold text-on-surface">{item.title}</span>
                          <span className="mt-[2px] block line-clamp-2 font-body-sub text-body-sub text-on-surface-variant">{item.body}</span>
                        </span>
                      </Link>
                    ))}
                  </div>
                )}

                <div className="border-t border-outline-variant/20 p-sm">
                  <Link
                    className="flex items-center justify-center gap-xs rounded-xl bg-surface-container px-md py-sm font-label-bold text-label-bold text-primary hover:bg-primary-fixed"
                    href="/requests"
                    onClick={() => setIsNotificationsOpen(false)}
                  >
                    View request center
                    <MaterialSymbol className="text-[18px]">arrow_forward</MaterialSymbol>
                  </Link>
                </div>
              </div>
            )}
          </div>
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
