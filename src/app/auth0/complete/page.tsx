"use client";

import { useEffect, useRef, useState } from "react";
import { LoaderCircle } from "lucide-react";
import { useAuth } from "@/components/auth/auth-provider";
import { PublicHeader } from "@/components/layout/public-header";
import { usePreferences } from "@/components/preferences-provider";
import { ErrorState } from "@/components/ui/status";
import { readStoredUser, readToken } from "@/lib/auth-storage";
import type { User } from "@/types/domain";

export default function Auth0CompletePage() {
  const { completeAuth0Login, redirectForRole, user } = useAuth();
  const { t } = usePreferences();
  const [error, setError] = useState("");
  const started = useRef(false);

  useEffect(() => {
    if (user) {
      redirectToRole(redirectForRole(user.role));
    }
  }, [redirectForRole, user]);

  useEffect(() => {
    if (started.current) {
      return;
    }
    started.current = true;
    let cancelled = false;
    const storedUser = readStoredUser<User>();
    if (readToken() && storedUser) {
      redirectToRole(redirectForRole(storedUser.role));
      return;
    }
    const sessionWatchdog = window.setInterval(() => {
      const nextStoredUser = readStoredUser<User>();
      if (!cancelled && readToken() && nextStoredUser) {
        redirectToRole(redirectForRole(nextStoredUser.role));
      }
    }, 500);

    completeAuth0Login()
      .then((user) => {
        if (!cancelled) {
          redirectToRole(redirectForRole(user.role));
        }
      })
      .catch((err) => {
        const storedUser = readStoredUser<User>();
        if (!cancelled && readToken() && storedUser) {
          redirectToRole(redirectForRole(storedUser.role));
          return;
        }
        if (!cancelled) {
          setError(err instanceof Error ? err.message : t("No se pudo completar Auth0.", "Could not complete Auth0 sign-in."));
        }
      });

    return () => {
      cancelled = true;
      window.clearInterval(sessionWatchdog);
    };
  }, [completeAuth0Login, redirectForRole, t]);

  return (
    <>
      <PublicHeader />
      <main className="grid min-h-[calc(100vh-66px)] place-items-center px-4 py-10">
        <section className="w-full max-w-md rounded-lg border border-black/10 bg-white p-5 text-center shadow-soft">
          <p className="text-sm font-bold uppercase tracking-[0.2em] text-brass">Auth0</p>
          <h1 className="mt-3 text-2xl font-bold text-ink">
            {t("Ingresando", "Signing in")}
          </h1>
          <p className="mt-2 text-sm text-steel">
            {t("Te estamos llevando a tu panel.", "Taking you to your panel.")}
          </p>
          {!error ? (
            <div className="mt-5 flex justify-center">
              <LoaderCircle className="h-7 w-7 animate-spin text-brass" />
            </div>
          ) : null}
          {error ? <div className="mt-4"><ErrorState message={error} /></div> : null}
        </section>
      </main>
    </>
  );
}

function redirectToRole(path: string) {
  const normalized = path.endsWith("/") ? path : `${path}/`;
  window.location.replace(new URL(normalized, window.location.origin).toString());
}
