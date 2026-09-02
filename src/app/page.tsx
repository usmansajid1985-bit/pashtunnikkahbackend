import Link from "next/link";
import {
  Users,
  IdCard,
  CreditCard,
  MessageSquare,
  Flag,
  BadgeCheck,
  UsersRound,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  AgeBarChart,
  CountryBarChart,
  GenderPieChart,
  SignupsAreaChart,
} from "@/components/charts";
import { getDashboardAnalytics } from "@/lib/analytics";
import { moneyPence } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const a = await getDashboardAnalytics();

  const stats = [
    { label: "Users", value: a.users, href: "/users", icon: Users, hint: "accounts" },
    { label: "Profiles", value: a.profiles, href: "/profiles", icon: IdCard, hint: `${a.approved} approved` },
    { label: "Avg age", value: a.avgAge ?? "—", href: "/profiles", icon: BadgeCheck, hint: `${a.minAge ?? "—"}–${a.maxAge ?? "—"} yrs` },
    { label: "Gender split", value: `${a.males}/${a.females}`, href: "/profiles", icon: UsersRound, hint: "M / F" },
    { label: "Revenue", value: moneyPence(a.revenuePence), href: "/payments", icon: CreditCard, hint: `${a.completedPayments} paid` },
    { label: "Messages", value: a.messages, href: "/requests", icon: MessageSquare, hint: `${a.requests} requests` },
    { label: "Subscriptions", value: a.subscriptions, href: "/payments", icon: CreditCard, hint: "gold plans" },
    { label: "Open reports", value: a.openReports, href: "/reports", icon: Flag, hint: "needs review" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="font-heading text-3xl font-medium tracking-tight">Dashboard</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Live stats from migrated profiles — age, gender, country, payments and more.
          </p>
        </div>
        <Badge variant="secondary" className="w-fit">
          {a.approved} approved · {a.rejected} rejected · {a.suspended} suspended
        </Badge>
      </div>

      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => {
          const Icon = s.icon;
          return (
            <Link key={s.label} href={s.href} className="group">
              <Card className="h-full transition group-hover:ring-primary/25 group-hover:shadow-sm">
                <CardHeader className="flex flex-row items-start justify-between gap-2 pb-0">
                  <CardDescription>{s.label}</CardDescription>
                  <span className="rounded-lg bg-accent p-1.5 text-accent-foreground">
                    <Icon className="size-3.5" />
                  </span>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl sm:text-3xl font-semibold tracking-tight tabular-nums">
                    {typeof s.value === "number" ? s.value.toLocaleString() : s.value}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">{s.hint}</p>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle>Signups · last 30 days</CardTitle>
            <CardDescription>New user registrations by day</CardDescription>
          </CardHeader>
          <CardContent>
            <SignupsAreaChart data={a.signups} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Gender</CardTitle>
            <CardDescription>Profile gender distribution</CardDescription>
          </CardHeader>
          <CardContent>
            <GenderPieChart data={a.gender} />
            <div className="mt-2 flex justify-center gap-4 text-xs text-muted-foreground">
              {a.gender.map((g) => (
                <span key={g.name}>
                  {g.name}: <strong className="text-foreground">{g.value}</strong>
                </span>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Age buckets</CardTitle>
            <CardDescription>How old members are on average ({a.avgAge ?? "—"} yrs)</CardDescription>
          </CardHeader>
          <CardContent>
            <AgeBarChart data={a.ageBuckets} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Top countries</CardTitle>
            <CardDescription>Where profiles say they live</CardDescription>
          </CardHeader>
          <CardContent>
            <CountryBarChart data={a.countries} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Marital status</CardTitle>
          <CardDescription>From signup questionnaire fields</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {a.marital.map((m) => (
              <div
                key={m.name}
                className="flex items-center justify-between rounded-xl border border-border bg-muted/40 px-3 py-2.5"
              >
                <span className="text-sm">{m.name}</span>
                <span className="text-sm font-semibold tabular-nums">{m.value}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
