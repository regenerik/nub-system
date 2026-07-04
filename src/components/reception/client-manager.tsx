"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import { EmptyState, ErrorState, SuccessState } from "@/components/ui/status";
import { api } from "@/lib/api";
import type { ApiList, Client } from "@/types/domain";

export function ClientManager() {
  const [clients, setClients] = useState<Client[]>([]);
  const [q, setQ] = useState("");
  const [sort, setSort] = useState("created_desc");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState({ full_name: "", email: "", phone: "", dni: "", birth_date: "" });
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function loadClients() {
    const data = await api.get<ApiList<Client>>("/clients");
    setClients(data.items);
  }

  useEffect(() => {
    loadClients().catch((err) => setError(err instanceof Error ? err.message : "No se cargaron clientes."));
  }, []);

  const sortedClients = [...clients].sort((a, b) => {
    if (sort === "age_asc") return String(b.birth_date ?? "").localeCompare(String(a.birth_date ?? ""));
    if (sort === "age_desc") return String(a.birth_date ?? "").localeCompare(String(b.birth_date ?? ""));
    return b.id - a.id;
  });

  async function searchClients() {
    setError("");
    if (!q.trim()) {
      await loadClients();
      return;
    }
    const data = await api.get<ApiList<Client>>("/clients/search", { query: { q } });
    setClients(data.items);
  }

  async function saveClient(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    const saved = editingId ? await api.patch<Client>(`/clients/${editingId}`, form) : await api.post<Client>("/clients", form);
    setClients((current) => [saved, ...current.filter((item) => item.id !== saved.id)]);
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
    setClients((current) => current.filter((item) => item.id !== client.id));
    setMessage("Cliente eliminado.");
  }

  return (
    <section className="rounded-lg border border-black/10 bg-white p-4 shadow-soft">
      <h2 className="text-lg font-bold text-ink">Clientes</h2>
      {message ? <SuccessState message={message} /> : null}
      {error ? <ErrorState message={error} /> : null}
      <div className="mt-4 grid gap-3">
        <div className="flex gap-2">
          <Input placeholder="Buscar por nombre, DNI, telefono o email" value={q} onChange={(event) => setQ(event.target.value)} />
          <Button type="button" variant="secondary" onClick={searchClients}>Buscar</Button>
        </div>
        <Field label="Ordenar clientes">
          <Select value={sort} onChange={(event) => setSort(event.target.value)}>
            <option value="created_desc">Fecha de creacion</option>
            <option value="age_asc">Edad de menor a mayor</option>
            <option value="age_desc">Edad de mayor a menor</option>
          </Select>
        </Field>
        <div className="grid gap-2">
          {sortedClients.length ? sortedClients.map((client) => (
            <div key={client.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-smoke p-2 text-sm">
              <span>{client.full_name} - {client.email} - {client.phone}</span>
              <span className="flex flex-wrap gap-2">
                <Button type="button" variant="secondary" onClick={() => editClient(client)}>Editar</Button>
                <Button type="button" variant="danger" onClick={() => deleteClient(client)}>Eliminar</Button>
              </span>
            </div>
          )) : <EmptyState title="No hay clientes para mostrar." />}
        </div>
        <form className="grid gap-2 sm:grid-cols-2" onSubmit={saveClient}>
          <Input placeholder="Nombre completo" value={form.full_name} onChange={(event) => setForm({ ...form, full_name: event.target.value })} required />
          <Input placeholder="Email" type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} required />
          <Input placeholder="Telefono" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} required />
          <Input placeholder="DNI" value={form.dni} onChange={(event) => setForm({ ...form, dni: event.target.value })} />
          <Input type="date" value={form.birth_date} onChange={(event) => setForm({ ...form, birth_date: event.target.value })} />
          <div className="flex flex-wrap gap-2 sm:col-span-2">
            <Button type="submit">{editingId ? "Guardar cliente" : "Crear cliente"}</Button>
            {editingId ? (
              <Button type="button" variant="secondary" onClick={() => { setEditingId(null); setForm({ full_name: "", email: "", phone: "", dni: "", birth_date: "" }); }}>
                Cancelar edicion
              </Button>
            ) : null}
          </div>
        </form>
      </div>
    </section>
  );
}
