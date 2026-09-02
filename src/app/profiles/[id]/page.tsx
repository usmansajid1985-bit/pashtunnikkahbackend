import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { fmtDate } from "@/lib/format";
import { StatusBadge } from "@/components/status-badge";
import { updateProfileStatus, updatePhotoStatus, toggleProfileHidden } from "../actions";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const dynamic = "force-dynamic";

const WEB_ORIGIN = process.env.WEB_PUBLIC_URL || "http://localhost:3001";

function resolveSrc(url: string | null | undefined) {
  if (!url) return null;
  return url.startsWith("http") ? url : `${WEB_ORIGIN}${url}`;
}

function initials(name: string | null | undefined, fallback: string) {
  const source = (name || fallback || "").trim();
  if (!source) return "?";
  const parts = source.split(/\s+/).filter(Boolean);
  return parts.slice(0, 2).map((p) => p[0]?.toUpperCase()).join("") || "?";
}

function Fact({ label, value }: { label: string; value?: string | number | null }) {
  if (value == null || value === "") return null;
  return (
    <Badge variant="outline" className="h-auto py-1.5 px-3 text-[13px] font-medium">
      <span className="text-muted-foreground mr-1">{label}:</span>
      {value}
    </Badge>
  );
}

function FactRow({ facts }: { facts: [string, string | number | null | undefined][] }) {
  const visible = facts.filter(([, v]) => v != null && v !== "");
  if (visible.length === 0) {
    return <p className="text-sm text-muted-foreground">No details added yet.</p>;
  }
  return (
    <div className="flex flex-wrap gap-2">
      {visible.map(([label, value]) => (
        <Fact key={label} label={label} value={value} />
      ))}
    </div>
  );
}

function Info({ title, value }: { title: string; value?: string | null }) {
  return (
    <div className="rounded-xl border border-border bg-card px-3.5 py-3">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{title}</p>
      <p className="mt-1 text-sm break-words">{value || "—"}</p>
    </div>
  );
}

export default async function ProfileDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const profile = await prisma.profiles.findUnique({
    where: { id: BigInt(id) },
    include: {
      users: true,
      profile_guardians: true,
    },
  });

  if (!profile) notFound();

  const photoSrc = resolveSrc(profile.photo_url);
  const verSrc = resolveSrc(profile.photo_verification_url);
  const location = [profile.city || profile.current_location, profile.country].filter(Boolean).join(", ");

  const faith: [string, string | number | null | undefined][] = [
    ["Practice", profile.religious_practice],
    ["Methodology", profile.religious_methodology],
    ["Islamic practice", profile.islamic_practice],
    ["Practicing since", profile.practicing_since],
    ["Salah", profile.salah_pattern],
    ["Born Muslim", profile.born_muslim],
  ];

  const family: [string, string | number | null | undefined][] = [
    ["Marital status", profile.marital_status],
    ["Children", profile.children || profile.has_children],
    ["Wants children", profile.wants_children],
    ["Father", profile.father_name],
    ["Father's occupation", profile.father_occupation],
    ["Brothers", profile.brothers],
    ["Sisters", profile.sisters],
  ];

  const career: [string, string | number | null | undefined][] = [
    ["Education", profile.education],
    ["Field of study", profile.field_of_study],
    ["Occupation", profile.occupation],
  ];

  const roots: [string, string | number | null | undefined][] = [
    ["Ancestral village", profile.ancestral_village],
    ["Family origin", profile.family_origin],
    ["Ethnicity", profile.ethnicity],
    ["Tribe", profile.tribe],
    ["Sub tribe", profile.sub_tribe],
    ["Khiel", profile.khiel],
    ["Relocate", profile.willing_to_relocate || profile.relocate],
    ["Pashto", profile.pashto_speaker || profile.pashto_level],
    ["Home language", profile.home_language],
    ["Dialect", profile.dialect],
  ];

  const partnerPrefs: [string, string | number | null | undefined][] = [
    ["Age range", profile.age_pref_from != null ? `${profile.age_pref_from}–${profile.age_pref_to}` : null],
    ["Height", profile.height_preference],
    ["Education", profile.education_pref],
    ["Appearance", profile.appearance_pref],
    ["Accept widow", profile.accept_widow],
    ["Consider divorcee", profile.consider_divorcee],
    ["Disabilities OK", profile.consider_disabilities],
    ["Open to", profile.open_to],
  ];

  return (
    <div className="space-y-8">
      <Link href="/profiles" className="text-sm text-muted-foreground hover:text-primary">
        ← Profiles
      </Link>

      {/* Hero */}
      <Card>
        <CardContent className="p-6 sm:p-8">
          <div className="flex flex-col sm:flex-row gap-6 sm:items-center">
            <Avatar className="size-24 sm:size-28 shrink-0 rounded-2xl">
              {photoSrc ? <AvatarImage src={photoSrc} alt="" className="rounded-2xl" /> : null}
              <AvatarFallback className="rounded-2xl text-2xl font-heading bg-accent text-accent-foreground">
                {initials(profile.full_name, profile.profile_code || "")}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="font-heading text-3xl font-medium tracking-tight">
                  {profile.full_name || profile.profile_code || `Profile ${profile.id}`}
                </h1>
                <StatusBadge value={profile.status} />
                {profile.is_hidden ? <StatusBadge value="hidden" /> : null}
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                {profile.profile_code || "No code"} · User{" "}
                <Link href={`/users/${profile.user_id}`} className="text-primary hover:underline">
                  #{profile.user_id.toString()}
                </Link>{" "}
                · Submitted {fmtDate(profile.submitted_at)}
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Fact label="Age" value={profile.age != null ? `${profile.age} yrs` : null} />
                <Fact label="Gender" value={profile.gender} />
                <Fact label="Height" value={profile.height} />
                <Fact label="Location" value={location} />
                <Fact label="Warn count" value={profile.warn_count > 0 ? profile.warn_count : null} />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main column */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>About</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm leading-relaxed whitespace-pre-wrap">
                {profile.about_me || "No about section yet."}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Looking for</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm leading-relaxed whitespace-pre-wrap">
                {profile.partner_preferences || "No preferences added yet."}
              </p>
              {partnerPrefs.some(([, v]) => v != null && v !== "") ? (
                <div className="mt-4">
                  <FactRow facts={partnerPrefs} />
                </div>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Family &amp; career</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <FactRow facts={family} />
              <FactRow facts={career} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Faith</CardTitle>
            </CardHeader>
            <CardContent>
              <FactRow facts={faith} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Roots &amp; location</CardTitle>
            </CardHeader>
            <CardContent>
              <FactRow facts={roots} />
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Admin controls</CardTitle>
              <CardDescription>Moderation actions — not shown on the member&apos;s profile.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <form action={updateProfileStatus} className="space-y-3">
                <input type="hidden" name="id" value={profile.id.toString()} />
                <label className="block text-sm">
                  <span className="block text-xs text-muted-foreground mb-1">Status</span>
                  <select
                    name="status"
                    defaultValue={profile.status}
                    className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
                  >
                    {["approved", "pending", "rejected", "suspended", "unverified"].map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block text-sm">
                  <span className="block text-xs text-muted-foreground mb-1">Rejection reason</span>
                  <Input
                    name="rejection_reason"
                    defaultValue={profile.rejection_reason || ""}
                    placeholder="Optional"
                  />
                </label>
                <Button type="submit" className="w-full">
                  Save status
                </Button>
              </form>
              <form action={toggleProfileHidden}>
                <input type="hidden" name="id" value={profile.id.toString()} />
                <Button type="submit" variant="outline" size="sm" className="w-full">
                  {profile.is_hidden ? "Unhide profile" : "Hide profile"}
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Photo review</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {photoSrc || verSrc ? (
                <div className="flex flex-wrap gap-3">
                  {photoSrc ? (
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Public</p>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={photoSrc} alt="" className="h-40 w-32 rounded-xl object-cover border" />
                    </div>
                  ) : null}
                  {verSrc ? (
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Verification</p>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={verSrc} alt="" className="h-40 w-32 rounded-xl object-cover border" />
                    </div>
                  ) : null}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No photo uploaded.</p>
              )}
              <div className="flex items-center justify-between">
                <StatusBadge value={profile.photo_status || "none"} />
              </div>
              {photoSrc ? (
                <div className="flex flex-wrap gap-2">
                  <form action={updatePhotoStatus}>
                    <input type="hidden" name="id" value={profile.id.toString()} />
                    <input type="hidden" name="photo_status" value="approved" />
                    <Button type="submit" size="sm">
                      Approve
                    </Button>
                  </form>
                  <form action={updatePhotoStatus}>
                    <input type="hidden" name="id" value={profile.id.toString()} />
                    <input type="hidden" name="photo_status" value="rejected" />
                    <Button type="submit" size="sm" variant="outline">
                      Reject
                    </Button>
                  </form>
                </div>
              ) : null}
            </CardContent>
          </Card>

          {profile.profile_guardians ? (
            <Card>
              <CardHeader>
                <CardTitle>Guardian / Wali</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2.5">
                <Info title="Name" value={profile.profile_guardians.name} />
                <Info title="Contact" value={profile.profile_guardians.contact} />
                <Info title="Email" value={profile.profile_guardians.email} />
                <Info title="Notes" value={profile.profile_guardians.notes} />
              </CardContent>
            </Card>
          ) : null}

          <Card>
            <CardHeader>
              <CardTitle>Private contact details</CardTitle>
              <CardDescription>Never shown to other members.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-2.5">
              <Info title="Email" value={profile.email} />
              <Info title="Phone" value={profile.phone ? `${profile.phone_country_code || ""} ${profile.phone}` : null} />
              <Info title="DOB" value={profile.dob ? profile.dob.toISOString().slice(0, 10) : null} />
              <Info title="Legal status" value={profile.legal_status} />
              <Info title="Weight / build" value={[profile.weight, profile.build].filter(Boolean).join(" · ") || null} />
              <Info title="Complexion / appearance" value={[profile.complexion, profile.appearance].filter(Boolean).join(" · ") || null} />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
