"use client";

import Link from "next/link";
import MaterialSymbol from "@/components/MaterialSymbol";

export default function ChatPage() {
  return (
    <div className="bg-background text-on-background min-h-screen flex flex-col">
      <header className="bg-white/80 backdrop-blur-md top-0 sticky z-50 shadow-[0_4px_20px_0_rgba(0,0,0,0.04)] border-b border-slate-200/50 flex justify-between items-center w-full px-5 h-14">
        <Link
          href="/requests"
          className="text-primary hover:bg-surface-container transition-colors active:scale-95 p-2 -ml-2 rounded-full flex items-center justify-center"
        >
          <MaterialSymbol>arrow_back_ios_new</MaterialSymbol>
        </Link>
        <h1 className="text-lg font-black tracking-tighter text-on-surface">Scrim Chat</h1>
        <div className="w-10" />
      </header>

      <main className="flex-1 px-margin-mobile py-xl max-w-[720px] w-full mx-auto">
        <div className="rounded-xl border border-outline-variant/30 bg-surface-container-lowest p-lg text-center">
          <MaterialSymbol className="mx-auto mb-sm block text-[42px] text-outline">chat_bubble</MaterialSymbol>
          <h2 className="font-headline-2 text-headline-2 text-on-surface">Open a requested scrim to use chat.</h2>
          <p className="mt-sm font-body-sub text-body-sub text-on-surface-variant">
            Chat is tied to each pending or confirmed scrim so only the two participating organizations can coordinate.
          </p>
          <Link
            className="mt-lg inline-flex items-center gap-xs rounded-lg bg-primary px-md py-sm font-label-bold text-label-bold text-on-primary"
            href="/requests"
          >
            View Requests
            <MaterialSymbol className="text-[18px]">arrow_forward</MaterialSymbol>
          </Link>
        </div>
      </main>
    </div>
  );
}
