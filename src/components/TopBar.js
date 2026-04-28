"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import MaterialSymbol from "./MaterialSymbol";
import { clearAuthSession } from "@/lib/auth-session";
import { supabase } from "@/lib/supabase";

const navItems = [
  { label: "Scrims",   href: "/" },
  { label: "Org",      href: "/org" },
  { label: "Requests", href: "/requests" },
  { label: "Calendar", href: "/calendar" },
];

const AVATAR =
  "https://lh3.googleusercontent.com/aida-public/AB6AXuDZas2PHDhMQf6bh1NqGekpHou2Fk84J0kH5hv9VCjvdsxWej66o0a82Vx5Uymod3zrwESdhL5KpoF6EEdRjTxa6qmfLeqD2arJId1d3y0_gDsrWQccFcPb3Z0ry_GZXzXvN-q6I0qse-d6rJ_hVaxmP7Vwghs6A8jJMjNiXQDeL8niwgPUtvqF3YukqYrrSavndl-4EagChEnEkw3DVtUqxf3SMvL7yEndQcX7HDvu-DdG5rdxcsVfvmrr1ghTYu05Oy7L5b08kOE";

export default function TopBar({ right }) {
  const pathname = usePathname();
  const router = useRouter();

  async function handleLogout() {
    await supabase.auth.signOut();
    clearAuthSession();
    router.push("/login");
    router.refresh();
  }

  return (
    <header className="bg-white/80 backdrop-blur-md text-on-surface w-full top-0 sticky z-50 border-b border-surface-variant flex items-center justify-between px-5 h-16">
      {/* Left: avatar + wordmark */}
      <div className="flex items-center gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img alt="User avatar" className="w-8 h-8 rounded-full object-cover" src={AVATAR} />
        <span className="text-xl font-bold tracking-tight text-on-surface">ScrimGG</span>
      </div>

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
          <button className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-surface-container transition-colors active:scale-95">
            <MaterialSymbol className="text-on-surface-variant">notifications</MaterialSymbol>
          </button>
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
