"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { PanelShell } from "@/components/layout/panel-shell";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState } from "@/components/ui/status";
import { api } from "@/lib/api";
import { shortDate } from "@/lib/format";
import { useSocket } from "@/hooks/use-socket";
import type { ApiList, Appointment } from "@/types/domain";

export default function BarberoPage() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [error, setError] = useState("");

  const load = useCallback(() => {
    api
      .get<ApiList<Appointment>>("/barber/me/appointments")
      .then((data) => setAppointments(data.items))
      .catch((err) => setError(err instanceof Error ? err.message : "No se cargo la agenda."));
  }, []);

  useEffect(load, [load]);
  const socketEvents = useMemo(
    () => ({
      "appointment:created": load,
      "appointment:updated": load,
      "appointment:rescheduled": load,
      "appointment:cancelled": load,
      "appointment:completed": load,
    }),
    [load],
  );
  useSocket(socketEvents);

  const today = new Date().toISOString().slice(0, 10);
  const todayItems = appointments.filter((item) => item.starts_at.startsWith(today));

  async function complete(id: number) {
    await api.patch(`/appointments/${id}/complete`, {});
    load();
  }

  return (
    <ProtectedRoute roles={["barbero", "admin"]}>
      <PanelShell title="Panel barbero" subtitle="Agenda diaria y semanal actualizada en vivo.">
        <div className="grid gap-5">
          {error ? <ErrorState message={error} /> : null}
          <section className="rounded-lg border border-black/10 bg-white p-4 shadow-soft">
            <h2 className="text-lg font-bold text-ink">Agenda de hoy</h2>
            <AppointmentCards items={todayItems} onComplete={complete} />
          </section>
          <section className="rounded-lg border border-black/10 bg-white p-4 shadow-soft">
            <h2 className="text-lg font-bold text-ink">Agenda semanal</h2>
            <AppointmentCards items={appointments} onComplete={complete} />
          </section>
        </div>
      </PanelShell>
    </ProtectedRoute>
  );
}

function AppointmentCards({
  items,
  onComplete,
}: {
  items: Appointment[];
  onComplete: (id: number) => void;
}) {
  if (!items.length) {
    return <EmptyState title="Sin turnos asignados." />;
  }
  return (
    <div className="mt-4 grid gap-3 md:grid-cols-2">
      {items.map((item) => (
        <article key={item.id} className="rounded-md bg-smoke p-3 text-sm">
          <p className="font-bold text-ink">{shortDate(item.starts_at)}</p>
          <p className="text-steel">Estado: {item.status}</p>
          <p className="text-steel">Sucursal #{item.branch_id}</p>
          <p className="text-steel">Comentario: {item.customer_comment || "-"}</p>
          {item.status !== "completed" ? (
            <Button className="mt-3" type="button" variant="secondary" onClick={() => onComplete(item.id)}>
              Marcar atendido
            </Button>
          ) : null}
        </article>
      ))}
    </div>
  );
}
