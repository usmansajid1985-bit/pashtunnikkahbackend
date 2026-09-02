"use client";

import { useActionState } from "react";
import { loginStep1, loginStep2 } from "./actions";

type Step1State = { error?: string; step?: "otp" } | undefined;
type Step2State = { error?: string; restart?: true } | undefined;

export function LoginForm({ initialStep }: { initialStep: "password" | "otp" }) {
  const [state1, action1, pending1] = useActionState<Step1State, FormData>(loginStep1, undefined);
  const [state2, action2, pending2] = useActionState<Step2State, FormData>(loginStep2, undefined);

  const showOtp = initialStep === "otp" || state1?.step === "otp";

  if (showOtp && !state2?.restart) {
    return (
      <form action={action2} className="space-y-4">
        <div>
          <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
            6-digit authenticator code
          </label>
          <input
            name="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            autoFocus
            className="w-full h-11 rounded-xl border border-input bg-transparent px-3.5 text-center text-lg tracking-[0.3em] tabular-nums"
            placeholder="000000"
          />
        </div>
        {state2?.error ? <p className="text-sm text-destructive">{state2.error}</p> : null}
        <button
          type="submit"
          disabled={pending2}
          className="w-full h-11 rounded-xl bg-primary text-primary-foreground font-semibold text-sm disabled:opacity-60"
        >
          {pending2 ? "Verifying…" : "Verify"}
        </button>
      </form>
    );
  }

  return (
    <form action={action1} className="space-y-4">
      <div>
        <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Email</label>
        <input
          name="email"
          type="email"
          autoComplete="username"
          required
          className="w-full h-11 rounded-xl border border-input bg-transparent px-3.5 text-sm"
        />
      </div>
      <div>
        <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Password</label>
        <input
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="w-full h-11 rounded-xl border border-input bg-transparent px-3.5 text-sm"
        />
      </div>
      {state1?.error ? <p className="text-sm text-destructive">{state1.error}</p> : null}
      <button
        type="submit"
        disabled={pending1}
        className="w-full h-11 rounded-xl bg-primary text-primary-foreground font-semibold text-sm disabled:opacity-60"
      >
        {pending1 ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
