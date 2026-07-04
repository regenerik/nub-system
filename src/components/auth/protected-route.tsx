"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/auth-provider";
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
    return <div className="p-6 text-sm text-steel">Cargando sesion...</div>;
  }
  if (!user || !roles.includes(user.role)) {
    return <div className="p-6 text-sm text-steel">Redirigiendo...</div>;
  }
  return <>{children}</>;
}
