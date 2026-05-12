"use client";

import { useEffect, useState } from "react";
import MaterialSymbol from "./MaterialSymbol";

const STORAGE_KEY = "matchmake-theme-v2";

function getInitialTheme() {
  if (typeof window === "undefined") return "light";
  const savedTheme = window.localStorage.getItem(STORAGE_KEY);
  if (savedTheme === "dark" || savedTheme === "light") return savedTheme;
  return "light";
}

function applyTheme(theme) {
  const root = document.documentElement;
  root.classList.toggle("dark", theme === "dark");
  root.classList.toggle("light", theme !== "dark");
  root.style.colorScheme = theme;
}

export default function ThemeToggle() {
  const [theme, setTheme] = useState("light");

  useEffect(() => {
    const initialTheme = getInitialTheme();
    setTheme(initialTheme);
    applyTheme(initialTheme);
  }, []);

  function handleToggle() {
    const nextTheme = theme === "dark" ? "light" : "dark";
    setTheme(nextTheme);
    window.localStorage.setItem(STORAGE_KEY, nextTheme);
    applyTheme(nextTheme);
  }

  const isDark = theme === "dark";

  return (
    <button
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      aria-pressed={isDark}
      className="group flex h-10 items-center gap-xs rounded-full bg-surface-container-high px-xs text-on-surface-variant transition-colors hover:bg-surface-variant"
      onClick={handleToggle}
      title={isDark ? "Light mode" : "Dark mode"}
      type="button"
    >
      <span className={`flex h-8 w-8 items-center justify-center rounded-full transition-colors ${
        isDark ? "bg-primary text-on-primary" : "bg-surface-container-lowest text-primary"
      }`}>
        <MaterialSymbol className="text-[18px]" fill>
          {isDark ? "dark_mode" : "light_mode"}
        </MaterialSymbol>
      </span>
      <span className="hidden pr-sm font-label-small text-label-small sm:inline">
        {isDark ? "Dark" : "Light"}
      </span>
    </button>
  );
}
