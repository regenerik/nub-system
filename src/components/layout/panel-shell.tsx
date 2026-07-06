"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { LogOut, Moon, Sun, UserRound } from "lucide-react";
import { useAuth } from "@/components/auth/auth-provider";
import { usePreferences } from "@/components/preferences-provider";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import type { ApiList, Appointment, UserRole } from "@/types/domain";

export function PanelShell({
  title,
  subtitle,
  children,
  profileImageUrl,
  headerAccessory,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  profileImageUrl?: string | null;
  headerAccessory?: React.ReactNode;
}) {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = usePreferences();
  const [reprogramCount, setReprogramCount] = useState(0);
  const navItems = getNavItems(user?.role, reprogramCount);
  const isClient = user?.role === "cliente";
  const avatarUrl = profileImageUrl || user?.profile_image_url;

  function openClientSection(section: "reservas" | "perfil") {
    const hash = section === "perfil" ? "mi-perfil" : "mis-reservas";
    window.history.pushState(null, "", `/cliente/#${hash}`);
    window.dispatchEvent(new CustomEvent("nub:client-section-change", { detail: section }));
  }

  useEffect(() => {
    if (user?.role !== "admin" && user?.role !== "recepcion") return;
    const refreshReprogramCount = () => {
      api
        .get<ApiList<Appointment>>("/appointments/reprogramming")
        .then((data) => setReprogramCount(data.items.length))
        .catch(() => setReprogramCount(0));
    };
    refreshReprogramCount();
    window.addEventListener("nub:reprogramming-updated", refreshReprogramCount);
    return () => window.removeEventListener("nub:reprogramming-updated", refreshReprogramCount);
  }, [user?.role]);

  return (
    <main className="min-h-screen">
      <div className="mx-2 grid max-w-none gap-5 px-2 py-5 sm:mx-3 sm:px-3 lg:grid-cols-[144px_1fr] lg:px-3">
        <aside className="overflow-hidden rounded-lg border border-black/10 bg-white p-3 shadow-soft lg:sticky lg:top-5 lg:h-[calc(100vh-2.5rem)]">
          <Link href="/" className="text-lg font-bold text-ink">
            NUB System
          </Link>
          {isClient ? (
            <div className="mt-5 grid gap-3">
              <div className="flex justify-center">
                <Avatar imageUrl={avatarUrl} fallback={user?.full_name} sizeClassName="h-16 w-16" />
              </div>
              <nav className="grid gap-2 text-sm">
                <button
                  className="block w-full rounded-md px-2 py-2 text-left hover:bg-smoke"
                  onClick={() => openClientSection("reservas")}
                  type="button"
                >
                  Mis reservas
                </button>
                <button
                  className="block w-full rounded-md px-2 py-2 text-left hover:bg-smoke"
                  onClick={() => openClientSection("perfil")}
                  type="button"
                >
                  Mi perfil
                </button>
              </nav>
            </div>
          ) : (
            <>
              <p className="mt-1 text-xs uppercase text-steel">{user?.role}</p>
              <nav className="mt-5 grid gap-2 text-sm">
                {navItems.map((item) => (
                  <Link key={item.href} href={item.href} className="flex items-center justify-between gap-2 rounded-md px-3 py-2 hover:bg-smoke">
                    {item.label}
                    {item.badge ? (
                      <span className="rounded-full bg-clay px-2 py-0.5 text-xs font-bold text-white">{item.badge}</span>
                    ) : null}
                  </Link>
                ))}
              </nav>
            </>
          )}
          <div className="mt-5 flex items-center gap-1.5">
            <button
              type="button"
              aria-label="Cambiar tema"
              className="grid h-9 w-9 shrink-0 place-items-center rounded-md border border-black/10 bg-white text-ink hover:bg-smoke dark:border-white/15 dark:bg-white/10 dark:text-white dark:hover:bg-white/15"
              onClick={toggleTheme}
            >
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
            <Button className="h-9 min-h-9 flex-1 gap-1.5 px-1.5 text-xs" type="button" variant="secondary" onClick={logout}>
              <LogOut className="h-3.5 w-3.5" />
              Salir
            </Button>
          </div>
        </aside>
        <section className="min-w-0">
          <header className="mb-5 rounded-lg border border-black/10 bg-white p-4 shadow-soft">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h1 className="text-2xl font-bold text-ink">{title}</h1>
                <p className="mt-1 text-sm leading-6 text-steel">{subtitle}</p>
              </div>
              {headerAccessory ? <div className="min-w-[220px] max-w-xs">{headerAccessory}</div> : null}
            </div>
          </header>
          {children}
        </section>
      </div>
    </main>
  );
}

function Avatar({
  imageUrl,
  fallback,
  sizeClassName,
}: {
  imageUrl?: string | null;
  fallback?: string | null;
  sizeClassName: string;
}) {
  return (
    <span className={`grid ${sizeClassName} place-items-center overflow-hidden rounded-full bg-smoke text-ink`}>
      {imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img alt="" className="h-full w-full object-cover" src={imageUrl} referrerPolicy="no-referrer" />
      ) : fallback ? (
        <span className="text-lg font-bold">{fallback.slice(0, 1).toUpperCase()}</span>
      ) : (
        <UserRound className="h-6 w-6" />
      )}
    </span>
  );
}

function getNavItems(role?: UserRole, reprogramCount = 0) {
  if (role === "admin") {
    return [
      { href: "/recepcion", label: "Recepcion" },
      { href: "/recepcion/clientes", label: "Clientes" },
      { href: "/recepcion/ventas", label: "Ventas" },
      { href: "/recepcion/reprogramar", label: "Reprogramar", badge: reprogramCount },
      { href: "/admin", label: "Admin" },
    ];
  }
  if (role === "recepcion") {
    return [
      { href: "/recepcion", label: "Recepcion" },
      { href: "/recepcion/clientes", label: "Clientes" },
      { href: "/recepcion/ventas", label: "Ventas" },
      { href: "/recepcion/reprogramar", label: "Reprogramar", badge: reprogramCount },
    ];
  }
  if (role === "barbero") {
    return [{ href: "/barbero", label: "Barbero" }];
  }
  return [{ href: "/cliente", label: "Cliente" }];
}
