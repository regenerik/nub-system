"use client";

import { useState } from "react";
import Link from "next/link";
import { Globe2, Moon, Scissors, Sun, UserRound } from "lucide-react";
import { LoginDialog } from "@/components/auth/login-dialog";
import { usePreferences } from "@/components/preferences-provider";

export function PublicHeader() {
  const { theme, locale, toggleTheme, setLocale, t } = usePreferences();
  const [loginOpen, setLoginOpen] = useState(false);

  return (
    <header className="sticky top-0 z-20 border-b border-black/10 bg-white/90 backdrop-blur dark:border-white/10 dark:bg-[#111315]/95">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
        <Link className="flex items-center gap-2 font-bold text-ink" href="/">
          <span className="flex h-9 w-9 items-center justify-center rounded-md bg-ink text-white dark:text-black">
            <Scissors className="h-5 w-5" />
          </span>
          NUB System
        </Link>
        <nav className="flex items-center gap-2">
          <button
            aria-label={t("Cambiar tema", "Toggle theme")}
            className="grid h-10 w-10 place-items-center rounded-md text-steel hover:bg-black/5 dark:text-white dark:hover:bg-white/10"
            onClick={toggleTheme}
            type="button"
          >
            {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </button>
          <button
            aria-label={t("Cambiar idioma", "Change language")}
            className="inline-flex h-10 items-center gap-1 rounded-md px-2 text-sm font-bold text-steel hover:bg-black/5 dark:text-white dark:hover:bg-white/10"
            onClick={() => setLocale(locale === "es" ? "en" : "es")}
            type="button"
          >
            <Globe2 className="h-4 w-4" />
            {locale.toUpperCase()}
          </button>
          <button
            aria-label={t("Ingresar", "Sign in")}
            className="grid h-10 w-10 place-items-center rounded-md border border-black/10 bg-white text-ink hover:bg-smoke dark:border-white/15 dark:bg-white/10 dark:text-white dark:hover:bg-white/15"
            onClick={() => setLoginOpen(true)}
            type="button"
          >
            <UserRound className="h-5 w-5" />
          </button>
        </nav>
      </div>
      <LoginDialog open={loginOpen} onClose={() => setLoginOpen(false)} />
    </header>
  );
}
