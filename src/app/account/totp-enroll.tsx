"use client";

import { useActionState, useState, useTransition } from "react";
import { confirmTotpEnrollment, disableTotp, startTotpEnrollment } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type ConfirmState = { error?: string; success?: string } | undefined;
type DisableState = { error?: string; success?: string } | undefined;

export function TotpEnroll({ enabled, email }: { enabled: boolean; email: string }) {
  const [secret, setSecret] = useState<string | null>(null);
  const [starting, startTransition] = useTransition();
  const [confirmState, confirmAction, confirmPending] = useActionState<ConfirmState, FormData>(
    confirmTotpEnrollment,
    undefined
  );
  const [disableState, disableAction, disablePending] = useActionState<DisableState, FormData>(
    disableTotp,
    undefined
  );

  if (enabled && !confirmState?.success) {
    return (
      <div className="space-y-3 max-w-sm">
        <p className="text-sm text-emerald-600 font-medium">Two-factor authentication is enabled.</p>
        <form action={disableAction} className="space-y-3">
          <label className="block text-sm">
            <span className="block text-xs text-muted-foreground mb-1">
              Enter your password to disable it
            </span>
            <Input name="password" type="password" autoComplete="current-password" required />
          </label>
          {disableState?.error ? <p className="text-sm text-destructive">{disableState.error}</p> : null}
          <Button type="submit" variant="outline" disabled={disablePending}>
            {disablePending ? "Disabling…" : "Disable 2FA"}
          </Button>
        </form>
      </div>
    );
  }

  if (confirmState?.success) {
    return <p className="text-sm text-emerald-600 font-medium">Two-factor authentication is enabled.</p>;
  }

  if (!secret) {
    return (
      <div className="max-w-sm">
        <p className="text-sm text-muted-foreground mb-3">
          Add an extra step at login using an authenticator app (Google Authenticator, Authy, 1Password…).
        </p>
        <Button
          type="button"
          disabled={starting}
          onClick={() =>
            startTransition(async () => {
              const s = await startTotpEnrollment();
              setSecret(s);
            })
          }
        >
          {starting ? "Starting…" : "Enable 2FA"}
        </Button>
      </div>
    );
  }

  const otpauth = `otpauth://totp/${encodeURIComponent(`Pashtun Nikah Admin:${email}`)}?secret=${secret}&issuer=${encodeURIComponent("Pashtun Nikah Admin")}&digits=6&period=30`;

  return (
    <div className="space-y-4 max-w-sm">
      <div>
        <p className="text-sm text-muted-foreground">
          Add this account in your authenticator app, then enter the 6-digit code it shows.
        </p>
        <div className="mt-3 rounded-xl border border-border bg-muted/40 px-3.5 py-3">
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Secret key</p>
          <p className="mt-1 text-sm font-mono break-all">{secret}</p>
        </div>
        <details className="mt-2">
          <summary className="text-xs text-muted-foreground cursor-pointer">Show setup URI</summary>
          <p className="mt-1 text-xs font-mono break-all text-muted-foreground">{otpauth}</p>
        </details>
      </div>
      <form action={confirmAction} className="space-y-3">
        <label className="block text-sm">
          <span className="block text-xs text-muted-foreground mb-1">6-digit code</span>
          <Input name="code" inputMode="numeric" maxLength={6} required className="tracking-[0.3em] text-center" />
        </label>
        {confirmState?.error ? <p className="text-sm text-destructive">{confirmState.error}</p> : null}
        <Button type="submit" disabled={confirmPending}>
          {confirmPending ? "Confirming…" : "Confirm & enable"}
        </Button>
      </form>
    </div>
  );
}
