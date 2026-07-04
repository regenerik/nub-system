"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { PanelShell } from "@/components/layout/panel-shell";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { ImageUploader } from "@/components/ui/image-uploader";
import { EmptyState, ErrorState, SuccessState } from "@/components/ui/status";
import { api } from "@/lib/api";
import { appConfig } from "@/lib/config";
import { readToken } from "@/lib/auth-storage";
import { money, todayInputValue } from "@/lib/format";
import { useSocket } from "@/hooks/use-socket";
import type {
  ApiList,
  Appointment,
  Barber,
  BarberAvailability,
  Branch,
  ChartDatum,
  Client,
  DashboardStats,
  Product,
  Service,
  User,
} from "@/types/domain";

type Charts = Record<string, ChartDatum[]>;

const tabs = [
  "Dashboard",
  "Migraciones",
  "Sucursales",
  "Servicios",
  "Productos",
  "Clientes",
  "Barberos",
  "Usuarios",
  "Gastos",
  "Sueldos",
  "Backup",
];

type BranchScheduleDay = { enabled: boolean; from: string; to: string };
type BranchSchedule = Record<string, BranchScheduleDay>;

const weekDays = [
  { key: "mon", label: "Lunes" },
  { key: "tue", label: "Martes" },
  { key: "wed", label: "Miercoles" },
  { key: "thu", label: "Jueves" },
  { key: "fri", label: "Viernes" },
  { key: "sat", label: "Sabado" },
  { key: "sun", label: "Domingo" },
];

const defaultBranchSchedule: BranchSchedule = weekDays.reduce((acc, day) => {
  acc[day.key] = { enabled: day.key !== "sun", from: "09:00", to: "20:00" };
  return acc;
}, {} as BranchSchedule);

const emptyBranchForm = {
  name: "",
  address: "",
  phone: "",
  email: "",
  description: "",
  image_url: "",
  opening_hours: JSON.stringify(defaultBranchSchedule),
};

function parseBranchSchedule(value?: string | null): BranchSchedule {
  if (!value) return defaultBranchSchedule;
  try {
    const parsed = JSON.parse(value) as Partial<BranchSchedule>;
    return weekDays.reduce((acc, day) => {
      acc[day.key] = {
        enabled: Boolean(parsed[day.key]?.enabled),
        from: parsed[day.key]?.from || "09:00",
        to: parsed[day.key]?.to || "20:00",
      };
      return acc;
    }, {} as BranchSchedule);
  } catch {
    return defaultBranchSchedule;
  }
}

function stringifyBranchSchedule(schedule: BranchSchedule) {
  return JSON.stringify(schedule);
}

function toggleNumberValue(values: number[], value: number) {
  return values.includes(value) ? values.filter((item) => item !== value) : [...values, value];
}

function formatMoneyInput(value: string) {
  const cleaned = value.replace(/[^\d,]/g, "");
  const [rawInteger, rawDecimals = ""] = cleaned.split(",");
  const integer = rawInteger.replace(/^0+(?=\d)/, "") || "0";
  const formattedInteger = Number(integer).toLocaleString("es-AR");
  return rawDecimals.length ? `${formattedInteger},${rawDecimals.slice(0, 2)}` : formattedInteger;
}

function parseMoneyInput(value: string) {
  const normalized = value.replace(/\./g, "").replace(",", ".");
  return Number(normalized || 0);
}

export default function AdminPage() {
  const [tab, setTab] = useState("Dashboard");
  const [branches, setBranches] = useState<Branch[]>([]);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [charts, setCharts] = useState<Charts>({});
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [filters, setFilters] = useState({ branch_id: "", from: "", to: "" });

  const loadBranches = useCallback(async () => {
    const data = await api.get<ApiList<Branch>>("/admin/branches");
    setBranches(data.items.filter((item) => item.is_active));
  }, []);

  useEffect(() => {
    const requestedTab = new URLSearchParams(window.location.search).get("tab");
    if (requestedTab && tabs.includes(requestedTab)) setTab(requestedTab);
  }, []);

  const loadStats = useCallback(async () => {
    const [overview, chartData] = await Promise.all([
      api.get<DashboardStats>("/admin/stats/overview", { query: filters }),
      api.get<Charts>("/admin/stats/charts", { query: filters }),
    ]);
    setStats(overview);
    setCharts(chartData);
  }, [filters]);

  useEffect(() => {
    loadBranches().catch((err) => setError(err instanceof Error ? err.message : "No se cargaron sucursales."));
  }, [loadBranches]);

  useEffect(() => {
    loadStats().catch((err) => setError(err instanceof Error ? err.message : "No se cargaron estadisticas."));
  }, [loadStats]);

  const socketEvents = useMemo(
    () => ({
      "stats:updated": loadStats,
      "sale:paid": loadStats,
      "stock:updated": loadStats,
      "appointment:created": loadStats,
      "appointment:completed": loadStats,
    }),
    [loadStats],
  );
  useSocket(socketEvents);

  return (
    <ProtectedRoute roles={["admin"]}>
      <PanelShell title="Panel admin" subtitle="Gestion completa de NUB System.">
        <div className="grid gap-5">
          {error ? <ErrorState message={error} /> : null}
          {message ? <SuccessState message={message} /> : null}
          <div className="flex gap-2 overflow-x-auto rounded-lg border border-black/10 bg-white p-2 shadow-soft">
            {tabs.map((item) => (
              <Button
                key={item}
                type="button"
                variant={tab === item ? "primary" : "ghost"}
                onClick={() => setTab(item)}
              >
                {item}
              </Button>
            ))}
          </div>

          {tab === "Dashboard" ? (
            <Dashboard
              branches={branches}
              charts={charts}
              filters={filters}
              setFilters={setFilters}
              stats={stats}
            />
          ) : null}
          {tab === "Migraciones" ? <MigrationsAdmin onMessage={setMessage} /> : null}
          {tab === "Sucursales" ? <BranchesAdmin onMessage={setMessage} reload={loadBranches} /> : null}
          {tab === "Servicios" ? <ServicesAdmin branches={branches} onMessage={setMessage} /> : null}
          {tab === "Productos" ? <ProductsAdmin branches={branches} onMessage={setMessage} /> : null}
          {tab === "Clientes" ? <ClientsAdmin /> : null}
          {tab === "Barberos" ? <BarbersAdmin branches={branches} onMessage={setMessage} /> : null}
          {tab === "Usuarios" ? <UsersAdmin branches={branches} onMessage={setMessage} /> : null}
          {tab === "Gastos" ? <ExpenseAdmin branches={branches} onMessage={setMessage} /> : null}
          {tab === "Sueldos" ? <SalaryAdmin branches={branches} onMessage={setMessage} /> : null}
          {tab === "Backup" ? <BackupAdmin onMessage={setMessage} /> : null}
        </div>
      </PanelShell>
    </ProtectedRoute>
  );
}

function Dashboard({
  branches,
  stats,
  charts,
  filters,
  setFilters,
}: {
  branches: Branch[];
  stats: DashboardStats | null;
  charts: Charts;
  filters: { branch_id: string; from: string; to: string };
  setFilters: (filters: { branch_id: string; from: string; to: string }) => void;
}) {
  const kpis = stats
    ? [
        ["Facturacion", money(stats.revenue_total)],
        ["Clientes", stats.clients_total],
        ["Turnos", stats.appointments_total],
        ["Completados", stats.appointments_completed],
        ["Cancelados", stats.appointments_cancelled],
        ["No-shows", stats.no_show_count],
        ["Ticket promedio", money(stats.average_ticket)],
        ["Ganancia bruta", money(stats.gross_profit)],
        ["Ganancia neta", money(stats.net_profit)],
        ["Gastos", money(stats.total_expenses)],
        ["Sueldos", money(stats.total_salaries)],
        ["Valor stock", money(stats.stock_value_total)],
      ]
    : [];

  return (
    <section className="grid gap-5">
      <div className="grid gap-3 rounded-lg border border-black/10 bg-white p-4 shadow-soft sm:grid-cols-4">
        <Field label="Sucursal">
          <Select value={filters.branch_id} onChange={(event) => setFilters({ ...filters, branch_id: event.target.value })}>
            <option value="">Todas</option>
            {branches.map((branch) => (
              <option key={branch.id} value={branch.id}>{branch.name}</option>
            ))}
          </Select>
        </Field>
        <Field label="Desde">
          <Input type="date" value={filters.from} onChange={(event) => setFilters({ ...filters, from: event.target.value })} />
        </Field>
        <Field label="Hasta">
          <Input type="date" value={filters.to} onChange={(event) => setFilters({ ...filters, to: event.target.value })} />
        </Field>
        <div className="flex items-end gap-2">
          <Button type="button" variant="secondary" onClick={() => downloadProtected("/admin/stats/export.xlsx", "nub-stats.xlsx")}>
            Excel
          </Button>
          <Button type="button" variant="secondary" onClick={() => downloadProtected("/admin/stats/export.json", "nub-stats.json")}>
            JSON
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map(([label, value]) => (
          <article key={label} className="rounded-lg border border-black/10 bg-white p-4 shadow-soft">
            <p className="text-sm text-steel">{label}</p>
            <p className="mt-2 text-2xl font-bold text-ink">{value}</p>
          </article>
        ))}
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <ChartCard title="Ventas por dia" data={charts.sales_by_day ?? []} dataKey="total" nameKey="date" />
        <PieCard title="Medios de pago" data={charts.payment_method_distribution ?? []} dataKey="total" nameKey="method" />
        <ChartCard title="Productos mas vendidos" data={charts.top_products ?? []} dataKey="quantity" nameKey="name" />
        <ChartCard title="Turnos por hora" data={charts.appointments_by_hour ?? []} dataKey="total" nameKey="hour" />
        <ChartCard title="Comparacion sucursales" data={charts.branch_comparison ?? []} dataKey="revenue" nameKey="branch" />
        <ChartCard title="Stock valorizado por sucursal" data={charts.stock_value_by_branch ?? []} dataKey="stock_value" nameKey="branch" />
      </div>
    </section>
  );
}

function ChartCard({
  title,
  data,
  dataKey,
  nameKey,
}: {
  title: string;
  data: ChartDatum[];
  dataKey: string;
  nameKey: string;
}) {
  return (
    <article className="rounded-lg border border-black/10 bg-white p-4 shadow-soft">
      <h3 className="font-bold text-ink">{title}</h3>
      <div className="mt-4 h-64">
        {data.length ? (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey={nameKey} />
              <YAxis />
              <Tooltip />
              <Bar dataKey={dataKey} fill="#b88a44" radius={[5, 5, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <EmptyState title="Sin datos para este grafico." />
        )}
      </div>
    </article>
  );
}

function PieCard({
  title,
  data,
  dataKey,
  nameKey,
}: {
  title: string;
  data: ChartDatum[];
  dataKey: string;
  nameKey: string;
}) {
  return (
    <article className="rounded-lg border border-black/10 bg-white p-4 shadow-soft">
      <h3 className="font-bold text-ink">{title}</h3>
      <div className="mt-4 h-64">
        {data.length ? (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={data} dataKey={dataKey} nameKey={nameKey} outerRadius={90}>
                {data.map((_, index) => (
                  <Cell key={index} fill={["#b88a44", "#657c6a", "#9b5d48", "#344054"][index % 4]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        ) : (
          <EmptyState title="Sin datos para este grafico." />
        )}
      </div>
    </article>
  );
}

function BranchHoursEditor({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const schedule = parseBranchSchedule(value);

  function update(dayKey: string, patch: Partial<BranchScheduleDay>) {
    const next = {
      ...schedule,
      [dayKey]: { ...schedule[dayKey], ...patch },
    };
    onChange(stringifyBranchSchedule(next));
  }

  return (
    <div className="sm:col-span-2 rounded-md border border-black/10 p-3">
      <p className="mb-2 text-sm font-bold text-ink">Dias y horarios habiles</p>
      <div className="grid gap-2">
        {weekDays.map((day) => (
          <div key={day.key} className="grid items-center gap-2 rounded-md bg-smoke p-2 sm:grid-cols-[150px_1fr_1fr]">
            <label className="flex items-center gap-2 text-sm font-semibold text-ink">
              <input
                type="checkbox"
                checked={schedule[day.key].enabled}
                onChange={(event) => update(day.key, { enabled: event.target.checked })}
              />
              {day.label}
            </label>
            <Input
              type="time"
              step={900}
              value={schedule[day.key].from}
              disabled={!schedule[day.key].enabled}
              onChange={(event) => update(day.key, { from: event.target.value })}
            />
            <Input
              type="time"
              step={900}
              value={schedule[day.key].to}
              disabled={!schedule[day.key].enabled}
              onChange={(event) => update(day.key, { to: event.target.value })}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

type MigrationBranch = Branch & {
  barbers: Barber[];
  services: Service[];
  products: Product[];
};

type DragPayload = {
  kind: "barber" | "service" | "product";
  id: number;
  sourceBranchId: number;
  name: string;
};

type MigrationPreview = {
  future_count: number;
  movable_count: number;
  conflict_count: number;
  conflicts: Appointment[];
};

function MigrationsAdmin({ onMessage }: { onMessage: (msg: string) => void }) {
  const [branches, setBranches] = useState<MigrationBranch[]>([]);
  const [barberMove, setBarberMove] = useState<DragPayload | null>(null);
  const [targetBranchId, setTargetBranchId] = useState<number | null>(null);
  const [barberMode, setBarberMode] = useState("with_turns");
  const [turnAction, setTurnAction] = useState("reprogram_source");
  const [targetBarberId, setTargetBarberId] = useState<number | "">("");
  const [barberPreview, setBarberPreview] = useState<MigrationPreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [blockForm, setBlockForm] = useState({
    branch_id: "",
    barber_id: "",
    starts_at: `${todayInputValue()}T09:00`,
    ends_at: `${todayInputValue()}T10:00`,
    reason: "",
  });
  const [error, setError] = useState("");

  const load = useCallback(() => api.get<ApiList<MigrationBranch>>("/admin/migrations").then((data) => setBranches(data.items)), []);
  useEffect(() => { load().catch((err) => setError(err instanceof Error ? err.message : "No se cargaron migraciones.")); }, [load]);

  function drag(event: React.DragEvent, payload: DragPayload) {
    event.dataTransfer.setData("application/json", JSON.stringify(payload));
  }

  async function drop(event: React.DragEvent, target: MigrationBranch) {
    event.preventDefault();
    const payload = JSON.parse(event.dataTransfer.getData("application/json")) as DragPayload;
    if (!payload || payload.sourceBranchId === target.id) return;
    setError("");
    if (payload.kind === "barber") {
      setBarberMove(payload);
      setTargetBranchId(target.id);
      setTargetBarberId(target.barbers[0]?.id || "");
      await loadBarberPreview(payload, target.id);
      return;
    }
    if (payload.kind === "service") {
      const result = await api.post<{ already_existed: boolean }>("/admin/migrations/services", {
        service_id: payload.id,
        target_branch_id: target.id,
      });
      onMessage(result.already_existed ? "El servicio ya estaba asociado." : "Servicio asociado a la sucursal.");
    }
    if (payload.kind === "product") {
      const initial = Number(window.prompt("Stock inicial en destino", "0") || 0);
      const result = await api.post<{ already_existed: boolean }>("/admin/migrations/products", {
        product_id: payload.id,
        target_branch_id: target.id,
        initial_stock: initial,
      });
      onMessage(result.already_existed ? "El producto ya estaba asociado." : "Producto asociado a la sucursal.");
    }
    load();
  }

  async function loadBarberPreview(payload: DragPayload, targetId: number) {
    setPreviewLoading(true);
    setBarberPreview(null);
    try {
      const result = await api.post<MigrationPreview>("/admin/migrations/barbers/preview", {
        barber_id: payload.id,
        source_branch_id: payload.sourceBranchId,
        target_branch_id: targetId,
      });
      setBarberPreview(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo calcular el desglose previo.");
    } finally {
      setPreviewLoading(false);
    }
  }

  async function confirmBarberMigration() {
    if (!barberMove || !targetBranchId) return;
    const result = await api.post<{ moved: number; reprogrammed: number; transferred: number }>("/admin/migrations/barbers", {
      barber_id: barberMove.id,
      source_branch_id: barberMove.sourceBranchId,
      target_branch_id: targetBranchId,
      mode: barberMode,
      turn_action: turnAction,
      target_barber_id: targetBarberId || null,
    });
    onMessage(`Barbero migrado. ${result.moved} turnos migrados, ${result.transferred} transferidos, ${result.reprogrammed} a reprogramar.`);
    setBarberMove(null);
    setTargetBranchId(null);
    setBarberPreview(null);
    load();
  }

  async function createBlock(event: React.FormEvent) {
    event.preventDefault();
    const result = await api.post<{ affected_count: number }>("/admin/schedule-blocks", {
      ...blockForm,
      branch_id: Number(blockForm.branch_id),
      barber_id: blockForm.barber_id ? Number(blockForm.barber_id) : null,
    });
    onMessage(`Bloqueo creado. ${result.affected_count} turnos enviados a A reprogramar.`);
  }

  const targetBranch = branches.find((branch) => branch.id === targetBranchId);
  const selectedBranchBarbers = branches.find((branch) => branch.id === Number(blockForm.branch_id))?.barbers ?? [];

  return (
    <section className="grid gap-5">
      {error ? <ErrorState message={error} onDismiss={() => setError("")} /> : null}
      <section className="rounded-lg border border-black/10 bg-white p-4 shadow-soft">
        <h2 className="text-lg font-bold text-ink">Bloqueos de agenda</h2>
        <form onSubmit={createBlock} className="mt-3 grid gap-3 sm:grid-cols-3">
          <Field label="Sucursal">
            <Select value={blockForm.branch_id} onChange={(event) => setBlockForm({ ...blockForm, branch_id: event.target.value, barber_id: "" })} required>
              <option value="">Seleccionar</option>
              {branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
            </Select>
          </Field>
          <Field label="Barbero">
            <Select value={blockForm.barber_id} onChange={(event) => setBlockForm({ ...blockForm, barber_id: event.target.value })}>
              <option value="">Toda la sucursal</option>
              {selectedBranchBarbers.map((barber) => <option key={barber.id} value={barber.id}>{barber.full_name}</option>)}
            </Select>
          </Field>
          <Field label="Motivo"><Input value={blockForm.reason} onChange={(event) => setBlockForm({ ...blockForm, reason: event.target.value })} /></Field>
          <Field label="Desde"><Input type="datetime-local" value={blockForm.starts_at} onChange={(event) => setBlockForm({ ...blockForm, starts_at: event.target.value })} /></Field>
          <Field label="Hasta"><Input type="datetime-local" value={blockForm.ends_at} onChange={(event) => setBlockForm({ ...blockForm, ends_at: event.target.value })} /></Field>
          <div className="flex items-end"><Button type="submit">Crear bloqueo</Button></div>
        </form>
      </section>

      <div className="grid gap-4 xl:grid-cols-2">
        {branches.map((branch) => (
          <article
            key={branch.id}
            className="rounded-lg border border-black/10 bg-white p-4 shadow-soft"
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => drop(event, branch).catch((err) => setError(err instanceof Error ? err.message : "No se pudo migrar."))}
          >
            <h2 className="text-xl font-bold text-ink">{branch.name}</h2>
            <p className="text-sm text-steel">{branch.address}</p>
            <MigrationList title="Barberos" items={branch.barbers} kind="barber" sourceBranchId={branch.id} onDrag={drag} />
            <MigrationList title="Servicios" items={branch.services} kind="service" sourceBranchId={branch.id} onDrag={drag} />
            <MigrationList title="Productos" items={branch.products} kind="product" sourceBranchId={branch.id} onDrag={drag} />
          </article>
        ))}
      </div>

      {barberMove && targetBranch ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4">
          <section className="w-full max-w-lg rounded-lg bg-white p-5 shadow-soft">
            <h3 className="text-lg font-bold text-ink">Migrar barbero</h3>
            <p className="mt-2 text-sm text-steel">{barberMove.name} hacia {targetBranch.name}</p>
            <div className="mt-4 grid gap-3">
              <Field label="Modo">
                <Select value={barberMode} onChange={(event) => setBarberMode(event.target.value)}>
                  <option value="with_turns">Migrar barbero con sus turnos</option>
                  <option value="without_turns">Migrar barbero sin sus turnos</option>
                </Select>
              </Field>
              {barberMode === "without_turns" ? (
                <>
                  <Field label="Que hacer con turnos futuros">
                    <Select value={turnAction} onChange={(event) => setTurnAction(event.target.value)}>
                      <option value="reprogram_source">A reprogramar en sucursal original</option>
                      <option value="reprogram_target">A reprogramar en sucursal nueva</option>
                      <option value="transfer">Transferir a otro barbero</option>
                    </Select>
                  </Field>
                  {turnAction === "transfer" ? (
                    <Field label="Barbero destino">
                      <Select value={targetBarberId} onChange={(event) => setTargetBarberId(Number(event.target.value))}>
                        {targetBranch.barbers.map((barber) => <option key={barber.id} value={barber.id}>{barber.full_name}</option>)}
                      </Select>
                    </Field>
                  ) : null}
                </>
              ) : null}
              <div className="rounded-md border border-black/10 bg-smoke p-3 text-sm text-ink">
                <p className="font-bold">Desglose previo</p>
                {previewLoading ? (
                  <p className="mt-2 text-steel">Calculando conflictos...</p>
                ) : barberPreview ? (
                  <div className="mt-2 grid gap-2">
                    <div className="grid gap-2 sm:grid-cols-3">
                      <span className="rounded-md bg-white p-2"><b>{barberPreview.future_count}</b><br />turnos futuros</span>
                      <span className="rounded-md bg-white p-2"><b>{barberPreview.movable_count}</b><br />migran directo</span>
                      <span className="rounded-md bg-white p-2"><b>{barberPreview.conflict_count}</b><br />a reprogramar</span>
                    </div>
                    {barberMode === "without_turns" ? (
                      <p className="text-xs text-steel">
                        En este modo los turnos no acompanan al barbero. La accion elegida abajo define si quedan a reprogramar o se transfieren.
                      </p>
                    ) : null}
                    {barberPreview.conflicts.length ? (
                      <div className="rounded-md bg-white p-2">
                        <p className="mb-1 text-xs font-bold uppercase tracking-[0.18em] text-steel">Conflictos principales</p>
                        {barberPreview.conflicts.slice(0, 5).map((appointment) => (
                          <p key={appointment.id} className="text-xs">
                            #{appointment.id} - {new Date(appointment.starts_at).toLocaleString("es-AR", { dateStyle: "short", timeStyle: "short" })} - {appointment.client?.full_name || `Cliente #${appointment.client_id}`}
                          </p>
                        ))}
                        {barberPreview.conflicts.length > 5 ? <p className="text-xs text-steel">Y {barberPreview.conflicts.length - 5} mas.</p> : null}
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <p className="mt-2 text-steel">Sin desglose disponible.</p>
                )}
              </div>
            </div>
            <div className="mt-5 flex gap-2">
              <Button type="button" onClick={confirmBarberMigration} disabled={previewLoading}>Confirmar migracion</Button>
              <Button type="button" variant="secondary" onClick={() => { setBarberMove(null); setBarberPreview(null); }}>Cancelar</Button>
            </div>
          </section>
        </div>
      ) : null}
    </section>
  );
}

function MigrationList({
  title,
  items,
  kind,
  sourceBranchId,
  onDrag,
}: {
  title: string;
  items: Array<Barber | Service | Product>;
  kind: DragPayload["kind"];
  sourceBranchId: number;
  onDrag: (event: React.DragEvent, payload: DragPayload) => void;
}) {
  return (
    <div className="mt-4 rounded-md border border-black/10 p-3">
      <p className="mb-2 text-sm font-bold uppercase tracking-[0.18em] text-steel">{title}</p>
      <div className="grid gap-2">
        {items.length ? items.map((item) => (
          <div
            key={`${kind}-${item.id}`}
            draggable
            onDragStart={(event) => onDrag(event, { kind, id: item.id, sourceBranchId, name: "full_name" in item ? item.full_name : item.name })}
            className="cursor-grab rounded-md bg-smoke px-3 py-2 text-sm font-semibold text-ink active:cursor-grabbing"
          >
            {"full_name" in item ? item.full_name : item.name}
          </div>
        )) : <p className="text-sm text-steel">Sin elementos asociados.</p>}
      </div>
    </div>
  );
}

function BranchesAdmin({ reload, onMessage }: { reload: () => void; onMessage: (msg: string) => void }) {
  const [items, setItems] = useState<Branch[]>([]);
  const [barbers, setBarbers] = useState<Barber[]>([]);
  const [form, setForm] = useState(emptyBranchForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [selectedBarberIds, setSelectedBarberIds] = useState<number[]>([]);
  const [targetBranchIds, setTargetBranchIds] = useState<Record<number, string>>({});
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [branchError, setBranchError] = useState("");

  const load = useCallback(() => api.get<ApiList<Branch>>("/admin/branches").then((data) => setItems(data.items.filter((item) => item.is_active))), []);
  const loadBarbers = useCallback(() => api.get<ApiList<Barber>>("/barbers").then((data) => setBarbers(data.items)), []);
  useEffect(() => { load(); loadBarbers(); }, [load, loadBarbers]);

  function startEdit(branch: Branch) {
    setEditingId(branch.id);
    setForm({
      name: branch.name,
      address: branch.address,
      phone: branch.phone ?? "",
      email: branch.email ?? "",
      description: branch.description ?? "",
      image_url: branch.image_url ?? "",
      opening_hours: branch.opening_hours ?? JSON.stringify(defaultBranchSchedule),
    });
    setSelectedBarberIds(barbers.filter((barber) => barber.branch_ids?.includes(branch.id)).map((barber) => barber.id));
  }

  function resetForm() {
    setEditingId(null);
    setForm(emptyBranchForm);
    setSelectedBarberIds([]);
  }

  async function create(event: React.FormEvent) {
    event.preventDefault();
    setBranchError("");
    setConfirmOpen(true);
  }

  async function confirmCreate() {
    if (submitting) return;
    setSubmitting(true);
    setBranchError("");
    try {
      const branch = editingId
        ? await api.patch<Branch>(`/admin/branches/${editingId}`, form)
        : await api.post<Branch>("/admin/branches", form);
      await Promise.all(
        barbers.map((barber) =>
          api.post(`/admin/barbers/${barber.id}/branches`, {
            branch_ids: toggleBranchMembership(barber.branch_ids ?? [], branch.id, selectedBarberIds.includes(barber.id)),
          }),
        ),
      );
      setConfirmOpen(false);
      resetForm();
      onMessage(editingId ? "Sucursal actualizada." : "Sucursal creada.");
      load();
      loadBarbers();
      reload();
    } catch (err) {
      setBranchError(err instanceof Error ? err.message : "No se pudo guardar la sucursal.");
    } finally {
      setSubmitting(false);
    }
  }

  async function remove(branch: Branch) {
    setBranchError("");
    const targetBranchId = targetBranchIds[branch.id] ?? "";
    const confirmed = window.confirm(
      targetBranchId
        ? "Vas a migrar barberos y turnos a la sucursal destino. Los turnos que queden fuera de sus horarios habilitados pasaran a A reprogramar. Continuar?"
        : "Vas a desactivar esta sucursal. Continuar?",
    );
    if (!confirmed) return;
    const body = targetBranchId ? { target_branch_id: Number(targetBranchId) } : undefined;
    const response = await fetch(`${appConfig.apiUrl}/admin/branches/${branch.id}`, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        ...(readToken() ? { Authorization: `Bearer ${readToken()}` } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!response.ok) {
      const data = await response.json().catch(() => null);
      setBranchError(data?.message ?? "No se pudo eliminar la sucursal.");
      return;
    }
    const data = await response.json().catch(() => null);
    setTargetBranchIds((current) => {
      const next = { ...current };
      delete next[branch.id];
      return next;
    });
    onMessage(
      data?.reprogrammed_count
        ? `Sucursal desactivada. ${data.reprogrammed_count} turnos pasaron a A reprogramar.`
        : "Sucursal desactivada.",
    );
    load();
    loadBarbers();
    reload();
  }

  return (
    <CrudSection
      title="Sucursales"
      items={items.map((item) => (
        <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
          <div>
            <p className="font-bold text-ink">{item.name}</p>
            <p>{item.address}</p>
            <p>{item.barber_count ?? 0} barberos / {item.appointment_count ?? 0} turnos</p>
          </div>
          <div className="flex flex-wrap items-start gap-2">
            <Button type="button" variant="secondary" onClick={() => startEdit(item)}>Editar</Button>
            <Select
              className="max-w-48"
              value={targetBranchIds[item.id] ?? ""}
              onChange={(event) => setTargetBranchIds((current) => ({ ...current, [item.id]: event.target.value }))}
              title="Los turnos fuera del horario de destino pasan a A reprogramar"
            >
              <option value="">Migrar a...</option>
              {items.filter((branch) => branch.id !== item.id && branch.is_active).map((branch) => (
                <option key={branch.id} value={branch.id}>{branch.name}</option>
              ))}
            </Select>
            <Button type="button" variant="danger" onClick={() => remove(item)}>
              {targetBranchIds[item.id] ? "Migrar y desactivar" : "Eliminar"}
            </Button>
            {targetBranchIds[item.id] ? (
              <p className="basis-full text-xs text-steel">Los turnos fuera del horario destino pasan a A reprogramar.</p>
            ) : null}
          </div>
        </div>
      ))}
    >
      <form onSubmit={create} className="grid gap-3 sm:grid-cols-2">
        {branchError ? <div className="sm:col-span-2"><ErrorState message={branchError} onDismiss={() => setBranchError("")} /></div> : null}
        <Field label="Nombre"><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></Field>
        <Field label="Direccion"><Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} required /></Field>
        <Field label="Telefono"><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field>
        <Field label="Email"><Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
        <Textarea placeholder="Descripcion" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        <ImageUploader value={form.image_url} onChange={(url) => setForm({ ...form, image_url: url })} />
        <BranchHoursEditor value={form.opening_hours} onChange={(opening_hours) => setForm({ ...form, opening_hours })} />
        <div className="sm:col-span-2 rounded-md border border-black/10 p-3">
          <p className="mb-2 text-sm font-bold text-ink">Barberos asociados</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {barbers.map((barber) => (
              <label key={barber.id} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={selectedBarberIds.includes(barber.id)}
                  onChange={() => setSelectedBarberIds((current) => toggleNumberValue(current, barber.id))}
                />
                {barber.full_name}
              </label>
            ))}
          </div>
        </div>
        <div className="flex gap-2 sm:col-span-2">
          <Button type="submit" disabled={submitting}>{editingId ? "Guardar cambios" : "Crear sucursal"}</Button>
          {editingId ? <Button type="button" variant="secondary" onClick={resetForm}>Cancelar</Button> : null}
        </div>
      </form>
      {confirmOpen ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4">
          <section className="w-full max-w-md rounded-lg bg-white p-5 shadow-soft">
            <h3 className="text-lg font-bold text-ink">{editingId ? "Confirmar cambios" : "Confirmar sucursal"}</h3>
            <p className="mt-2 text-sm leading-6 text-steel">
              Revisá que los datos de la sucursal estén correctos antes de guardar. Esto evita crear sucursales duplicadas por error.
            </p>
            <div className="mt-4 rounded-md bg-smoke p-3 text-sm text-ink">
              <p><strong>Nombre:</strong> {form.name || "-"}</p>
              <p><strong>Dirección:</strong> {form.address || "-"}</p>
              <p><strong>Teléfono:</strong> {form.phone || "-"}</p>
            </div>
            {branchError ? <div className="mt-3"><ErrorState message={branchError} onDismiss={() => setBranchError("")} /></div> : null}
            <div className="mt-5 flex flex-wrap gap-2">
              <Button type="button" disabled={submitting} onClick={confirmCreate}>
                {submitting ? "Guardando..." : "Aceptar"}
              </Button>
              <Button type="button" variant="secondary" disabled={submitting} onClick={() => setConfirmOpen(false)}>
                Cancelar
              </Button>
            </div>
          </section>
        </div>
      ) : null}
    </CrudSection>
  );
}

function toggleBranchMembership(current: number[], branchId: number, shouldInclude: boolean) {
  const without = current.filter((item) => item !== branchId);
  return shouldInclude ? [...without, branchId] : without;
}

function ServicesAdmin({ branches, onMessage }: { branches: Branch[]; onMessage: (msg: string) => void }) {
  const [items, setItems] = useState<Service[]>([]);
  const [form, setForm] = useState({ name: "", duration_minutes: 45, price: 0, service_type: "main", description: "", image_url: "", branch_ids: [] as number[] });
  const [editingId, setEditingId] = useState<number | null>(null);
  const [success, setSuccess] = useState("");
  const load = useCallback(() => api.get<ApiList<Service>>("/admin/services").then((data) => setItems(data.items)), []);
  useEffect(() => { load(); }, [load]);
  function edit(service: Service) {
    setEditingId(service.id);
    setForm({
      name: service.name,
      duration_minutes: service.duration_minutes,
      price: Number(service.price),
      service_type: service.service_type,
      description: service.description ?? "",
      image_url: service.image_url ?? "",
      branch_ids: service.branch_ids ?? [],
    });
  }
  async function create(event: React.FormEvent) {
    event.preventDefault();
    const service = editingId
      ? await api.patch<Service>(`/admin/services/${editingId}`, form)
      : await api.post<Service>("/admin/services", form);
    await api.post(`/admin/services/${service.id}/branches`, { branch_ids: form.branch_ids });
    setItems((current) => [{ ...service, branch_ids: form.branch_ids }, ...current.filter((item) => item.id !== service.id)]);
    setForm({ name: "", duration_minutes: 45, price: 0, service_type: "main", description: "", image_url: "", branch_ids: [] });
    setEditingId(null);
    setSuccess(editingId ? "Servicio actualizado correctamente." : "Servicio creado correctamente.");
    onMessage(editingId ? "Servicio actualizado." : "Servicio creado.");
  }
  return (
    <CrudSection title="Servicios y extras" items={items.map((item) => (
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span>{item.name} - {item.service_type} - {money(item.price)}</span>
        <Button type="button" variant="secondary" onClick={() => edit(item)}>Editar</Button>
      </div>
    ))}>
      <form onSubmit={create} className="grid gap-3 sm:grid-cols-2">
        <Field label="Nombre"><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></Field>
        <Field label="Duracion en minutos"><Input type="number" value={form.duration_minutes} onChange={(e) => setForm({ ...form, duration_minutes: Number(e.target.value) })} required /></Field>
        <Field label="Precio de venta"><Input type="number" value={form.price} onChange={(e) => setForm({ ...form, price: Number(e.target.value) })} required /></Field>
        <Field label="Tipo de servicio">
          <Select value={form.service_type} onChange={(e) => setForm({ ...form, service_type: e.target.value })}>
            <option value="main">Principal</option>
            <option value="extra">Extra</option>
            <option value="both">Ambos</option>
          </Select>
        </Field>
        <div className="sm:col-span-2 rounded-md border border-black/10 p-3">
          <p className="mb-2 text-sm font-bold text-ink">Sucursales donde esta disponible</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {branches.map((branch) => (
              <label key={branch.id} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.branch_ids.includes(branch.id)}
                  onChange={() => setForm({ ...form, branch_ids: toggleNumberValue(form.branch_ids, branch.id) })}
                />
                {branch.name}
              </label>
            ))}
          </div>
        </div>
        <div className="sm:col-span-2"><Field label="Descripcion"><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field></div>
        <div className="sm:col-span-2">
          <Field label="Imagen del servicio"><ImageUploader value={form.image_url} onChange={(url) => setForm({ ...form, image_url: url })} /></Field>
          <p className="mt-2 text-xs text-steel">Cloudinary usa variables de backend: CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY y CLOUDINARY_API_SECRET.</p>
        </div>
        <div className="sm:col-span-2">
          <Button type="submit">{editingId ? "Guardar servicio" : "Crear servicio"}</Button>
          {editingId ? <Button className="ml-2" type="button" variant="secondary" onClick={() => { setEditingId(null); setForm({ name: "", duration_minutes: 45, price: 0, service_type: "main", description: "", image_url: "", branch_ids: [] }); }}>Cancelar</Button> : null}
          {success ? <p className="mt-2 text-sm font-medium text-green-700">{success}</p> : null}
        </div>
      </form>
    </CrudSection>
  );
}

function ProductsAdmin({ branches, onMessage }: { branches: Branch[]; onMessage: (msg: string) => void }) {
  const [branchId, setBranchId] = useState("");
  const [items, setItems] = useState<Product[]>([]);
  const [form, setForm] = useState({ name: "", sku: "", sale_price: 0, unit_cost: 0, image_url: "" });
  const [adjust, setAdjust] = useState({ product_id: "", quantity: 0 });
  const load = useCallback(() => api.get<ApiList<Product>>("/admin/products", { query: { branch_id: branchId } }).then((data) => setItems(data.items)), [branchId]);
  useEffect(() => { load(); }, [load]);
  async function create(event: React.FormEvent) {
    event.preventDefault();
    await api.post("/admin/products", form);
    setForm({ name: "", sku: "", sale_price: 0, unit_cost: 0, image_url: "" });
    onMessage("Producto creado.");
    load();
  }
  async function adjustStock(event: React.FormEvent) {
    event.preventDefault();
    if (!branchId || !adjust.product_id) return;
    const selected = items.find((item) => item.id === Number(adjust.product_id));
    if (selected?.stock && selected.stock.current_stock + adjust.quantity < 0) {
      onMessage("El ajuste deja el stock en negativo.");
      return;
    }
    await api.post(`/admin/products/${adjust.product_id}/stock-adjustment`, { branch_id: Number(branchId), quantity: adjust.quantity });
    onMessage("Stock ajustado.");
    load();
  }
  return (
    <CrudSection title="Productos y stock" items={items.map((item) => `${item.name} - ${money(item.sale_price)} - stock ${item.stock?.current_stock ?? "-"}`)}>
      <div className="grid gap-5">
        <Field label="Sucursal para stock">
          <Select value={branchId} onChange={(e) => setBranchId(e.target.value)}>
            <option value="">Todas</option>
            {branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
          </Select>
        </Field>
        <form onSubmit={create} className="grid gap-3 sm:grid-cols-2">
          <Field label="Nombre"><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></Field>
          <Field label="SKU / codigo interno"><Input value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} /></Field>
          <Field label="Precio de venta"><Input type="number" value={form.sale_price} onChange={(e) => setForm({ ...form, sale_price: Number(e.target.value) })} required /></Field>
          <Field label="Costo unitario"><Input type="number" value={form.unit_cost} onChange={(e) => setForm({ ...form, unit_cost: Number(e.target.value) })} required /></Field>
          <Field label="Imagen del producto"><ImageUploader value={form.image_url} onChange={(url) => setForm({ ...form, image_url: url })} /></Field>
          <Button type="submit">Crear producto</Button>
        </form>
        <form onSubmit={adjustStock} className="grid gap-3 sm:grid-cols-3">
          <Field label="Producto">
            <Select value={adjust.product_id} onChange={(e) => setAdjust({ ...adjust, product_id: e.target.value })}>
              <option value="">Producto</option>
              {items.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </Select>
          </Field>
          <Field label="Cantidad (+ suma / - descuenta)"><Input type="number" value={adjust.quantity} onChange={(e) => setAdjust({ ...adjust, quantity: Number(e.target.value) })} /></Field>
          <Button type="submit" variant="secondary">Ajustar stock</Button>
        </form>
      </div>
    </CrudSection>
  );
}

function ClientsAdmin() {
  const [q, setQ] = useState("");
  const [items, setItems] = useState<Client[]>([]);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState({ full_name: "", email: "", phone: "", dni: "", profile_image_url: "", notes: "" });
  async function search() {
    const data = await api.get<ApiList<Client>>("/clients/search", { query: { q } });
    setItems(data.items);
  }
  async function save(event: React.FormEvent) {
    event.preventDefault();
    const saved = editingId
      ? await api.patch<Client>(`/clients/${editingId}`, form)
      : await api.post<Client>("/clients", form);
    setItems((current) => [saved, ...current.filter((item) => item.id !== saved.id)]);
    setEditingId(null);
    setForm({ full_name: "", email: "", phone: "", dni: "", profile_image_url: "", notes: "" });
  }
  function edit(client: Client) {
    setEditingId(client.id);
    setForm({
      full_name: client.full_name,
      email: client.email,
      phone: client.phone,
      dni: client.dni ?? "",
      profile_image_url: client.profile_image_url ?? "",
      notes: client.notes ?? "",
    });
  }
  return (
    <CrudSection
      title="Clientes"
      items={items.map((item) => (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span>{item.full_name} - {item.email} - {item.phone}</span>
          <Button type="button" variant="secondary" onClick={() => edit(item)}>Editar</Button>
        </div>
      ))}
    >
      <div className="grid gap-4">
        <div className="flex gap-2">
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar cliente" />
        <Button type="button" onClick={search}>Buscar</Button>
        </div>
        <form onSubmit={save} className="grid gap-3 sm:grid-cols-2">
          <Field label="Nombre completo"><Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} required /></Field>
          <Field label="Email"><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required /></Field>
          <Field label="Telefono"><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} required /></Field>
          <Field label="DNI"><Input value={form.dni} onChange={(e) => setForm({ ...form, dni: e.target.value })} /></Field>
          <div className="sm:col-span-2"><Field label="Foto del cliente"><ImageUploader value={form.profile_image_url} onChange={(url) => setForm({ ...form, profile_image_url: url })} /></Field></div>
          <div className="sm:col-span-2"><Field label="Notas"><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></Field></div>
          <Button type="submit">{editingId ? "Guardar cliente" : "Crear cliente"}</Button>
        </form>
      </div>
    </CrudSection>
  );
}

function BarbersAdmin({ branches, onMessage }: { branches: Branch[]; onMessage: (msg: string) => void }) {
  const [items, setItems] = useState<Barber[]>([]);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState({ full_name: "", email: "", phone: "", address: "", profile_image_url: "", branch_ids: [] as number[] });
  const [availability, setAvailability] = useState<Record<number, { useFull: boolean; days: BranchSchedule }>>({});
  const load = useCallback(() => api.get<ApiList<Barber>>("/barbers").then((data) => setItems(data.items)), []);
  useEffect(() => { load(); }, [load]);
  function defaultAvailability(branch: Branch) {
    return { useFull: true, days: parseBranchSchedule(branch.opening_hours) };
  }
  function ensureAvailability(branchIds: number[]) {
    setAvailability((current) => {
      const next = { ...current };
      branchIds.forEach((branchId) => {
        const branch = branches.find((item) => item.id === branchId);
        if (branch && !next[branchId]) next[branchId] = defaultAvailability(branch);
      });
      return next;
    });
  }
  async function edit(barber: Barber) {
    setEditingId(barber.id);
    const activeBranchIds = new Set(branches.map((branch) => branch.id));
    const branchIds = (barber.branch_ids ?? []).filter((branchId) => activeBranchIds.has(branchId));
    setForm({
      full_name: barber.full_name,
      email: barber.email ?? "",
      phone: barber.phone ?? "",
      address: barber.address ?? "",
      profile_image_url: barber.profile_image_url ?? "",
      branch_ids: branchIds,
    });
    const data = await api.get<ApiList<BarberAvailability>>("/admin/barber-availabilities", { query: { barber_id: barber.id } });
    const next: Record<number, { useFull: boolean; days: BranchSchedule }> = {};
    branchIds.forEach((branchId) => {
      const branch = branches.find((item) => item.id === branchId);
      if (branch) next[branchId] = defaultAvailability(branch);
    });
    data.items.forEach((row) => {
      const branch = branches.find((item) => item.id === row.branch_id);
      if (!branch) return;
      if (!next[row.branch_id]) next[row.branch_id] = defaultAvailability(branch);
      next[row.branch_id].useFull = false;
      const key = weekDays[row.weekday]?.key;
      if (key) next[row.branch_id].days[key] = { enabled: true, from: row.start_time, to: row.end_time };
    });
    setAvailability(next);
  }
  async function create(event: React.FormEvent) {
    event.preventDefault();
    const barber = editingId
      ? await api.patch<Barber>(`/admin/barbers/${editingId}`, form)
      : await api.post<Barber>("/admin/barbers", form);
    await api.post(`/admin/barbers/${barber.id}/branches`, { branch_ids: form.branch_ids });
    await Promise.all(form.branch_ids.map((branchId) => {
      const config = availability[branchId] ?? defaultAvailability(branches.find((branch) => branch.id === branchId)!);
      return api.post(`/admin/barbers/${barber.id}/availability`, {
        branch_id: branchId,
        use_full_schedule: config.useFull,
        items: weekDays.map((day, weekday) => ({
          weekday,
          enabled: config.days[day.key]?.enabled,
          start_time: config.days[day.key]?.from,
          end_time: config.days[day.key]?.to,
        })),
      });
    }));
    setForm({ full_name: "", email: "", phone: "", address: "", profile_image_url: "", branch_ids: [] });
    setAvailability({});
    setEditingId(null);
    onMessage(editingId ? "Barbero actualizado." : "Barbero creado.");
    load();
  }
  function toggleBranch(branchId: number) {
    const nextIds = toggleNumberValue(form.branch_ids, branchId);
    setForm({ ...form, branch_ids: nextIds });
    ensureAvailability(nextIds);
  }
  function updateAvailability(branchId: number, patch: Partial<{ useFull: boolean; days: BranchSchedule }>) {
    setAvailability((current) => ({ ...current, [branchId]: { ...(current[branchId] ?? defaultAvailability(branches.find((branch) => branch.id === branchId)!)), ...patch } }));
  }
  function updateAvailabilityDay(branchId: number, dayKey: string, patch: Partial<BranchScheduleDay>) {
    const current = availability[branchId] ?? defaultAvailability(branches.find((branch) => branch.id === branchId)!);
    updateAvailability(branchId, { days: { ...current.days, [dayKey]: { ...current.days[dayKey], ...patch } } });
  }
  return (
    <CrudSection
      title="Barberos"
      items={items.map((item) => (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span>{item.full_name} - {item.email || ""}</span>
          <Button type="button" variant="secondary" onClick={() => edit(item)}>Editar</Button>
        </div>
      ))}
    >
      <form onSubmit={create} className="grid gap-3 sm:grid-cols-2">
        <Field label="Nombre"><Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} required /></Field>
        <Field label="Email"><Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
        <Field label="Telefono"><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field>
        <Field label="Direccion"><Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></Field>
        <div className="sm:col-span-2"><Field label="Foto personal"><ImageUploader value={form.profile_image_url} onChange={(url) => setForm({ ...form, profile_image_url: url })} /></Field></div>
        <div className="sm:col-span-2 rounded-md border border-black/10 p-3">
          <p className="mb-2 text-sm font-bold text-ink">Sucursales donde trabaja</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {branches.map((branch) => (
              <label key={branch.id} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.branch_ids.includes(branch.id)}
                  onChange={() => toggleBranch(branch.id)}
                />
                {branch.name}
              </label>
            ))}
          </div>
        </div>
        {form.branch_ids.map((branchId) => {
          const branch = branches.find((item) => item.id === branchId);
          if (!branch) return null;
          const config = availability[branchId] ?? defaultAvailability(branch);
          const branchSchedule = parseBranchSchedule(branch.opening_hours);
          return (
            <div key={branchId} className="sm:col-span-2 rounded-md border border-black/10 p-3">
              <label className="flex items-center gap-2 text-sm font-bold text-ink">
                <input type="checkbox" checked={config.useFull} onChange={(event) => updateAvailability(branchId, { useFull: event.target.checked })} />
                Usa horario completo de {branch.name}
              </label>
              {!config.useFull ? (
                <div className="mt-3 grid gap-2">
                  {weekDays.map((day) => (
                    <div key={day.key} className="grid items-center gap-2 rounded-md bg-smoke p-2 sm:grid-cols-[140px_1fr_1fr]">
                      <label className="flex items-center gap-2 text-sm">
                        <input checked={config.days[day.key]?.enabled} type="checkbox" onChange={(event) => updateAvailabilityDay(branchId, day.key, { enabled: event.target.checked })} />
                        {day.label}
                      </label>
                      <Input type="time" min={branchSchedule[day.key]?.from} max={branchSchedule[day.key]?.to} value={config.days[day.key]?.from || branchSchedule[day.key]?.from} onChange={(event) => updateAvailabilityDay(branchId, day.key, { from: event.target.value })} />
                      <Input type="time" min={branchSchedule[day.key]?.from} max={branchSchedule[day.key]?.to} value={config.days[day.key]?.to || branchSchedule[day.key]?.to} onChange={(event) => updateAvailabilityDay(branchId, day.key, { to: event.target.value })} />
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          );
        })}
        <Button className="sm:col-span-2" type="submit">{editingId ? "Guardar barbero" : "Crear barbero"}</Button>
      </form>
    </CrudSection>
  );
}

function UsersAdmin({ branches, onMessage }: { branches: Branch[]; onMessage: (msg: string) => void }) {
  const [items, setItems] = useState<User[]>([]);
  const [filters, setFilters] = useState({ q: "", role: "" });
  const [form, setForm] = useState({ full_name: "", email: "", password: "", confirm_password: "", role: "recepcion", branch_id: "", can_apply_discounts: false });
  const [error, setError] = useState("");
  const load = useCallback(() => api.get<ApiList<User>>("/admin/users", { query: filters }).then((data) => setItems(data.items)), [filters]);
  useEffect(() => { load(); }, [load]);
  const discountDisabled = form.role === "cliente" || form.role === "barbero";
  async function create(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    if (form.password !== form.confirm_password) {
      setError("Las contraseñas no coinciden.");
      return;
    }
    await api.post("/admin/users", {
      ...form,
      branch_id: form.branch_id ? Number(form.branch_id) : null,
      can_apply_discounts: discountDisabled ? false : form.can_apply_discounts,
    });
    setForm({ full_name: "", email: "", password: "", confirm_password: "", role: "recepcion", branch_id: "", can_apply_discounts: false });
    onMessage("Usuario creado.");
    load();
  }
  return (
    <CrudSection title="Usuarios" items={items.map((item) => `${item.full_name} - ${item.email} - ${item.role}`)}>
      {error ? <ErrorState message={error} /> : null}
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Buscar"><Input value={filters.q} onChange={(e) => setFilters({ ...filters, q: e.target.value })} /></Field>
        <Field label="Tipo de usuario">
          <Select value={filters.role} onChange={(e) => setFilters({ ...filters, role: e.target.value })}>
            <option value="">Todos</option>
            <option value="recepcion">Recepcion</option>
            <option value="barbero">Barbero</option>
            <option value="cliente">Cliente</option>
            <option value="admin">Admin</option>
          </Select>
        </Field>
      </div>
      <form onSubmit={create} className="grid gap-3 sm:grid-cols-2">
        <Field label="Nombre"><Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} required /></Field>
        <Field label="Email"><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required /></Field>
        <Field label="Contraseña"><Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required /></Field>
        <Field label="Confirmar contraseña"><Input type="password" value={form.confirm_password} onChange={(e) => setForm({ ...form, confirm_password: e.target.value })} required /></Field>
        <Field label="Tipo de usuario">
          <Select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value, can_apply_discounts: e.target.value === "cliente" || e.target.value === "barbero" ? false : form.can_apply_discounts })}>
            <option value="recepcion">Recepcion</option>
            <option value="barbero">Barbero</option>
            <option value="cliente">Cliente</option>
            <option value="admin">Admin</option>
          </Select>
        </Field>
        <Field label="Sucursal asociada">
          <Select value={form.branch_id} onChange={(e) => setForm({ ...form, branch_id: e.target.value })}>
            <option value="">Sin sucursal</option>
            {branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
          </Select>
        </Field>
        <label className="flex items-center gap-2 text-sm">
          <input disabled={discountDisabled} checked={!discountDisabled && form.can_apply_discounts} type="checkbox" onChange={(e) => setForm({ ...form, can_apply_discounts: e.target.checked })} />
          Puede aplicar descuentos
        </label>
        <Button type="submit">Crear usuario</Button>
      </form>
    </CrudSection>
  );
}

function ExpenseAdmin({ branches, onMessage }: { branches: Branch[]; onMessage: (msg: string) => void }) {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<{ name: string }[]>([]);
  const [amountText, setAmountText] = useState("0");
  const [form, setForm] = useState({
    branch_id: "",
    category: "",
    new_category: "",
    description: "",
    expense_date: todayInputValue(),
    adds_stock: false,
    stock_mode: "existing",
    product_id: "",
    stock_quantity: 1,
    new_product_name: "",
    new_product_sku: "",
    new_product_sale_price: 0,
    new_product_unit_cost: 0,
    new_product_image_url: "",
  });
  useEffect(() => {
    api.get<ApiList<Product>>("/admin/products").then((data) => setProducts(data.items));
    api.get<ApiList<{ name: string }>>("/admin/expenses/categories").then((data) => setCategories(data.items));
  }, []);
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const category = form.new_category.trim() || form.category;
    await api.post("/admin/expenses", {
      branch_id: form.branch_id ? Number(form.branch_id) : null,
      category,
      description: form.description,
      amount: parseMoneyInput(amountText),
      expense_date: form.expense_date,
      adds_stock: form.adds_stock,
      stock_mode: form.stock_mode,
      product_id: form.product_id ? Number(form.product_id) : null,
      stock_quantity: form.stock_quantity,
      new_product: {
        name: form.new_product_name,
        sku: form.new_product_sku,
        sale_price: form.new_product_sale_price,
        unit_cost: form.new_product_unit_cost || parseMoneyInput(amountText),
        image_url: form.new_product_image_url,
      },
    });
    onMessage("Gasto cargado.");
  }
  return (
    <CrudSection title="Gastos" items={[]}>
      <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2">
        <Field label="Sucursal"><Select value={form.branch_id} onChange={(e) => setForm({ ...form, branch_id: e.target.value })}><option value="">Sin sucursal</option>{branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</Select></Field>
        <Field label="Categoria existente"><Select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}><option value="">Elegir o crear nueva</option>{categories.map((category) => <option key={category.name} value={category.name}>{category.name}</option>)}</Select></Field>
        <Field label="Nueva categoria"><Input value={form.new_category} onChange={(e) => setForm({ ...form, new_category: e.target.value })} /></Field>
        <Field label="Monto"><Input inputMode="decimal" value={amountText} onChange={(e) => setAmountText(formatMoneyInput(e.target.value))} /></Field>
        <Field label="Fecha"><Input type="date" value={form.expense_date} onChange={(e) => setForm({ ...form, expense_date: e.target.value })} /></Field>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.adds_stock} onChange={(e) => setForm({ ...form, adds_stock: e.target.checked })} />Este gasto agrega stock</label>
        <div className="sm:col-span-2"><Field label="Descripcion"><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field></div>
        {form.adds_stock ? (
          <div className="grid gap-3 rounded-md border border-black/10 p-3 sm:col-span-2 sm:grid-cols-2">
            <Field label="Accion de stock"><Select value={form.stock_mode} onChange={(e) => setForm({ ...form, stock_mode: e.target.value })}><option value="existing">Incrementar producto existente</option><option value="new">Crear producto nuevo</option></Select></Field>
            <Field label="Cantidad"><Input type="number" min={1} value={form.stock_quantity} onChange={(e) => setForm({ ...form, stock_quantity: Number(e.target.value) })} /></Field>
            {form.stock_mode === "existing" ? (
              <Field label="Producto"><Select value={form.product_id} onChange={(e) => setForm({ ...form, product_id: e.target.value })}><option value="">Seleccionar</option>{products.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}</Select></Field>
            ) : (
              <>
                <Field label="Nombre del producto"><Input value={form.new_product_name} onChange={(e) => setForm({ ...form, new_product_name: e.target.value })} /></Field>
                <Field label="SKU"><Input value={form.new_product_sku} onChange={(e) => setForm({ ...form, new_product_sku: e.target.value })} /></Field>
                <Field label="Precio de venta"><Input type="number" value={form.new_product_sale_price} onChange={(e) => setForm({ ...form, new_product_sale_price: Number(e.target.value) })} /></Field>
                <Field label="Costo unitario"><Input type="number" value={form.new_product_unit_cost} onChange={(e) => setForm({ ...form, new_product_unit_cost: Number(e.target.value) })} /></Field>
                <div className="sm:col-span-2"><Field label="Imagen del producto"><ImageUploader value={form.new_product_image_url} onChange={(url) => setForm({ ...form, new_product_image_url: url })} /></Field></div>
              </>
            )}
          </div>
        ) : null}
        <Button type="submit">Guardar gasto</Button>
      </form>
    </CrudSection>
  );
}

function SalaryAdmin({ branches, onMessage }: { branches: Branch[]; onMessage: (msg: string) => void }) {
  const [barbers, setBarbers] = useState<Barber[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  useEffect(() => {
    api.get<ApiList<Barber>>("/barbers").then((data) => setBarbers(data.items));
    api.get<ApiList<User>>("/admin/users", { query: { role: "recepcion" } }).then((data) => setUsers(data.items));
  }, []);
  const [amountText, setAmountText] = useState("0");
  const [form, setForm] = useState({ branch_id: "", recipient_type: "barbero", barber_id: "", user_id: "", period_start: todayInputValue(), period_end: todayInputValue(), notes: "" });
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    await api.post("/admin/salaries", {
      ...form,
      branch_id: form.branch_id ? Number(form.branch_id) : null,
      barber_id: form.recipient_type === "barbero" ? Number(form.barber_id) : null,
      user_id: form.recipient_type === "recepcion" ? Number(form.user_id) : null,
      amount: parseMoneyInput(amountText),
    });
    onMessage("Sueldo cargado.");
  }
  return (
    <CrudSection title="Sueldos" items={[]}>
      <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2">
        <Field label="Sucursal"><Select value={form.branch_id} onChange={(e) => setForm({ ...form, branch_id: e.target.value })}><option value="">Sin sucursal</option>{branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</Select></Field>
        <Field label="Tipo de empleado"><Select value={form.recipient_type} onChange={(e) => setForm({ ...form, recipient_type: e.target.value, barber_id: "", user_id: "" })}><option value="barbero">Barberos</option><option value="recepcion">Recepcion</option></Select></Field>
        {form.recipient_type === "barbero" ? (
          <Field label="Barbero"><Select value={form.barber_id} onChange={(e) => setForm({ ...form, barber_id: e.target.value })} required><option value="">Barbero</option>{barbers.map((barber) => <option key={barber.id} value={barber.id}>{barber.full_name}</option>)}</Select></Field>
        ) : (
          <Field label="Recepcion"><Select value={form.user_id} onChange={(e) => setForm({ ...form, user_id: e.target.value })} required><option value="">Usuario recepcion</option>{users.map((user) => <option key={user.id} value={user.id}>{user.full_name}</option>)}</Select></Field>
        )}
        <Field label="Monto"><Input inputMode="decimal" value={amountText} onChange={(e) => setAmountText(formatMoneyInput(e.target.value))} /></Field>
        <Field label="Periodo desde"><Input type="date" value={form.period_start} onChange={(e) => setForm({ ...form, period_start: e.target.value })} /></Field>
        <Field label="Periodo hasta"><Input type="date" value={form.period_end} onChange={(e) => setForm({ ...form, period_end: e.target.value })} /></Field>
        <Field label="Notas"><Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></Field>
        <Button type="submit">Cargar sueldo</Button>
      </form>
    </CrudSection>
  );
}

function MoneyForm({ title, branches, endpoint, onMessage }: { title: string; branches: Branch[]; endpoint: string; onMessage: (msg: string) => void }) {
  const [form, setForm] = useState({ branch_id: "", category: "", description: "", amount: 0, expense_date: todayInputValue() });
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    await api.post(endpoint, { ...form, branch_id: form.branch_id ? Number(form.branch_id) : null });
    onMessage(`${title} cargado.`);
  }
  return (
    <CrudSection title={title} items={[]}>
      <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2">
        <Select value={form.branch_id} onChange={(e) => setForm({ ...form, branch_id: e.target.value })}>
          <option value="">Sin sucursal</option>
          {branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
        </Select>
        <Input placeholder="Categoria" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} required />
        <Input type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })} />
        <Input type="date" value={form.expense_date} onChange={(e) => setForm({ ...form, expense_date: e.target.value })} />
        <Textarea placeholder="Descripcion" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        <Button type="submit">Guardar</Button>
      </form>
    </CrudSection>
  );
}

function BackupAdmin({ onMessage }: { onMessage: (msg: string) => void }) {
  const [result, setResult] = useState("");
  async function validate(file?: File) {
    if (!file) return;
    const text = await file.text();
    const data = await api.post<{ valid: boolean; issues: string[] }>("/admin/backup/validate", JSON.parse(text));
    setResult(data.valid ? "Backup valido." : `Problemas: ${data.issues.join(", ")}`);
  }
  async function restore(file?: File) {
    if (!file) return;
    if (!window.confirm("Restaurar backup puede reemplazar datos. Ejecutar dry-run?")) return;
    const text = await file.text();
    const data = await api.post<{ message: string }>("/admin/backup/restore?dry_run=true", JSON.parse(text));
    setResult(data.message);
    onMessage("Dry-run de restauracion ejecutado.");
  }
  return (
    <section className="rounded-lg border border-black/10 bg-white p-4 shadow-soft">
      <h2 className="text-lg font-bold text-ink">Backup y restauracion</h2>
      <div className="mt-4 flex flex-col gap-3 sm:flex-row">
        <Button type="button" onClick={() => downloadProtected("/admin/backup/full", "nub-backup.json")}>
          Descargar backup JSON
        </Button>
        <label>
          <input className="sr-only" type="file" accept="application/json" onChange={(e) => validate(e.target.files?.[0])} />
          <Button type="button" variant="secondary">Validar JSON</Button>
        </label>
        <label>
          <input className="sr-only" type="file" accept="application/json" onChange={(e) => restore(e.target.files?.[0])} />
          <Button type="button" variant="danger">Restaurar dry-run</Button>
        </label>
      </div>
      {result ? <p className="mt-4 rounded-md bg-smoke p-3 text-sm text-steel">{result}</p> : null}
    </section>
  );
}

async function downloadProtected(path: string, filename: string) {
  const response = await fetch(`${appConfig.apiUrl}${path}`, {
    headers: readToken() ? { Authorization: `Bearer ${readToken()}` } : undefined,
  });
  if (!response.ok) {
    throw new Error("No se pudo descargar el archivo.");
  }
  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  window.URL.revokeObjectURL(url);
}

function CrudSection({
  title,
  items,
  children,
}: {
  title: string;
  items: React.ReactNode[];
  children: React.ReactNode;
}) {
  return (
    <section className="grid gap-5 rounded-lg border border-black/10 bg-white p-4 shadow-soft">
      <h2 className="text-lg font-bold text-ink">{title}</h2>
      {children}
      <div className="grid gap-2">
        {items.length ? (
          items.map((item, index) => (
            <div key={index} className="rounded-md bg-smoke p-3 text-sm text-steel">
              {item}
            </div>
          ))
        ) : (
          <EmptyState title="Sin registros cargados en esta vista." />
        )}
      </div>
    </section>
  );
}
