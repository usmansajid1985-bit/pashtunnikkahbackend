import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { PENDING_COOKIE, SESSION_COOKIE, verifyPendingToken, verifySessionToken } from "@/lib/session";
import { LoginForm } from "./login-form";

export const dynamic = "force-dynamic";

export default async function AdminLoginPage() {
  const jar = await cookies();

  const sessionToken = jar.get(SESSION_COOKIE)?.value;
  if (sessionToken && (await verifySessionToken(sessionToken))) {
    redirect("/");
  }

  const pendingToken = jar.get(PENDING_COOKIE)?.value;
  const initialStep = pendingToken && (await verifyPendingToken(pendingToken)) ? "otp" : "password";

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Pashtun Nikah</p>
          <h1 className="font-heading text-2xl font-medium mt-0.5">Admin sign in</h1>
        </div>
        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <LoginForm initialStep={initialStep} />
        </div>
      </div>
    </div>
  );
}
