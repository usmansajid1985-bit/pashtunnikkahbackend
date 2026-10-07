import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { updateFamilySettings, updatePlanSettings } from "./actions";
import { loadFamilySettings, type FamilySettings } from "@/lib/family-flow";

export const dynamic = "force-dynamic";

const FIELDS: { name: string; label: string; hint?: string }[] = [
  { name: "monthly_credits", label: "Monthly Introductions" },
  { name: "rollover_cap", label: "Rollover cap", hint: "max unused Introductions carried into next cycle" },
  { name: "max_balance", label: "Maximum balance", hint: "hard cap regardless of rollover" },
  { name: "pending_request_limit", label: "Pending request limit", hint: "max active outgoing Introductions" },
  { name: "request_expiry_days", label: "Request expiry (days)" },
];

const FAMILY_NUMBERS: { name: keyof FamilySettings; label: string; hint?: string }[] = [
  { name: "minDaysMatched", label: "Days since matching" },
  { name: "minTotalMessages", label: "Messages combined" },
  { name: "minMessagesEach", label: "Messages from each member" },
  { name: "minActiveDaysEach", label: "Separate days each member took part" },
  { name: "recentActivityHours", label: "Both active within (hours)" },
  { name: "finalReminderAfterDays", label: "Final reminder after (days)", hint: "after Not now on the first reminder" },
  { name: "requestCooldownDays", label: "Request cooldown (days)", hint: "before he can ask again after she says Not now" },
  { name: "contactPromptAfterHours", label: "Ask \"Have you contacted the wali?\" after (hours)" },
  { name: "contactFollowupAfterDays", label: "Ask once more after (days)", hint: "after Not yet" },
];

const FAMILY_TEXT: { name: keyof FamilySettings; label: string }[] = [
  { name: "pushTitle", label: "Reminder notification — title" },
  { name: "pushBody", label: "Reminder notification — message" },
  { name: "finalPushTitle", label: "Final reminder — title" },
  { name: "finalPushBody", label: "Final reminder — message" },
];

export default async function SettingsPage() {
  const plans = await prisma.plan_settings.findMany({ orderBy: { plan: "asc" } });
  const family = await loadFamilySettings();

  return (
    <div className="space-y-8">
      <div>
        <h2 className="font-heading text-3xl font-medium tracking-tight">Settings</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Membership plan limits — changes take effect immediately for new requests and the next
          renewal cycle.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {plans.map((p) => (
          <Card key={p.plan}>
            <CardHeader>
              <CardTitle className="capitalize">{p.plan}</CardTitle>
              <CardDescription>
                Last updated {p.updated_at.toLocaleString()}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form action={updatePlanSettings} className="space-y-3">
                <input type="hidden" name="plan" value={p.plan} />
                {FIELDS.map((f) => (
                  <label key={f.name} className="block text-sm">
                    <span className="block text-xs text-muted-foreground mb-1">
                      {f.label}
                      {f.hint ? <span className="opacity-70"> — {f.hint}</span> : null}
                    </span>
                    <Input
                      name={f.name}
                      type="number"
                      min={0}
                      defaultValue={p[f.name as keyof typeof p] as number}
                    />
                  </label>
                ))}
                <label className="block text-sm">
                  <span className="block text-xs text-muted-foreground mb-1">
                    Saved profile limit — blank = unlimited
                  </span>
                  <Input
                    name="saved_profile_limit"
                    type="number"
                    min={0}
                    defaultValue={p.saved_profile_limit ?? ""}
                  />
                </label>
                <Button type="submit">Save {p.plan} settings</Button>
              </form>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Involve Family reminder</CardTitle>
          <CardDescription>
            When a conversation meets all of these, both members get the &ldquo;Ready to involve family?&rdquo;
            notification and in-chat card. Members can involve family manually at any time regardless.
            {family.updatedAt ? ` Last updated ${family.updatedAt.toLocaleString()}.` : " Using defaults."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={updateFamilySettings} className="space-y-5">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {FAMILY_NUMBERS.map((f) => (
                <label key={f.name} className="block text-sm">
                  <span className="block text-xs text-muted-foreground mb-1">
                    {f.label}
                    {f.hint ? <span className="opacity-70"> — {f.hint}</span> : null}
                  </span>
                  <Input name={f.name} type="number" min={0} defaultValue={family.settings[f.name] as number} />
                </label>
              ))}
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {FAMILY_TEXT.map((f) => (
                <label key={f.name} className="block text-sm">
                  <span className="block text-xs text-muted-foreground mb-1">{f.label}</span>
                  <Input name={f.name} maxLength={300} defaultValue={family.settings[f.name] as string} />
                </label>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              Use {"{code}"} where the other member&apos;s profile ID should appear (e.g. PNM581). Changes reach the
              member app within a minute.
            </p>
            <Button type="submit">Save Involve Family settings</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
