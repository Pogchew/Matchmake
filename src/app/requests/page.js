"use client";

import { useState } from "react";
import Link from "next/link";
import TopBar from "@/components/TopBar";
import BottomNav from "@/components/BottomNav";
import MaterialSymbol from "@/components/MaterialSymbol";

/* eslint-disable @next/next/no-img-element */

const inboundRequests = [
  {
    id: 1,
    team: "Cloud9",
    game: "Valorant",
    time: "8:00 PM",
    games: 3,
    img: "https://lh3.googleusercontent.com/aida-public/AB6AXuDNppj2Dm6q2Qpq3yUlyAm9K_Zm5KRPkd6YzSo7nm40ACyJbrugBoeBe__GbVj-TQZ6mE63aLjGnOo7afv-EZMid8KFiuD8XCJeUKd8hvJR8CunHw2NwI1REE2yEn30BvsLvA9K8IeJfWalGIjVNwpLUFDA6q0Klw1AGuh8eRM42em0zcnEfaVDivsPOI0zWW9hoEjf8Bs-jvzvhfGo6G23-J6OF0Ff4mSymTdBI7txxEL8LS28PxSA49zuQ1xSzr-WJb_g_1ZdT6E",
  },
  {
    id: 2,
    team: "Sentinels",
    game: "Valorant",
    time: "9:00 PM",
    games: 1,
    img: "https://lh3.googleusercontent.com/aida-public/AB6AXuCyqtbtQuIBB6SROkAI6L8gXC-ZAcYZuATUwUTFWMs7rEXwrW_j1lq9Boy7sAkHxfZIsniFxugCf0Yjvoi9Yin0JFnFAJAKVI4NAB12VB1-ddzynb2XKmTsF6XDkpQ6WKaYM7VG71NPMAztLyua45mkixGfsWutGAo2saoLRPTEneVM16MGL2koDMOdxVvw0Z6jpnxHnFweboMjiysqjLVFtYNdLrtBJT8eG2e6UZQ-66lSrdj0AHePKPoY-tttyv6a2rCGZWOiFLM",
  },
  {
    id: 3,
    team: "100 Thieves",
    game: "Valorant",
    time: "7:00 PM",
    games: 5,
    initials: "100",
    awaiting: true,
  },
];

const outboundRequests = [
  { id: 1, team: "Nova Esports",  game: "Valorant", time: "8:00 PM", games: 3, initials: "NV" },
  { id: 2, team: "Team Synergy",  game: "LoL",      time: "9:00 PM", games: 1, initials: "TS" },
];

const confirmedScrims = [
  { id: 1, team: "Cloud9 Academy", game: "Valorant", time: "Tonight 8:00 PM", games: 3, initials: "C9" },
];

export default function RequestsPage() {
  const [activeTab, setActiveTab] = useState("inbound");
  const [dismissed, setDismissed] = useState([]);

  const dismiss = (id) => setDismissed((prev) => [...prev, id]);

  return (
    <>
      <TopBar />

      <main className="max-w-[1200px] mx-auto px-margin-mobile md:px-lg pt-lg pb-32 md:pb-xl">
        {/* Page Header */}
        <div className="mb-lg">
          <h2 className="font-headline-1 text-headline-1 text-on-surface mb-sm">Requests</h2>
          <p className="font-body-sub text-body-sub text-on-surface-variant">
            Manage your inbound and outbound scrim requests.
          </p>
        </div>

        {/* Segmented Control */}
        <div className="bg-surface-container-low p-1 rounded-lg flex mb-xl max-w-md">
          {["inbound", "outbound", "confirmed"].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-2 px-4 rounded-md font-label-bold text-label-bold text-center capitalize transition-colors ${
                activeTab === tab
                  ? "bg-surface-container-lowest text-on-surface shadow-[0_1px_3px_rgba(0,0,0,0.1)]"
                  : "text-on-surface-variant hover:text-on-surface"
              }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>

        {/* Inbound Panel */}
        {activeTab === "inbound" && (
          <div className="space-y-md">
            {inboundRequests
              .filter((r) => !dismissed.includes(r.id))
              .map((req) => (
                <div
                  key={req.id}
                  className="bg-surface-container-lowest rounded-[16px] p-md border border-surface-variant shadow-[0_4px_20px_0_rgba(0,0,0,0.04)] flex flex-col gap-md"
                  style={req.awaiting ? { opacity: 0.8 } : undefined}
                >
                  <div className="flex items-start gap-md">
                    <div className="w-12 h-12 rounded-lg bg-surface-container flex items-center justify-center shrink-0 overflow-hidden">
                      {req.img ? (
                        <img alt="Team Logo" className="w-full h-full object-cover rounded-lg" src={req.img} />
                      ) : (
                        <div className="w-full h-full bg-surface-dim rounded-lg flex items-center justify-center text-outline font-headline-3 text-headline-3">
                          {req.initials}
                        </div>
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-sm mb-xs">
                        <h3 className="font-headline-3 text-headline-3 text-on-surface">{req.team}</h3>
                        <span className="inline-flex items-center bg-primary-fixed text-on-primary-fixed-variant rounded-full px-2 py-0.5 font-label-small text-label-small">
                          {req.game}
                        </span>
                      </div>
                      <div className="flex items-center gap-xs text-on-surface-variant font-body-sub text-body-sub">
                        <MaterialSymbol className="text-[16px]">schedule</MaterialSymbol>
                        <span>
                          {req.time} • {req.games} Game{req.games !== 1 ? "s" : ""}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex w-full gap-sm pt-md border-t border-surface-variant">
                    {req.awaiting ? (
                      <span className="bg-[#E5E5EA] text-on-surface-variant font-label-bold text-label-bold py-2 px-4 rounded-lg inline-flex items-center gap-xs">
                        <MaterialSymbol className="text-[16px]">schedule</MaterialSymbol>
                        Awaiting Response
                      </span>
                    ) : (
                      <>
                        <button
                          onClick={() => dismiss(req.id)}
                          className="flex-1 bg-[#E5E5EA] text-on-surface font-label-bold text-label-bold py-2 px-6 rounded-lg hover:bg-surface-dim transition-colors"
                        >
                          Decline
                        </button>
                        <Link
                          href="/detail"
                          className="flex-1 bg-[#007AFF] text-white font-label-bold text-label-bold py-2 px-6 rounded-lg hover:bg-[#007AFF]/90 transition-colors text-center"
                        >
                          Accept
                        </Link>
                      </>
                    )}
                  </div>
                </div>
              ))}
          </div>
        )}

        {/* Outbound Panel */}
        {activeTab === "outbound" && (
          <div className="space-y-md">
            {outboundRequests.map((req) => (
              <div
                key={req.id}
                className="bg-surface-container-lowest rounded-[16px] p-md border border-surface-variant shadow-[0_4px_20px_0_rgba(0,0,0,0.04)] flex flex-col gap-md"
              >
                <div className="flex items-start gap-md">
                  <div className="w-12 h-12 rounded-lg bg-surface-container flex items-center justify-center shrink-0 font-headline-3 text-on-surface-variant font-bold">
                    {req.initials}
                  </div>
                  <div>
                    <div className="flex items-center gap-sm mb-xs">
                      <h3 className="font-headline-3 text-headline-3 text-on-surface">{req.team}</h3>
                      <span className="inline-flex items-center bg-primary-fixed text-on-primary-fixed-variant rounded-full px-2 py-0.5 font-label-small text-label-small">
                        {req.game}
                      </span>
                    </div>
                    <div className="flex items-center gap-xs text-on-surface-variant font-body-sub text-body-sub">
                      <MaterialSymbol className="text-[16px]">schedule</MaterialSymbol>
                      <span>
                        {req.time} • {req.games} Game{req.games !== 1 ? "s" : ""}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex w-full gap-sm pt-md border-t border-surface-variant">
                  <span className="bg-primary-fixed text-on-primary-fixed font-label-bold text-label-bold py-2 px-4 rounded-lg inline-flex items-center gap-xs">
                    <MaterialSymbol className="text-[16px]">schedule</MaterialSymbol>
                    Pending Response
                  </span>
                  <button className="ml-auto bg-[#E5E5EA] text-on-surface-variant font-label-bold text-label-bold py-2 px-4 rounded-lg hover:bg-surface-dim transition-colors">
                    Cancel
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Confirmed Panel */}
        {activeTab === "confirmed" && (
          <div className="space-y-md">
            {confirmedScrims.map((scrim) => (
              <Link
                key={scrim.id}
                href="/detail"
                className="block bg-surface-container-lowest rounded-[16px] p-md border border-surface-variant shadow-[0_4px_20px_0_rgba(0,0,0,0.04)]"
              >
                <div className="flex items-start gap-md mb-md">
                  <div className="w-12 h-12 rounded-lg bg-surface-container flex items-center justify-center shrink-0 font-headline-3 text-on-surface-variant font-bold">
                    {scrim.initials}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-sm mb-xs">
                      <h3 className="font-headline-3 text-headline-3 text-on-surface">{scrim.team}</h3>
                      <span className="inline-flex items-center bg-primary-fixed text-on-primary-fixed-variant rounded-full px-2 py-0.5 font-label-small text-label-small">
                        {scrim.game}
                      </span>
                    </div>
                    <div className="flex items-center gap-xs text-on-surface-variant font-body-sub text-body-sub">
                      <MaterialSymbol className="text-[16px]">schedule</MaterialSymbol>
                      <span>
                        {scrim.time} • {scrim.games} Games
                      </span>
                    </div>
                  </div>
                  <span className="inline-flex items-center gap-1 bg-[#E3F9E5] text-[#1B5E20] font-label-small text-label-small px-3 py-1 rounded-full shrink-0">
                    <MaterialSymbol className="text-[14px]">check_circle</MaterialSymbol>
                    Confirmed
                  </span>
                </div>
                <div className="flex gap-sm pt-md border-t border-surface-variant">
                  <span className="text-primary font-label-bold text-label-bold flex items-center gap-1">
                    <MaterialSymbol className="text-[16px]">chat_bubble</MaterialSymbol>
                    Open Chat
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>

      <BottomNav />
    </>
  );
}
