"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PublicHeader } from "@/components/layout/public-header";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { ErrorState } from "@/components/ui/status";
import { useAuth } from "@/components/auth/auth-provider";

export default function LoginPage() {
  const { login, redirectForRole, startAuth0Login } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("admin@example.com");
  const [password, setPassword] = useState("Admin123!");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [auth0Loading, setAuth0Loading] = useState(false);

  async function handleLogin(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      const user = await login(email, password);
      router.push(redirectForRole(user.role));
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo iniciar sesion.");
    } finally {
      setLoading(false);
    }
  }

  async function goToAuth0() {
    setAuth0Loading(true);
    try {
      await startAuth0Login();
    } catch {
      setAuth0Loading(false);
    }
  }

  return (
    <>
      <PublicHeader />
      <main className="mx-auto grid min-h-[calc(100vh-72px)] max-w-5xl place-items-center px-4 py-8">
        <section className="grid w-full gap-4 lg:grid-cols-2">
          <form onSubmit={handleLogin} className="rounded-lg border border-black/10 bg-white p-5 shadow-soft">
            <h1 className="text-2xl font-bold text-ink">Entrar al sistema</h1>
            <p className="mt-2 text-sm leading-6 text-steel">
              Usa email y password para admin, recepcion, barbero o cliente.
            </p>
            <div className="mt-5 grid gap-4">
              <Field label="Email">
                <Input value={email} onChange={(event) => setEmail(event.target.value)} type="email" />
              </Field>
              <Field label="Password">
                <Input
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  type="password"
                />
              </Field>
              {error ? <ErrorState message={error} /> : null}
              <Button loading={loading} type="submit">
                {loading ? "Entrando..." : "Entrar"}
              </Button>
            </div>
            <div className="mt-5 rounded-md bg-smoke p-3 text-sm leading-6 text-steel">
              <p className="font-semibold text-ink">Credenciales demo</p>
              <p>admin@example.com / Admin123!</p>
              <p>recepcion@example.com / Recepcion123!</p>
              <p>barbero@example.com / Barbero123!</p>
              <p>cliente@example.com / Cliente123!</p>
            </div>
          </form>

          <section className="rounded-lg border border-black/10 bg-white p-5 shadow-soft">
            <h2 className="text-xl font-bold text-ink">Cliente con Google Auth0</h2>
            <p className="mt-2 text-sm leading-6 text-steel">
              Auth0 autentica con Google y despues NUB crea tu sesion interna.
            </p>
            <div className="mt-5 grid gap-4">
              <Button
                loading={auth0Loading}
                onClick={() => void goToAuth0()}
                type="button"
                variant="secondary"
              >
                {auth0Loading ? "Redirigiendo..." : "Entrar con Google"}
              </Button>
              <Link className="text-sm font-semibold text-brass" href="/reservar">
                Reservar sin iniciar sesion
              </Link>
            </div>
          </section>
        </section>
      </main>
    </>
  );
}
