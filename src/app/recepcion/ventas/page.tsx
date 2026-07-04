"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { PanelShell } from "@/components/layout/panel-shell";
import { ProductSaleCard, SalesHistory } from "@/components/reception/product-sales";
import { Field, Select } from "@/components/ui/field";
import { ErrorState, SuccessState } from "@/components/ui/status";
import { api } from "@/lib/api";
import type { ApiList, Branch, Product, Sale } from "@/types/domain";

export default function ReceptionSalesPage() {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [branchId, setBranchId] = useState<number | "">("");
  const [products, setProducts] = useState<Product[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const { user } = useAuth();

  const loadBranches = useCallback(async () => {
    const data = await api.get<ApiList<Branch>>("/public/branches");
    setBranches(data.items);
    setBranchId((current) => current || user?.branch_id || data.items[0]?.id || "");
  }, [user?.branch_id]);

  const loadData = useCallback(async () => {
    if (!branchId) return;
    const [productData, saleData] = await Promise.all([
      api.get<ApiList<Product>>("/admin/products", { query: { branch_id: branchId } }),
      api.get<ApiList<Sale>>("/sales", { query: { branch_id: branchId } }),
    ]);
    setProducts(productData.items);
    setSales(saleData.items);
  }, [branchId]);

  useEffect(() => {
    loadBranches().catch((err) => setError(err instanceof Error ? err.message : "No se cargaron sucursales."));
  }, [loadBranches]);

  useEffect(() => {
    loadData().catch((err) => setError(err instanceof Error ? err.message : "No se cargaron ventas."));
  }, [loadData]);

  return (
    <ProtectedRoute roles={["recepcion", "admin"]}>
      <PanelShell title="Ventas" subtitle="Venta de productos, pendientes y historial paginado.">
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
          <ProductSaleCard branchId={branchId} products={products} onDone={(doneMessage) => { setMessage(doneMessage); loadData(); }} />
          <SalesHistory sales={sales} />
        </div>
      </PanelShell>
    </ProtectedRoute>
  );
}
