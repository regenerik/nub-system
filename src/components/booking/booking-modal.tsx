"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { clsx } from "clsx";
import {
  BadgeCheck,
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  CircleUserRound,
  MapPin,
  Scissors,
  Sparkles,
  UserRound,
  X,
} from "lucide-react";
import { usePreferences } from "@/components/preferences-provider";
import { useAuth } from "@/components/auth/auth-provider";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/field";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/status";
import { api, ApiError } from "@/lib/api";
import { appConfig } from "@/lib/config";
import { appointmentStatusLabel, money, todayInputValue } from "@/lib/format";
import type { ApiList, Appointment, Barber, Branch, Client, Service } from "@/types/domain";

type Slot = {
  barber_id: number;
  starts_at: string;
  ends_at: string;
};

type AvailabilitySummaryDay = {
  date: string;
  count: number;
  closed?: boolean;
};

type BookingModalProps = {
  open: boolean;
  initialBranchId?: number | null;
  onClose: () => void;
};

const stepCount = 6;

function dateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function timeKey(value: string) {
  return new Date(value).toLocaleTimeString("es-AR", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function buildTimeGrid() {
  const times: string[] = [];
  for (let hour = 9; hour <= 20; hour += 1) {
    for (const minute of [0, 15, 30, 45]) {
      if (hour === 20 && minute > 0) continue;
      times.push(`${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`);
    }
  }
  return times;
}

const timeGrid = buildTimeGrid();

export function BookingModal({ open, initialBranchId, onClose }: BookingModalProps) {
  const { locale, t } = usePreferences();
  const { user, redirectForRole } = useAuth();
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [extras, setExtras] = useState<Service[]>([]);
  const [barbers, setBarbers] = useState<Barber[]>([]);
  const [availabilityByDate, setAvailabilityByDate] = useState<Record<string, Slot[]>>({});
  const [availabilitySummaryByDate, setAvailabilitySummaryByDate] = useState<Record<string, AvailabilitySummaryDay>>({});
  const [branchId, setBranchId] = useState<number | null>(initialBranchId ?? null);
  const [serviceId, setServiceId] = useState<number | null>(null);
  const [extraIds, setExtraIds] = useState<number[]>([]);
  const [barberId, setBarberId] = useState<number | "any">("any");
  const [monthDate, setMonthDate] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState(todayInputValue());
  const [slot, setSlot] = useState<Slot | null>(null);
  const [client, setClient] = useState({
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
    customer_comment: "",
  });
  const [success, setSuccess] = useState<Appointment | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [branchesLoading, setBranchesLoading] = useState(false);
  const [branchDataLoading, setBranchDataLoading] = useState(false);
  const [availabilityLoading, setAvailabilityLoading] = useState(false);
  const [summaryLoading, setSummaryLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setBranchesLoading(true);
    api
      .get<ApiList<Branch>>("/public/branches")
      .then((data) => {
        setBranches(data.items);
        if (initialBranchId) {
          setBranchId(initialBranchId);
          setStep(1);
        }
      })
      .catch((err) => setError(err instanceof Error ? err.message : t("No se cargaron sucursales.", "Branches could not be loaded.")))
      .finally(() => setBranchesLoading(false));
  }, [initialBranchId, open, t]);

  useEffect(() => {
    if (!branchId) return;
    setError("");
    setBranchDataLoading(true);
    Promise.all([
      api.get<ApiList<Service>>("/public/services", { query: { branch_id: branchId, type: "main" } }),
      api.get<ApiList<Service>>("/public/services", { query: { branch_id: branchId, type: "extra" } }),
      api.get<ApiList<Barber>>("/public/barbers", { query: { branch_id: branchId } }),
    ])
      .then(([mainData, extraData, barberData]) => {
        setServices(mainData.items);
        setExtras(extraData.items);
        setBarbers(barberData.items);
      })
      .catch((err) => setError(err instanceof Error ? err.message : t("No se cargaron datos.", "Data could not be loaded.")))
      .finally(() => setBranchDataLoading(false));
  }, [branchId, t]);

  const selectedBranch = branches.find((item) => item.id === branchId);
  const selectedService = services.find((item) => item.id === serviceId);
  const selectedExtras = extras.filter((item) => extraIds.includes(item.id));
  const selectedBarber = barbers.find((item) => item.id === barberId);
  const selectedDateSlots = availabilityByDate[selectedDate] ?? [];
  const maxCapacity = Math.max(1, ...Object.values(availabilitySummaryByDate).map((item) => item.count));

  const totalPrice =
    Number(selectedService?.price ?? 0) + selectedExtras.reduce((sum, item) => sum + Number(item.price), 0);
  const totalDuration =
    Number(selectedService?.duration_minutes ?? 0) +
    selectedExtras.reduce((sum, item) => sum + Number(item.duration_minutes), 0);

  const canConfirm = Boolean(client.first_name && client.last_name && client.email && client.phone && slot);

  useEffect(() => {
    if (!open || !user) return;
    const [firstName, ...rest] = user.full_name.split(" ");
    setClient((current) => ({
      ...current,
      first_name: current.first_name || firstName || "",
      last_name: current.last_name || rest.join(" "),
      email: user.email,
    }));
    if (user.role === "cliente") {
      api
        .get<Client>("/client/me/profile")
        .then((profile) => {
          setClient((current) => ({
            ...current,
            first_name: current.first_name || profile.first_name || profile.full_name?.split(" ")[0] || "",
            last_name: current.last_name || profile.last_name || profile.full_name?.split(" ").slice(1).join(" ") || "",
            email: profile.email || user.email,
            phone: current.phone || profile.phone || "",
          }));
        })
        .catch(() => undefined);
    }
  }, [open, user]);

  const calendarDays = useMemo(() => {
    const year = monthDate.getFullYear();
    const month = monthDate.getMonth();
    const first = new Date(year, month, 1);
    const firstMondayIndex = (first.getDay() + 6) % 7;
    const start = new Date(year, month, 1 - firstMondayIndex);
    return Array.from({ length: 42 }, (_, index) => {
      const day = new Date(start);
      day.setDate(start.getDate() + index);
      return day;
    });
  }, [monthDate]);

  useEffect(() => {
    if (!open || step !== 4 || !branchId || !serviceId) return;
    if (availabilityByDate[selectedDate] !== undefined) return;
    let cancelled = false;

    setAvailabilityLoading(true);
    async function loadSelectedDateAvailability() {
      try {
        const data = await api.get<ApiList<Slot>>("/public/availability", {
          query: {
            branch_id: branchId,
            service_id: serviceId,
            extra_service_ids: extraIds.map(String),
            barber_id: barberId,
            date: selectedDate,
          },
        });
        if (cancelled) return;
        setAvailabilityByDate((current) => ({
          ...current,
          [selectedDate]: data.items,
        }));
        setAvailabilitySummaryByDate((current) => ({
          ...current,
          [selectedDate]: {
            date: selectedDate,
            count: data.items.length,
          },
        }));
      } catch (err) {
        setError(err instanceof Error ? err.message : t("No se pudo cargar disponibilidad.", "Availability could not be loaded."));
      } finally {
        if (!cancelled) setAvailabilityLoading(false);
      }
    }

    loadSelectedDateAvailability();

    return () => {
      cancelled = true;
    };
    // availabilityByDate is intentionally read as a cache here; including it would restart the day load after it resolves.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    barberId,
    branchId,
    extraIds,
    open,
    selectedDate,
    serviceId,
    step,
    t,
  ]);

  useEffect(() => {
    if (!open || step !== 4 || !branchId || !serviceId) return;
    let cancelled = false;
    const month = `${monthDate.getFullYear()}-${String(monthDate.getMonth() + 1).padStart(2, "0")}`;

    setSummaryLoading(true);
    async function loadMonthSummary() {
      try {
        const data = await api.get<ApiList<AvailabilitySummaryDay>>("/public/availability-summary", {
            query: {
              branch_id: branchId,
              service_id: serviceId,
              extra_service_ids: extraIds.map(String),
              barber_id: barberId,
              month,
            },
          });
        if (cancelled) return;
        setAvailabilitySummaryByDate((current) => {
          const next = { ...current };
          data.items.forEach((item) => {
            next[item.date] = item;
          });
          return next;
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : t("No se pudo cargar disponibilidad.", "Availability could not be loaded."));
      } finally {
        if (!cancelled) setSummaryLoading(false);
      }
    }

    loadMonthSummary();

    return () => {
      cancelled = true;
    };
  }, [
    barberId,
    branchId,
    extraIds,
    monthDate,
    open,
    serviceId,
    step,
    t,
  ]);

  useEffect(() => {
    setAvailabilityByDate({});
    setAvailabilitySummaryByDate({});
    setSlot(null);
  }, [barberId, branchId, extraIds, serviceId]);

  if (!open) return null;

  function chooseBranch(id: number) {
    setBranchId(id);
    setServiceId(null);
    setExtraIds([]);
    setBarberId("any");
    setStep(1);
  }

  function chooseService(id: number) {
    setServiceId(id);
    setExtraIds([]);
    setBarberId("any");
    setStep(2);
  }

  function chooseBarber(id: number | "any") {
    setBarberId(id);
    setStep(4);
  }

  function goBack() {
    setError("");
    setStep((current) => Math.max(0, current - 1));
  }

  async function confirm() {
    if (!branchId || !serviceId || !slot) return;
    setLoading(true);
    setError("");
    try {
      const data = await api.post<{ appointment: Appointment }>("/public/appointments", {
        branch_id: branchId,
        primary_service_id: serviceId,
        extra_service_ids: extraIds,
        barber_id: barberId === "any" ? "any" : barberId,
        starts_at: slot.starts_at,
        ...client,
      });
      setSuccess(data.appointment);
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setError(t("Ese horario acaba de ser tomado. Elegi otro.", "That time was just taken. Choose another one."));
        setStep(4);
        setAvailabilityByDate({});
      } else {
        setError(err instanceof Error ? err.message : t("No se pudo confirmar el turno.", "The booking could not be confirmed."));
      }
    } finally {
      setLoading(false);
    }
  }

  const monthLabel = new Intl.DateTimeFormat(locale === "en" ? "en-US" : "es-AR", {
    month: "long",
    year: "numeric",
  }).format(monthDate);

  const footerAction =
    step === 2
      ? {
          label: t("Siguiente", "Next"),
          disabled: loading,
          onClick: () => setStep(3),
        }
      : step === 4
        ? {
            label: t("Siguiente", "Next"),
            disabled: loading || !slot,
            onClick: () => setStep(5),
          }
        : step === 5
          ? {
              label: loading ? t("Confirmando...", "Confirming...") : t("Confirmar turno", "Confirm booking"),
              disabled: loading || !canConfirm,
              onClick: confirm,
            }
          : null;

  return (
    <div className="fixed inset-0 z-40 grid place-items-center bg-black/55 px-2 py-4 backdrop-blur-sm sm:px-4">
      <section className="grid h-[94vh] max-h-[900px] w-full max-w-7xl overflow-hidden rounded-lg border border-black/10 bg-white shadow-soft lg:grid-cols-[320px_minmax(0,1fr)_360px]">
        <aside className="hidden min-h-0 bg-smoke p-8 text-center lg:grid lg:content-between">
          <div>
            <StepDots step={step} />
            <StepIcon step={step} />
            <h2 className="mt-8 text-2xl font-bold text-ink">{leftTitle(step, t)}</h2>
            <p className="mt-4 text-sm leading-6 text-steel">{leftBody(step, t)}</p>
          </div>
          <div className="text-sm text-steel">
            <p className="font-bold text-ink">{t("Preguntas?", "Questions?")}</p>
            <p className="mt-2">WhatsApp (+54) 9 11 2189 3986</p>
          </div>
        </aside>

        <main className="flex min-h-0 flex-col overflow-hidden">
          <header className="flex items-center justify-between gap-4 border-b border-black/10 px-5 py-4 sm:px-8">
            <div>
              <StepDots className="mb-2 justify-start lg:hidden" step={step} />
              <h1 className="text-2xl font-bold text-ink">{stepTitle(step, t)}</h1>
            </div>
            <button
              aria-label={t("Cerrar", "Close")}
              className="grid h-10 w-10 place-items-center rounded-md text-ink hover:bg-black/5"
              onClick={onClose}
              type="button"
            >
              <X className="h-6 w-6" />
            </button>
          </header>

          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-6 sm:px-8">
            {error ? <ErrorState message={error} /> : null}
            {success ? (
              <SuccessView
                appointment={success}
                onClose={() => {
                  if (user) {
                    onClose();
                    router.push(redirectForRole(user.role));
                    return;
                  }
                  onClose();
                }}
              />
            ) : (
              <>
                {step === 0 ? (
                  <OptionList
                    loading={branchesLoading}
                    loadingLabel={t("Cargando sedes...", "Loading branches...")}
                    items={branches}
                    empty={t("No hay sedes disponibles.", "No branches are available.")}
                    render={(branch) => (
                      <button
                        key={branch.id}
                        className="group grid w-full grid-cols-[48px_1fr_auto] items-center gap-4 rounded-lg border border-black/10 bg-white p-4 text-left transition hover:border-brass hover:bg-brass/10"
                        onClick={() => chooseBranch(branch.id)}
                        type="button"
                      >
                        <IconBubble><MapPin className="h-6 w-6" /></IconBubble>
                        <span>
                          <span className="block font-bold text-ink">{branch.name}</span>
                          <span className="mt-1 block text-sm text-steel">{branch.address}</span>
                        </span>
                        <ChevronRight className="h-5 w-5 text-steel" />
                      </button>
                    )}
                  />
                ) : null}

                {step === 1 ? (
                  <OptionList
                    loading={branchDataLoading}
                    loadingLabel={t("Cargando servicios...", "Loading services...")}
                    items={services}
                    empty={t("No hay servicios principales en esta sede.", "No main services are available at this branch.")}
                    render={(service) => (
                      <ServiceButton
                        key={service.id}
                        service={service}
                        selected={serviceId === service.id}
                        onClick={() => chooseService(service.id)}
                      />
                    )}
                  />
                ) : null}

                {step === 2 ? (
                  <div className="grid gap-4">
                    <OptionList
                      loading={branchDataLoading}
                      loadingLabel={t("Cargando extras...", "Loading extras...")}
                      items={extras}
                      empty={t("No hay extras disponibles. Podes continuar.", "No extras are available. You can continue.")}
                      render={(extra) => {
                        const selected = extraIds.includes(extra.id);
                        return (
                          <label
                            key={extra.id}
                            className={clsx(
                              "grid cursor-pointer grid-cols-[28px_48px_1fr_auto] items-center gap-4 rounded-lg border p-4 transition",
                              selected ? "border-brass bg-brass/10" : "border-black/10 bg-white hover:border-brass",
                            )}
                          >
                            <input
                              checked={selected}
                              className="h-5 w-5 accent-sage"
                              type="checkbox"
                              onChange={(event) => {
                                setExtraIds((current) =>
                                  event.target.checked
                                    ? [...current, extra.id]
                                    : current.filter((id) => id !== extra.id),
                                );
                              }}
                            />
                            <IconBubble><Sparkles className="h-6 w-6" /></IconBubble>
                            <span>
                              <span className="block font-bold text-ink">{extra.name}</span>
                              <span className="mt-1 block text-xs uppercase text-steel">{t("Opcional", "Optional")}</span>
                            </span>
                            <span className="font-bold text-ink">{money(extra.price)}</span>
                          </label>
                        );
                      }}
                    />
                  </div>
                ) : null}

                {step === 3 ? (
                  <div className="grid gap-3">
                    <button
                      className="grid w-full grid-cols-[48px_1fr_auto] items-center gap-4 rounded-lg border border-black/10 bg-white p-4 text-left transition hover:border-brass hover:bg-brass/10"
                      onClick={() => chooseBarber("any")}
                      type="button"
                    >
                      <IconBubble><UserRound className="h-6 w-6" /></IconBubble>
                      <span>
                        <span className="block font-bold text-ink">{t("Cualquiera disponible", "Any available barber")}</span>
                        <span className="mt-1 block text-sm text-steel">
                          {t("El sistema asigna un profesional libre.", "The system assigns an available professional.")}
                        </span>
                      </span>
                      <ChevronRight className="h-5 w-5 text-steel" />
                    </button>
                    <OptionList
                      loading={branchDataLoading}
                      loadingLabel={t("Cargando barberos...", "Loading barbers...")}
                      items={barbers}
                      empty={t("No hay barberos disponibles en esta sede.", "No barbers are available at this branch.")}
                      render={(barber) => (
                        <button
                          key={barber.id}
                          className="grid w-full grid-cols-[56px_1fr_auto] items-center gap-4 rounded-lg border border-black/10 bg-white p-4 text-left transition hover:border-brass hover:bg-brass/10"
                          onClick={() => chooseBarber(barber.id)}
                          type="button"
                        >
                          <span className="grid h-14 w-14 place-items-center overflow-hidden rounded-md bg-smoke text-ink">
                            {barber.profile_image_url ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img alt="" className="h-full w-full object-cover" src={barber.profile_image_url} />
                            ) : (
                              <CircleUserRound className="h-7 w-7" />
                            )}
                          </span>
                          <span>
                            <span className="block font-bold text-ink">{barber.full_name}</span>
                            <span className="mt-1 block text-sm text-steel">{barber.bio || t("Barbero NUB", "NUB barber")}</span>
                          </span>
                          <ChevronRight className="h-5 w-5 text-steel" />
                        </button>
                      )}
                    />
                  </div>
                ) : null}

                {step === 4 ? (
                  <div className="grid gap-6">
                    <div className="mx-auto w-full max-w-xl">
                      <div className="mb-4 flex items-center justify-between">
                        <button
                          className="grid h-10 w-10 place-items-center rounded-md text-steel hover:bg-black/5"
                          onClick={() => setMonthDate(new Date(monthDate.getFullYear(), monthDate.getMonth() - 1, 1))}
                          type="button"
                        >
                          <ChevronLeft className="h-5 w-5" />
                        </button>
                        <h3 className="text-lg font-bold capitalize text-ink">{monthLabel}</h3>
                        <button
                          className="grid h-10 w-10 place-items-center rounded-md text-ink hover:bg-black/5"
                          onClick={() => setMonthDate(new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 1))}
                          type="button"
                        >
                          <ChevronRight className="h-5 w-5" />
                        </button>
                      </div>
                      <div className="grid grid-cols-7 gap-2 text-center text-xs font-bold uppercase text-steel">
                        {["Lun", "Mar", "Mie", "Jue", "Vie", "Sab", "Dom"].map((day) => (
                          <span key={day}>{locale === "en" ? translateWeekday(day) : day}</span>
                        ))}
                      </div>
                      <div className="mt-2 grid grid-cols-7 gap-2">
                        {calendarDays.map((day) => {
                          const key = dateKey(day);
                          const summary = availabilitySummaryByDate[key];
                          const count = summary?.count ?? 0;
                          const hasSummary = summary !== undefined;
                          const isCurrentMonth = day.getMonth() === monthDate.getMonth();
                          const isPast = key < todayInputValue();
                          const selected = key === selectedDate;
                          const unavailable = hasSummary && count === 0;
                          return (
                            <button
                              key={key}
                              title={
                                hasSummary
                                  ? t(`${count} disponibles`, `${count} available`)
                                  : t("Toca para consultar horarios", "Tap to check times")
                              }
                              className={clsx(
                                "relative min-h-12 rounded-md text-sm font-bold transition",
                                !isCurrentMonth && "opacity-35",
                                isPast || unavailable
                                  ? "bg-smoke text-steel"
                                  : hasSummary
                                    ? capacityClass(count, maxCapacity)
                                    : "bg-white text-ink ring-1 ring-black/10 hover:bg-smoke",
                                selected && "ring-2 ring-brass",
                              )}
                              disabled={isPast || unavailable}
                              onClick={() => {
                                setSelectedDate(key);
                                setSlot(null);
                              }}
                              type="button"
                            >
                              {day.getDate()}
                              {!isPast && hasSummary && count > 0 ? (
                                <span className="absolute inset-x-2 bottom-1 h-1 rounded-full bg-sage" />
                              ) : null}
                            </button>
                          );
                        })}
                      </div>
                      {availabilityByDate[selectedDate] === undefined ? (
                        <p className="mt-3 text-center text-sm text-steel">
                          {availabilityLoading
                            ? t("Buscando horarios...", "Looking for times...")
                            : t("Toca un dia para ver horarios.", "Tap a day to see times.")}
                        </p>
                      ) : summaryLoading ? (
                        <p className="mt-3 text-center text-sm text-steel">
                          {t("Actualizando referencia del mes...", "Updating month reference...")}
                        </p>
                      ) : null}
                    </div>

                    <div className="mx-auto w-full max-w-xl border-t border-black/10 pt-5">
                      <p className="text-center text-sm text-steel">
                        {t("Elija una franja horaria para", "Choose a time for")}{" "}
                        <span className="font-bold text-ink">
                          {new Date(`${selectedDate}T12:00:00`).toLocaleDateString(locale === "en" ? "en-US" : "es-AR", {
                            day: "numeric",
                            month: "long",
                          })}
                        </span>
                      </p>
                      <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-5">
                        {timeGrid.map((time) => {
                          const available = selectedDateSlots.find((item) => timeKey(item.starts_at) === time);
                          const selected = available && slot?.starts_at === available.starts_at;
                          return (
                            <button
                              key={time}
                              className={clsx(
                                "min-h-10 rounded-md px-2 text-sm font-bold transition",
                                available
                                  ? "bg-sage/25 text-ink hover:bg-sage/35"
                                  : "cursor-not-allowed bg-smoke text-steel/60",
                                selected && "ring-2 ring-brass",
                              )}
                              disabled={!available}
                              onClick={() => available && setSlot(available)}
                              type="button"
                            >
                              {time}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                ) : null}

                {step === 5 ? (
                  <form className="grid gap-4" onSubmit={(event) => { event.preventDefault(); confirm(); }}>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Field label={t("Nombre", "First name")}>
                        <Input value={client.first_name} onChange={(event) => setClient({ ...client, first_name: event.target.value })} required />
                      </Field>
                      <Field label={t("Apellido", "Last name")}>
                        <Input value={client.last_name} onChange={(event) => setClient({ ...client, last_name: event.target.value })} required />
                      </Field>
                      <Field label={t("Telefono", "Phone")}>
                        <Input value={client.phone} onChange={(event) => setClient({ ...client, phone: event.target.value })} required />
                      </Field>
                      <Field label="Email">
                        <Input
                          disabled={Boolean(user?.email)}
                          value={client.email}
                          onChange={(event) => setClient({ ...client, email: event.target.value })}
                          type="email"
                          required
                        />
                      </Field>
                    </div>
                    <Field label={t("Comentario adicional", "Additional comment")}>
                      <Textarea value={client.customer_comment} onChange={(event) => setClient({ ...client, customer_comment: event.target.value })} />
                    </Field>
                  </form>
                ) : null}
              </>
            )}
          </div>

          {!success ? (
            <footer className="flex shrink-0 items-center justify-between gap-3 border-t border-black/10 bg-white px-5 py-3 sm:px-8">
              <Button disabled={step === 0 || loading} type="button" variant="ghost" onClick={goBack}>
                <ChevronLeft className="h-4 w-4" />
                {t("Atras", "Back")}
              </Button>
              <div className="flex items-center gap-4">
                <span className="text-xs font-bold text-steel">{step + 1}/{stepCount}</span>
                {footerAction ? (
                  <Button disabled={footerAction.disabled} loading={loading && step === 5} type="button" onClick={footerAction.onClick}>
                    {footerAction.label}
                    {step !== 5 ? <ChevronRight className="h-4 w-4" /> : null}
                  </Button>
                ) : null}
              </div>
            </footer>
          ) : null}
        </main>

        <aside className="hidden min-h-0 border-l border-black/10 bg-smoke lg:block">
          <div className="border-b border-black/10 bg-white p-5 text-right text-sm font-bold uppercase tracking-[0.3em] text-ink">
            {t("Resumen", "Summary")}
          </div>
          <div className="grid gap-6 p-8">
            <div>
              <h3 className="text-2xl font-bold uppercase leading-snug text-ink">
                {selectedService?.name || t("Tu turno", "Your booking")}
              </h3>
              {slot ? (
                <p className="mt-3 font-bold text-ink">
                  {new Date(slot.starts_at).toLocaleString(locale === "en" ? "en-US" : "es-AR", {
                    weekday: "short",
                    day: "numeric",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              ) : null}
              {selectedExtras.length ? (
                <p className="mt-4 text-sm text-steel">
                  Extras: <span className="font-bold text-ink">{selectedExtras.map((item) => item.name).join(", ")}</span>
                </p>
              ) : null}
            </div>
            <SummaryLine label={t("Profesional", "Professional")} value={selectedBarber?.full_name || (barberId === "any" ? t("Cualquiera", "Any") : "-")} />
            <SummaryLine label={t("Ubicacion", "Location")} value={selectedBranch?.name || "-"} />
            <div className="border-t border-black/20 pt-5">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-steel">{t("Desglose de costos", "Cost breakdown")}</p>
              <div className="mt-4 grid gap-2 text-sm text-ink">
                {selectedService ? <CostLine label={selectedService.name} value={selectedService.price} /> : null}
                {selectedExtras.map((extra) => <CostLine key={extra.id} label={extra.name} value={extra.price} />)}
              </div>
              <div className="mt-4 flex justify-between border-t border-black/30 pt-3 text-xl font-bold text-ink">
                <span>{t("Precio Total", "Total")}</span>
                <span>{money(totalPrice)}</span>
              </div>
              <p className="mt-2 text-xs text-steel">{totalDuration ? `${totalDuration} min` : ""}</p>
            </div>
          </div>
        </aside>
      </section>
    </div>
  );
}

function StepDots({ step, className }: { step: number; className?: string }) {
  return (
    <div className={clsx("flex justify-center gap-3", className)}>
      {Array.from({ length: stepCount }, (_, index) => (
        <span
          key={index}
          className={clsx("h-1.5 w-1.5 rounded-full", index <= step ? "bg-steel" : "bg-steel/20")}
        />
      ))}
    </div>
  );
}

function StepIcon({ step }: { step: number }) {
  const icons = [
    <MapPin key="branch" className="h-16 w-16" />,
    <Scissors key="service" className="h-16 w-16" />,
    <Sparkles key="extras" className="h-16 w-16" />,
    <CircleUserRound key="barber" className="h-16 w-16" />,
    <CalendarClock key="calendar" className="h-16 w-16" />,
    <BadgeCheck key="client" className="h-16 w-16" />,
  ];
  return <div className="mt-24 grid place-items-center text-brass">{icons[step]}</div>;
}

function leftTitle(step: number, t: (es: string, en: string) => string) {
  return [
    t("Seleccione una sede", "Choose a branch"),
    t("Seleccione un servicio", "Choose a service"),
    t("Servicios adicionales", "Additional services"),
    t("Seleccione profesional", "Choose a professional"),
    t("Seleccione fecha y horario", "Choose date and time"),
    t("Identificacion", "Identification"),
  ][step];
}

function leftBody(step: number, t: (es: string, en: string) => string) {
  return [
    t("Elegi donde queres atenderte.", "Choose where you want your appointment."),
    t("Al tocar un servicio pasas al siguiente paso.", "Tap a service to continue."),
    t("Podes sumar uno o varios extras a tu turno.", "You can add one or more extras."),
    t("Solo aparecen barberos asociados a la sede elegida.", "Only barbers assigned to the branch appear here."),
    t("Los dias mas verdes tienen mas horarios disponibles.", "Greener days have more available times."),
    t("Dejanos tus datos para confirmar la reserva.", "Leave your details to confirm your booking."),
  ][step];
}

function stepTitle(step: number, t: (es: string, en: string) => string) {
  return [
    t("Sede", "Branch"),
    t("Servicio Principal", "Main Service"),
    t("Servicios Adicionales", "Additional Services"),
    t("Profesional", "Professional"),
    t("Seleccion de Fecha & Horario", "Date & Time Selection"),
    t("Informacion del Cliente", "Client Information"),
  ][step];
}

function translateWeekday(day: string) {
  return ({ Lun: "Mon", Mar: "Tue", Mie: "Wed", Jue: "Thu", Vie: "Fri", Sab: "Sat", Dom: "Sun" } as Record<string, string>)[day];
}

function capacityClass(count: number, max: number) {
  const ratio = count / max;
  if (ratio > 0.66) return "bg-sage/25 text-ink";
  if (ratio > 0.33) return "bg-brass/25 text-ink";
  return "bg-clay/20 text-ink";
}

function IconBubble({ children }: { children: React.ReactNode }) {
  return <span className="grid h-12 w-12 place-items-center rounded-md bg-smoke text-ink">{children}</span>;
}

function OptionList<T>({
  loading = false,
  loadingLabel = "Cargando...",
  items,
  render,
  empty,
}: {
  loading?: boolean;
  loadingLabel?: string;
  items: T[];
  render: (item: T) => React.ReactNode;
  empty: string;
}) {
  if (loading) return <LoadingState title={loadingLabel} />;
  if (!items.length) return <EmptyState title={empty} />;
  return <div className="grid gap-3">{items.map(render)}</div>;
}

function ServiceButton({
  service,
  selected,
  onClick,
}: {
  service: Service;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      className={clsx(
        "grid w-full grid-cols-[48px_1fr_auto] items-center gap-4 rounded-lg border p-4 text-left transition hover:border-brass hover:bg-brass/10",
        selected ? "border-brass bg-brass/10" : "border-black/10 bg-white",
      )}
      onClick={onClick}
      type="button"
    >
      <IconBubble><Scissors className="h-6 w-6" /></IconBubble>
      <span>
        <span className="block text-lg font-bold uppercase text-ink">{service.name}</span>
        <span className="mt-1 block text-sm text-steel">{service.description || `${service.duration_minutes} min`}</span>
      </span>
      <span className="text-right">
        <span className="block font-bold text-ink">{money(service.price)}</span>
        <span className="text-xs text-steel">{service.duration_minutes} min</span>
      </span>
    </button>
  );
}

function SummaryLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 border-b border-black/10 pb-2 text-sm">
      <span className="font-bold uppercase tracking-[0.14em] text-steel">{label}</span>
      <span className="text-right font-bold text-ink">{value}</span>
    </div>
  );
}

function CostLine({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="uppercase">{label}</span>
      <span>{money(value)}</span>
    </div>
  );
}

function SuccessView({ appointment, onClose }: { appointment: Appointment; onClose: () => void }) {
  const { locale, t } = usePreferences();

  return (
    <div className="mx-auto max-w-xl rounded-lg border border-sage/30 bg-sage/10 p-6 text-center">
      <BadgeCheck className="mx-auto h-12 w-12 text-sage" />
      <h2 className="mt-4 text-2xl font-bold text-ink">{t("Turno confirmado", "Booking confirmed")}</h2>
      <p className="mt-2 text-steel">
        {appointmentStatusLabel(appointment.status, locale)} ·{" "}
        {new Date(appointment.starts_at).toLocaleString(locale === "en" ? "en-US" : "es-AR")}
      </p>
      <p className="mt-2 font-bold text-ink">{money(appointment.total_estimated)}</p>
      <div className="mt-5 flex flex-col justify-center gap-3 sm:flex-row">
        <a href={`${appConfig.backendUrl}/api/appointments/${appointment.id}/calendar.ics`}>
          <Button type="button" variant="secondary">{t("Agregar al calendario", "Add to calendar")}</Button>
        </a>
        <Button type="button" onClick={onClose}>{t("Listo", "Done")}</Button>
      </div>
    </div>
  );
}
