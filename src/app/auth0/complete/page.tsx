"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/auth-provider";
import { PublicHeader } from "@/components/layout/public-header";
import { usePreferences } from "@/components/preferences-provider";
import { ErrorState } from "@/components/ui/status";

export default function Auth0CompletePage() {
  const { completeAuth0Login, redirectForRole } = useAuth();
  const { t } = usePreferences();
  const router = useRouter();
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    completeAuth0Login()
      .then((user) => {
        if (!cancelled) {
          router.replace(redirectForRole(user.role));
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : t("No se pudo completar Auth0.", "Could not complete Auth0 sign-in."));
        }
      });

    return () => {
      cancelled = true;
    };
  }, [completeAuth0Login, redirectForRole, router, t]);

  return (
    <>
      <PublicHeader />
      <main className="grid min-h-[calc(100vh-66px)] place-items-center px-4 py-10">
        <section className="w-full max-w-md rounded-lg border border-black/10 bg-white p-5 text-center shadow-soft">
          <p className="text-sm font-bold uppercase tracking-[0.2em] text-brass">Auth0</p>
          <h1 className="mt-3 text-2xl font-bold text-ink">
            {t("Completando inicio de sesion", "Completing sign-in")}
          </h1>
          <p className="mt-2 text-sm text-steel">
            {t("Estamos preparando tu panel.", "We are preparing your panel.")}
          </p>
          {error ? <div className="mt-4"><ErrorState message={error} /></div> : null}
        </section>
      </main>
    </>
  );
}
