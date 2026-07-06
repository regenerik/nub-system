"use client";

import { useState } from "react";
import { CalendarPlus, LayoutDashboard, Mail } from "lucide-react";
import { useRouter } from "next/navigation";
import { BookingModal } from "@/components/booking/booking-modal";
import { PublicHeader } from "@/components/layout/public-header";
import { usePreferences } from "@/components/preferences-provider";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/auth/auth-provider";

export default function Home() {
  const { t } = usePreferences();
  const { startAuth0Login, user, redirectForRole } = useAuth();
  const router = useRouter();
  const [bookingOpen, setBookingOpen] = useState(false);

  return (
    <>
      <PublicHeader />
      <main className="grid min-h-[calc(100vh-66px)] place-items-center px-4 py-10">
        <section className="mx-auto grid w-full max-w-3xl justify-items-center text-center">
          <p className="text-sm font-bold uppercase tracking-[0.34em] text-brass">NUB System</p>
          <h1 className="mt-5 text-5xl font-bold leading-none text-ink sm:text-7xl">
            {t("Reserva tu turno", "Book your appointment")}
          </h1>
          <p className="mt-5 max-w-xl text-base leading-7 text-steel">
            {t(
              "Elegis sede, servicio, profesional, fecha y horario en pocos pasos.",
              "Choose branch, service, professional, date and time in a few quick steps.",
            )}
          </p>
          <div className="mt-9 grid w-full max-w-sm gap-3">
            <Button className="min-h-14 text-base" type="button" onClick={() => setBookingOpen(true)}>
              <CalendarPlus className="h-5 w-5" />
              {t("Reservar turno", "Book now")}
            </Button>
            {user ? (
              <button
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md border border-black/10 bg-white px-4 py-2 text-sm font-semibold text-ink transition hover:bg-smoke"
                onClick={() => router.push(redirectForRole(user.role))}
                type="button"
              >
                <LayoutDashboard className="h-4 w-4" />
                {t("Ir a mi panel", "Go to my panel")}
              </button>
            ) : (
              <button
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md border border-black/10 bg-white px-4 py-2 text-sm font-semibold text-ink transition hover:bg-smoke"
                onClick={() => void startAuth0Login()}
                type="button"
              >
                <Mail className="h-4 w-4" />
                {t("Entrar con Google", "Continue with Google")}
              </button>
            )}
          </div>
        </section>
      </main>
      <BookingModal open={bookingOpen} onClose={() => setBookingOpen(false)} />
    </>
  );
}
