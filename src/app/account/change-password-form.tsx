"use client";

import { useActionState } from "react";
import { changePassword } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type State = { error?: string; success?: string } | undefined;

export function ChangePasswordForm() {
  const [state, action, pending] = useActionState<State, FormData>(changePassword, undefined);

  return (
    <form action={action} className="space-y-3 max-w-sm">
      <label className="block text-sm">
        <span className="block text-xs text-muted-foreground mb-1">Current password</span>
        <Input name="current_password" type="password" autoComplete="current-password" required />
      </label>
      <label className="block text-sm">
        <span className="block text-xs text-muted-foreground mb-1">New password</span>
        <Input name="new_password" type="password" autoComplete="new-password" required minLength={10} />
      </label>
      <label className="block text-sm">
        <span className="block text-xs text-muted-foreground mb-1">Confirm new password</span>
        <Input name="confirm_password" type="password" autoComplete="new-password" required minLength={10} />
      </label>
      {state?.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
      {state?.success ? <p className="text-sm text-emerald-600">{state.success}</p> : null}
      <Button type="submit" disabled={pending}>
        {pending ? "Updating…" : "Update password"}
      </Button>
    </form>
  );
}
