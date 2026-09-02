"use client";

import { useState, useTransition } from "react";
import { addHeroSlide } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const MAX_BYTES = 10 * 1024 * 1024;
const ALLOWED = ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif"];

export function HeroUploadForm({
  slot = "hero",
  submitLabel = "Add slide",
}: {
  slot?: "hero" | "cta";
  submitLabel?: string;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  function validate(file: File | undefined) {
    if (!file) return "Choose an image to upload.";
    if (!file.type.startsWith("image/") && !ALLOWED.includes(file.type)) {
      return "Please choose an image file (JPG, PNG, WEBP, or GIF).";
    }
    if (file.size > MAX_BYTES) {
      return `Image is too large (${(file.size / 1024 / 1024).toFixed(1)}MB). Maximum is 10MB. Compress it and try again.`;
    }
    return null;
  }

  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        const form = e.currentTarget;
        const file = (form.elements.namedItem("image") as HTMLInputElement | null)?.files?.[0];
        const invalid = validate(file);
        setError(invalid);
        setOk(false);
        if (invalid) return;
        const data = new FormData(form);
        data.set("slot", slot);
        startTransition(async () => {
          const result = await addHeroSlide(data);
          if (result?.error) {
            setError(result.error);
            return;
          }
          setOk(true);
          form.reset();
        });
      }}
    >
      <label className="text-sm block">
        <span className="block text-xs text-muted-foreground mb-1">Image (JPG, PNG, WEBP, GIF · max 10MB)</span>
        <Input
          name="image"
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif,image/*"
          required
          onChange={(e) => {
            const file = e.target.files?.[0];
            setOk(false);
            setError(file ? validate(file) : null);
          }}
        />
      </label>
      <label className="text-sm block">
        <span className="block text-xs text-muted-foreground mb-1">Alt text (optional)</span>
        <Input name="alt" placeholder="Henna and ring — Nikah hero" />
      </label>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {ok ? (
        <p className="text-sm text-emerald-700">
          Slide added. Homepage will use the new cache until the next upload.
        </p>
      ) : null}
      <Button type="submit" disabled={pending}>
        {pending ? "Uploading…" : submitLabel}
      </Button>
    </form>
  );
}
