import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/admin-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChangePasswordForm } from "./change-password-form";
import { TotpEnroll } from "./totp-enroll";

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const session = await getAdminSession();
  if (!session) redirect("/login");

  const adminId = BigInt(session.adminId);
  const [admin, security] = await Promise.all([
    prisma.users.findUnique({ where: { id: adminId } }),
    prisma.admin_security.findUnique({ where: { user_id: adminId } }),
  ]);
  if (!admin) redirect("/login");

  return (
    <div className="space-y-8">
      <div>
        <h2 className="font-heading text-3xl font-medium tracking-tight">Account</h2>
        <p className="mt-1 text-sm text-muted-foreground">{admin.email}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Change password</CardTitle>
        </CardHeader>
        <CardContent>
          <ChangePasswordForm />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Two-factor authentication</CardTitle>
        </CardHeader>
        <CardContent>
          <TotpEnroll enabled={Boolean(security?.totp_enabled)} email={admin.email} />
        </CardContent>
      </Card>
    </div>
  );
}
