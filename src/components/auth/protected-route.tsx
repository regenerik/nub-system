"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/auth-provider";
import { LoadingState } from "@/components/ui/status";
import type { UserRole } from "@/types/domain";

export function ProtectedRoute({
  roles,
  children,
}: {
  roles: UserRole[];
  children: React.ReactNode;
}) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace("/login");
      return;
    }
    if (!roles.includes(user.role)) {
      router.replace("/");
    }
  }, [loading, roles, router, user]);

  if (loading) {
    return <RouteLoading title="Cargando sesion..." />;
  }
  if (!user || !roles.includes(user.role)) {
    return <RouteLoading title="Redirigiendo..." />;
  }
  return <>{children}</>;
}

function RouteLoading({ title }: { title: string }) {
  return (
    <main className="grid min-h-screen place-items-center px-4">
      <div className="w-full max-w-sm">
        <LoadingState title={title} />
      </div>
    </main>
  );
}
