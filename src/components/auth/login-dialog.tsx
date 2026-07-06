"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LogIn, Mail, UserRound, X } from "lucide-react";
import { useAuth } from "@/components/auth/auth-provider";
import { usePreferences } from "@/components/preferences-provider";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { ErrorState, SuccessState } from "@/components/ui/status";

type LoginDialogProps = {
  open: boolean;
  initialMode?: "password" | "google";
  onClose: () => void;
};

export function LoginDialog({ open, initialMode = "password", onClose }: LoginDialogProps) {
  const { user, login, logout, redirectForRole, startAuth0Login } = useAuth();
  const { t } = usePreferences();
  const router = useRouter();
  const [mode, setMode] = useState<"password" | "google">(initialMode);
  const [email, setEmail] = useState("cliente@example.com");
  const [password, setPassword] = useState("Cliente123!");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [auth0Loading, setAuth0Loading] = useState(false);

  useEffect(() => {
    if (open) {
      setMode(initialMode);
      setError("");
      setMessage("");
      setAuth0Loading(false);
    }
  }, [initialMode, open]);

  if (!open) return null;

  async function handleLogin(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      const nextUser = await login(email, password);
      onClose();
      router.push(redirectForRole(nextUser.role));
    } catch (err) {
      setError(err instanceof Error ? err.message : t("No se pudo iniciar sesion.", "Could not sign in."));
    } finally {
      setLoading(false);
    }
  }

  async function goToAuth0() {
    setAuth0Loading(true);
    setError("");
    try {
      await startAuth0Login();
    } catch (err) {
      setAuth0Loading(false);
      setError(err instanceof Error ? err.message : t("No se pudo iniciar Auth0.", "Could not start Auth0."));
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-start bg-black/45 px-4 py-20 backdrop-blur-sm sm:place-items-center sm:py-6">
      <section className="mx-auto w-full max-w-md rounded-lg border border-black/10 bg-white p-4 shadow-soft">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-brass">NUB</p>
            <h2 className="text-xl font-bold text-ink">
              {user ? t("Tu cuenta", "Your account") : t("Ingresar", "Sign in")}
            </h2>
          </div>
          <button
            aria-label={t("Cerrar", "Close")}
            className="grid h-9 w-9 place-items-center rounded-md text-steel hover:bg-black/5"
            onClick={onClose}
            type="button"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {user ? (
          <div className="mt-4 grid gap-3">
            <div className="rounded-md bg-smoke p-3 text-sm text-steel">
              <p className="font-bold text-ink">{user.full_name}</p>
              <p>{user.email}</p>
            </div>
            <Button type="button" onClick={() => router.push(redirectForRole(user.role))}>
              <UserRound className="h-4 w-4" />
              {t("Ir al panel", "Open panel")}
            </Button>
            <Button type="button" variant="secondary" onClick={logout}>
              {t("Salir", "Sign out")}
            </Button>
          </div>
        ) : (
          <>
            <div className="mt-4 grid grid-cols-2 gap-2 rounded-md bg-smoke p-1">
              <button
                className={`rounded px-3 py-2 text-sm font-semibold ${mode === "password" ? "bg-white text-ink shadow-sm" : "text-steel"}`}
                onClick={() => setMode("password")}
                type="button"
              >
                Email
              </button>
              <button
                className={`rounded px-3 py-2 text-sm font-semibold ${mode === "google" ? "bg-white text-ink shadow-sm" : "text-steel"}`}
                onClick={() => setMode("google")}
                type="button"
              >
                Google
              </button>
            </div>

            {mode === "password" ? (
              <form className="mt-4 grid gap-4" onSubmit={handleLogin}>
                <Field label="Email">
                  <Input value={email} onChange={(event) => setEmail(event.target.value)} type="email" />
                </Field>
                <Field label={t("Password", "Password")}>
                  <Input value={password} onChange={(event) => setPassword(event.target.value)} type="password" />
                </Field>
                {error ? <ErrorState message={error} /> : null}
                {message ? <SuccessState message={message} /> : null}
                <Button loading={loading} type="submit">
                  {!loading ? <LogIn className="h-4 w-4" /> : null}
                  {loading ? t("Entrando...", "Signing in...") : t("Entrar", "Sign in")}
                </Button>
              </form>
            ) : (
              <div className="mt-4 grid gap-4">
                <p className="text-sm leading-6 text-steel">
                  {t(
                    "Vas a entrar con Google mediante Auth0.",
                    "You will continue with Google through Auth0.",
                  )}
                </p>
                {error ? <ErrorState message={error} /> : null}
                <Button
                  loading={auth0Loading}
                  onClick={() => void goToAuth0()}
                  type="button"
                  variant="secondary"
                >
                  {!auth0Loading ? <Mail className="h-4 w-4" /> : null}
                  {auth0Loading ? t("Redirigiendo...", "Redirecting...") : t("Entrar con Google", "Continue with Google")}
                </Button>
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}
