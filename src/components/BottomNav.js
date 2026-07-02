"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useOwnerAccess } from "@/lib/use-owner-access";
import MaterialSymbol from "./MaterialSymbol";

const navItems = [
  { label: "Scrims",   icon: "sports_esports", href: "/" },
  { label: "Org",      icon: "corporate_fare",  href: "/org" },
  { label: "Requests", icon: "pending_actions", href: "/requests" },
  { label: "Calendar", icon: "calendar_month",  href: "/calendar" },
];

const adminNavItem = {
  label: "Admin",
  icon: "admin_panel_settings",
  href: "/admin",
};

export default function BottomNav() {
  const pathname = usePathname();
  const isOwner = useOwnerAccess();

  return (
    <nav className="md:hidden bg-surface/90 backdrop-blur-lg fixed bottom-0 w-full rounded-t-2xl border-t border-surface-container shadow-[0_-4px_20px_0_rgba(0,0,0,0.14)] z-30 flex justify-around items-center px-4 pt-3 pb-6">
      {(isOwner ? [...navItems, adminNavItem] : navItems).map((item) => {
        const isActive =
          item.href === "/"
            ? pathname === "/"
            : pathname === item.href || pathname.startsWith(item.href + "/");
        return (
          <Link
            key={item.label}
            href={item.href}
            className={`flex flex-col items-center justify-center gap-1 active:scale-90 transition-all ${
              isActive ? "text-primary" : "text-outline hover:text-primary"
            }`}
          >
            <MaterialSymbol fill={isActive}>{item.icon}</MaterialSymbol>
            <span className="text-[10px] font-semibold tracking-wide uppercase">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
