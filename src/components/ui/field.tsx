import { clsx } from "clsx";
import type { InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";

export function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="grid gap-1.5 text-sm font-medium text-ink">
      <span>{label}</span>
      {children}
    </label>
  );
}

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={clsx(
        "min-h-10 w-full rounded-md border border-black/12 bg-white px-3 text-sm outline-none focus:border-brass focus:ring-2 focus:ring-brass/20",
        props.className,
      )}
      {...props}
    />
  );
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={clsx(
        "min-h-10 w-full rounded-md border border-black/12 bg-white px-3 text-sm outline-none focus:border-brass focus:ring-2 focus:ring-brass/20",
        props.className,
      )}
      {...props}
    />
  );
}

export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={clsx(
        "min-h-24 w-full rounded-md border border-black/12 bg-white px-3 py-2 text-sm outline-none focus:border-brass focus:ring-2 focus:ring-brass/20",
        props.className,
      )}
      {...props}
    />
  );
}
