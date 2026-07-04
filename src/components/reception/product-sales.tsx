"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/field";
import { EmptyState, ErrorState } from "@/components/ui/status";
import { api } from "@/lib/api";
import { formatMoneyInput, money, parseMoneyInput, shortDate } from "@/lib/format";
import type { Product, Sale } from "@/types/domain";

type PendingProductSale = {
  id: number;
  items: { product_id: string; quantity: number }[];
  payments: { method: string; amount: string }[];
};

export function ProductSaleCard({
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
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const total = draft.items.reduce((sum, item) => {
    const product = products.find((option) => option.id === Number(item.product_id));
    return sum + (product ? Number(product.sale_price) * item.quantity : 0);
  }, 0);

  function resetDraft() {
    setDraft({ id: Date.now(), items: [{ product_id: "", quantity: 1 }], payments: [{ method: "efectivo", amount: "" }] });
  }

  async function confirm() {
    if (!branchId || !draft.items.some((item) => item.product_id)) return;
    setSaving(true);
    setError("");
    try {
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
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo registrar la venta.");
    } finally {
      setSaving(false);
    }
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
              {error ? <ErrorState message={error} /> : null}
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
                <Button type="button" onClick={confirm} disabled={saving}>{saving ? "Registrando..." : "Confirmar compra"}</Button>
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

export function SalesHistory({ sales }: { sales: Sale[] }) {
  const [showAll, setShowAll] = useState(false);
  const [page, setPage] = useState(1);
  const pageSize = 8;
  const sorted = useMemo(
    () => [...sales].sort((a, b) => String(b.created_at ?? b.id).localeCompare(String(a.created_at ?? a.id))),
    [sales],
  );
  const latest = sorted.slice(0, 3);
  const pages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const visible = sorted.slice((page - 1) * pageSize, page * pageSize);

  return (
    <section className="rounded-lg border border-black/10 bg-white p-4 shadow-soft">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-bold text-ink">Ventas recientes</h2>
        <Button type="button" variant="secondary" onClick={() => setShowAll((current) => !current)}>
          {showAll ? "Ver ultimas 3" : "Ver mas"}
        </Button>
      </div>
      <div className="mt-4 grid gap-2">
        {(showAll ? visible : latest).length ? (showAll ? visible : latest).map((sale) => (
          <article key={sale.id} className="grid gap-2 rounded-md bg-smoke p-3 text-sm sm:grid-cols-[1fr_auto_auto]">
            <span className="font-bold text-ink">Venta #{sale.id}</span>
            <span className="text-steel">{sale.created_at ? shortDate(sale.created_at) : "-"}</span>
            <span className="font-bold text-ink">{money(sale.total)}</span>
            <span className="text-steel sm:col-span-3">Estado: {sale.status} / Cliente: {sale.client_id ?? "sin cliente"} / Turno: {sale.appointment_id ?? "sin turno"}</span>
          </article>
        )) : <EmptyState title="No hay ventas para mostrar." />}
      </div>
      {showAll ? (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Button type="button" variant="secondary" disabled={page <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))}>Anterior</Button>
          <span className="text-sm text-steel">Pagina {page} de {pages}</span>
          <Button type="button" variant="secondary" disabled={page >= pages} onClick={() => setPage((current) => Math.min(pages, current + 1))}>Siguiente</Button>
        </div>
      ) : null}
    </section>
  );
}
