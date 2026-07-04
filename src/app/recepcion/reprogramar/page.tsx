"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { PanelShell } from "@/components/layout/panel-shell";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { EmptyState, ErrorState, SuccessState } from "@/components/ui/status";
import { api, ApiError } from "@/lib/api";
import { money, shortDate, todayInputValue } from "@/lib/format";
import type { ApiList, Appointment, Barber, Branch } from "@/types/domain";

type Slot = { barber_id: number; starts_at: string; ends_at: string };
type MissingService = { id: number; name: string };

export default function ReprogrammingPage() {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [branchId, setBranchId] = useState<number | "">("");
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [barbers, setBarbers] = useState<Barber[]>([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [ready, setReady] = useState(false);
  const { user } = useAuth();

  const loadBranches = useCallback(async () => {
    if (!user) return;
    setReady(false);
    const branchData = await api.get<ApiList<Branch>>("/public/branches");
    const pendingData = user.role === "admin"
      ? await api.get<ApiList<Appointment>>("/appointments/reprogramming")
      : null;
    const pendingBranchId = pendingData?.items.find((appointment) =>
      branchData.items.some((branch) => branch.id === appointment.branch_id),
    )?.branch_id;
    setBranches(branchData.items);
    setBranchId((current) => current || (user.role === "admin" ? pendingBranchId : user.branch_id) || user.branch_id || branchData.items[0]?.id || "");
    setReady(true);
  }, [user?.branch_id, user?.role]);

  const loadData = useCallback(async () => {
    if (!ready || !branchId) {
      setAppointments([]);
      setBarbers([]);
      return;
    }
    const query = { branch_id: branchId };
    const [appointmentData, barberData] = await Promise.all([
      api.get<ApiList<Appointment>>("/appointments/reprogramming", { query }),
      api.get<ApiList<Barber>>("/public/barbers", { query: { branch_id: branchId } }),
    ]);
    setAppointments(appointmentData.items);
    setBarbers(barberData.items);
  }, [branchId, ready]);

  useEffect(() => {
    loadBranches().catch((err) => setError(err instanceof Error ? err.message : "No se cargaron sucursales."));
  }, [loadBranches]);

  useEffect(() => {
    loadData().catch((err) => setError(err instanceof Error ? err.message : "No se cargaron turnos a reprogramar."));
  }, [loadData]);

  return (
    <ProtectedRoute roles={["recepcion", "admin"]}>
      <PanelShell title="Reprogramar" subtitle="Turnos sin fecha activa para reubicar, comentar o cancelar.">
        <div className="grid gap-5">
          {message ? <SuccessState message={message} /> : null}
          {error ? <ErrorState message={error} /> : null}
          <section className="rounded-lg border border-black/10 bg-white p-4 shadow-soft">
            <Field label="Sucursal">
              <Select disabled={user?.role === "recepcion"} value={branchId} onChange={(event) => setBranchId(Number(event.target.value))}>
                {branches.map((branch) => (
                  <option key={branch.id} value={branch.id}>{branch.name}</option>
                ))}
              </Select>
            </Field>
          </section>
          <section className="grid gap-3">
            {!appointments.length ? <EmptyState title="No hay turnos pendientes de reprogramacion." /> : null}
            {appointments.map((appointment) => (
              <ReprogrammingCard
                key={appointment.id}
                appointment={appointment}
                branches={branches}
                barbers={barbers}
                onDone={(doneMessage) => {
                  setMessage(doneMessage);
                  loadData();
                }}
              />
            ))}
          </section>
        </div>
      </PanelShell>
    </ProtectedRoute>
  );
}

function ReprogrammingCard({
  appointment,
  branches,
  barbers,
  onDone,
}: {
  appointment: Appointment;
  branches: Branch[];
  barbers: Barber[];
  onDone: (message: string) => void;
}) {
  const [date, setDate] = useState(todayInputValue());
  const [branchId, setBranchId] = useState<number | "">(appointment.branch_id);
  const [barberId, setBarberId] = useState<number | "">(appointment.barber_id);
  const [branchBarbers, setBranchBarbers] = useState<Barber[]>(barbers);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [slot, setSlot] = useState("");
  const [missingServices, setMissingServices] = useState<MissingService[]>([]);
  const [selectedMissingIds, setSelectedMissingIds] = useState<number[]>([]);
  const [importState, setImportState] = useState<"idle" | "importing" | "imported">("idle");
  const [importOpen, setImportOpen] = useState(false);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState<"idle" | "comment" | "reprogram" | "delete">("idle");
  const total = Number(appointment.total_final ?? appointment.total_estimated ?? 0);
  const extraIds = (appointment.extra_services ?? []).map((extra) => extra.service_id).filter(Boolean);

  useEffect(() => {
    if (!branchId) return;
    api.get<ApiList<Barber>>("/public/barbers", { query: { branch_id: branchId } })
      .then((data) => {
        setBranchBarbers(data.items);
        setBarberId((current) => data.items.some((barber) => barber.id === current) ? current : data.items[0]?.id || "");
      })
      .catch((err) => setError(err instanceof Error ? err.message : "No se cargaron barberos."));
  }, [branchId]);

  const loadSlots = useCallback(async () => {
    if (!branchId || !barberId || !date) {
      setSlots([]);
      setSlot("");
      return;
    }
    try {
      const data = await api.get<ApiList<Slot>>("/public/availability", {
        query: {
          branch_id: branchId,
          service_id: appointment.primary_service_id,
          extra_service_ids: extraIds.map(String),
          barber_id: barberId,
          date,
          exclude_appointment_id: appointment.id,
        },
      });
      setSlots(data.items);
      setMissingServices([]);
      setSelectedMissingIds([]);
      setImportState("idle");
      setImportOpen(false);
      setSlot((current) => data.items.some((item) => `${item.barber_id}-${item.starts_at}` === current) ? current : "");
    } catch (err) {
      setSlots([]);
      setSlot("");
      if (isMissingServiceError(err)) {
        setMissingServices(err.details.missing_services);
        setSelectedMissingIds(err.details.missing_services.map((service) => service.id));
        setImportOpen(false);
      }
      setError(err instanceof Error ? err.message : "No se cargaron horarios.");
    }
  }, [appointment.id, appointment.primary_service_id, branchId, barberId, date, extraIds.join(",")]);

  useEffect(() => {
    loadSlots();
  }, [loadSlots]);

  async function importMissingServices() {
    if (!branchId || !selectedMissingIds.length) return;
    setImportState("importing");
    setError("");
    try {
      await api.post("/admin/services/import-to-branch", {
        branch_id: branchId,
        service_ids: selectedMissingIds,
      });
      setImportState("imported");
      await loadSlots();
    } catch (err) {
      setImportState("idle");
      setError(err instanceof Error ? err.message : "No se pudieron importar servicios.");
    }
  }

  async function saveComment() {
    setSaving("comment");
    setError("");
    try {
      await api.patch<Appointment>(`/appointments/${appointment.id}`, {
        internal_notes: [appointment.internal_notes, notes ? `[Reprogramacion] ${notes}` : ""].filter(Boolean).join("\n"),
      });
      setNotes("");
      onDone("Comentario guardado.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar el comentario.");
      setSaving("idle");
    }
  }

  async function reprogram() {
    const selected = slots.find((item) => `${item.barber_id}-${item.starts_at}` === slot);
    if (!branchId || !barberId || !selected) return;
    setSaving("reprogram");
    setError("");
    try {
      await api.patch<Appointment>(`/appointments/${appointment.id}/reprogram`, {
        branch_id: branchId,
        barber_id: barberId,
        date: selected.starts_at.slice(0, 10),
        time: selected.starts_at.slice(11, 16),
        internal_notes: notes,
      });
      window.dispatchEvent(new Event("nub:reprogramming-updated"));
      onDone("Turno reprogramado.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo reprogramar el turno.");
      setSaving("idle");
    }
  }

  async function logicalDelete() {
    if (!window.confirm("Cancelar este turno pendiente de reprogramacion?")) return;
    setSaving("delete");
    setError("");
    try {
      await api.patch<Appointment>(`/appointments/${appointment.id}/cancel`, {
        cancellation_reason: "Baja logica desde A reprogramar",
      });
      window.dispatchEvent(new Event("nub:reprogramming-updated"));
      onDone("Turno cancelado logicamente.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cancelar el turno.");
      setSaving("idle");
    }
  }

  return (
    <article className="rounded-lg border border-black/10 bg-white p-4 shadow-soft">
      <div className="grid gap-4 xl:grid-cols-[1fr_360px]">
        <div>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-ink">{appointment.client?.full_name ?? `Cliente #${appointment.client_id}`}</h2>
              <p className="text-sm text-steel">
                Original: {shortDate(appointment.starts_at)} / Barbero #{appointment.barber_id}
              </p>
            </div>
            <p className="rounded-full bg-orange-100 px-3 py-1 text-xs font-bold text-orange-800">Reprogramar</p>
          </div>
          <div className="mt-4 grid gap-2 text-sm text-ink">
            <p><strong>Servicio:</strong> {serviceSummary(appointment)}</p>
            <p><strong>Total:</strong> {money(total)}</p>
            {appointment.client?.phone ? <p><strong>Telefono:</strong> {appointment.client.phone}</p> : null}
            {appointment.client?.email ? <p><strong>Email:</strong> {appointment.client.email}</p> : null}
            {appointment.internal_notes ? <p className="text-steel"><strong>Notas:</strong> {appointment.internal_notes}</p> : null}
          </div>
        </div>
        <div className="grid gap-3 rounded-md border border-black/10 p-3">
          {error ? <ErrorState message={error} /> : null}
          {missingServices.length ? (
            <Button type="button" variant="secondary" onClick={() => setImportOpen(true)}>
              Importar servicio/s
            </Button>
          ) : null}
          <Field label="Sucursal">
            <Select value={branchId} onChange={(event) => setBranchId(Number(event.target.value))}>
              {branches.map((branch) => (
                <option key={branch.id} value={branch.id}>{branch.name}</option>
              ))}
            </Select>
          </Field>
          <Field label="Nueva fecha">
            <Input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
          </Field>
          <Field label="Barbero">
            <Select value={barberId} onChange={(event) => setBarberId(Number(event.target.value))}>
              {branchBarbers.map((barber) => (
                <option key={barber.id} value={barber.id}>{barber.full_name}</option>
              ))}
            </Select>
          </Field>
          <Field label="Horario disponible">
            <Select value={slot} onChange={(event) => setSlot(event.target.value)}>
              <option value="">Seleccionar</option>
              {slots.map((item) => (
                <option key={`${item.barber_id}-${item.starts_at}`} value={`${item.barber_id}-${item.starts_at}`}>
                  {new Date(item.starts_at).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Comentario de reprogramacion">
            <Textarea value={notes} onChange={(event) => setNotes(event.target.value)} />
          </Field>
          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={reprogram} disabled={saving === "reprogram" || !slot}>
              {saving === "reprogram" ? "Reprogramando..." : "Reprogramar"}
            </Button>
            <Button type="button" variant="secondary" onClick={saveComment} disabled={saving === "comment" || !notes.trim()}>
              {saving === "comment" ? "Guardando..." : "Guardar comentario"}
            </Button>
            <Button type="button" variant="danger" onClick={logicalDelete} disabled={saving === "delete"}>
              {saving === "delete" ? "Cancelando..." : "Eliminar"}
            </Button>
          </div>
        </div>
      </div>
      {importOpen && missingServices.length ? (
        <ImportServicesModal
          services={missingServices}
          selectedIds={selectedMissingIds}
          state={importState}
          onToggle={(serviceId) =>
            setSelectedMissingIds((current) =>
              current.includes(serviceId) ? current.filter((id) => id !== serviceId) : [...current, serviceId],
            )
          }
          onImport={importMissingServices}
          onClose={() => setImportOpen(false)}
        />
      ) : null}
    </article>
  );
}

function isMissingServiceError(error: unknown): error is ApiError & { details: { code: string; missing_services: MissingService[] } } {
  if (!(error instanceof ApiError) || !error.details || typeof error.details !== "object") return false;
  const details = error.details as { code?: unknown; missing_services?: unknown };
  return details.code === "service_missing_in_branch" && Array.isArray(details.missing_services);
}

function ImportServicesModal({
  services,
  selectedIds,
  state,
  onToggle,
  onImport,
  onClose,
}: {
  services: MissingService[];
  selectedIds: number[];
  state: "idle" | "importing" | "imported";
  onToggle: (serviceId: number) => void;
  onImport: () => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4">
      <section className="w-full max-w-md rounded-lg bg-white p-5 shadow-soft">
        <h3 className="text-lg font-bold text-ink">Importar servicio/s</h3>
        <p className="mt-1 text-sm text-steel">Estos servicios no estan disponibles en la sucursal nueva.</p>
        <div className="mt-4 grid gap-2">
          {services.map((service) => (
            <label key={service.id} className="flex items-center gap-2 text-sm text-ink">
              <input type="checkbox" checked={selectedIds.includes(service.id)} onChange={() => onToggle(service.id)} />
              {service.name}
            </label>
          ))}
        </div>
        <div className="mt-5 flex flex-wrap gap-2">
          <Button type="button" onClick={onImport} disabled={!selectedIds.length || state === "importing" || state === "imported"}>
            {state === "importing" ? "Importando..." : state === "imported" ? "Conseguido" : "Importar"}
          </Button>
          <Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button>
        </div>
      </section>
    </div>
  );
}

function serviceSummary(appointment: Appointment) {
  return [
    appointment.primary_service?.name ?? `Servicio #${appointment.primary_service_id}`,
    ...(appointment.extra_services ?? []).map((extra) => extra.name ?? extra.service?.name ?? `Extra #${extra.service_id}`),
  ].join(" + ");
}
