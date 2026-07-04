import type { LucideIcon } from "lucide-react";

type ModuleCardProps = {
  module: {
    title: string;
    description: string;
    icon: LucideIcon;
  };
};

export function ModuleCard({ module }: ModuleCardProps) {
  const Icon = module.icon;

  return (
    <article className="rounded-lg border border-black/10 bg-white p-4 shadow-soft">
      <div className="flex h-10 w-10 items-center justify-center rounded-md bg-brass/12 text-brass">
        <Icon className="h-5 w-5" aria-hidden="true" />
      </div>
      <h3 className="mt-4 text-base font-bold text-ink">{module.title}</h3>
      <p className="mt-2 text-sm leading-6 text-steel">{module.description}</p>
    </article>
  );
}
