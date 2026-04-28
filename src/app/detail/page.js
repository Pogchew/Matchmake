"use client";

import { useState } from "react";
import Link from "next/link";
import MaterialSymbol from "@/components/MaterialSymbol";

/* eslint-disable @next/next/no-img-element */

const rosterPlayers = [
  { initials: "AP", name: "ApexPredator", role: "Captain • IGL",  bgClass: "bg-secondary-container" },
  { initials: "VK", name: "Valkyrie",     role: "Entry Fragger",  bgClass: "bg-tertiary-container" },
  { initials: "NX", name: "Noxious",      role: "Support",        bgClass: "bg-secondary-container" },
  { initials: "ZF", name: "ZeroFlux",     role: "Flex",           bgClass: "bg-tertiary-container" },
  { initials: "EC", name: "Echo",         role: "Sniper",         bgClass: "bg-secondary-container" },
];

export default function DetailPage() {
  const [showRoster, setShowRoster] = useState(false);
  const [showLobby, setShowLobby] = useState(false);

  return (
    <div className="bg-background text-on-background min-h-screen">
      {/* TopAppBar */}
      <header className="bg-white/80 backdrop-blur-md top-0 sticky z-50 shadow-[0_4px_20px_0_rgba(0,0,0,0.04)] flex justify-between items-center w-full px-5 h-14">
        <Link
          href="/"
          className="text-primary hover:bg-surface-container transition-colors active:scale-95 w-10 h-10 flex items-center justify-center rounded-full"
        >
          <MaterialSymbol>arrow_back</MaterialSymbol>
        </Link>
        <h1 className="text-lg font-black tracking-tighter text-on-surface">Scrim Detail</h1>
        <button className="text-on-surface-variant hover:bg-surface-container transition-colors active:scale-95 w-10 h-10 flex items-center justify-center rounded-full">
          <MaterialSymbol>more_vert</MaterialSymbol>
        </button>
      </header>

      <main className="max-w-[1200px] mx-auto px-margin-mobile md:px-lg py-lg space-y-lg pb-32">

        {/* Matchup Card */}
        <section className="bg-surface-container-lowest rounded-xl p-lg shadow-[0_4px_20px_0_rgba(0,0,0,0.04)] border border-surface-container-highest">
          <div className="flex items-center justify-center gap-lg">
            {/* Team A */}
            <div className="flex flex-col items-center gap-sm flex-1 min-w-0">
              <div className="w-20 h-20 md:w-24 md:h-24 rounded-full overflow-hidden bg-surface-container-low flex items-center justify-center shrink-0">
                <img
                  alt="Team A Logo"
                  className="w-full h-full object-cover"
                  src="https://lh3.googleusercontent.com/aida-public/AB6AXuB7XPCUJ4rHJtSkTPnQrM0r_wgqHZmyJcICrIBzyRqMo_MzCCQLgy5T_vPNZMYKJG36GXw7VodpoKBiLoxflwF3-RzgtNal63Om6XikY2tZhnbTXBw6vWzihFpO5vlaWC1EJ-8c-TGgq5aUvh9-vq-mUnt39bqshzTISVKMglwAcx0XpdasH8wAjFe_G_0ZLEL7WEodOY-j_8p9gf-0UbuKiWxXGS2kuJKawsSUOiMjSXwn2c9XJ4CP11xUorGCdTkcCWGdwzSTb1Y"
                />
              </div>
              <span className="font-headline-3 text-headline-3 text-center leading-tight break-words w-full">
                Rocket Rams
              </span>
            </div>

            {/* VS */}
            <div className="flex flex-col items-center justify-center gap-xs shrink-0 px-sm">
              <span className="font-label-bold text-label-bold text-outline uppercase tracking-widest">VS</span>
            </div>

            {/* Team B */}
            <div className="flex flex-col items-center gap-sm flex-1 min-w-0">
              <div className="w-20 h-20 md:w-24 md:h-24 rounded-full overflow-hidden bg-surface-container-low flex items-center justify-center shrink-0">
                <img
                  alt="Team B Logo"
                  className="w-full h-full object-cover"
                  src="https://lh3.googleusercontent.com/aida-public/AB6AXuBaW4SjqVuferdMkoOLP3EBwkFDhskTRz8AmAD4yI0SbQv6iBhHX09xd2Q_nebtM_cjZELYZzZgH4tXo4ot9jdgxL8XPxCZB5XqNqQ9rZdsdfNTDUHJuJSew8n2KBC18tTjzL9QcoBRBSVN1XuBe_UnA2BsRVVBSv-y60lZw9xSJzEuEN3vIxSfN0Ei-IY0DSCAsdJ2E1Vnvw7z1j1yDcQ9yGBBip6Y6AOzbiLR-A-QGFGGe1XnYXs89c01kmLMMsTec_ZzEKmUmOo"
                />
              </div>
              <span className="font-headline-3 text-headline-3 text-center leading-tight break-words w-full">
                Cloud9 Academy
              </span>
            </div>
          </div>

          {/* Status Badge */}
          <div className="flex justify-center mt-md">
            <span className="inline-flex items-center gap-1 bg-[#E3F9E5] text-[#1B5E20] font-label-bold text-label-bold px-4 py-1.5 rounded-full">
              <MaterialSymbol className="text-[16px]">check_circle</MaterialSymbol>
              Confirmed
            </span>
          </div>

          {/* Date & Time */}
          <div className="mt-lg text-center">
            <p className="font-headline-2 text-headline-2 text-on-surface">Tonight, 8:00 PM local</p>
            <div className="flex flex-wrap justify-center gap-sm mt-md">
              <span className="inline-flex items-center px-3 py-1 rounded-full bg-primary-fixed text-on-primary-fixed font-label-small text-label-small">
                <MaterialSymbol className="text-[14px] mr-1">sports_esports</MaterialSymbol>
                Valorant
              </span>
              <span className="inline-flex items-center px-3 py-1 rounded-full bg-tertiary-fixed text-on-tertiary-fixed font-label-small text-label-small">
                <MaterialSymbol className="text-[14px] mr-1">diamond</MaterialSymbol>
                Immortal
              </span>
              <span className="inline-flex items-center px-3 py-1 rounded-full bg-surface-container-highest text-on-surface-variant font-label-small text-label-small">
                <MaterialSymbol className="text-[14px] mr-1">dns</MaterialSymbol>
                NA East
              </span>
            </div>
          </div>
        </section>

        {/* Primary Actions */}
        <section className="flex flex-col gap-md">
          <Link
            href="/chat"
            className="w-full bg-[#007AFF] text-white rounded-xl py-4 flex items-center justify-center gap-sm hover:opacity-90 active:scale-[0.98] transition-all shadow-sm"
          >
            <MaterialSymbol fill>chat_bubble</MaterialSymbol>
            <span className="font-headline-3 text-headline-3">Open Scrim Chat</span>
          </Link>
          <div className="grid grid-cols-2 gap-md">
            <button
              onClick={() => { setShowRoster((v) => !v); }}
              className="w-full bg-[#E5E5EA] text-[#007AFF] rounded-lg py-3 flex items-center justify-center gap-sm hover:bg-[#D1D1D6] active:scale-[0.98] transition-all"
            >
              <MaterialSymbol>group</MaterialSymbol>
              <span className="font-label-bold text-label-bold">View Roster</span>
            </button>
            <button
              onClick={() => { setShowLobby((v) => !v); }}
              className="w-full bg-[#E5E5EA] text-[#007AFF] rounded-lg py-3 flex items-center justify-center gap-sm hover:bg-[#D1D1D6] active:scale-[0.98] transition-all"
            >
              <MaterialSymbol>info</MaterialSymbol>
              <span className="font-label-bold text-label-bold">Lobby Info</span>
            </button>
          </div>
        </section>

        {/* Match Details */}
        <section className="bg-surface-container-lowest rounded-xl p-lg shadow-[0_4px_20px_0_rgba(0,0,0,0.04)] border border-surface-container-highest">
          <h2 className="font-headline-3 text-headline-3 mb-md">Match Details</h2>
          <div className="space-y-md">
            {[
              { icon: "map",                   label: "Map Selection",  value: "Ascent, Bind (TBD)" },
              { icon: "format_list_numbered",  label: "Format",         value: "Best of 3" },
              { icon: "dns",                   label: "Server",         value: "NA East" },
              { icon: "gavel",                 label: "Ruleset",        value: "Standard VCT", last: true },
            ].map((row) => (
              <div
                key={row.label}
                className={`flex items-center justify-between ${!row.last ? "border-b border-surface-container-highest pb-md" : ""}`}
              >
                <div className="flex items-center gap-sm text-on-surface-variant">
                  <MaterialSymbol>{row.icon}</MaterialSymbol>
                  <span className="font-body-main text-body-main">{row.label}</span>
                </div>
                <span className="font-body-main text-body-main font-medium text-on-surface">{row.value}</span>
              </div>
            ))}
          </div>
        </section>

        {/* Roster Section */}
        {showRoster && (
          <section className="bg-surface-container-lowest rounded-xl p-lg shadow-[0_4px_20px_0_rgba(0,0,0,0.04)] border border-surface-container-highest">
            <h2 className="font-headline-3 text-headline-3 mb-md">Rocket Rams Roster</h2>
            <div className="flex flex-col gap-sm">
              {rosterPlayers.map((p) => (
                <div key={p.name} className="flex items-center gap-sm p-sm rounded-lg bg-surface-container-low">
                  <div className={`w-8 h-8 rounded-full ${p.bgClass} flex items-center justify-center font-label-bold text-on-primary text-[11px]`}>
                    {p.initials}
                  </div>
                  <div>
                    <p className="font-label-bold text-on-surface">{p.name}</p>
                    <p className="font-label-small text-on-surface-variant">{p.role}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Lobby Info */}
        {showLobby && (
          <section className="bg-surface-container-lowest rounded-xl p-lg shadow-[0_4px_20px_0_rgba(0,0,0,0.04)] border border-surface-container-highest">
            <h2 className="font-headline-3 text-headline-3 mb-md">Lobby Info</h2>
            <div className="space-y-md">
              {[
                { label: "Lobby Name", value: "rams_scrim" },
                { label: "Password",   value: "1234" },
                { label: "Region",     value: "NA East" },
              ].map((row) => (
                <div key={row.label} className="flex items-center justify-between bg-surface-container-low p-md rounded-lg">
                  <span className="font-body-sub text-on-surface-variant">{row.label}</span>
                  <span className="font-label-bold text-on-surface font-mono">{row.value}</span>
                </div>
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
