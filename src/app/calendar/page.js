"use client";

import { useState } from "react";
import Link from "next/link";
import TopBar from "@/components/TopBar";
import BottomNav from "@/components/BottomNav";
import MaterialSymbol from "@/components/MaterialSymbol";

/* eslint-disable @next/next/no-img-element */

const MONTHS = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];
const DAYS_FULL = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
const SCRIM_DAYS = [6, 9, 14, 18, 19, 24];

const scheduledScrims = [
  {
    id: 1,
    time: "14:00",
    tz: "EST",
    team: "Sentinels Academy",
    meta: "Valorant • BO3 • Server: NA East",
    status: "confirmed",
    img: "https://lh3.googleusercontent.com/aida-public/AB6AXuCZLwxyybtBLMSAf8E8feB80u2P9EyKlFKH_Ez9I8HjPYiZXg5uSYX2FEm9vr6KzQXICxh3Tz4T2SVsld1L_VirdwehnGAfM1mAcTG5ac6nzQfCuIASo1Wo8gzJFAPemaAGz63wvDHGN_DnTEM-rffen-kJcuLsnlcwAHBVsyW2GD1llVvjCZUPgioB4wzqO6J7Mp6zbZgV5j3_EmelBOkfdwa2-7Yg7i75paeKXGb6XE2ArrmN_NImYZi0i-x8kV4xjKU713sDM3Y",
    accentColor: "bg-primary",
  },
  {
    id: 2,
    time: "17:30",
    tz: "EST",
    team: "Cloud9 Black",
    meta: "Valorant • BO1 • Server: NA Central",
    status: "pending",
    initials: "C9",
    accentColor: "bg-tertiary",
  },
  {
    id: 3,
    time: "20:00",
    tz: "EST",
    team: "Nova Esports",
    meta: "Valorant • BO3 • Server: NA East",
    status: "confirmed",
    initials: "NV",
    accentColor: "bg-secondary",
  },
];

function StatusChip({ status }) {
  if (status === "confirmed") {
    return (
      <div className="flex items-center gap-xs font-label-small text-label-small text-[#1B5E20] bg-[#E3F9E5] px-3 py-1 rounded-full self-start sm:self-auto">
        <MaterialSymbol className="text-[14px]">check_circle</MaterialSymbol>
        Confirmed
      </div>
    );
  }
  return (
    <div className="flex items-center gap-xs font-label-small text-label-small text-tertiary bg-tertiary-fixed/40 px-3 py-1 rounded-full self-start sm:self-auto">
      <MaterialSymbol className="text-[14px]">schedule</MaterialSymbol>
      Pending
    </div>
  );
}

export default function CalendarPage() {
  const [current, setCurrent] = useState(new Date(2024, 9, 1)); // Oct 2024
  const [selected, setSelected] = useState(18);

  const year = current.getFullYear();
  const month = current.getMonth();

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const prevDays = new Date(year, month, 0).getDate();
  const total = firstDay + daysInMonth;
  const trailing = total % 7 === 0 ? 0 : 7 - (total % 7);

  const changeMonth = (dir) => {
    const next = new Date(current);
    next.setMonth(next.getMonth() + dir);
    setCurrent(next);
    setSelected(1);
  };

  const selDate = new Date(year, month, selected);
  const dayLabel = `${DAYS_FULL[selDate.getDay()]}, ${MONTHS[month].slice(0, 3)} ${selected}`;

  return (
    <>
      <TopBar right={
        <button className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-surface-container transition-colors active:scale-95">
          <MaterialSymbol className="text-primary">settings</MaterialSymbol>
        </button>
      } />

      <main className="pt-lg pb-[100px] px-margin-mobile max-w-[1200px] mx-auto">

        {/* Calendar Header */}
        <div className="flex justify-between items-center mb-md">
          <h1 className="font-headline-1 text-headline-1 text-on-surface">{MONTHS[month]}</h1>
          <div className="flex gap-unit bg-surface-container-low rounded-lg p-unit">
            <button
              onClick={() => changeMonth(-1)}
              className="w-8 h-8 flex items-center justify-center rounded text-on-surface-variant hover:bg-surface-variant transition-colors"
            >
              <MaterialSymbol className="text-[20px]">chevron_left</MaterialSymbol>
            </button>
            <button
              onClick={() => changeMonth(1)}
              className="w-8 h-8 flex items-center justify-center rounded text-on-surface-variant hover:bg-surface-variant transition-colors"
            >
              <MaterialSymbol className="text-[20px]">chevron_right</MaterialSymbol>
            </button>
          </div>
        </div>

        {/* Calendar Grid */}
        <section className="bg-surface-container-lowest rounded-xl p-md mb-xl shadow-[0_8px_30px_0_rgba(0,0,0,0.04)] border border-surface-variant/50">
          <div className="grid grid-cols-7 mb-sm text-center">
            {["S","M","T","W","T","F","S"].map((d, i) => (
              <div key={i} className="font-label-small text-label-small text-on-surface-variant">{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-y-sm gap-x-xs text-center font-body-main text-body-main">
            {/* Leading blanks */}
            {Array.from({ length: firstDay }).map((_, i) => (
              <div key={`prev-${i}`} className="py-2 text-outline-variant cursor-default">
                {prevDays - (firstDay - 1 - i)}
              </div>
            ))}
            {/* Current month */}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const d = i + 1;
              const hasScrim = SCRIM_DAYS.includes(d);
              const isSelected = d === selected;
              return (
                <div
                  key={d}
                  onClick={() => setSelected(d)}
                  className={`py-2 cursor-pointer rounded-lg flex flex-col items-center relative ${
                    isSelected
                      ? "bg-primary text-on-primary shadow-sm"
                      : "hover:bg-surface-container"
                  }`}
                >
                  <span className={isSelected ? "font-label-bold" : ""}>{d}</span>
                  {hasScrim && (
                    <div
                      className={`w-1 h-1 rounded-full absolute bottom-1 ${
                        isSelected ? "bg-on-primary" : "bg-outline"
                      }`}
                    />
                  )}
                </div>
              );
            })}
            {/* Trailing blanks */}
            {Array.from({ length: trailing }).map((_, i) => (
              <div key={`next-${i}`} className="py-2 text-outline-variant cursor-default">
                {i + 1}
              </div>
            ))}
          </div>
        </section>

        {/* Daily Schedule */}
        <section>
          <div className="flex items-center justify-between mb-md">
            <h2 className="font-headline-2 text-headline-2 text-on-surface">{dayLabel}</h2>
            <span className="font-label-small text-label-small text-primary bg-primary-fixed px-2 py-1 rounded-full">
              3 Scrims
            </span>
          </div>
          <div className="flex flex-col gap-md">
            {scheduledScrims.map((scrim) => (
              <Link
                key={scrim.id}
                href="/detail"
                className="bg-surface-container-lowest rounded-xl p-md shadow-[0_8px_30px_0_rgba(0,0,0,0.04)] border border-surface-variant/50 flex items-stretch gap-md relative overflow-hidden hover:border-outline-variant transition-colors cursor-pointer"
              >
                <div className={`w-1 ${scrim.accentColor} absolute left-0 top-md bottom-md rounded-r-full`} />
                <div className="flex flex-col justify-center min-w-[60px] pl-sm">
                  <span className="font-label-bold text-label-bold text-on-surface">{scrim.time}</span>
                  <span className="font-label-small text-label-small text-on-surface-variant">{scrim.tz}</span>
                </div>
                <div className="w-[1px] bg-surface-variant" />
                <div className="flex-1 flex flex-col sm:flex-row sm:items-center justify-between gap-md py-xs">
                  <div className="flex items-center gap-sm">
                    <div className="w-10 h-10 rounded-full bg-surface-container-high flex items-center justify-center border border-surface-variant overflow-hidden">
                      {scrim.img ? (
                        <img alt="Team Logo" className="w-full h-full object-cover" src={scrim.img} />
                      ) : (
                        <span className="font-label-bold text-on-surface-variant">{scrim.initials}</span>
                      )}
                    </div>
                    <div>
                      <h3 className="font-body-main text-body-main text-on-surface font-semibold">{scrim.team}</h3>
                      <p className="font-label-small text-label-small text-on-surface-variant">{scrim.meta}</p>
                    </div>
                  </div>
                  <StatusChip status={scrim.status} />
                </div>
              </Link>
            ))}

            {/* Add Slot */}
            <Link
              href="/?post=true"
              className="bg-transparent rounded-xl p-md border-2 border-dashed border-outline-variant/40 flex items-center justify-center gap-sm cursor-pointer hover:bg-surface-container-low transition-colors py-lg"
            >
              <MaterialSymbol className="text-outline">add</MaterialSymbol>
              <span className="font-label-bold text-label-bold text-outline">Schedule New Scrim</span>
            </Link>
          </div>
        </section>
      </main>

      <BottomNav />
    </>
  );
}
