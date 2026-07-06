"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { PanelShell } from "@/components/layout/panel-shell";
import { usePreferences } from "@/components/preferences-provider";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/field";
import { ImageUploader } from "@/components/ui/image-uploader";
import { EmptyState, ErrorState } from "@/components/ui/status";
import { api } from "@/lib/api";
import { appConfig } from "@/lib/config";
import { appointmentStatusLabel, money, shortDate } from "@/lib/format";
import type { ApiList, Appointment, Client } from "@/types/domain";

export default function ClientePage() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [profile, setProfile] = useState<Client | null>(null);
  const [error, setError] = useState("");
  const [section, setSection] = useState<"reservas" | "perfil">("reservas");

  const load = useCallback(() => {
    Promise.all([
      api.get<ApiList<Appointment>>("/client/me/appointments"),
      api.get<Client>("/client/me/profile"),
    ])
      .then(([appointmentData, profileData]) => {
        setAppointments(appointmentData.items);
        setProfile(profileData);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "No se cargaron tus datos."));
  }, []);

  useEffect(load, [load]);

  useEffect(() => {
    function setFromValue(value?: string) {
      setSection(value === "perfil" || window.location.hash === "#mi-perfil" ? "perfil" : "reservas");
    }
    function syncSectionFromHash() {
      setFromValue();
    }
    function syncSectionFromEvent(event: Event) {
      const detail = (event as CustomEvent<"reservas" | "perfil">).detail;
      setFromValue(detail);
    }
    syncSectionFromHash();
    window.addEventListener("hashchange", syncSectionFromHash);
    window.addEventListener("nub:client-section-change", syncSectionFromEvent);
    return () => {
      window.removeEventListener("hashchange", syncSectionFromHash);
      window.removeEventListener("nub:client-section-change", syncSectionFromEvent);
    };
  }, []);

  const future = appointments.filter((item) => new Date(item.starts_at) >= new Date());
  const past = appointments.filter((item) => new Date(item.starts_at) < new Date());

  return (
    <ProtectedRoute roles={["cliente", "admin"]}>
      <PanelShell
        title={`Hola ${profile?.full_name || "cliente"}`}
        subtitle="Bienvenido a NUB."
        profileImageUrl={profile?.profile_image_url}
      >
        <div id={section === "perfil" ? "mi-perfil" : "mis-reservas"} className="grid gap-5">
          {error ? <ErrorState message={error} /> : null}
          {section === "perfil" ? (
            <ProfileCard profile={profile} onProfileSaved={setProfile} />
          ) : (
            <>
              <AppointmentList title="Proximos turnos" items={future} />
              <AppointmentList title="Historial" items={past} />
            </>
          )}
        </div>
      </PanelShell>
    </ProtectedRoute>
  );
}

function ProfileCard({
  profile,
  onProfileSaved,
}: {
  profile: Client | null;
  onProfileSaved: (profile: Client) => void;
}) {
  const [form, setForm] = useState({
    full_name: "",
    phone: "",
    dni: "",
    notes: "",
    profile_image_url: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!profile) return;
    setForm({
      full_name: profile.full_name ?? "",
      phone: profile.phone ?? "",
      dni: profile.dni ?? "",
      notes: profile.notes ?? "",
      profile_image_url: profile.profile_image_url ?? "",
    });
  }, [profile]);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const updated = await api.patch<Client>("/client/me/profile", form);
      onProfileSaved(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar tu perfil.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section id="mi-perfil" className="rounded-lg border border-black/10 bg-white p-4 shadow-soft">
      <div className="flex items-center gap-3">
        <span className="grid h-14 w-14 place-items-center overflow-hidden rounded-full bg-smoke text-ink">
          {form.profile_image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img alt="" className="h-full w-full object-cover" src={form.profile_image_url} referrerPolicy="no-referrer" />
          ) : (
            <span className="text-lg font-bold">{form.full_name.slice(0, 1) || "N"}</span>
          )}
        </span>
        <div>
          <h2 className="text-lg font-bold text-ink">Mi perfil</h2>
          <p className="text-sm text-steel">Actualiza tus datos personales.</p>
        </div>
      </div>
      <form className="mt-4 grid gap-4 sm:grid-cols-2" onSubmit={save}>
        <Field label="Nombre completo">
          <Input value={form.full_name} onChange={(event) => setForm({ ...form, full_name: event.target.value })} />
        </Field>
        <Field label="Telefono">
          <Input value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} />
        </Field>
        <Field label="DNI">
          <Input value={form.dni} onChange={(event) => setForm({ ...form, dni: event.target.value })} />
        </Field>
        <div className="sm:col-span-2">
          <Field label="Foto de perfil">
            <ImageUploader value={form.profile_image_url} onChange={(url) => setForm({ ...form, profile_image_url: url })} />
          </Field>
        </div>
        <div className="sm:col-span-2">
          <Field label="Notas personales">
            <Textarea value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} />
          </Field>
        </div>
        {error ? <div className="sm:col-span-2"><ErrorState message={error} /></div> : null}
        <div className="sm:col-span-2">
          <Button disabled={saving} type="submit">
            {saving ? "Guardando..." : "Guardar perfil"}
          </Button>
        </div>
      </form>
    </section>
  );
}

function AppointmentList({ title, items }: { title: string; items: Appointment[] }) {
  const { locale } = usePreferences();

  return (
    <section className="rounded-lg border border-black/10 bg-white p-4 shadow-soft">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-bold text-ink">{title}</h2>
        {title === "Proximos turnos" ? (
          <Link href="/reservar">
            <Button type="button">Nueva reserva</Button>
          </Link>
        ) : null}
      </div>
      <div className="mt-4 grid gap-3">
        {items.length ? (
          items.map((appointment) => (
            <article key={appointment.id} className="rounded-md bg-smoke p-3 text-sm">
              <p className="font-bold text-ink">{shortDate(appointment.starts_at)}</p>
              <p className="mt-1 text-steel">
                Estado: {appointmentStatusLabel(appointment.status, locale)}
              </p>
              <p className="text-steel">Monto: {money(appointment.total_final ?? appointment.total_estimated)}</p>
              <a href={googleCalendarUrl(appointment)} target="_blank" rel="noreferrer">
                <Button className="mt-3" type="button" variant="secondary">
                  Abrir en Google Calendar
                </Button>
              </a>
              <a className="ml-2" href={`${appConfig.backendUrl}/api/appointments/${appointment.id}/calendar.ics`}>
                <Button className="mt-3" type="button" variant="secondary">
                  Descargar .ics
                </Button>
              </a>
            </article>
          ))
        ) : (
          <EmptyState title="No hay turnos para mostrar." />
        )}
      </div>
    </section>
  );
}

function googleCalendarUrl(appointment: Appointment) {
  const start = new Date(appointment.starts_at).toISOString().replace(/[-:]|\.\d{3}/g, "");
  const end = new Date(appointment.ends_at).toISOString().replace(/[-:]|\.\d{3}/g, "");
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: "Turno NUB System",
    dates: `${start}/${end}`,
    details: `Turno #${appointment.id}. Estado: ${appointmentStatusLabel(appointment.status)}`,
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}
