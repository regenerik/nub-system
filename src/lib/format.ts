export function money(value?: number | string | null) {
  const amount = Number(value ?? 0);
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(amount);
}

export function shortDate(value?: string | null) {
  if (!value) {
    return "-";
  }
  return new Intl.DateTimeFormat("es-AR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

export function todayInputValue() {
  return new Date().toISOString().slice(0, 10);
}

export function formatMoneyInput(value: string) {
  const cleaned = value.replace(/[^\d,]/g, "");
  const [rawInteger, rawDecimals = ""] = cleaned.split(",");
  const integer = rawInteger.replace(/^0+(?=\d)/, "") || "0";
  const formattedInteger = Number(integer).toLocaleString("es-AR");
  return rawDecimals.length ? `${formattedInteger},${rawDecimals.slice(0, 2)}` : formattedInteger;
}

export function parseMoneyInput(value: string) {
  const normalized = value.replace(/\./g, "").replace(",", ".");
  return Number(normalized || 0);
}

const appointmentStatusLabels = {
  pending: { es: "Confirmado", en: "Confirmed" },
  confirmed: { es: "Confirmado", en: "Confirmed" },
  checked_in: { es: "En barberia", en: "Checked in" },
  completed: { es: "Completado", en: "Completed" },
  cancelled: { es: "Cancelado", en: "Cancelled" },
  no_show: { es: "Ausente", en: "No-show" },
  rescheduled: { es: "Reprogramado", en: "Rescheduled" },
  pending_reschedule: { es: "A reprogramar", en: "To reschedule" },
} as const;

export function appointmentStatusLabel(
  status?: keyof typeof appointmentStatusLabels | null,
  locale: "es" | "en" = "es",
) {
  if (!status) return locale === "en" ? "Confirmed" : "Confirmado";
  return appointmentStatusLabels[status]?.[locale] ?? status;
}
