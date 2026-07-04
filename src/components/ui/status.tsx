"use client";

import { useEffect, useState } from "react";

export function EmptyState({ title, body }: { title: string; body?: string }) {
  return (
    <div className="rounded-lg border border-dashed border-black/15 bg-smoke/60 p-4 text-sm">
      <p className="font-semibold text-ink">{title}</p>
      {body ? <p className="mt-1 leading-6 text-steel">{body}</p> : null}
    </div>
  );
}

export function ErrorState({ message, onDismiss }: { message: string; onDismiss?: () => void }) {
  const [visible, setVisible] = useState(true);
  useEffect(() => setVisible(true), [message]);
  if (!onDismiss && !visible) return null;
  if (onDismiss && !message) return null;
  function dismiss() {
    setVisible(false);
    onDismiss?.();
  }
  return (
    <div className="relative rounded-lg border border-clay/25 bg-clay/10 p-3 pr-10 text-sm font-medium text-clay">
      <span>{message}</span>
      <button
        type="button"
        aria-label="Cerrar"
        className="absolute right-3 top-2 text-lg leading-none text-clay/75 hover:text-clay"
        onClick={dismiss}
      >
        x
      </button>
    </div>
  );
}

export function SuccessState({ message, onDismiss }: { message: string; onDismiss?: () => void }) {
  const [visible, setVisible] = useState(true);
  useEffect(() => setVisible(true), [message]);
  if (!onDismiss && !visible) return null;
  if (onDismiss && !message) return null;
  function dismiss() {
    setVisible(false);
    onDismiss?.();
  }
  return (
    <div className="relative rounded-lg border border-sage/25 bg-sage/10 p-3 pr-10 text-sm font-medium text-sage">
      <span>{message}</span>
      <button
        type="button"
        aria-label="Cerrar"
        className="absolute right-3 top-2 text-lg leading-none text-sage/75 hover:text-sage"
        onClick={dismiss}
      >
        x
      </button>
    </div>
  );
}
