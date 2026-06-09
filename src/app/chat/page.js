"use client";

import Link from "next/link";
import MaterialSymbol from "@/components/MaterialSymbol";
import TopBar from "@/components/TopBar";

export default function ChatPage() {
  return (
    <div className="bg-background text-on-background min-h-screen flex flex-col">
      <TopBar
        actions={(
          <Link
            aria-label="Back to requests"
            className="hidden h-10 items-center justify-center gap-xs rounded-xl border border-outline-variant/25 bg-surface-container-lowest px-md font-label-bold text-label-bold text-on-surface-variant transition-colors hover:border-primary/35 hover:bg-surface-container hover:text-primary active:scale-95 sm:flex"
            href="/requests"
            title="Back to requests"
          >
            <MaterialSymbol className="text-[18px]">arrow_back</MaterialSymbol>
            Requests
          </Link>
        )}
      />

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
