import { NextResponse } from "next/server";
import { auth0 } from "@/lib/auth0";
import type { LoginResponse } from "@/types/domain";

export async function POST() {
  const session = await auth0.getSession();

  if (!session?.user) {
    return NextResponse.json({ message: "No hay sesion Auth0 activa." }, { status: 401 });
  }

  const email = session.user.email;
  if (!email) {
    return NextResponse.json(
      { message: "Auth0 no devolvio email para este usuario." },
      { status: 422 },
    );
  }

  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:5000/api";
  const response = await fetch(`${apiUrl}/auth/google`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email,
      full_name: session.user.name ?? email.split("@")[0] ?? "Cliente Auth0",
      google_account_id: session.user.sub ?? `auth0-${email}`,
      profile_image_url: session.user.picture,
    }),
    cache: "no-store",
  });

  const data = (await response.json()) as LoginResponse | { message?: string };
  if (!response.ok) {
    return NextResponse.json(data, { status: response.status });
  }

  return NextResponse.json(data);
}
