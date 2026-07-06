"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, CalendarX, MapPin, UserRound, X } from "lucide-react";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { PanelShell } from "@/components/layout/panel-shell";
import { usePreferences } from "@/components/preferences-provider";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/field";
import { ImageUploader } from "@/components/ui/image-uploader";
import { EmptyState, ErrorState } from "@/components/ui/status";
import { api } from "@/lib/api";
import { appointmentStatusLabel, money, shortDate } from "@/lib/format";
import type { ApiList, Appointment, Client } from "@/types/domain";

const BARBERSHOP_WHATSAPP_NUMBER = "5491121893986";

export default function ClientePage() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [profile, setProfile] = useState<Client | null>(null);
  const [error, setError] = useState("");
  const [section, setSection] = useState<"reservas" | "perfil">("reservas");
  const [cancelTarget, setCancelTarget] = useState<Appointment | null>(null);
  const [cancelLoading, setCancelLoading] = useState(false);

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

  const historicalStatuses = new Set(["completed", "cancelled", "no_show"]);
  const future = appointments.filter(
    (item) => new Date(item.starts_at) >= new Date() && !historicalStatuses.has(item.status),
  );
  const past = appointments.filter(
    (item) => new Date(item.starts_at) < new Date() || historicalStatuses.has(item.status),
  );

  async function cancelAppointment() {
    if (!cancelTarget) return;
    setCancelLoading(true);
    setError("");
    try {
      const updated = await api.patch<Appointment>(`/client/me/appointments/${cancelTarget.id}/cancel`, {});
      setAppointments((current) => current.map((item) => (item.id === updated.id ? updated : item)));
      setCancelTarget(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cancelar la reserva.");
    } finally {
      setCancelLoading(false);
    }
  }

  return (
    <ProtectedRoute roles={["cliente", "admin"]}>
      <PanelShell
        title={`Hola ${profile?.full_name || "cliente"}`}
        subtitle="Bienvenido a NUB."
        profileImageUrl={profile?.profile_image_url}
        clientReservationCount={future.length}
      >
        <div id={section === "perfil" ? "mi-perfil" : "mis-reservas"} className="grid gap-5">
          {error ? <ErrorState message={error} /> : null}
          {section === "perfil" ? (
            <ProfileCard profile={profile} onProfileSaved={setProfile} />
          ) : (
            <>
              <AppointmentList
                canCancel
                clientName={profile?.full_name}
                onCancel={setCancelTarget}
                title="Proximos turnos"
                items={future}
              />
              <AppointmentList clientName={profile?.full_name} title="Historial" items={past} />
            </>
          )}
        </div>
        <CancelReservationDialog
          appointment={cancelTarget}
          loading={cancelLoading}
          onCancel={() => setCancelTarget(null)}
          onConfirm={cancelAppointment}
        />
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
    <section id="mi-perfil" className="rounded-lg border border-black/10 bg-white p-4 shadow-soft sm:p-5">
      <div className="flex flex-wrap items-center gap-4">
        <div className="relative shrink-0">
          <span className="grid h-20 w-20 place-items-center overflow-hidden rounded-full bg-smoke text-ink sm:h-24 sm:w-24">
            {form.profile_image_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img alt="" className="h-full w-full object-cover" src={form.profile_image_url} referrerPolicy="no-referrer" />
            ) : (
              <span className="text-2xl font-bold">{form.full_name.slice(0, 1) || "N"}</span>
            )}
          </span>
          <ImageUploader
            buttonClassName="inline-flex min-h-8 cursor-pointer items-center justify-center gap-1 rounded-full border border-black/10 bg-brass px-3 py-1.5 text-xs font-bold text-ink shadow-soft transition hover:brightness-95"
            buttonLabel="Reemplazar imagen"
            className="absolute -bottom-2 left-10 w-max sm:left-12"
            onChange={(url) => setForm({ ...form, profile_image_url: url })}
            showPreview={false}
            value={form.profile_image_url}
          />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-bold text-ink">Mi perfil</h2>
          <p className="text-sm text-steel">Actualiza tus datos personales.</p>
        </div>
      </div>
      <form className="mt-4 grid gap-4 sm:grid-cols-2" onSubmit={save}>
        <Field label="Nombre completo">
          <Input placeholder="Tu nombre y apellido" value={form.full_name} onChange={(event) => setForm({ ...form, full_name: event.target.value })} />
        </Field>
        <Field label="Telefono">
          <Input placeholder="+54 9 11 2345-6789" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} />
        </Field>
        <Field label="DNI">
          <Input placeholder="Ej: 30123456" value={form.dni} onChange={(event) => setForm({ ...form, dni: event.target.value })} />
        </Field>
        <div className="sm:col-span-2">
          <Field label="Notas personales">
            <Textarea placeholder="Preferencias, alergias o comentarios para tus reservas" value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} />
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

function AppointmentList({
  title,
  items,
  clientName,
  canCancel = false,
  onCancel,
}: {
  title: string;
  items: Appointment[];
  clientName?: string;
  canCancel?: boolean;
  onCancel?: (appointment: Appointment) => void;
}) {
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
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <p className="font-bold text-ink">{shortDate(appointment.starts_at)}</p>
                  <p className="mt-1 text-steel">
                    Estado: {appointmentStatusLabel(appointment.status, locale)}
                  </p>
                  <p className="text-steel">Monto: {money(appointment.total_final ?? appointment.total_estimated)}</p>
                  <p className="mt-2 font-semibold text-ink">
                    Servicio: {serviceSummary(appointment)}
                  </p>
                  <BranchLine appointment={appointment} />
                </div>
                <BarberBadge appointment={appointment} />
              </div>
              <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                <a href={googleCalendarUrl(appointment)} target="_blank" rel="noreferrer">
                  <Button className="w-full sm:w-auto" type="button" variant="secondary">
                    Abrir en Google Calendar
                  </Button>
                </a>
                <a href={whatsappContactUrl(appointment, clientName)} target="_blank" rel="noreferrer">
                  <Button className="w-full bg-[#25D366] text-white hover:brightness-95 sm:w-auto" type="button">
                    <WhatsAppIcon className="h-4 w-4" />
                    Contactanos
                  </Button>
                </a>
                {canCancel ? (
                  <Button
                    className="w-full sm:w-auto"
                    onClick={() => onCancel?.(appointment)}
                    type="button"
                    variant="danger"
                  >
                    <CalendarX className="h-4 w-4" />
                    Cancelar reserva
                  </Button>
                ) : null}
              </div>
            </article>
          ))
        ) : (
          <EmptyState title="No hay turnos para mostrar." />
        )}
      </div>
    </section>
  );
}

function BarberBadge({ appointment }: { appointment: Appointment }) {
  const name = appointment.barber?.full_name || "Barbero asignado";
  return (
    <div className="flex min-w-[180px] items-center gap-3 rounded-md bg-white/70 p-2">
      <span className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-full bg-white text-ink">
        {appointment.barber?.profile_image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            alt=""
            className="h-full w-full object-cover"
            referrerPolicy="no-referrer"
            src={appointment.barber.profile_image_url}
          />
        ) : (
          <UserRound className="h-6 w-6 text-steel" />
        )}
      </span>
      <span className="min-w-0">
        <span className="block text-xs font-bold uppercase tracking-[0.12em] text-steel">Barbero</span>
        <span className="block truncate font-bold text-ink">{name}</span>
      </span>
    </div>
  );
}

function WhatsAppIcon({ className = "" }: { className?: string }) {
  return (
    <svg aria-hidden="true" className={className} fill="currentColor" viewBox="0 0 24 24">
      <path d="M12.04 2.25A9.7 9.7 0 0 0 3.7 16.9L2.75 21.75l4.97-1.17a9.7 9.7 0 1 0 4.32-18.33Zm0 1.86a7.84 7.84 0 1 1-3.84 14.68l-.31-.18-2.78.65.53-2.72-.2-.32a7.84 7.84 0 0 1 6.6-12.11Zm-3.4 3.86c-.18 0-.47.07-.72.34-.25.27-.94.92-.94 2.24 0 1.31.97 2.59 1.1 2.77.14.18 1.87 3 4.62 4.09 2.29.9 2.76.72 3.25.68.5-.05 1.61-.66 1.84-1.3.23-.64.23-1.18.16-1.3-.07-.12-.25-.19-.53-.33-.28-.14-1.61-.8-1.86-.89-.25-.09-.44-.14-.62.14-.18.27-.71.88-.87 1.06-.16.18-.32.21-.6.07-.28-.14-1.17-.43-2.23-1.38-.83-.74-1.39-1.65-1.55-1.93-.16-.28-.02-.43.12-.57.13-.13.28-.32.41-.48.14-.16.18-.28.28-.46.09-.18.05-.34-.02-.48-.07-.14-.62-1.49-.85-2.03-.22-.54-.45-.46-.62-.47l-.53-.01Z" />
    </svg>
  );
}

function BranchLine({ appointment }: { appointment: Appointment }) {
  if (!appointment.branch) return null;
  const mapsUrl = googleMapsUrl(appointment);
  return (
    <div className="mt-2 grid gap-1 text-steel">
      <p>
        Sucursal: <span className="font-semibold text-ink">{appointment.branch.name}</span>
      </p>
      <p className="flex flex-wrap items-center gap-1">
        <span>
          Direccion: <span className="font-semibold text-ink">{appointment.branch.address}</span>
        </span>
        <a
          aria-label="Abrir direccion en Google Maps"
          className="inline-grid h-7 w-7 place-items-center rounded-full bg-clay/15 text-clay transition hover:bg-clay/25"
          href={mapsUrl}
          rel="noreferrer"
          target="_blank"
          title="Abrir en Google Maps"
        >
          <MapPin className="h-4 w-4" />
        </a>
      </p>
    </div>
  );
}

function serviceSummary(appointment: Appointment) {
  const names = [
    appointment.primary_service?.name,
    ...(appointment.extra_services ?? []).map((extra) => extra.name || extra.service?.name),
  ].filter(Boolean);
  return names.length ? names.join(" + ") : `Turno #${appointment.id}`;
}

function CancelReservationDialog({
  appointment,
  loading,
  onCancel,
  onConfirm,
}: {
  appointment: Appointment | null;
  loading: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  if (!appointment) return null;
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/55 px-4 py-6 backdrop-blur-sm">
      <section className="w-full max-w-md rounded-lg border border-black/10 bg-white p-5 shadow-soft">
        <div className="flex items-start justify-between gap-4">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-clay/15 text-clay">
            <AlertTriangle className="h-6 w-6" />
          </div>
          <button
            aria-label="Cerrar"
            className="grid h-9 w-9 place-items-center rounded-md text-steel hover:bg-smoke"
            onClick={onCancel}
            type="button"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <h2 className="mt-4 text-xl font-bold text-ink">Cancelar reserva</h2>
        <p className="mt-2 leading-6 text-steel">
          Estas seguro que queres cancelar tu reserva para el{" "}
          <span className="font-bold text-ink">{shortDate(appointment.starts_at)}</span>?
        </p>
        <p className="mt-2 text-sm leading-6 text-steel">
          Servicio: <span className="font-semibold text-ink">{serviceSummary(appointment)}</span>
          <br />
          Barbero: <span className="font-semibold text-ink">{appointment.barber?.full_name || "Barbero asignado"}</span>
          {appointment.branch ? (
            <>
              <br />
              Sucursal: <span className="font-semibold text-ink">{appointment.branch.name}</span>
              <br />
              Direccion:{" "}
              <a
                className="font-semibold text-brass underline-offset-4 hover:underline"
                href={googleMapsUrl(appointment)}
                rel="noreferrer"
                target="_blank"
              >
                {appointment.branch.address}
              </a>
            </>
          ) : null}
        </p>
        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button disabled={loading} type="button" variant="secondary" onClick={onCancel}>
            Mantener
          </Button>
          <Button loading={loading} type="button" variant="danger" onClick={onConfirm}>
            Dar la baja
          </Button>
        </div>
      </section>
    </div>
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

function googleMapsUrl(appointment: Appointment) {
  const query = [appointment.branch?.name, appointment.branch?.address].filter(Boolean).join(" ");
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

function whatsappContactUrl(appointment: Appointment, clientName?: string) {
  const customerName = clientName || appointment.client?.full_name || "cliente";
  const barberName = appointment.barber?.full_name || "el barbero asignado";
  const message = `Hola mi nombre es ${customerName}. Tengo turno el dia ${shortDate(appointment.starts_at)} con el barbero ${barberName} y tengo una duda...`;
  return `https://wa.me/${BARBERSHOP_WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
}
