"use client";

import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { BookingModal } from "@/components/booking/booking-modal";
import { PublicHeader } from "@/components/layout/public-header";

export default function ReservarPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-steel">Cargando reserva...</div>}>
      <ReservarContent />
    </Suspense>
  );
}

function ReservarContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const branchId = Number(searchParams.get("branch_id")) || null;

  return (
    <>
      <PublicHeader />
      <main className="min-h-[calc(100vh-66px)] bg-smoke" />
      <BookingModal open initialBranchId={branchId} onClose={() => router.push("/")} />
    </>
  );
}
