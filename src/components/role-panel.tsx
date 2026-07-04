import { CheckCircle2 } from "lucide-react";
import type { RoleSummary } from "@/types/domain";

type RolePanelProps = {
  role: RoleSummary;
};

export function RolePanel({ role }: RolePanelProps) {
  return (
    <article className="rounded-lg border border-black/10 bg-white p-4 shadow-soft">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-bold uppercase text-ink">{role.name}</h3>
        <CheckCircle2 className="h-5 w-5 text-sage" aria-hidden="true" />
      </div>
      <p className="mt-2 text-sm leading-6 text-steel">{role.scope}</p>
    </article>
  );
}
