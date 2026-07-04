"use client";

import { useId, useState } from "react";
import { Upload } from "lucide-react";
import { api } from "@/lib/api";

export function ImageUploader({
  value,
  onChange,
}: {
  value?: string | null;
  onChange: (url: string) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const inputId = useId();

  async function upload(file?: File) {
    if (!file) return;
    setLoading(true);
    setError("");
    try {
      const form = new FormData();
      form.append("image", file);
      const data = await api.post<{ secure_url: string }>("/uploads/image", form);
      onChange(data.secure_url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo subir la imagen.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid gap-2">
      {value ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={value} alt="" className="h-24 w-24 rounded-md border object-cover" />
      ) : null}
      <input
        id={inputId}
        className="sr-only"
        type="file"
        accept="image/jpeg,image/png,image/webp"
        disabled={loading}
        onChange={(event) => upload(event.target.files?.[0])}
      />
      <label
        htmlFor={inputId}
        className={`inline-flex min-h-10 cursor-pointer items-center justify-center gap-2 rounded-md border border-black/10 bg-white px-4 py-2 text-sm font-semibold text-ink transition hover:bg-smoke ${
          loading ? "pointer-events-none opacity-60" : ""
        }`}
      >
          <Upload className="h-4 w-4" />
          {loading ? "Subiendo..." : "Subir imagen"}
      </label>
      {error ? <p className="text-sm text-clay">{error}</p> : null}
    </div>
  );
}
