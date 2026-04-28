"use client";

/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import TopBar from "@/components/TopBar";
import BottomNav from "@/components/BottomNav";
import MaterialSymbol from "@/components/MaterialSymbol";

const upcomingScrims = [
  { day: "Today", time: "19:00", team: "Valorant Academy", vs: "vs. Sentinel Youth", img: "https://lh3.googleusercontent.com/aida-public/AB6AXuD_od0adwzkYT7CFrzhW1tj72kfp9_SOY9J2bRo2Bo3S5dp7Nv8pkTFs0XJsfL54ddP7TsDRzsaLYdkzCK6UMex3FUJ8fSBDZZWElRW5pOTtD4f6KWunMV0ZKHgcTQK-CrUREg0BhyKn3lWVjFvQkyXy1Tfb5SjYBTbsyBIFYr04GXJGfROxtjwJncGZ1KyU2scKlZnuN6ilaRJ94D2ZUdgzZxgJM4cezCaEVELEQq7FKrSbvmcuMK5NRRmtoBEd3Er6QaDGwfXYDc" },
  { day: "Tmrw",  time: "20:30", team: "RL Main Roster",   vs: "vs. Boost Hogs",    img: "https://lh3.googleusercontent.com/aida-public/AB6AXuA1NFhAGe4midIbCnqz2paaTq6qSp4CgvahesSDFS6SrrE-v3BgA3evNU0w_CZqA2VEDdqKmNhheuFyXBADBupCaGuLprBuvyyn7d_6Sbxr_oO1yQsMk803KM7mvPQPSfvcrtOE0FqgB2UE6IpkltNzR8EL4a8ZLTiS3KFeQC0j5GGcsmP1PtK8j4nBPmpAMbK4VjivwGNDWMgC5EgcRPnUmQLirwfuu_EvTkWpfvZL_ywWJhUfRPb3NtPqo29Wfm98erI46fErKK4" },
];

const teams = {
  Valorant: [
    { name: "Contenders Main",    rank: "Immortal+",   status: "in-game",  statusLabel: "In-Game",           statusSub: "Started 45m ago" },
    { name: "Contenders Academy", rank: "Diamond-Asc", status: "lf-scrim", statusLabel: "Looking for Scrim", statusSub: "" },
  ],
  "Rocket League": [
    { name: "RL Main Roster", rank: "GC2+",   status: "idle", statusLabel: "Idle", statusSub: "" },
    { name: "RL Academy",     rank: "Champ+", status: "idle", statusLabel: "Idle", statusSub: "" },
  ],
};

function StatusBadge({ status, label, sub }) {
  if (status === "in-game") {
    return (
      <div className="bg-surface-container p-sm rounded-lg flex items-center justify-between">
        <div className="flex items-center gap-xs text-on-surface-variant font-label-small text-label-small">
          <span className="w-2 h-2 rounded-full bg-tertiary-container animate-pulse" />
          {label}
        </div>
        {sub && <div className="text-outline font-label-small text-[11px]">{sub}</div>}
      </div>
    );
  }
  if (status === "lf-scrim") {
    return (
      <div className="bg-primary-fixed-dim/30 border border-primary-fixed-dim p-sm rounded-lg flex items-center gap-xs cursor-pointer hover:bg-primary-fixed-dim/50 transition-colors">
        <MaterialSymbol className="text-on-primary-fixed text-[16px]">search</MaterialSymbol>
        <span className="font-label-small text-label-small text-on-primary-fixed">{label}</span>
      </div>
    );
  }
  return (
    <div className="bg-surface-container p-sm rounded-lg flex items-center gap-xs text-on-surface-variant font-label-small text-label-small">
      <MaterialSymbol className="text-[16px]">schedule</MaterialSymbol>
      {label}
    </div>
  );
}

export default function OrgPage() {
  return (
    <>
      <TopBar />

      <main className="max-w-[1200px] mx-auto px-margin-mobile md:px-lg pt-lg pb-xl flex flex-col gap-xl">
        {/* Editorial Header */}
        <section className="flex flex-col md:flex-row md:items-end justify-between gap-md">
          <div>
            <h2 className="font-label-bold text-label-bold text-outline uppercase tracking-wider mb-xs">My Organization</h2>
            <h1 className="font-headline-1 text-headline-1 md:font-editorial-large md:text-editorial-large text-on-surface">
              Contenders St. Louis
            </h1>
          </div>
          <div className="flex gap-sm">
            <Link
              href="/team/new"
              className="bg-surface-variant text-primary font-label-bold text-label-bold px-md py-sm rounded-lg hover:bg-surface-container-high transition-colors flex items-center gap-xs"
            >
              <MaterialSymbol className="text-[18px]">add</MaterialSymbol>
              Add Team
            </Link>
            <Link
              href="/?post=true"
              className="bg-primary text-on-primary font-label-bold text-label-bold px-md py-sm rounded-lg hover:bg-on-primary-fixed-variant transition-colors flex items-center gap-xs shadow-[0_4px_12px_rgba(0,112,235,0.2)]"
            >
              <MaterialSymbol className="text-[18px]" fill>calendar_month</MaterialSymbol>
              Schedule Scrim
            </Link>
          </div>
        </section>

        {/* Metrics */}
        <section className="grid grid-cols-2 md:grid-cols-3 gap-md">
          <div className="bg-surface-container-lowest rounded-xl p-md border border-outline-variant/30 shadow-[0_8px_24px_-12px_rgba(0,0,0,0.05)] flex flex-col justify-between">
            <div className="flex items-center gap-xs text-outline mb-sm">
              <MaterialSymbol className="text-[16px]">groups</MaterialSymbol>
              <span className="font-label-small text-label-small uppercase tracking-wide">Total Teams</span>
            </div>
            <div className="font-headline-1 text-headline-1 text-on-surface">4</div>
          </div>
          <div className="bg-surface-container-lowest rounded-xl p-md border border-outline-variant/30 shadow-[0_8px_24px_-12px_rgba(0,0,0,0.05)] flex flex-col justify-between">
            <div className="flex items-center gap-xs text-primary mb-sm">
              <MaterialSymbol className="text-[16px]">sports_esports</MaterialSymbol>
              <span className="font-label-small text-label-small uppercase tracking-wide">Active Scrims</span>
            </div>
            <div className="font-headline-1 text-headline-1 text-on-surface">2</div>
          </div>
          <div className="col-span-2 md:col-span-1 bg-primary-fixed rounded-xl p-md border border-primary-fixed-dim/50 shadow-[0_8px_24px_-12px_rgba(0,112,235,0.15)] flex flex-col justify-between relative overflow-hidden">
            <div className="absolute -right-4 -top-4 opacity-10">
              <MaterialSymbol className="text-[100px]" fill>pending_actions</MaterialSymbol>
            </div>
            <div className="flex items-center gap-xs text-on-primary-fixed mb-sm relative z-10">
              <MaterialSymbol className="text-[16px]">mail</MaterialSymbol>
              <span className="font-label-small text-label-small uppercase tracking-wide">Pending Invites</span>
            </div>
            <div className="font-headline-1 text-headline-1 text-on-primary-fixed relative z-10">5</div>
          </div>
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-xl">
          {/* Upcoming Scrims */}
          <section className="lg:col-span-1 flex flex-col gap-md">
            <h3 className="font-headline-3 text-headline-3 text-on-surface flex items-center gap-sm">
              <MaterialSymbol className="text-primary">event_upcoming</MaterialSymbol>
              Upcoming Scrims
            </h3>
            <div className="flex flex-col gap-sm">
              {upcomingScrims.map((s) => (
                <Link
                  key={s.team}
                  href="/detail"
                  className="bg-surface-container-lowest p-md rounded-xl border border-outline-variant/30 flex items-center gap-md hover:shadow-[0_4px_16px_-8px_rgba(0,0,0,0.08)] transition-shadow"
                >
                  <div className="flex flex-col items-center justify-center bg-surface-container w-12 h-12 rounded-lg text-on-surface-variant font-label-bold text-label-bold shrink-0">
                    <span className="text-[10px] uppercase text-outline">{s.day}</span>
                    <span>{s.time}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-label-small text-label-small text-primary mb-[2px]">{s.team}</div>
                    <div className="font-label-bold text-label-bold text-on-surface">{s.vs}</div>
                  </div>
                  <div className="w-8 h-8 rounded-full overflow-hidden flex items-center justify-center border border-outline-variant/20 shrink-0">
                    <img alt="opponent logo" className="w-full h-full object-cover" src={s.img} />
                  </div>
                </Link>
              ))}
            </div>
          </section>

          {/* My Teams */}
          <section className="lg:col-span-2 flex flex-col gap-md">
            <h3 className="font-headline-3 text-headline-3 text-on-surface flex items-center gap-sm">
              <MaterialSymbol className="text-primary">swords</MaterialSymbol>
              My Teams
            </h3>
            {Object.entries(teams).map(([game, gameTeams]) => (
              <div key={game} className="flex flex-col gap-sm mb-md">
                <h4 className="font-label-bold text-label-bold text-outline uppercase tracking-wider pl-xs">{game}</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-md">
                  {gameTeams.map((team) => (
                    <Link
                      key={team.name}
                      href="/team"
                      className="bg-surface-container-lowest p-md rounded-xl border border-outline-variant/30 shadow-[0_4px_16px_-8px_rgba(0,0,0,0.05)] relative overflow-hidden block"
                    >
                      <div
                        className="absolute top-0 left-0 w-1 h-full"
                        style={{
                          background:
                            team.status === "in-game"
                              ? "var(--tw-color-primary, #0058bc)"
                              : team.status === "idle" && team.rank === "Champ+"
                              ? "var(--tw-color-secondary, #4c4aca)"
                              : "#c1c6d7",
                        }}
                      />
                      <div className="flex justify-between items-start mb-md">
                        <div>
                          <h5 className="font-headline-2 text-headline-2 text-on-surface leading-tight mb-xs">{team.name}</h5>
                          <span className="inline-flex items-center px-2 py-1 rounded-full bg-surface-container-high text-on-surface-variant font-label-small text-[10px] uppercase tracking-wide">
                            {team.rank}
                          </span>
                        </div>
                        <button
                          onClick={(e) => e.preventDefault()}
                          className="text-outline hover:text-primary transition-colors"
                        >
                          <MaterialSymbol>more_horiz</MaterialSymbol>
                        </button>
                      </div>
                      <StatusBadge status={team.status} label={team.statusLabel} sub={team.statusSub} />
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </section>
        </div>
      </main>

      <BottomNav />
    </>
  );
}
