import { prisma } from "@/lib/prisma";
import { format, subDays, startOfDay } from "date-fns";

export async function getDashboardAnalytics() {
  const [
    users,
    profiles,
    approved,
    rejected,
    suspended,
    payments,
    completedPayments,
    revenue,
    requests,
    messages,
    openReports,
    subscriptions,
    males,
    females,
    avgAgeAgg,
  ] = await Promise.all([
    prisma.users.count(),
    prisma.profiles.count(),
    prisma.profiles.count({ where: { status: "approved" } }),
    prisma.profiles.count({ where: { status: "rejected" } }),
    prisma.profiles.count({ where: { status: "suspended" } }),
    prisma.payments.count(),
    prisma.payments.count({ where: { status: "completed" } }),
    prisma.payments.aggregate({
      where: { status: "completed" },
      _sum: { amount_pence: true },
    }),
    prisma.match_requests.count(),
    prisma.messages.count(),
    prisma.reports.count({ where: { status: "open" } }),
    prisma.subscriptions.count(),
    prisma.profiles.count({ where: { gender: "Male" } }),
    prisma.profiles.count({ where: { gender: "Female" } }),
    prisma.profiles.aggregate({ _avg: { age: true }, _min: { age: true }, _max: { age: true } }),
  ]);

  const since = startOfDay(subDays(new Date(), 29));
  const recentUsers = await prisma.users.findMany({
    where: { registered_at: { gte: since } },
    select: { registered_at: true },
  });

  const signupMap = new Map<string, number>();
  for (let i = 29; i >= 0; i--) {
    const key = format(subDays(new Date(), i), "dd MMM");
    signupMap.set(key, 0);
  }
  for (const u of recentUsers) {
    const key = format(u.registered_at, "dd MMM");
    if (signupMap.has(key)) signupMap.set(key, (signupMap.get(key) || 0) + 1);
  }
  const signups = Array.from(signupMap.entries()).map(([day, count]) => ({ day, count }));

  const ageRows = await prisma.$queryRaw<{ bucket: string; count: bigint }[]>`
    SELECT
      CASE
        WHEN age < 22 THEN '18-21'
        WHEN age < 26 THEN '22-25'
        WHEN age < 30 THEN '26-29'
        WHEN age < 35 THEN '30-34'
        WHEN age >= 35 THEN '35+'
        ELSE 'unknown'
      END AS bucket,
      COUNT(*)::bigint AS count
    FROM profiles
    GROUP BY 1
    ORDER BY 1
  `;

  const countryRows = await prisma.$queryRaw<{ country: string; count: bigint }[]>`
    SELECT COALESCE(NULLIF(country, ''), 'Unknown') AS country, COUNT(*)::bigint AS count
    FROM profiles
    GROUP BY 1
    ORDER BY count DESC
    LIMIT 8
  `;

  const maritalRows = await prisma.$queryRaw<{ marital_status: string; count: bigint }[]>`
    SELECT COALESCE(NULLIF(marital_status, ''), 'Unknown') AS marital_status, COUNT(*)::bigint AS count
    FROM profiles
    GROUP BY 1
    ORDER BY count DESC
    LIMIT 6
  `;

  return {
    users,
    profiles,
    approved,
    rejected,
    suspended,
    payments,
    completedPayments,
    revenuePence: revenue._sum.amount_pence || 0,
    requests,
    messages,
    openReports,
    subscriptions,
    males,
    females,
    avgAge: avgAgeAgg._avg.age ? Number(avgAgeAgg._avg.age.toFixed(1)) : null,
    minAge: avgAgeAgg._min.age,
    maxAge: avgAgeAgg._max.age,
    signups,
    ageBuckets: ageRows.map((r) => ({ name: r.bucket, value: Number(r.count) })),
    countries: countryRows.map((r) => ({ name: r.country, value: Number(r.count) })),
    marital: maritalRows.map((r) => ({ name: r.marital_status, value: Number(r.count) })),
    gender: [
      { name: "Male", value: males },
      { name: "Female", value: females },
    ],
  };
}
