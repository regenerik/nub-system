import { clsx } from "clsx";
import type { ButtonHTMLAttributes } from "react";

export function Button({
  className,
  variant = "primary",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "danger" | "ghost";
}) {
  return (
    <button
      className={clsx(
        "inline-flex min-h-10 items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60",
        variant === "primary" && "bg-ink text-white hover:bg-black dark:bg-brass dark:text-black dark:hover:brightness-95",
        variant === "secondary" && "border border-black/10 bg-white text-ink hover:bg-smoke",
        variant === "danger" && "bg-clay text-white hover:brightness-95",
        variant === "ghost" && "text-steel hover:bg-black/5",
        className,
      )}
      {...props}
    />
  );
}
