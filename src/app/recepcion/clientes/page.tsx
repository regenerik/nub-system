"use client";

import { ProtectedRoute } from "@/components/auth/protected-route";
import { PanelShell } from "@/components/layout/panel-shell";
import { ClientManager } from "@/components/reception/client-manager";

export default function ReceptionClientsPage() {
  return (
    <ProtectedRoute roles={["recepcion", "admin"]}>
      <PanelShell title="Clientes" subtitle="Busqueda, alta, edicion y baja logica de clientes.">
        <ClientManager />
      </PanelShell>
    </ProtectedRoute>
  );
}
