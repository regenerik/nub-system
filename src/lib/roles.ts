import type { RoleSummary } from "@/types/domain";

export const roles: RoleSummary[] = [
  {
    name: "Cliente",
    scope: "Reserva publica, historial propio y calendario personal.",
  },
  {
    name: "Barbero",
    scope: "Agenda propia, servicios asignados y estados permitidos.",
  },
  {
    name: "Recepcion",
    scope: "Turnos, clientes, caja, ventas y descuentos autorizados.",
  },
  {
    name: "Admin",
    scope: "Usuarios, permisos, stock, gastos, sueldos, backups y KPIs.",
  },
];
