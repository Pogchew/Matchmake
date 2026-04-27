"use client";

/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import BottomNav from "@/components/BottomNav";
import MaterialSymbol from "@/components/MaterialSymbol";

const roster = [
  { name: "ApexPredator", role: "Captain • IGL",   img: "https://lh3.googleusercontent.com/aida-public/AB6AXuC0ro6y5_-AQ4_ykBQXC9nM_kuWEIZRi-hecS8jLRjQNdqPBzOOIgZG_LSytK_Ir12sQ14hN9qwoVIG4nRucu-lHzDlPNyWDm92DCyk9XkqPl2KGO0ayDob5eYCtep4E1WPWFk15K3HLSrDrpTNHQDqNCzMk32cXdzG3xq_84MQfAD8WAulyNB7TCJDnS0vBFCcYtMTgI8vBYg6abJJvFx0kaPAbgLcAGphMlQdF1qd1VFDoM5P5mKDehD3wMXhOCSHideA4GSjOpk" },
  { name: "Valkyrie",     role: "Entry Fragger",    img: "https://lh3.googleusercontent.com/aida-public/AB6AXuAyri2vhgSpmv4xJ_obkz_ToDzXFYFVOT8jNRg1n1e6wes6ro9rCfvkUcp4lu5FBGL1Sm8ePJhUROSIOmNbfpnV7cKMYbwGbkVL4S-H9Wxuo2XdxJxF5c0CZHuypdZoWM2Z8mm_6tRNJub2va5pGYcefmn6OGt9GAUijQJlSBnx108aPg-ECD7RgfDLbTte1h9A0-VR4iqFnbEKx9LCU0UZRmOV31t9x-DXGVI53O8_Vs87lWQXl_NHuUWFzAxRp1fn7rngAUB2frw" },
  { name: "Noxious",      role: "Support",          initials: "NX", bgClass: "bg-secondary-container" },
  { name: "ZeroFlux",     role: "Flex",             initials: "ZF", bgClass: "bg-tertiary-container" },
  { name: "Echo",         role: "Sniper",           img: "https://lh3.googleusercontent.com/aida-public/AB6AXuB6ftVZ1UcrTGJFp76zHQyZVvCaQq6fbsB9LA2BKMrSJeZi92UiTwCQ4VkwSv618UQt6XrPdraSnRNyHCx9WyZAEHdTQVppOnxfJzaedwFw1HThVP9AoSwpXnqovt7peygYgcNnO03J1KeeHJrR9RvV7xKa4HAWm1e8on7Px0FHWz7WlZW8XySE6Fuv7a-nNWfxFWYRfzNbI3gsMJYx7pXnx13MlcAeKhh0ideIYM9M8DjGx5wAG5rlXkqMEqQ4rlM8UR8eq8Tmp8A" },
];

const upcomingScrims = [
  { id: 1, vs: "vs. Cloud9 Academy",    meta: "Best of 3 • Pro Tier",          when: "Today",    time: "8:00 PM EST",  server: "NA East Server",  status: "confirmed" },
  { id: 2, vs: "vs. Team Liquid Blue",  meta: "Best of 1 • Practice",          when: "Tomorrow", time: "6:30 PM EST",  server: "NA Central Server", status: "confirmed" },
  { id: 3, vs: "vs. Sentinels B",       meta: "Best of 5 • Tournament Prep",   when: "Pending",  time: "TBD",          server: null,              status: "pending" },
];

export default function TeamPage() {
  return (
    <>
      {/* TopAppBar – custom layout with back button */}
      <header className="bg-white/80 backdrop-blur-md text-on-surface w-full top-0 sticky z-50 border-b border-surface-variant flex items-center justify-between px-5 h-16">
        <div className="flex items-center gap-3">
          <Link
            href="/org"
            className="text-primary hover:bg-surface-container transition-colors active:scale-95 w-9 h-9 flex items-center justify-center rounded-full -ml-1"
          >
            <MaterialSymbol>arrow_back</MaterialSymbol>
          </Link>
          <span className="font-headline-3 text-on-surface font-bold tracking-tight">ScrimGG</span>
        </div>

        {/* Desktop nav – Org is active since we came from there */}
        <nav className="hidden md:flex items-center gap-1">
          {[
            { label: "Scrims",   href: "/" },
            { label: "Org",      href: "/org",      active: true },
            { label: "Requests", href: "/requests" },
            { label: "Calendar", href: "/calendar" },
          ].map((item) => (
            <Link
              key={item.label}
              href={item.href}
              className={
                item.active
                  ? "text-primary font-label-bold font-bold bg-primary-fixed px-3 py-2 rounded-lg"
                  : "text-on-surface-variant font-label-bold hover:bg-surface-container transition-colors px-3 py-2 rounded-lg"
              }
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <button className="text-primary hover:bg-surface-container transition-colors p-2 rounded-full flex items-center justify-center active:scale-95">
          <MaterialSymbol>settings</MaterialSymbol>
        </button>
      </header>

      <main className="pt-6 pb-[100px] md:pb-xl px-margin-mobile md:px-xl max-w-[1200px] mx-auto min-h-screen">

        {/* Team Header Card */}
        <section className="bg-surface-container-lowest rounded-xl shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] border border-surface-variant p-lg mb-lg flex flex-col md:flex-row items-start md:items-center gap-md">
          <div className="w-24 h-24 rounded-full bg-surface-container-high flex items-center justify-center shrink-0 border-4 border-surface-container-lowest shadow-sm">
            <MaterialSymbol className="text-[48px] text-primary" fill>rocket_launch</MaterialSymbol>
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-sm mb-xs">
              <h1 className="font-headline-1 text-on-surface">Rocket Rams</h1>
              <MaterialSymbol className="text-primary text-[20px]" fill>verified</MaterialSymbol>
            </div>
            <p className="font-body-sub text-on-surface-variant mb-md">North American Division • Main Roster</p>
            <div className="flex flex-wrap gap-sm">
              <span className="bg-primary-fixed text-on-primary-fixed font-label-small px-3 py-1 rounded-full">Valorant</span>
              <span className="bg-surface-container text-on-surface-variant font-label-small px-3 py-1 rounded-full">Pro Tier</span>
              <span className="bg-surface-container text-on-surface-variant font-label-small px-3 py-1 rounded-full">EST</span>
            </div>
          </div>
          <div className="flex flex-col gap-sm w-full md:w-auto">
            <button className="bg-primary text-on-primary font-label-bold px-md py-sm rounded-lg hover:opacity-90 transition-opacity">
              Edit Team Info
            </button>
            <button className="bg-surface-container text-primary font-label-bold px-md py-sm rounded-lg hover:bg-surface-variant transition-colors">
              Manage Roster
            </button>
          </div>
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-lg">

          {/* Left: Roster & Stats */}
          <div className="lg:col-span-1 flex flex-col gap-lg">

            {/* Roster */}
            <div className="bg-surface-container-lowest rounded-xl shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] border border-surface-variant p-md">
              <div className="flex justify-between items-center mb-md">
                <h2 className="font-headline-3 text-on-surface">Active Roster</h2>
                <span className="font-body-sub text-on-surface-variant">5/5</span>
              </div>
              <div className="flex flex-col gap-sm">
                {roster.map((player) => (
                  <div
                    key={player.name}
                    className="flex items-center gap-sm p-sm rounded-lg hover:bg-surface-container-low transition-colors cursor-pointer"
                  >
                    {player.img ? (
                      <img alt="Player" className="w-10 h-10 rounded-full object-cover" src={player.img} />
                    ) : (
                      <div className={`w-10 h-10 rounded-full ${player.bgClass} text-on-primary flex items-center justify-center font-label-bold`}>
                        {player.initials}
                      </div>
                    )}
                    <div className="flex-1">
                      <p className="font-label-bold text-on-surface">{player.name}</p>
                      <p className="font-label-small text-on-surface-variant">{player.role}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Stats */}
            <div className="bg-surface-container-lowest rounded-xl shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] border border-surface-variant p-md">
              <h2 className="font-headline-3 text-on-surface mb-md">Season Stats</h2>
              <div className="grid grid-cols-2 gap-sm">
                <div className="bg-surface-container-low p-sm rounded-lg flex flex-col items-center justify-center text-center">
                  <span className="font-editorial-large text-editorial-large text-primary">24</span>
                  <span className="font-label-small text-label-small text-on-surface-variant">Scrims Played</span>
                </div>
                <div className="bg-surface-container-low p-sm rounded-lg flex flex-col items-center justify-center text-center">
                  <span className="font-editorial-large text-editorial-large text-secondary">68%</span>
                  <span className="font-label-small text-label-small text-on-surface-variant">Win Rate</span>
                </div>
              </div>
            </div>
          </div>

          {/* Right: Upcoming Scrims */}
          <div className="lg:col-span-2">
            <div className="bg-surface-container-lowest rounded-xl shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] border border-surface-variant p-md h-full">
              <div className="flex justify-between items-center mb-md">
                <h2 className="font-headline-3 text-on-surface">Upcoming Scrims</h2>
                <Link
                  href="/calendar"
                  className="text-primary font-label-bold flex items-center gap-xs hover:bg-surface-container p-xs rounded-lg transition-colors"
                >
                  View Calendar
                  <MaterialSymbol className="text-[18px]">arrow_forward</MaterialSymbol>
                </Link>
              </div>
              <div className="flex flex-col gap-md">
                {upcomingScrims.map((scrim) => (
                  scrim.status === "pending" ? (
                    <div
                      key={scrim.id}
                      className="border border-surface-variant rounded-lg p-md opacity-60"
                    >
                      <ScrimCard scrim={scrim} />
                    </div>
                  ) : (
                    <Link
                      key={scrim.id}
                      href="/detail"
                      className="block border border-surface-variant rounded-lg p-md hover:shadow-[0_4px_12px_0_rgba(0,0,0,0.05)] transition-shadow"
                    >
                      <ScrimCard scrim={scrim} />
                    </Link>
                  )
                ))}
              </div>
            </div>
          </div>
        </div>
      </main>

      <BottomNav />
    </>
  );
}

function ScrimCard({ scrim }) {
  return (
    <>
      <div className="flex justify-between items-start mb-sm">
        <div className="flex items-center gap-sm">
          <div className="w-12 h-12 rounded-lg bg-surface-container flex items-center justify-center shrink-0">
            <MaterialSymbol className="text-on-surface-variant text-[24px]">sports_esports</MaterialSymbol>
          </div>
          <div>
            <h3 className="font-headline-3 text-on-surface text-[16px]">{scrim.vs}</h3>
            <p className="font-body-sub text-on-surface-variant">{scrim.meta}</p>
          </div>
        </div>
        <span
          className={`font-label-small px-2 py-1 rounded text-[10px] ${
            scrim.when === "Today"
              ? "bg-tertiary-fixed text-on-tertiary-fixed"
              : "bg-surface-container text-on-surface-variant"
          }`}
        >
          {scrim.when}
        </span>
      </div>
      <div className="flex items-center gap-md text-on-surface-variant font-label-small mt-sm">
        <div className="flex items-center gap-xs">
          <MaterialSymbol className="text-[16px]">schedule</MaterialSymbol>
          {scrim.time}
        </div>
        {scrim.server && (
          <div className="flex items-center gap-xs">
            <MaterialSymbol className="text-[16px]">dns</MaterialSymbol>
            {scrim.server}
          </div>
        )}
      </div>
    </>
  );
}
