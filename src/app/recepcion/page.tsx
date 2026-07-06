"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { useAuth } from "@/components/auth/auth-provider";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { PanelShell } from "@/components/layout/panel-shell";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { EmptyState, ErrorState, SuccessState } from "@/components/ui/status";
import { api, ApiError } from "@/lib/api";
import { formatMoneyInput, money, parseMoneyInput, shortDate, todayInputValue } from "@/lib/format";
import { useSocket } from "@/hooks/use-socket";
import type {
  ApiList,
  Appointment,
  Barber,
  BarberAvailability,
  Branch,
  BranchDateClosure,
  Client,
  Product,
  ScheduleBlock,
  Service,
} from "@/types/domain";

type Slot = { barber_id: number; starts_at: string; ends_at: string };
type MissingService = { id: number; name: string };
type BranchScheduleDay = { enabled?: boolean; from?: string; to?: string };
type BranchSchedule = Record<string, BranchScheduleDay>;
type QuickCreate = { date: string; time: string; barberId: number; forceUnavailable?: boolean };
const AGENDA_SLOT_HEIGHT = 64;
const WEEKDAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

function defaultDaySchedule(date: string): BranchScheduleDay {
  const isSunday = new Date(`${date}T00:00:00`).getDay() === 0;
  return { enabled: !isSunday, from: "09:00", to: "20:00" };
}

export default function RecepcionPage() {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [branchId, setBranchId] = useState<number | "">("");
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [barbers, setBarbers] = useState<Barber[]>([]);
  const [dateClosures, setDateClosures] = useState<BranchDateClosure[]>([]);
  const [scheduleBlocks, setScheduleBlocks] = useState<ScheduleBlock[]>([]);
  const [barberAvailabilities, setBarberAvailabilities] = useState<BarberAvailability[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [selectedDate, setSelectedDate] = useState(localDateInputValue());
  const [quickCreate, setQuickCreate] = useState<QuickCreate | null>(null);
  const [dateClosureOpen, setDateClosureOpen] = useState(false);
  const { user } = useAuth();

  const loadBranches = useCallback(async () => {
    const data = await api.get<ApiList<Branch>>("/public/branches");
    setBranches(data.items);
    setBranchId((current) => current || user?.branch_id || data.items[0]?.id || "");
  }, [user?.branch_id]);

  const loadOperationalData = useCallback(async () => {
    if (!branchId) return;
    const [appointmentData, serviceData, barberData, productData, closureData, blockData, availabilityData] = await Promise.all([
      api.get<ApiList<Appointment>>("/appointments", { query: { branch_id: branchId } }),
      api.get<ApiList<Service>>("/public/services", { query: { branch_id: branchId } }),
      api.get<ApiList<Barber>>("/public/barbers", { query: { branch_id: branchId } }),
      api.get<ApiList<Product>>("/admin/products", { query: { branch_id: branchId } }),
      api.get<ApiList<BranchDateClosure>>("/appointments/date-closures", { query: { branch_id: branchId } }),
      api.get<ApiList<ScheduleBlock>>("/admin/schedule-blocks", { query: { branch_id: branchId } }),
      api.get<ApiList<BarberAvailability>>("/admin/barber-availabilities", { query: { branch_id: branchId } }),
    ]);
    setAppointments(appointmentData.items);
    setServices(serviceData.items);
    setBarbers(barberData.items);
    setProducts(productData.items);
    setDateClosures(closureData.items);
    setScheduleBlocks(blockData.items);
    setBarberAvailabilities(availabilityData.items);
  }, [branchId]);

  useEffect(() => {
    loadBranches().catch((err) => setError(err instanceof Error ? err.message : "No se cargaron sucursales."));
  }, [loadBranches]);

  useEffect(() => {
    loadOperationalData().catch((err) => setError(err instanceof Error ? err.message : "No se cargo recepcion."));
  }, [loadOperationalData]);

  const socketEvents = useMemo(
    () => ({
      "appointment:created": loadOperationalData,
      "appointment:updated": loadOperationalData,
      "appointment:rescheduled": loadOperationalData,
      "appointment:cancelled": loadOperationalData,
      "appointment:completed": loadOperationalData,
      "sale:created": loadOperationalData,
      "sale:paid": loadOperationalData,
      "stock:updated": loadOperationalData,
    }),
    [loadOperationalData],
  );
  useSocket(socketEvents, Boolean(branchId));
  const selectedBranch = branches.find((branch) => branch.id === branchId) ?? null;

  async function searchClients(q: string) {
    if (!q.trim()) {
      setClients([]);
      return;
    }
    const data = await api.get<ApiList<Client>>("/clients/search", { query: { q } });
    setClients(data.items);
  }

  return (
    <ProtectedRoute roles={["recepcion", "admin"]}>
      <PanelShell
        title="Panel recepcion"
        subtitle="Agenda, clientes, turnos y cobros rapidos."
        headerAccessory={
          <Field label="Sucursal">
            <Select disabled={user?.role === "recepcion"} value={branchId} onChange={(event) => setBranchId(Number(event.target.value))}>
              {branches.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.name}
                </option>
              ))}
            </Select>
          </Field>
        }
      >
        <div className="grid gap-5">
          {error ? <ErrorState message={error} onDismiss={() => setError("")} /> : null}
          {success ? <SuccessState message={success} onDismiss={() => setSuccess("")} /> : null}

          <section className="rounded-lg border border-black/10 bg-white p-4 shadow-soft">
            <div className="flex flex-wrap items-end gap-2">
              <Button type="button" variant="secondary" onClick={() => setSelectedDate(addDays(selectedDate, -1))}>Anterior</Button>
              {[-2, -1].map((offset) => (
                <DatePill key={offset} date={addDays(selectedDate, offset)} appointments={appointments} barbers={barbers} branch={selectedBranch} closures={dateClosures} onClick={setSelectedDate} />
              ))}
              <Field label="Fecha seleccionada">
                <Input type="date" value={selectedDate} onChange={(event) => setSelectedDate(event.target.value)} />
                <span className={`text-xs font-bold ${isDateClosed(selectedDate, dateClosures) ? "text-clay" : "text-green-700"}`}>
                  {isDateClosed(selectedDate, dateClosures)
                    ? "Fecha dada de baja"
                    : !branchTimeRange(selectedBranch, selectedDate)
                      ? "No disponible"
                      : `${countAvailableHalfHours(selectedDate, appointments, barbers, selectedBranch)} turnos libres`}
                </span>
              </Field>
              {[1, 2].map((offset) => (
                <DatePill key={offset} date={addDays(selectedDate, offset)} appointments={appointments} barbers={barbers} branch={selectedBranch} closures={dateClosures} onClick={setSelectedDate} />
              ))}
              <Button type="button" variant="secondary" onClick={() => setSelectedDate(addDays(selectedDate, 1))}>Siguiente</Button>
            </div>
          </section>

          <section className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1fr)_204px]">
            <Agenda
              appointments={appointments}
              barbers={barbers}
              branches={branches}
              scheduleBlocks={scheduleBlocks}
              barberAvailabilities={barberAvailabilities}
              services={services}
              products={products}
              branch={selectedBranch}
              branchId={branchId}
              selectedDate={selectedDate}
              dateClosure={findDateClosure(selectedDate, dateClosures)}
              reload={loadOperationalData}
              onDone={setSuccess}
              onToggleDateClosure={() => setDateClosureOpen(true)}
              onQuickCreate={(date, time, barberId, forceUnavailable) => {
                setSelectedDate(date);
                setQuickCreate({ date, time, barberId, forceUnavailable });
              }}
            />
            <QuickAppointment
              branchId={branchId}
              services={services}
              barbers={barbers}
              quickCreate={null}
              onDone={(message) => {
                setSuccess(message);
                loadOperationalData();
              }}
            />
          </section>

          {quickCreate ? (
            <QuickAppointmentModal
              branchId={branchId}
              services={services}
              barbers={barbers}
              quickCreate={quickCreate}
              onClose={() => setQuickCreate(null)}
              onDone={(message) => {
                setSuccess(message);
                setQuickCreate(null);
                loadOperationalData();
              }}
            />
          ) : null}

          {dateClosureOpen ? (
            <DateClosureModal
              date={selectedDate}
              appointments={appointments}
              barbers={barbers}
              closure={findDateClosure(selectedDate, dateClosures)}
              branchId={branchId}
              onClose={() => setDateClosureOpen(false)}
              onDone={(message) => {
                setSuccess(message);
                setDateClosureOpen(false);
                loadOperationalData();
              }}
            />
          ) : null}

        </div>
      </PanelShell>
    </ProtectedRoute>
  );
}

function addDays(value: string, days: number) {
  const date = new Date(`${value}T00:00:00`);
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function sameDay(value: string, date: string) {
  return value.slice(0, 10) === date;
}

function branchDaySchedule(branch: Branch | null, date: string): BranchScheduleDay {
  if (!branch?.opening_hours) return defaultDaySchedule(date);
  try {
    const parsed = JSON.parse(branch.opening_hours) as BranchSchedule;
    const day = parsed[WEEKDAY_KEYS[new Date(`${date}T00:00:00`).getDay()]];
    if (!day) return defaultDaySchedule(date);
    return {
      enabled: day.enabled !== false,
      from: day.from || "09:00",
      to: day.to || "20:00",
    };
  } catch {
    return defaultDaySchedule(date);
  }
}

function timeFromMinutes(total: number) {
  const hour = Math.floor(total / 60);
  const minute = total % 60;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function localDateInputValue(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function currentQuarterSlot(date = new Date()) {
  const minutes = date.getHours() * 60 + date.getMinutes();
  return timeFromMinutes(Math.floor(minutes / 15) * 15);
}

function branchTimeRange(branch: Branch | null, date: string) {
  const schedule = branchDaySchedule(branch, date);
  if (!schedule.enabled) return null;
  const start = minutesFromTime(schedule.from || "09:00");
  const end = minutesFromTime(schedule.to || "20:00");
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return null;
  return {
    start: Math.ceil(start / 15) * 15,
    end: Math.floor(end / 15) * 15,
  };
}

function timeSlots(branch: Branch | null, date: string) {
  const range = branchTimeRange(branch, date);
  if (!range) return [];
  const slots: string[] = [];
  for (let minute = range.start; minute < range.end; minute += 15) {
    slots.push(timeFromMinutes(minute));
  }
  return slots;
}

function halfHourSlots(branch: Branch | null, date: string) {
  const range = branchTimeRange(branch, date);
  if (!range) return [];
  const slots: string[] = [];
  for (let minute = range.start; minute + 30 <= range.end; minute += 30) {
    slots.push(timeFromMinutes(minute));
  }
  return slots;
}

function minutesBetween(startsAt: string, endsAt: string) {
  return Math.max(15, Math.round((new Date(endsAt).getTime() - new Date(startsAt).getTime()) / 60000));
}

function isVisibleOnAgenda(appointment: Appointment) {
  return appointment.status !== "cancelled" && appointment.status !== "pending_reschedule";
}

function canSendToReprogramming(appointment: Appointment) {
  return ["pending", "confirmed", "checked_in", "rescheduled"].includes(appointment.status);
}

function blockOverlapsSlot(block: ScheduleBlock, date: string, time: string, barberId: number) {
  if (block.barber_id && block.barber_id !== barberId) return false;
  const startsAt = new Date(`${date}T${time}:00`);
  const endsAt = new Date(startsAt.getTime() + 15 * 60000);
  return new Date(block.starts_at) < endsAt && new Date(block.ends_at) > startsAt;
}

function blockDurationSlots(block: ScheduleBlock) {
  return Math.max(1, minutesBetween(block.starts_at, block.ends_at) / 15);
}

function isSoftUnavailableSlot(
  availabilities: BarberAvailability[],
  branchId: number | "",
  barberId: number,
  date: string,
  time: string,
) {
  if (!branchId) return false;
  const weekday = new Date(`${date}T00:00:00`).getDay();
  const rows = availabilities.filter(
    (item) =>
      item.is_active &&
      item.branch_id === branchId &&
      item.barber_id === barberId &&
      item.weekday === weekday,
  );
  if (!rows.length) return false;
  const slotStart = minutesFromTime(time);
  const slotEnd = slotStart + 15;
  return !rows.some((row) => minutesFromTime(row.start_time) <= slotStart && minutesFromTime(row.end_time) >= slotEnd);
}

function confirmSoftUnavailableAction() {
  return window.confirm(
    "Este horario esta fuera del horario reducido habitual del barbero. Queres sobreescribirlo igualmente?",
  );
}

function findDateClosure(date: string, closures: BranchDateClosure[]) {
  return closures.find((closure) => closure.date === date && closure.is_active) ?? null;
}

function isDateClosed(date: string, closures: BranchDateClosure[]) {
  return Boolean(findDateClosure(date, closures));
}

function countAvailableHalfHours(date: string, appointments: Appointment[], barbers: Barber[], branch: Branch | null, barberId?: number) {
  const targetBarbers = barberId ? barbers.filter((barber) => barber.id === barberId) : barbers;
  return targetBarbers.reduce((total, barber) => {
    const freeBlocks = halfHourSlots(branch, date).filter((time) => {
      const startsAt = new Date(`${date}T${time}:00`);
      const endsAt = new Date(startsAt.getTime() + 30 * 60000);
      return !appointments.some((appointment) => {
        if (!isVisibleOnAgenda(appointment) || appointment.barber_id !== barber.id) return false;
        return new Date(appointment.starts_at) < endsAt && new Date(appointment.ends_at) > startsAt;
      });
    });
    return total + freeBlocks.length;
  }, 0);
}

function appointmentCardHeight(appointment: Appointment) {
  return Math.max(52, (minutesBetween(appointment.starts_at, appointment.ends_at) / 15) * AGENDA_SLOT_HEIGHT - 8);
}

function addMinutesToTime(time: string, minutes: number) {
  const [rawHour, rawMinute] = time.split(":").map(Number);
  const total = rawHour * 60 + rawMinute + minutes;
  const hour = Math.floor(total / 60);
  const minute = total % 60;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function minutesFromTime(time: string) {
  const [hour, minute] = time.split(":").map(Number);
  return hour * 60 + minute;
}

function floorTimeToQuarter(time: string) {
  const minutes = minutesFromTime(time);
  const floored = Math.floor(minutes / 15) * 15;
  const hour = Math.floor(floored / 60);
  const minute = floored % 60;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function appointmentTopOffset(appointment: Appointment) {
  const time = appointment.starts_at.slice(11, 16);
  const extraMinutes = minutesFromTime(time) - minutesFromTime(floorTimeToQuarter(time));
  return 4 + (extraMinutes / 15) * AGENDA_SLOT_HEIGHT;
}

function timeFromCardDrop(event: React.DragEvent<HTMLElement>, appointment: Appointment) {
  const rect = event.currentTarget.getBoundingClientRect();
  const y = Math.max(0, event.clientY - rect.top);
  const startTime = appointment.starts_at.slice(11, 16);
  const quarterStart = floorTimeToQuarter(startTime);
  const extraMinutes = minutesFromTime(startTime) - minutesFromTime(quarterStart);
  const slotOffset = Math.floor((extraMinutes + (y / AGENDA_SLOT_HEIGHT) * 15) / 15);
  return addMinutesToTime(quarterStart, slotOffset * 15);
}

function appointmentOffset(appointment: Appointment, all: Appointment[]) {
  const peers = all
    .filter(
      (item) =>
        item.id !== appointment.id &&
        item.barber_id === appointment.barber_id &&
        item.starts_at < appointment.ends_at &&
        item.ends_at > appointment.starts_at,
    )
    .sort((a, b) => a.id - b.id);
  const group = [...peers, appointment].sort((a, b) => a.id - b.id);
  return group.findIndex((item) => item.id === appointment.id) * 18;
}

function appointmentClientName(appointment: Appointment) {
  return appointment.client?.full_name || `Cliente #${appointment.client_id}`;
}

function appointmentServiceSummary(appointment: Appointment) {
  const names = [
    appointment.primary_service?.name ?? `Servicio #${appointment.primary_service_id}`,
    ...(appointment.extra_services ?? []).map((extra) => extra.name ?? extra.service?.name ?? `Extra #${extra.service_id}`),
  ];
  return names.join(" + ");
}

function ClientAvatar({ appointment }: { appointment: Appointment }) {
  const imageUrl = appointment.client?.profile_image_url;
  const initials = appointmentClientName(appointment)
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return (
    <span className="pointer-events-none absolute right-1.5 top-1.5 grid h-11 w-11 place-items-center overflow-hidden rounded-full border border-white/80 bg-white text-[11px] font-black text-ink shadow-sm">
      {imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img alt="" className="h-full w-full object-cover" referrerPolicy="no-referrer" src={imageUrl} />
      ) : (
        <span>{initials || "CL"}</span>
      )}
    </span>
  );
}

function isPrimaryService(service: Service) {
  return service.service_type === "main" || service.service_type === "both";
}

function isExtraService(service: Service) {
  return service.service_type === "extra" || service.service_type === "both";
}

function DatePill({
  date,
  appointments,
  barbers,
  branch,
  closures,
  onClick,
}: {
  date: string;
  appointments: Appointment[];
  barbers: Barber[];
  branch: Branch | null;
  closures: BranchDateClosure[];
  onClick: (date: string) => void;
}) {
  const closure = findDateClosure(date, closures);
  const remaining = countAvailableHalfHours(date, appointments, barbers, branch);
  const availableDay = Boolean(branchTimeRange(branch, date));
  return (
    <button
      type="button"
      onClick={() => onClick(date)}
      title={closure?.reason || (closure ? "Fecha dada de baja" : undefined)}
      className={`rounded-md border px-3 py-2 text-left text-xs hover:border-brass ${
        closure ? "border-black/30 bg-ink text-white" : "border-black/10 bg-smoke text-ink"
      }`}
    >
      <span className="block font-bold">{new Date(`${date}T00:00:00`).toLocaleDateString("es-AR", { day: "2-digit", month: "short" })}</span>
      {closure ? (
        <span className="text-white/80">Bloqueada</span>
      ) : !availableDay ? (
        <span className="text-clay">No disponible</span>
      ) : (
        <span className={remaining ? "text-green-700" : "text-clay"}>{remaining ? `${remaining} turnos libres` : "Lleno"}</span>
      )}
    </button>
  );
}

function StatusBadge({ status }: { status: Appointment["status"] }) {
  const config = {
    checked_in: "bg-green-100 text-green-800",
    completed: "bg-blue-100 text-blue-800",
    no_show: "bg-red-100 text-red-800",
    cancelled: "bg-neutral-200 text-neutral-700",
    pending: "bg-amber-100 text-amber-800",
    confirmed: "bg-green-100 text-green-800",
    rescheduled: "bg-violet-100 text-violet-800",
    pending_reschedule: "bg-orange-100 text-orange-800",
  }[status];
  const label = {
    checked_in: "✓ Se presentó",
    completed: "Completo",
    no_show: "No show",
    cancelled: "Cancelado",
    pending: "Pendiente",
    confirmed: "Confirmado",
    rescheduled: "Reprogramado",
    pending_reschedule: "A reprogramar",
  }[status];
  return <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${config}`}>{label}</span>;
}

function PaymentBadge({ appointment }: { appointment: Appointment }) {
  const total = Number(appointment.total_final ?? appointment.total_estimated ?? appointment.sale?.total ?? 0);
  const paid = Number(appointment.paid_total ?? 0);
  const tip = Number(appointment.tip_amount ?? Math.max(0, paid - total));
  if (tip > 0) return <span className="rounded-full bg-brass/20 px-2 py-0.5 text-[11px] font-bold text-ink">Pago + tip</span>;
  if (paid >= total && total > 0) return <span className="rounded-full bg-green-100 px-2 py-0.5 text-[11px] font-bold text-green-800">Pago</span>;
  const status = appointment.payment_status;
  if (status === "paid") return <span className="rounded-full bg-green-100 px-2 py-0.5 text-[11px] font-bold text-green-800">✓ Pago</span>;
  if (status === "partially_paid") return <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-800">Pago parcial</span>;
  return <span className="rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-bold text-red-800">Falta pagar</span>;
}

function Agenda({
  appointments,
  barbers,
  branches,
  scheduleBlocks,
  barberAvailabilities,
  services,
  products,
  branch,
  branchId,
  selectedDate,
  dateClosure,
  reload,
  onDone,
  onToggleDateClosure,
  onQuickCreate,
}: {
  appointments: Appointment[];
  barbers: Barber[];
  branches: Branch[];
  scheduleBlocks: ScheduleBlock[];
  barberAvailabilities: BarberAvailability[];
  services: Service[];
  products: Product[];
  branch: Branch | null;
  branchId: number | "";
  selectedDate: string;
  dateClosure: BranchDateClosure | null;
  reload: () => void;
  onDone: (message: string) => void;
  onToggleDateClosure: () => void;
  onQuickCreate: (date: string, time: string, barberId: number, forceUnavailable?: boolean) => void;
}) {
  const [selected, setSelected] = useState<Appointment | null>(null);
  const [now, setNow] = useState(() => new Date());
  const agendaGridRef = useRef<HTMLDivElement | null>(null);
  const dayAppointments = appointments.filter((item) => isVisibleOnAgenda(item) && sameDay(item.starts_at, selectedDate));
  const dayBlocks = scheduleBlocks.filter((block) => sameDay(block.starts_at, selectedDate));
  const selectedDateLabel = new Date(`${selectedDate}T00:00:00`).toLocaleDateString("es-AR");
  const visibleTimeSlots = timeSlots(branch, selectedDate);
  const currentSlot = currentQuarterSlot(now);
  const currentSlotVisible = selectedDate === localDateInputValue(now) && visibleTimeSlots.includes(currentSlot);

  useEffect(() => {
    const interval = window.setInterval(() => setNow(new Date()), 30000);
    return () => window.clearInterval(interval);
  }, []);

  function scrollToCurrentSlot() {
    if (!currentSlotVisible) return;
    agendaGridRef.current
      ?.querySelector(`[data-time-slot="${currentSlot}"]`)
      ?.scrollIntoView({ behavior: "smooth", block: "start", inline: "nearest" });
  }

  async function cancel(id: number) {
    if (!window.confirm("Cancelar este turno?")) return;
    await api.patch(`/appointments/${id}/cancel`, { cancellation_reason: "Cancelado por recepcion" });
    reload();
  }

  async function move(appointmentId: number, barberId: number, time: string, forceUnavailable = false) {
    if (!appointmentId) return;
    if (!branchId) return;
    try {
      await api.patch(`/appointments/${appointmentId}/reschedule`, {
        branch_id: branchId,
        barber_id: barberId,
        date: selectedDate,
        time,
        force_overlap: true,
        force_unavailable: forceUnavailable,
      });
      onDone("Turno movido.");
      reload();
    } catch (err) {
      onDone(err instanceof Error ? err.message : "No se pudo mover el turno.");
    }
  }

  function dragAppointment(event: React.DragEvent, appointmentId: number) {
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("appointment/id", String(appointmentId));
    event.dataTransfer.setData("text/plain", String(appointmentId));
  }

  function dropAppointment(event: React.DragEvent, barberId: number, time: string) {
    event.preventDefault();
    event.stopPropagation();
    const softUnavailable = isSoftUnavailableSlot(barberAvailabilities, branchId, barberId, selectedDate, time);
    if (softUnavailable && !confirmSoftUnavailableAction()) return;
    const rawId = event.dataTransfer.getData("appointment/id") || event.dataTransfer.getData("text/plain");
    void move(Number(rawId), barberId, time, softUnavailable);
  }

  function dropAppointmentOnCard(event: React.DragEvent<HTMLElement>, barberId: number, targetAppointment: Appointment) {
    const time = timeFromCardDrop(event, targetAppointment);
    if (dayBlocks.some((block) => blockOverlapsSlot(block, selectedDate, time, barberId))) {
      event.preventDefault();
      event.stopPropagation();
      onDone("Ese bloque esta bloqueado para el barbero.");
      return;
    }
    dropAppointment(event, barberId, time);
  }

  return (
    <section className="rounded-lg border border-black/10 bg-white p-4 shadow-soft">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            aria-label={dateClosure ? "Habilitar esta fecha" : "Dar de baja esta fecha"}
            title={dateClosure ? "Habilitar esta fecha" : "Dar de baja esta fecha"}
            className={`grid h-10 w-10 place-items-center rounded-md border ${
              dateClosure
                ? "border-green-700/25 bg-green-100 text-green-800 hover:bg-green-700 hover:text-white"
                : "border-clay/25 bg-clay/10 text-clay hover:bg-clay hover:text-white"
            }`}
            onClick={onToggleDateClosure}
          >
            <AlertTriangle className="h-4 w-4" />
          </button>
          <div>
            <h2 className="text-lg font-bold text-ink">Turnos del dia {selectedDateLabel}</h2>
            {dateClosure ? (
              <p className="text-sm font-semibold text-clay">
                Fecha bloqueada: {dateClosure.reason || "dada de baja desde recepcion."}
              </p>
            ) : null}
          </div>
        </div>
        <Button
          disabled={!currentSlotVisible}
          type="button"
          variant="secondary"
          onClick={scrollToCurrentSlot}
          title={currentSlotVisible ? `Ir al horario actual: ${currentSlot}` : "El horario actual no esta visible para esta fecha"}
        >
          Ahora
        </Button>
      </div>
      {!barbers.length ? <EmptyState title="Sin barberos para esta sucursal." /> : null}
      <div className="mt-4 max-w-full overflow-x-auto">
        <div ref={agendaGridRef} className="grid min-w-[640px]" style={{ gridTemplateColumns: `74px repeat(${Math.max(barbers.length, 1)}, minmax(150px, 1fr))` }}>
          <div className="sticky left-0 z-10 bg-white p-2 text-xs font-bold uppercase text-steel">Hora</div>
          {barbers.map((barber) => (
            <div key={barber.id} className="border-l border-black/10 p-2 text-sm text-ink">
              <span className="block font-bold">{barber.full_name}</span>
              <span className="mt-1 block text-xs font-semibold text-green-700">
                {countAvailableHalfHours(selectedDate, appointments, barbers, branch, barber.id)} turnos libres
              </span>
            </div>
          ))}
          {!visibleTimeSlots.length ? (
            <div className="col-span-full border-t border-black/10 p-4">
              <EmptyState title="La sucursal no tiene horarios habilitados para este dia." />
            </div>
          ) : null}
          {visibleTimeSlots.map((time) => (
            <div key={time} className="contents">
              <div
                data-time-slot={time}
                className={`sticky left-0 z-10 border-t border-black/10 p-2 text-xs ${
                  currentSlotVisible && time === currentSlot ? "bg-brass/20 font-bold text-ink" : "bg-white text-steel"
                }`}
              >
                {time}
              </div>
              {barbers.map((barber) => {
                const slotAppointments = dayAppointments.filter((item) => item.barber_id === barber.id && floorTimeToQuarter(item.starts_at.slice(11, 16)) === time);
                const slotBlocks = dayBlocks.filter((block) => blockOverlapsSlot(block, selectedDate, time, barber.id));
                const blocked = Boolean(slotBlocks.length);
                const softUnavailable = isSoftUnavailableSlot(barberAvailabilities, branchId, barber.id, selectedDate, time);
                const isCurrentSlot = currentSlotVisible && time === currentSlot;
                return (
                  <div
                    key={`${barber.id}-${time}`}
                    className={`group relative min-h-16 border-l border-t border-black/10 p-1 ${
                      blocked ? "bg-red-950/10" : isCurrentSlot ? "bg-brass/10 ring-1 ring-inset ring-brass/30" : ""
                    }`}
                    style={
                      !blocked && softUnavailable
                        ? {
                            backgroundColor: "rgba(148, 163, 184, 0.12)",
                            backgroundImage:
                              "repeating-linear-gradient(135deg, rgba(100,116,139,0.16) 0, rgba(100,116,139,0.16) 6px, transparent 6px, transparent 14px)",
                          }
                        : undefined
                    }
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={(event) => {
                      if (blocked) {
                        event.preventDefault();
                        onDone("Ese bloque esta bloqueado para el barbero.");
                        return;
                      }
                      dropAppointment(event, barber.id, time);
                    }}
                  >
                    {slotBlocks.map((block) => (
                      <div
                        key={block.id}
                        className="pointer-events-none absolute inset-x-1 top-1 z-10 rounded-md border border-red-800/30 bg-red-900/20 p-1 text-[11px] font-bold text-red-900"
                        style={{ minHeight: blockDurationSlots(block) * AGENDA_SLOT_HEIGHT - 8 }}
                        title={block.reason || "Bloqueo de agenda"}
                      >
                        Bloqueado{block.reason ? `: ${block.reason}` : ""}
                      </div>
                    ))}
                    <button
                      type="button"
                      className="absolute right-1 top-1 z-10 hidden h-6 w-6 rounded-full bg-brass text-xs font-bold text-white disabled:bg-steel group-hover:block"
                      disabled={Boolean(dateClosure) || blocked}
                      onClick={() => {
                        if (softUnavailable && !confirmSoftUnavailableAction()) return;
                        onQuickCreate(selectedDate, time, barber.id, softUnavailable);
                      }}
                      title={
                        dateClosure
                          ? "No se pueden crear turnos en una fecha dada de baja."
                          : blocked
                            ? "Bloqueo real de agenda."
                            : softUnavailable
                              ? "Fuera del horario habitual reducido. Requiere confirmacion."
                              : "Crear turno en este bloque"
                      }
                    >
                      +
                    </button>
                    {slotAppointments.map((slotAppointment) => (
                      <button
                        key={slotAppointment.id}
                        type="button"
                        draggable
                        onDragStart={(event) => dragAppointment(event, slotAppointment.id)}
                        onDragOver={(event) => event.preventDefault()}
                        onDrop={(event) => dropAppointmentOnCard(event, barber.id, slotAppointment)}
                        onClick={() => setSelected(slotAppointment)}
                        className="absolute left-1 z-20 cursor-grab select-none rounded-md bg-brass/15 p-2 pr-12 text-left text-xs text-ink shadow-sm ring-1 ring-brass/30 active:cursor-grabbing"
                        style={{
                          top: appointmentTopOffset(slotAppointment),
                          width: `calc(100% - ${appointmentOffset(slotAppointment, dayAppointments) + 8}px)`,
                          transform: `translateX(${appointmentOffset(slotAppointment, dayAppointments)}px)`,
                          height: appointmentCardHeight(slotAppointment),
                        }}
                      >
                        <ClientAvatar appointment={slotAppointment} />
                        <span className="block truncate font-bold">{appointmentClientName(slotAppointment)}</span>
                        <span className="mt-0.5 line-clamp-2 block leading-snug">{appointmentServiceSummary(slotAppointment)}</span>
                        <span className="mt-1 flex flex-wrap gap-1"><StatusBadge status={slotAppointment.status} /><PaymentBadge appointment={slotAppointment} /></span>
                      </button>
                    ))}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
      {selected ? (
        <AppointmentModal
          appointment={selected}
          branches={branches}
          services={services}
          products={products}
          barbers={barbers}
          onClose={() => setSelected(null)}
          onCancel={async () => {
            await cancel(selected.id);
            setSelected(null);
          }}
          onDone={(message) => {
            onDone(message);
            reload();
          }}
        />
      ) : null}
    </section>
  );
}

function DateClosureModal({
  date,
  appointments,
  barbers,
  closure,
  branchId,
  onClose,
  onDone,
}: {
  date: string;
  appointments: Appointment[];
  barbers: Barber[];
  closure: BranchDateClosure | null;
  branchId: number | "";
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  const [selectedBarberIds, setSelectedBarberIds] = useState<number[]>(barbers.map((barber) => barber.id));
  const [restorePending, setRestorePending] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const impacted = appointments.filter(
    (appointment) =>
      sameDay(appointment.starts_at, date) &&
      (closure ? appointment.status === "pending_reschedule" : canSendToReprogramming(appointment)) &&
      selectedBarberIds.includes(appointment.barber_id),
  );

  function toggleBarber(barberId: number) {
    setSelectedBarberIds((current) =>
      current.includes(barberId) ? current.filter((item) => item !== barberId) : [...current, barberId],
    );
  }

  async function submit() {
    if (!branchId) return;
    setSubmitting(true);
    setError("");
    try {
      if (closure) {
        const result = await api.patch<{ restored_count: number }>("/appointments/date-closures/reopen", {
          branch_id: branchId,
          date,
          restore_pending: restorePending,
        });
        window.dispatchEvent(new Event("nub:reprogramming-updated"));
        onDone(
          restorePending
            ? `Fecha habilitada. ${result.restored_count} turnos volvieron a la agenda.`
            : "Fecha habilitada.",
        );
        return;
      }
      const result = await api.post<{ count: number }>("/appointments/reprogram-date", {
        branch_id: branchId,
        date,
        barber_ids: selectedBarberIds,
      });
      window.dispatchEvent(new Event("nub:reprogramming-updated"));
      onDone(`${result.count} turnos enviados a reprogramacion.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo dar de baja la fecha.");
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4">
      <section className="w-full max-w-2xl rounded-lg bg-white p-5 shadow-soft">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-xl font-bold text-ink">{closure ? "Habilitar esta fecha" : "Dar de baja esta fecha"}</h3>
            <p className="mt-1 text-sm text-steel">
              {closure
                ? "La fecha vuelve a quedar disponible para nuevos turnos. Tambien podes traer de vuelta a la agenda los turnos que aun no fueron reprogramados."
                : "Los turnos asociados a los barberos seleccionados van a pasar a A reprogramar. Se conserva cliente, servicios, precio, barbero original, fecha y notas para estadisticas."}
            </p>
          </div>
          <Button type="button" variant="secondary" onClick={onClose}>Cerrar</Button>
        </div>
        <div className="mt-4 grid gap-4">
          {error ? <ErrorState message={error} /> : null}
          <div className="rounded-md border border-black/10 p-3">
            <p className="text-sm font-bold text-ink">Fecha: {new Date(`${date}T00:00:00`).toLocaleDateString("es-AR")}</p>
            <p className="mt-1 text-sm text-steel">
              {closure
                ? `${impacted.length} turnos todavia pueden volver desde A reprogramar.`
                : `${impacted.length} turnos van a quedar pendientes de reprogramacion.`}
            </p>
          </div>
          {closure ? (
            <label className="flex items-start gap-2 rounded-md border border-black/10 p-3 text-sm text-ink">
              <input
                className="mt-1"
                type="checkbox"
                checked={restorePending}
                onChange={(event) => setRestorePending(event.target.checked)}
              />
              Traer de vuelta los turnos que todavia no fueron reprogramados.
            </label>
          ) : (
          <div className="rounded-md border border-black/10 p-3">
            <p className="mb-2 text-sm font-bold text-ink">Barberos incluidos</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {barbers.map((barber) => (
                <label key={barber.id} className="flex items-center gap-2 text-sm text-ink">
                  <input
                    type="checkbox"
                    checked={selectedBarberIds.includes(barber.id)}
                    onChange={() => toggleBarber(barber.id)}
                  />
                  {barber.full_name}
                </label>
              ))}
            </div>
          </div>
          )}
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant={closure ? "primary" : "danger"} disabled={submitting || (!closure && !selectedBarberIds.length)} onClick={submit}>
              {submitting ? "Procesando..." : closure ? "Habilitar fecha" : "Confirmar baja de fecha"}
            </Button>
            <Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button>
          </div>
        </div>
      </section>
    </div>
  );
}

function AppointmentModal({
  appointment,
  branches,
  services,
  products,
  barbers,
  onClose,
  onCancel,
  onDone,
}: {
  appointment: Appointment;
  branches: Branch[];
  services: Service[];
  products: Product[];
  barbers: Barber[];
  onClose: () => void;
  onCancel: () => void;
  onDone: (message: string) => void;
}) {
  const [current, setCurrent] = useState(appointment);
  const [saleItems, setSaleItems] = useState<{ item_type: "service" | "product"; item_id: string; quantity: number }[]>([]);
  const [payments, setPayments] = useState([{ method: "efectivo", amount: "" }]);
  const [notes, setNotes] = useState(appointment.internal_notes ?? "");
  const [error, setError] = useState("");
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle");
  const [chargeState, setChargeState] = useState<"idle" | "charging" | "charged">("idle");
  const [showReschedule, setShowReschedule] = useState(false);
  const [rescheduleState, setRescheduleState] = useState<"idle" | "saving" | "later">("idle");
  const [rescheduleForm, setRescheduleForm] = useState({
    branch_id: appointment.branch_id,
    date: appointment.starts_at.slice(0, 10),
    barber_id: appointment.barber_id,
    slot: "",
    internal_notes: "",
  });
  const [rescheduleBarbers, setRescheduleBarbers] = useState<Barber[]>(barbers);
  const [rescheduleSlots, setRescheduleSlots] = useState<Slot[]>([]);
  const [missingServices, setMissingServices] = useState<MissingService[]>([]);
  const [selectedMissingIds, setSelectedMissingIds] = useState<number[]>([]);
  const [importOpen, setImportOpen] = useState(false);
  const [importState, setImportState] = useState<"idle" | "importing" | "imported">("idle");
  useEffect(() => {
    setCurrent(appointment);
    setNotes(appointment.internal_notes ?? "");
    setSaveState("idle");
    setChargeState("idle");
    setShowReschedule(false);
    setRescheduleState("idle");
    setMissingServices([]);
    setSelectedMissingIds([]);
    setImportOpen(false);
    setImportState("idle");
    setRescheduleForm({
      branch_id: appointment.branch_id,
      date: appointment.starts_at.slice(0, 10),
      barber_id: appointment.barber_id,
      slot: "",
      internal_notes: "",
    });
  }, [appointment]);
  const baseTotal = Number(appointment.total_final ?? appointment.total_estimated ?? 0);
  const extraTotal = saleItems.reduce((total, item) => {
    const source = item.item_type === "service" ? services : products;
    const selected = source.find((option) => option.id === Number(item.item_id));
    if (!selected) return total;
    const unit = "price" in selected ? Number(selected.price) : Number(selected.sale_price);
    return total + unit * item.quantity;
  }, 0);
  const grandTotal = baseTotal + extraTotal;
  const paidTotal = payments.reduce((total, payment) => total + parseMoneyInput(payment.amount), 0);
  const houseTip = Math.max(0, paidTotal - grandTotal);
  const pendingTotal = Math.max(0, grandTotal - paidTotal);
  const rescheduleExtraIds = (appointment.extra_services ?? []).map((extra) => extra.service_id).filter(Boolean);

  useEffect(() => {
    if (!showReschedule || !rescheduleForm.branch_id) return;
    api.get<ApiList<Barber>>("/public/barbers", { query: { branch_id: rescheduleForm.branch_id } })
      .then((data) => {
        setRescheduleBarbers(data.items);
        setRescheduleForm((currentForm) => ({
          ...currentForm,
          barber_id: data.items.some((barber) => barber.id === currentForm.barber_id)
            ? currentForm.barber_id
            : data.items[0]?.id || currentForm.barber_id,
          slot: "",
        }));
      })
      .catch((err) => setError(err instanceof Error ? err.message : "No se cargaron barberos."));
  }, [rescheduleForm.branch_id, showReschedule]);

  useEffect(() => {
    if (!showReschedule || !rescheduleForm.branch_id || !rescheduleForm.barber_id || !rescheduleForm.date) {
      setRescheduleSlots([]);
      return;
    }
    api.get<ApiList<Slot>>("/public/availability", {
      query: {
        branch_id: rescheduleForm.branch_id,
        service_id: appointment.primary_service_id,
        extra_service_ids: rescheduleExtraIds.map(String),
        barber_id: rescheduleForm.barber_id,
        date: rescheduleForm.date,
        exclude_appointment_id: appointment.id,
      },
    })
      .then((data) => {
        setRescheduleSlots(data.items);
        setMissingServices([]);
        setSelectedMissingIds([]);
        setImportOpen(false);
        setImportState("idle");
        setRescheduleForm((currentForm) => ({
          ...currentForm,
          slot: data.items.some((item) => `${item.barber_id}-${item.starts_at}` === currentForm.slot)
            ? currentForm.slot
            : "",
        }));
      })
      .catch((err) => {
        setRescheduleSlots([]);
        setRescheduleForm((currentForm) => ({ ...currentForm, slot: "" }));
        if (isMissingServiceError(err)) {
          setMissingServices(err.details.missing_services);
          setSelectedMissingIds(err.details.missing_services.map((service) => service.id));
          setImportOpen(false);
        }
        setError(err instanceof Error ? err.message : "No se cargaron horarios.");
      });
  }, [
    appointment.id,
    appointment.primary_service_id,
    rescheduleExtraIds.join(","),
    rescheduleForm.barber_id,
    rescheduleForm.branch_id,
    rescheduleForm.date,
    showReschedule,
  ]);

  async function status(path: string, message: string) {
    setError("");
    const updated = await api.patch<Appointment>(`/appointments/${appointment.id}/${path}`, {});
    setCurrent(updated);
    onDone(message);
  }

  async function saveNotes() {
    try {
      setError("");
      setSaveState("saving");
      const updated = await api.patch<Appointment>(`/appointments/${appointment.id}`, { internal_notes: notes, total_final: grandTotal });
      setCurrent(updated);
      setSaveState("saved");
      onDone("Turno actualizado.");
      window.setTimeout(() => setSaveState("idle"), 1800);
    } catch (err) {
      setSaveState("idle");
      setError(err instanceof Error ? err.message : "No se pudo guardar el turno.");
    }
  }

  async function charge() {
    setError("");
    setChargeState("charging");
    try {
    const extraItems = saleItems
      .filter((item) => item.item_id)
      .map((item) =>
        item.item_type === "service"
          ? { item_type: "service", service_id: Number(item.item_id), quantity: item.quantity }
          : { item_type: "product", product_id: Number(item.item_id), quantity: item.quantity },
      );
    const items = [
      { item_type: "service", service_id: appointment.primary_service_id, quantity: 1, unit_price: baseTotal },
      ...extraItems,
    ];
    const sale = await api.post<{ id: number }>("/sales", {
      branch_id: appointment.branch_id,
      client_id: appointment.client_id,
      appointment_id: appointment.id,
      items,
      payment: payments[0] ? { method: payments[0].method, amount: parseMoneyInput(payments[0].amount) } : undefined,
    });
    for (const payment of payments.slice(1)) {
      await api.post(`/sales/${sale.id}/payments`, { method: payment.method, amount: parseMoneyInput(payment.amount) });
    }
    const updated = await api.patch<Appointment>(`/appointments/${appointment.id}`, { total_final: grandTotal });
    setCurrent(updated);
    setChargeState("charged");
    onDone("Cobro registrado.");
    window.setTimeout(() => setChargeState("idle"), 1800);
    } catch (err) {
      setChargeState("idle");
      setError(err instanceof Error ? err.message : "No se pudo registrar el cobro.");
    }
  }

  async function rescheduleNow() {
    const selectedSlot = rescheduleSlots.find((item) => `${item.barber_id}-${item.starts_at}` === rescheduleForm.slot);
    if (!selectedSlot) return;
    setError("");
    setRescheduleState("saving");
    try {
      const updated = await api.patch<Appointment>(`/appointments/${appointment.id}/reschedule`, {
        branch_id: rescheduleForm.branch_id,
        barber_id: rescheduleForm.barber_id,
        date: selectedSlot.starts_at.slice(0, 10),
        time: selectedSlot.starts_at.slice(11, 16),
      });
      const withNotes = rescheduleForm.internal_notes.trim()
        ? await api.patch<Appointment>(`/appointments/${appointment.id}`, {
            internal_notes: [updated.internal_notes, `[Reprogramacion] ${rescheduleForm.internal_notes}`].filter(Boolean).join("\n"),
          })
        : updated;
      setCurrent(withNotes);
      setShowReschedule(false);
      setRescheduleState("idle");
      onDone("Turno reprogramado.");
    } catch (err) {
      setRescheduleState("idle");
      setError(err instanceof Error ? err.message : "No se pudo reprogramar el turno.");
    }
  }

  async function importMissingServices() {
    if (!rescheduleForm.branch_id || !selectedMissingIds.length) return;
    setImportState("importing");
    setError("");
    try {
      await api.post("/admin/services/import-to-branch", {
        branch_id: rescheduleForm.branch_id,
        service_ids: selectedMissingIds,
      });
      setImportState("imported");
      const data = await api.get<ApiList<Slot>>("/public/availability", {
        query: {
          branch_id: rescheduleForm.branch_id,
          service_id: appointment.primary_service_id,
          extra_service_ids: rescheduleExtraIds.map(String),
          barber_id: rescheduleForm.barber_id,
          date: rescheduleForm.date,
          exclude_appointment_id: appointment.id,
        },
      });
      setRescheduleSlots(data.items);
      setMissingServices([]);
      setSelectedMissingIds([]);
      setImportOpen(false);
    } catch (err) {
      setImportState("idle");
      setError(err instanceof Error ? err.message : "No se pudieron importar servicios.");
    }
  }

  async function reprogramLater() {
    setError("");
    setRescheduleState("later");
    try {
      const updated = await api.patch<Appointment>(`/appointments/${appointment.id}`, {
        status: "pending_reschedule",
        internal_notes: [
          current.internal_notes,
          rescheduleForm.internal_notes.trim() ? `[Reprogramar despues] ${rescheduleForm.internal_notes}` : "[Reprogramar despues] Turno enviado a reprogramacion.",
        ].filter(Boolean).join("\n"),
      });
      setCurrent(updated);
      window.dispatchEvent(new Event("nub:reprogramming-updated"));
      onDone("Turno enviado a A reprogramar.");
      onClose();
    } catch (err) {
      setRescheduleState("idle");
      setError(err instanceof Error ? err.message : "No se pudo enviar a reprogramar.");
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4">
      <section className="max-h-[90vh] w-full max-w-3xl overflow-auto rounded-lg bg-white p-5 shadow-soft">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-xl font-bold text-ink">{appointmentClientName(current)}</h3>
            <p className="text-sm text-steel">{shortDate(current.starts_at)} / {appointmentServiceSummary(current)} / Barbero #{current.barber_id}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <StatusBadge status={current.status} />
              <PaymentBadge appointment={current} />
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="secondary" onClick={() => setShowReschedule((value) => !value)}>Reprogramar</Button>
            <Button type="button" variant="secondary" onClick={onClose}>Cerrar</Button>
          </div>
        </div>
        <div className="mt-4 grid gap-4">
          {error ? <ErrorState message={error} /> : null}
          {showReschedule ? (
            <div className="grid gap-3 rounded-md border border-black/10 p-3">
              {missingServices.length ? (
                <Button type="button" variant="secondary" onClick={() => setImportOpen(true)}>
                  Importar servicio/s
                </Button>
              ) : null}
              <Field label="Sucursal">
                <Select
                  value={rescheduleForm.branch_id}
                  onChange={(event) => setRescheduleForm({ ...rescheduleForm, branch_id: Number(event.target.value), slot: "" })}
                >
                  {branches.map((branch) => (
                    <option key={branch.id} value={branch.id}>{branch.name}</option>
                  ))}
                </Select>
              </Field>
              <Field label="Nueva fecha">
                <Input
                  type="date"
                  value={rescheduleForm.date}
                  onChange={(event) => setRescheduleForm({ ...rescheduleForm, date: event.target.value, slot: "" })}
                />
              </Field>
              <Field label="Barbero">
                <Select
                  value={rescheduleForm.barber_id}
                  onChange={(event) => setRescheduleForm({ ...rescheduleForm, barber_id: Number(event.target.value), slot: "" })}
                >
                  {rescheduleBarbers.map((barber) => (
                    <option key={barber.id} value={barber.id}>{barber.full_name}</option>
                  ))}
                </Select>
              </Field>
              <Field label="Horario disponible">
                <Select
                  value={rescheduleForm.slot}
                  onChange={(event) => setRescheduleForm({ ...rescheduleForm, slot: event.target.value })}
                >
                  <option value="">Seleccionar</option>
                  {rescheduleSlots.map((item) => (
                    <option key={`${item.barber_id}-${item.starts_at}`} value={`${item.barber_id}-${item.starts_at}`}>
                      {new Date(item.starts_at).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Comentario de reprogramacion">
                <Textarea
                  value={rescheduleForm.internal_notes}
                  onChange={(event) => setRescheduleForm({ ...rescheduleForm, internal_notes: event.target.value })}
                />
              </Field>
              <div className="flex flex-wrap gap-2">
                <Button type="button" onClick={rescheduleNow} disabled={rescheduleState === "saving" || !rescheduleForm.slot}>
                  {rescheduleState === "saving" ? "Reprogramando..." : "Reprogramar"}
                </Button>
                <Button type="button" variant="secondary" onClick={reprogramLater} disabled={rescheduleState === "later"}>
                  {rescheduleState === "later" ? "Enviando..." : "Reprogramar despues"}
                </Button>
                <Button type="button" variant="danger" onClick={() => setShowReschedule(false)}>Cancelar</Button>
              </div>
            </div>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="secondary" onClick={() => status("check-in", "Cliente presente.")}>Se presento</Button>
            <Button type="button" variant="secondary" onClick={() => status("complete", "Turno completado.")}>Completar</Button>
            <Button type="button" variant="danger" onClick={() => status("no-show", "Turno marcado no-show.")}>No-show</Button>
            <Button type="button" variant="danger" onClick={onCancel}>Cancelar</Button>
          </div>
          <Field label="Notas internas"><Textarea value={notes} onChange={(event) => setNotes(event.target.value)} /></Field>
          <div className="rounded-md border border-black/10 p-3 text-sm">
            <p className="font-bold text-ink">Items del turno</p>
            <div className="mt-2 grid gap-2">
              <div className="flex justify-between gap-3">
                <span>{current.primary_service?.name ?? `Servicio #${current.primary_service_id}`} ({current.primary_service?.duration_minutes ?? minutesBetween(current.starts_at, current.ends_at)} min)</span>
                <span>{money(current.primary_service?.price ?? baseTotal)}</span>
              </div>
              {(current.extra_services ?? []).map((extra) => (
                <div key={extra.id} className="flex justify-between gap-3 text-steel">
                  <span>{extra.name ?? extra.service?.name ?? `Extra #${extra.service_id}`} ({extra.duration_minutes ?? extra.duration_minutes_at_booking} min)</span>
                  <span>{money(extra.price ?? extra.price_at_booking)}</span>
                </div>
              ))}
              <div className="border-t border-black/10 pt-2 font-bold text-ink">Total acumulado: {money(grandTotal)}</div>
            </div>
          </div>
          <div className="rounded-md border border-black/10 p-3">
            <p className="font-bold text-ink">Productos y servicios adicionales</p>
            <div className="mt-3 grid gap-2">
              {saleItems.map((item, index) => (
                <div key={index} className="grid gap-2 sm:grid-cols-[130px_1fr_90px]">
                  <Select value={item.item_type} onChange={(event) => setSaleItems((current) => current.map((row, rowIndex) => rowIndex === index ? { ...row, item_type: event.target.value as "service" | "product", item_id: "" } : row))}>
                    <option value="service">Servicio</option>
                    <option value="product">Producto</option>
                  </Select>
                  <Select value={item.item_id} onChange={(event) => setSaleItems((current) => current.map((row, rowIndex) => rowIndex === index ? { ...row, item_id: event.target.value } : row))}>
                    <option value="">Seleccionar</option>
                    {(item.item_type === "service" ? services : products).map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}
                  </Select>
                  <Input type="number" min={1} value={item.quantity} onChange={(event) => setSaleItems((current) => current.map((row, rowIndex) => rowIndex === index ? { ...row, quantity: Number(event.target.value) } : row))} />
                </div>
              ))}
              <Button type="button" variant="secondary" onClick={() => setSaleItems((current) => [...current, { item_type: "service", item_id: "", quantity: 1 }])}>Agregar item</Button>
            </div>
          </div>
          <div className="rounded-md border border-black/10 p-3">
            <p className="font-bold text-ink">Pagos</p>
            <div className="mt-3 grid gap-2">
              {payments.map((payment, index) => (
                <div key={index} className="grid gap-2 sm:grid-cols-2">
                  <Select value={payment.method} onChange={(event) => setPayments((current) => current.map((row, rowIndex) => rowIndex === index ? { ...row, method: event.target.value } : row))}>
                    <option value="efectivo">Efectivo</option>
                    <option value="mercado_pago">Mercado Pago</option>
                    <option value="transferencia">Transferencia</option>
                    <option value="tarjeta_debito">Tarjeta debito</option>
                    <option value="tarjeta_credito">Tarjeta credito</option>
                    <option value="otro">Otro</option>
                  </Select>
                  <Input inputMode="decimal" value={payment.amount} onChange={(event) => setPayments((current) => current.map((row, rowIndex) => rowIndex === index ? { ...row, amount: formatMoneyInput(event.target.value) } : row))} />
                </div>
              ))}
              <Button type="button" variant="secondary" onClick={() => setPayments((current) => [...current, { method: "efectivo", amount: "" }])}>Agregar pago</Button>
            </div>
          </div>
          <div className="rounded-md bg-smoke p-3 text-sm text-ink">
            <p>Total: {money(grandTotal)}</p>
            <p>Pagado: {money(paidTotal)}</p>
            <p>Diferencia: {money(pendingTotal)}</p>
            {houseTip > 0 ? (
              <Button className="mt-2" type="button" variant="secondary">
                Propina a la casa: {money(houseTip)}
              </Button>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={saveNotes} disabled={saveState === "saving"}>
              {saveState === "saving" ? "Guardando..." : saveState === "saved" ? "✓ Guardado" : "Guardar cambios"}
            </Button>
            <Button type="button" variant="secondary" onClick={charge} disabled={chargeState === "charging"}>
              {chargeState === "charging" ? "Registrando..." : chargeState === "charged" ? "✓ Pago registrado" : "Registrar cobro"}
            </Button>
          </div>
        </div>
        {importOpen && missingServices.length ? (
          <ImportServicesModal
            services={missingServices}
            selectedIds={selectedMissingIds}
            state={importState}
            onToggle={(serviceId) =>
              setSelectedMissingIds((currentIds) =>
                currentIds.includes(serviceId)
                  ? currentIds.filter((id) => id !== serviceId)
                  : [...currentIds, serviceId],
              )
            }
            onImport={importMissingServices}
            onClose={() => setImportOpen(false)}
          />
        ) : null}
      </section>
    </div>
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
    <div className="fixed inset-0 z-[60] grid place-items-center bg-black/50 p-4">
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

function QuickAppointment({
  branchId,
  services,
  barbers,
  quickCreate,
  onDone,
  onCancel,
  surface = "card",
  title = "Crear turno",
}: {
  branchId: number | "";
  services: Service[];
  barbers: Barber[];
  quickCreate: QuickCreate | null;
  onDone: (message: string) => void;
  onCancel?: () => void;
  surface?: "card" | "plain";
  title?: string;
}) {
  const [serviceId, setServiceId] = useState<number | "">("");
  const [extraServiceIds, setExtraServiceIds] = useState<number[]>([]);
  const [barberId, setBarberId] = useState<number | "any">("any");
  const [date, setDate] = useState(todayInputValue());
  const [slots, setSlots] = useState<Slot[]>([]);
  const [slot, setSlot] = useState("");
  const [form, setForm] = useState({ first_name: "", last_name: "", email: "", phone: "", customer_comment: "" });
  const [clientQuery, setClientQuery] = useState("");
  const [clientResults, setClientResults] = useState<Client[]>([]);
  const [error, setError] = useState("");
  const primaryServices = services.filter(isPrimaryService);
  const extraServices = services.filter((item) => isExtraService(item) && item.id !== serviceId);
  const selectedServices = [
    ...services.filter((item) => item.id === serviceId),
    ...services.filter((item) => extraServiceIds.includes(item.id)),
  ];
  const total = selectedServices.reduce((sum, service) => sum + Number(service.price), 0);
  const duration = selectedServices.reduce((sum, service) => sum + Number(service.duration_minutes), 0);

  useEffect(() => {
    if (!quickCreate) return;
    setDate(quickCreate.date);
    setBarberId(quickCreate.barberId);
  }, [quickCreate]);

  async function loadSlots() {
    if (!branchId || !serviceId) return;
    const data = await api.get<ApiList<Slot>>("/public/availability", {
      query: { branch_id: branchId, service_id: serviceId, extra_service_ids: extraServiceIds.map(String), barber_id: barberId, date },
    });
    const loadedSlots = [...data.items];
    const desired = quickCreate
      ? loadedSlots.find((item) => item.barber_id === quickCreate.barberId && item.starts_at.slice(11, 16) === quickCreate.time)
      : null;
    if (quickCreate?.forceUnavailable && !desired) {
      const startsAt = `${quickCreate.date}T${quickCreate.time}:00`;
      loadedSlots.push({
        barber_id: quickCreate.barberId,
        starts_at: startsAt,
        ends_at: new Date(new Date(startsAt).getTime() + Math.max(duration, 15) * 60000).toISOString(),
      });
    }
    setSlots(loadedSlots);
    const selectedDesired = loadedSlots.find((item) => item.barber_id === quickCreate?.barberId && item.starts_at.slice(11, 16) === quickCreate?.time);
    setSlot(selectedDesired ? `${selectedDesired.barber_id}-${selectedDesired.starts_at}` : "");
  }

  useEffect(() => {
    if (!branchId || !serviceId || !date) return;
    loadSlots().catch((err) => setError(err instanceof Error ? err.message : "No se cargaron horarios."));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branchId, serviceId, extraServiceIds.join(","), barberId, date]);

  async function searchClient() {
    if (!clientQuery.trim()) return;
    const data = await api.get<ApiList<Client>>("/clients/search", { query: { q: clientQuery } });
    setClientResults(data.items);
  }

  function pickClient(client: Client) {
    const [firstName = client.full_name, ...rest] = client.full_name.split(" ");
    setForm({
      ...form,
      first_name: client.first_name || firstName,
      last_name: client.last_name || rest.join(" "),
      email: client.email,
      phone: client.phone,
    });
    setClientResults([]);
    setClientQuery(client.full_name);
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    const selected = slots.find((item) => `${item.barber_id}-${item.starts_at}` === slot);
    if (!branchId || !serviceId || !selected) return;
    try {
      await api.post("/appointments", {
        branch_id: branchId,
        primary_service_id: serviceId,
        extra_service_ids: extraServiceIds,
        barber_id: selected.barber_id,
        starts_at: selected.starts_at,
        force_unavailable: Boolean(quickCreate?.forceUnavailable),
        ...form,
      });
      setForm({ first_name: "", last_name: "", email: "", phone: "", customer_comment: "" });
      onDone("Turno creado.");
    } catch (err) {
      setError(err instanceof ApiError && err.status === 409 ? "Horario tomado." : err instanceof Error ? err.message : "Error");
    }
  }

  const formClassName = surface === "card" ? "rounded-lg border border-black/10 bg-white p-3 shadow-soft" : "grid gap-3";
  const identityGridClassName = surface === "card" ? "grid gap-3" : "grid gap-3 sm:grid-cols-2";

  return (
    <form onSubmit={submit} className={formClassName}>
      <h2 className="text-lg font-bold text-ink">{title}</h2>
      <div className="mt-4 grid gap-3">
        {error ? <ErrorState message={error} /> : null}
        <Field label="Servicio principal">
          <Select value={serviceId} onChange={(event) => setServiceId(event.target.value ? Number(event.target.value) : "")} required>
            <option value="">Seleccionar</option>
            {primaryServices.map((item) => (
              <option key={item.id} value={item.id}>{item.name}</option>
            ))}
          </Select>
        </Field>
        <div className="rounded-md border border-black/10 p-3">
          <p className="mb-2 text-sm font-bold text-ink">Servicios secundarios</p>
          <div className="grid gap-2">
            {extraServices.map((item) => (
              <label key={item.id} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={extraServiceIds.includes(item.id)}
                  onChange={() => setExtraServiceIds((current) => current.includes(item.id) ? current.filter((id) => id !== item.id) : [...current, item.id])}
                />
                {item.name} ({money(item.price)})
              </label>
            ))}
          </div>
        </div>
        <Field label="Barbero">
          <Select value={barberId} onChange={(event) => setBarberId(event.target.value === "any" ? "any" : Number(event.target.value))}>
            <option value="any">Cualquiera disponible</option>
            {barbers.map((item) => (
              <option key={item.id} value={item.id}>{item.full_name}</option>
            ))}
          </Select>
        </Field>
        <div className="grid gap-3">
          <Field label="Fecha">
            <Input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
          </Field>
        </div>
        <Field label="Horario">
          <Select value={slot} onChange={(event) => setSlot(event.target.value)} required>
            <option value="">Seleccionar</option>
            {slots.map((item) => (
              <option key={`${item.barber_id}-${item.starts_at}`} value={`${item.barber_id}-${item.starts_at}`}>
                {new Date(item.starts_at).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })} - barbero #{item.barber_id}
              </option>
            ))}
          </Select>
        </Field>
        <div className="rounded-md bg-smoke p-3 text-sm text-ink">Duracion: {duration} min / Total: {money(total)}</div>
        <div className="grid gap-2">
          <div className="flex gap-2">
            <Input placeholder="Buscar cliente existente" value={clientQuery} onChange={(event) => setClientQuery(event.target.value)} />
            <Button type="button" variant="secondary" onClick={searchClient}>Buscar</Button>
          </div>
          {clientResults.length ? (
            <div className="grid gap-1 rounded-md border border-black/10 p-2">
              {clientResults.map((client) => (
                <button key={client.id} type="button" className="text-left text-sm hover:text-brass" onClick={() => pickClient(client)}>
                  {client.full_name} - {client.email}
                </button>
              ))}
            </div>
          ) : null}
        </div>
        <div className={identityGridClassName}>
          <Input placeholder="Nombre" value={form.first_name} onChange={(event) => setForm({ ...form, first_name: event.target.value })} required />
          <Input placeholder="Apellido" value={form.last_name} onChange={(event) => setForm({ ...form, last_name: event.target.value })} required />
          <Input placeholder="Email" type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} required />
          <Input placeholder="Telefono" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} required />
        </div>
        <Textarea placeholder="Comentario" value={form.customer_comment} onChange={(event) => setForm({ ...form, customer_comment: event.target.value })} />
        <div className="flex flex-wrap gap-2">
          <Button type="submit">Crear turno</Button>
          {onCancel ? <Button type="button" variant="secondary" onClick={onCancel}>Cancelar</Button> : null}
        </div>
      </div>
    </form>
  );
}

function QuickAppointmentModal({
  branchId,
  services,
  barbers,
  quickCreate,
  onClose,
  onDone,
}: {
  branchId: number | "";
  services: Service[];
  barbers: Barber[];
  quickCreate: QuickCreate;
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  const barber = barbers.find((item) => item.id === quickCreate.barberId);
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4">
      <section className="max-h-[92vh] w-full max-w-2xl overflow-auto rounded-lg bg-white p-5 shadow-soft">
        <div className="mb-4 flex items-start justify-between gap-3 border-b border-black/10 pb-3">
          <div>
            <h3 className="text-xl font-bold text-ink">Crear turno rapido</h3>
            <p className="text-sm text-steel">
              {new Date(`${quickCreate.date}T00:00:00`).toLocaleDateString("es-AR")} / {quickCreate.time}
              {barber ? ` / ${barber.full_name}` : ""}
            </p>
          </div>
          <Button type="button" variant="secondary" onClick={onClose}>Cerrar</Button>
        </div>
        <QuickAppointment
          branchId={branchId}
          services={services}
          barbers={barbers}
          quickCreate={quickCreate}
          onDone={onDone}
          onCancel={onClose}
          surface="plain"
          title="Datos del turno"
        />
      </section>
    </div>
  );
}

function ClientTools({
  clients,
  onSearch,
}: {
  clients: Client[];
  onSearch: (q: string) => Promise<void>;
}) {
  const [q, setQ] = useState("");
  const [sort, setSort] = useState("created_desc");
  const [localClients, setLocalClients] = useState<Client[]>(clients);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState({ full_name: "", email: "", phone: "", dni: "", birth_date: "" });
  const [message, setMessage] = useState("");
  useEffect(() => setLocalClients(clients), [clients]);
  const sortedClients = [...localClients].sort((a, b) => {
    if (sort === "age_asc") return String(b.birth_date ?? "").localeCompare(String(a.birth_date ?? ""));
    if (sort === "age_desc") return String(a.birth_date ?? "").localeCompare(String(b.birth_date ?? ""));
    return b.id - a.id;
  });

  async function createClient(event: React.FormEvent) {
    event.preventDefault();
    const saved = editingId ? await api.patch<Client>(`/clients/${editingId}`, form) : await api.post<Client>("/clients", form);
    setLocalClients((current) => [saved, ...current.filter((item) => item.id !== saved.id)]);
    setEditingId(null);
    setForm({ full_name: "", email: "", phone: "", dni: "", birth_date: "" });
    setMessage(editingId ? "Cliente actualizado." : "Cliente creado.");
  }

  function editClient(client: Client) {
    setEditingId(client.id);
    setForm({
      full_name: client.full_name,
      email: client.email,
      phone: client.phone,
      dni: client.dni ?? "",
      birth_date: client.birth_date ?? "",
    });
  }

  async function deleteClient(client: Client) {
    if (!window.confirm("Eliminar este cliente?")) return;
    await api.delete(`/clients/${client.id}`);
    setLocalClients((current) => current.filter((item) => item.id !== client.id));
  }

  return (
    <section id="clientes" className="rounded-lg border border-black/10 bg-white p-4 shadow-soft">
      <h2 className="text-lg font-bold text-ink">Clientes</h2>
      {message ? <SuccessState message={message} /> : null}
      <div className="mt-4 grid gap-3">
        <div className="flex gap-2">
          <Input placeholder="Buscar por nombre, DNI, telefono o email" value={q} onChange={(event) => setQ(event.target.value)} />
          <Button type="button" variant="secondary" onClick={() => onSearch(q)}>Buscar</Button>
        </div>
        <Field label="Ordenar clientes">
          <Select value={sort} onChange={(event) => setSort(event.target.value)}>
            <option value="created_desc">Fecha de creacion</option>
            <option value="age_asc">Edad de menor a mayor</option>
            <option value="age_desc">Edad de mayor a menor</option>
          </Select>
        </Field>
        <div className="grid gap-2">
          {sortedClients.map((client) => (
            <div key={client.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-smoke p-2 text-sm">
              <span>{client.full_name} - {client.email} - {client.phone}</span>
              <span className="flex flex-wrap gap-2">
                <Button type="button" variant="secondary" onClick={() => editClient(client)}>Editar</Button>
                <Button type="button" variant="secondary" onClick={() => setMessage("Abrí el turno desde Agenda por barbero para administrarlo.")}>Administrar turnos</Button>
                <Button type="button" variant="danger" onClick={() => deleteClient(client)}>Eliminar</Button>
              </span>
            </div>
          ))}
        </div>
        <form className="grid gap-2 sm:grid-cols-2" onSubmit={createClient}>
          <Input placeholder="Nombre completo" value={form.full_name} onChange={(event) => setForm({ ...form, full_name: event.target.value })} required />
          <Input placeholder="Email" type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} required />
          <Input placeholder="Telefono" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} required />
          <Input placeholder="DNI" value={form.dni} onChange={(event) => setForm({ ...form, dni: event.target.value })} />
          <Input type="date" value={form.birth_date} onChange={(event) => setForm({ ...form, birth_date: event.target.value })} />
          <Button className="sm:col-span-2" type="submit">{editingId ? "Guardar cliente" : "Crear cliente"}</Button>
        </form>
      </div>
    </section>
  );
}

type PendingProductSale = {
  id: number;
  items: { product_id: string; quantity: number }[];
  payments: { method: string; amount: string }[];
};

function ProductSaleCard({
  branchId,
  products,
  onDone,
}: {
  branchId: number | "";
  products: Product[];
  onDone: (message: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState<PendingProductSale[]>([]);
  const [draft, setDraft] = useState<PendingProductSale>({
    id: Date.now(),
    items: [{ product_id: "", quantity: 1 }],
    payments: [{ method: "efectivo", amount: "" }],
  });
  const total = draft.items.reduce((sum, item) => {
    const product = products.find((option) => option.id === Number(item.product_id));
    return sum + (product ? Number(product.sale_price) * item.quantity : 0);
  }, 0);

  function resetDraft() {
    setDraft({ id: Date.now(), items: [{ product_id: "", quantity: 1 }], payments: [{ method: "efectivo", amount: "" }] });
  }

  async function confirm() {
    if (!branchId) return;
    const sale = await api.post<{ id: number }>("/sales", {
      branch_id: branchId,
      items: draft.items
        .filter((item) => item.product_id)
        .map((item) => ({ item_type: "product", product_id: Number(item.product_id), quantity: item.quantity })),
      payment: draft.payments[0] ? { method: draft.payments[0].method, amount: parseMoneyInput(draft.payments[0].amount) || total } : undefined,
    });
    for (const payment of draft.payments.slice(1)) {
      await api.post(`/sales/${sale.id}/payments`, {
        method: payment.method,
        amount: parseMoneyInput(payment.amount),
      });
    }
    setPending((current) => current.filter((item) => item.id !== draft.id));
    resetDraft();
    setOpen(false);
    onDone("Venta de productos registrada.");
  }

  function hold() {
    setPending((current) => [draft, ...current.filter((item) => item.id !== draft.id)]);
    resetDraft();
    setOpen(false);
  }

  return (
    <section className="rounded-lg border border-black/10 bg-white p-4 shadow-soft">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-ink">Venta de Productos</h2>
          <p className="text-sm text-steel">{pending.length ? `${pending.length} en espera` : "Sin ventas pendientes"}</p>
        </div>
        <Button type="button" onClick={() => setOpen(true)}>Nueva venta</Button>
      </div>
      {pending.length ? (
        <div className="mt-3 grid gap-2">
          {pending.map((sale) => (
            <button key={sale.id} type="button" className="rounded-md bg-smoke p-2 text-left text-sm" onClick={() => { setDraft(sale); setOpen(true); }}>
              Venta pendiente #{sale.id}
            </button>
          ))}
        </div>
      ) : null}
      {open ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4">
          <section className="w-full max-w-2xl rounded-lg bg-white p-5 shadow-soft">
            <div className="flex items-start justify-between gap-3">
              <h3 className="text-xl font-bold text-ink">Venta de productos</h3>
              <Button type="button" variant="secondary" onClick={() => setOpen(false)}>Cerrar</Button>
            </div>
            <div className="mt-4 grid gap-3">
              {draft.items.map((item, index) => (
                <div key={index} className="grid gap-2 sm:grid-cols-[1fr_100px]">
                  <Select value={item.product_id} onChange={(event) => setDraft((current) => ({ ...current, items: current.items.map((row, rowIndex) => rowIndex === index ? { ...row, product_id: event.target.value } : row) }))}>
                    <option value="">Producto</option>
                    {products.map((product) => <option key={product.id} value={product.id}>{product.name} - {money(product.sale_price)}</option>)}
                  </Select>
                  <Input type="number" min={1} value={item.quantity} onChange={(event) => setDraft((current) => ({ ...current, items: current.items.map((row, rowIndex) => rowIndex === index ? { ...row, quantity: Number(event.target.value) } : row) }))} />
                </div>
              ))}
              <Button type="button" variant="secondary" onClick={() => setDraft((current) => ({ ...current, items: [...current.items, { product_id: "", quantity: 1 }] }))}>Agregar producto</Button>
              {draft.payments.map((payment, index) => (
                <div key={index} className="grid gap-2 sm:grid-cols-2">
                  <Select value={payment.method} onChange={(event) => setDraft((current) => ({ ...current, payments: current.payments.map((row, rowIndex) => rowIndex === index ? { ...row, method: event.target.value } : row) }))}>
                    <option value="efectivo">Efectivo</option>
                    <option value="mercado_pago">Mercado Pago</option>
                    <option value="transferencia">Transferencia</option>
                    <option value="tarjeta_debito">Tarjeta debito</option>
                    <option value="tarjeta_credito">Tarjeta credito</option>
                  </Select>
                  <Input inputMode="decimal" value={payment.amount} onChange={(event) => setDraft((current) => ({ ...current, payments: current.payments.map((row, rowIndex) => rowIndex === index ? { ...row, amount: formatMoneyInput(event.target.value) } : row) }))} />
                </div>
              ))}
              <Button type="button" variant="secondary" onClick={() => setDraft((current) => ({ ...current, payments: [...current.payments, { method: "efectivo", amount: "" }] }))}>Agregar pago</Button>
              <p className="rounded-md bg-smoke p-3 text-sm font-bold text-ink">Total: {money(total)}</p>
              <div className="flex flex-wrap gap-2">
                <Button type="button" onClick={confirm}>Confirmar compra</Button>
                <Button type="button" variant="secondary" onClick={hold}>Dejar en espera</Button>
                <Button type="button" variant="danger" onClick={() => { resetDraft(); setOpen(false); }}>Cancelar</Button>
              </div>
            </div>
          </section>
        </div>
      ) : null}
    </section>
  );
}

function SaleBox({
  branchId,
  services,
  products,
  onDone,
}: {
  branchId: number | "";
  services: Service[];
  products: Product[];
  onDone: (message: string) => void;
}) {
  const [itemType, setItemType] = useState<"service" | "product">("product");
  const [itemId, setItemId] = useState<number | "">("");
  const [quantity, setQuantity] = useState(1);
  const [discount, setDiscount] = useState(0);
  const [method, setMethod] = useState("efectivo");
  const options = itemType === "service" ? services : products;
  const selected = options.find((item) => item.id === itemId);
  const unitPrice = selected && "price" in selected ? Number(selected.price) : selected ? Number(selected.sale_price) : 0;
  const total = Math.max(0, unitPrice * quantity - discount);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!branchId || !itemId) return;
    await api.post("/sales", {
      branch_id: branchId,
      discount_amount: discount,
      items: [
        itemType === "service"
          ? { item_type: "service", service_id: itemId, quantity }
          : { item_type: "product", product_id: itemId, quantity },
      ],
      payment: { method, amount: total },
    });
    onDone("Venta registrada.");
  }

  return (
    <form onSubmit={submit} className="rounded-lg border border-black/10 bg-white p-4 shadow-soft">
      <h2 className="text-lg font-bold text-ink">Venta / cobro</h2>
      <div className="mt-4 grid gap-3">
        <Field label="Tipo">
          <Select value={itemType} onChange={(event) => { setItemType(event.target.value as "service" | "product"); setItemId(""); }}>
            <option value="product">Producto</option>
            <option value="service">Servicio</option>
          </Select>
        </Field>
        <Field label="Item">
          <Select value={itemId} onChange={(event) => setItemId(Number(event.target.value))} required>
            <option value="">Seleccionar</option>
            {options.map((item) => (
              <option key={item.id} value={item.id}>{item.name}</option>
            ))}
          </Select>
        </Field>
        <Field label="Cantidad">
          <Input type="number" min={1} value={quantity} onChange={(event) => setQuantity(Number(event.target.value))} />
        </Field>
        <Field label="Descuento">
          <Input type="number" min={0} value={discount} onChange={(event) => setDiscount(Number(event.target.value))} />
        </Field>
        <Field label="Medio de pago">
          <Select value={method} onChange={(event) => setMethod(event.target.value)}>
            <option value="efectivo">Efectivo</option>
            <option value="transferencia">Transferencia</option>
            <option value="tarjeta_debito">Tarjeta debito</option>
            <option value="tarjeta_credito">Tarjeta credito</option>
            <option value="mercado_pago">Mercado Pago</option>
            <option value="otro">Otro</option>
          </Select>
        </Field>
        <p className="rounded-md bg-smoke p-3 text-sm font-bold text-ink">Total a cobrar: {money(total)}</p>
        <Button type="submit">Registrar cobro</Button>
      </div>
    </form>
  );
}
