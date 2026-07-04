"use client";

import { useState } from "react";
import { CalendarPlus, Mail } from "lucide-react";
import { BookingModal } from "@/components/booking/booking-modal";
import { PublicHeader } from "@/components/layout/public-header";
import { usePreferences } from "@/components/preferences-provider";
import { Button } from "@/components/ui/button";

export default function Home() {
  const { t } = usePreferences();
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
            <a
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md border border-black/10 bg-white px-4 py-2 text-sm font-semibold text-ink transition hover:bg-smoke"
              href="/auth/login?connection=google-oauth2&returnTo=/auth0/complete"
            >
              <Mail className="h-4 w-4" />
              {t("Entrar con Google", "Continue with Google")}
            </a>
          </div>
        </section>
      </main>
      <BookingModal open={bookingOpen} onClose={() => setBookingOpen(false)} />
    </>
  );
}
