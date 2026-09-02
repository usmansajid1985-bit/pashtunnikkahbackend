export type RoadmapStatus = "done" | "partial" | "todo";

export type RoadmapItem = {
  label: string;
  status: RoadmapStatus;
  note?: string;
};

export type RoadmapSection = {
  id: string;
  title: string;
  items: RoadmapItem[];
};

export type RoadmapDoc = {
  slug: string;
  title: string;
  source: string;
  lastUpdated: string;
  sections: RoadmapSection[];
};

const membershipMatching: RoadmapDoc = {
  slug: "membership-matching",
  title: "Membership & Matching Spec",
  source: "Membership and Matching Spec. - PN rebuild.docx",
  lastUpdated: "2026-08-07",
  sections: [
    {
      id: "3-4",
      title: "3-4. Monthly request allowances",
      items: [
        { label: "Free: 3 monthly credits", status: "done" },
        {
          label: "free_starter_credits dead field removed",
          status: "done",
          note: "no longer written at signup",
        },
        {
          label: "Gold: 10 new + up to 3 rollover, capped at 13",
          status: "done",
          note: "applyGoldRenewal() in web/src/lib/stripe.ts — real rollover math, not a flat reset",
        },
        { label: "Configurable via admin panel", status: "done", note: "admin /settings" },
      ],
    },
    {
      id: "5",
      title: "5. Request terminology",
      items: [
        { label: "\"Match tokens\" / \"credits\" wording", status: "done" },
        { label: "\"Introduction\" as the consistent verb/noun in UI copy", status: "partial" },
      ],
    },
    {
      id: "6",
      title: "6. Free membership structure",
      items: [
        { label: "6.1 Eligibility gates before sending", status: "done" },
        { label: "6.2 Accepting incoming requests is always free", status: "done" },
        { label: "6.3 Messaging after match unrestricted for Free", status: "done" },
        {
          label: "6.4 Basic filters for Free / advanced for Gold",
          status: "done",
          note: "buildProfileWhere() gates Gold-only fields server-side using a fresh DB plan check",
        },
        {
          label: "6.5 Saved profiles capped at 3 for Free",
          status: "done",
          note: "enforced in POST /api/favourites via getPlanSettings().savedProfileLimit, a fresh DB plan read (not the JWT session claim)",
        },
        {
          label: "6.6 Viewer-identity hidden for Free",
          status: "done",
          note: "Free sees a count + 7d/30d time-bucket summary (\"2 people viewed your profile, 2 in the last 7 days\"), never who — full identity stays Gold-only",
        },
        { label: "6.7 Safety/privacy features stay Free-tier", status: "done" },
      ],
    },
    {
      id: "7",
      title: "7. Gold membership structure",
      items: [
        { label: "7.1 10 + rollover + cap 13, shown everywhere", status: "partial" },
        { label: "7.2 AI Smart Matches", status: "todo" },
        { label: "7.3 AI-explained compatibility breakdown", status: "todo", note: "only a static heuristic score exists today" },
        { label: "7.4 Advanced filters as Gold-gated", status: "done" },
        { label: "7.5 Who viewed the profile (full identity)", status: "done", note: "already existed; unchanged by this pass" },
        { label: "7.6 Unlimited saved profiles for Gold", status: "done", note: "plan_settings.saved_profile_limit is null for gold — no cap applied" },
        { label: "7.7 Private browsing", status: "todo" },
        { label: "7.8 AI Profile Coach", status: "todo" },
        { label: "7.9 Gold badge (+ hide option)", status: "todo" },
        { label: "7.10 Request rollover", status: "todo" },
        { label: "7.11 Priority support flag", status: "todo" },
        { label: "7.12 Rematch Token (1/cycle, max 2)", status: "todo" },
      ],
    },
    {
      id: "8",
      title: "8. Removal of nudges",
      items: [
        { label: "Member-facing app (web/) fully clean", status: "done" },
        { label: "Admin panel nudge UI removed", status: "done" },
      ],
    },
    {
      id: "9",
      title: "9. Request lifecycle",
      items: [
        { label: "Core statuses: pending/accepted/declined/cancelled", status: "done" },
        { label: "Expired / Invalidated-by-admin / Invalidated (deleted, suspended) statuses", status: "todo" },
        { label: "9.1 Confirmation-before-send UX", status: "done" },
        { label: "9.2 Optional 250-char moderated introductory message", status: "todo" },
        { label: "9.3 Deduct-on-success + idempotency", status: "partial", note: "credit ledger now records every change; no explicit idempotency key on request creation yet" },
        { label: "9.4 Refund rules backed by ledger", status: "todo" },
        { label: "9.5 7-day configurable expiry + actual expiry job", status: "done", note: "lazy expiry via expireStaleRequests(), days configurable per plan in admin /settings" },
        { label: "9.6 Withdraw + 30-day re-contact cooldown", status: "partial", note: "withdraw exists, cooldown doesn't" },
        { label: "9.7 Duplicate pending request blocked", status: "done" },
        { label: "9.8 Requests blocked between blocked users", status: "done" },
      ],
    },
    {
      id: "10",
      title: "10. Pending request limits",
      items: [
        { label: "Free max 3 / Gold max 5 pending outgoing, configurable", status: "done", note: "enforced in POST /api/matches, limits editable in admin /settings" },
      ],
    },
    {
      id: "11",
      title: "11. Incoming request management",
      items: [
        { label: "Accept/decline flow with match + chat creation", status: "done" },
        { label: "Structured private decline reasons", status: "todo" },
      ],
    },
    {
      id: "12",
      title: "12. Protecting popular profiles",
      items: [
        { label: "Visibility ranking based on pending-request load", status: "todo" },
      ],
    },
    {
      id: "13-14",
      title: "13-14. AI Smart Matching & compatibility breakdown",
      items: [
        { label: "AI/LLM integration of any kind", status: "todo", note: "needs a provider decision first" },
      ],
    },
    {
      id: "15",
      title: "15. Gold advanced filters",
      items: [
        { label: "Filter fields exist", status: "done" },
        { label: "Free/Gold gating enforced server-side", status: "done" },
        { label: "Saved filter presets", status: "todo" },
      ],
    },
    {
      id: "16",
      title: "16. AI Profile Coach",
      items: [{ label: "Any implementation", status: "todo" }],
    },
    {
      id: "17",
      title: "17. Gold profile-view feature",
      items: [
        {
          label: "\"Who viewed me\" page with general time buckets",
          status: "done",
          note: "Free tier: total + last7d/last30d counts, no identity. Gold tier: full identified list (item 7.5).",
        },
      ],
    },
    {
      id: "18",
      title: "18. Gold privacy controls",
      items: [
        { label: "18.1 Private browsing", status: "todo" },
        { label: "18.2 Limited profile visibility tiers", status: "todo" },
        { label: "18.3 Hide Gold badge", status: "todo" },
        { label: "18.4 Pause new requests", status: "done", note: "profiles.is_hidden already does this correctly" },
      ],
    },
    {
      id: "19",
      title: "19. Saved profiles",
      items: [
        { label: "Save/remove/list", status: "done" },
        { label: "Free cap of 3 / Gold unlimited", status: "done" },
        {
          label: "Private notes, sort/filter options",
          status: "partial",
          note: "notes done (per-saved-profile text field, PATCH /api/favourites); sort was already client-side (newest/oldest/compat); server-side filter/search still not built",
        },
        {
          label: "Fixed: dead 'Save' bookmark button on Browse profile cards",
          status: "todo",
          note: "discovered while testing — the icon on /browse has no onClick at all; the only working save entry point today is the Requests → Views tab",
        },
      ],
    },
    {
      id: "20",
      title: "20. Introduction top-ups",
      items: [
        { label: "Top-up purchase flow with source-tracked balance", status: "todo" },
      ],
    },
    {
      id: "21",
      title: "21. Rematch feature",
      items: [
        { label: "Ending a match at all", status: "todo", note: "accepted is currently terminal — prerequisite for rematch" },
        { label: "Rematch tokens, requests, eligibility, cooldowns", status: "todo" },
      ],
    },
    {
      id: "22",
      title: "22. Subscription and billing behaviour",
      items: [
        { label: "22.1 Gold activation on checkout", status: "done" },
        { label: "22.2 Renewal (allowance + rollover)", status: "done", note: "applyGoldRenewal() shared by checkout activation, invoice.paid renewal, and initial signup path" },
        { label: "22.3 Failed payment / grace period", status: "todo" },
        { label: "22.4 Cancellation handling", status: "partial" },
      ],
    },
    {
      id: "23",
      title: "23. Backend data requirements",
      items: [
        { label: "23.1 Membership plan config table", status: "done", note: "plan_settings table + admin /settings UI" },
        { label: "23.2 User subscription fields", status: "done" },
        { label: "23.3 Introduction balance split by source", status: "todo", note: "still a single flat requests_remaining int; ledger tracks source per-entry but balance itself isn't split into buckets" },
        { label: "23.4 Introduction ledger", status: "done", note: "credit_ledger table, wired into signup, request-send, Gold renewal, and admin adjustments" },
        { label: "23.5 Match request fields (message, moderation, ledger link)", status: "partial" },
        { label: "23.6 Match record with end/rematch fields", status: "todo" },
        { label: "23.7-23.9 Rematch token balance/ledger/request entities", status: "todo" },
        { label: "23.10 AI recommendation entity", status: "todo" },
      ],
    },
    {
      id: "25-26",
      title: "25-26. Real-time events & scheduled jobs",
      items: [
        { label: "Core chat real-time events", status: "done" },
        { label: "Membership/rematch-specific real-time events", status: "todo" },
        { label: "Any scheduled job runner (renewals, expiry, rollover)", status: "todo" },
      ],
    },
    {
      id: "27",
      title: "27. Admin-panel controls",
      items: [
        { label: "General settings / plan-configuration page", status: "done", note: "admin /settings — monthly credits, rollover cap, max balance, pending limit, expiry days, saved-profile limit" },
        { label: "Feature flags", status: "todo" },
      ],
    },
    {
      id: "30",
      title: "30. Analytics and reporting",
      items: [
        { label: "General signup/gender/age/country charts", status: "done" },
        { label: "Request/AI/rematch/privacy-specific metrics", status: "todo" },
      ],
    },
    {
      id: "32",
      title: "32. Security and abuse prevention",
      items: [
        { label: "Duplicate-request and blocked-user checks", status: "done" },
        {
          label: "Filter-gating bypass",
          status: "done",
          note: "fixed — gating now happens inside buildProfileWhere() itself using a fresh DB plan read, not the query string or cached session claim",
        },
        { label: "Idempotency + rate limits on listed actions", status: "todo" },
      ],
    },
  ],
};

const pushNotifications: RoadmapDoc = {
  slug: "push-notifications",
  title: "PWA Push Notifications",
  source: "PWA Push notifs - PN Rebuild.docx",
  lastUpdated: "2026-08-07",
  sections: [
    {
      id: "transport",
      title: "Transport decision",
      items: [
        {
          label: "Firebase Cloud Messaging vs. standard Web Push + VAPID",
          status: "done",
          note: "chose VAPID + web-push (not Firebase) — FCM's Web SDK is itself a wrapper around the same standard Push API/VAPID mechanism, with a worse track record on Safari/iOS specifically, which is this feature's hardest target. No existing Firebase usage in the codebase either way.",
        },
      ],
    },
    {
      id: "pwa",
      title: "PWA setup",
      items: [
        { label: "Web App Manifest (name, start_url, standalone, theme/background colour)", status: "done" },
        { label: "Icon set generated from existing logo (192/512/maskable/apple-touch)", status: "done", note: "generated via sharp from the one existing logo.png — no dedicated icon pack existed" },
        { label: "Service worker registered site-wide", status: "done" },
        { label: "Install prompt (beforeinstallprompt) for Android", status: "todo" },
        { label: "Offline fallback screen", status: "todo", note: "not required for push to work; explicitly out of scope for this pass" },
      ],
    },
    {
      id: "sw",
      title: "Service worker behaviour",
      items: [
        { label: "push event → showNotification with title/body/icon/badge/tag", status: "done" },
        { label: "notificationclick → focus existing window or open new one at the URL", status: "done" },
      ],
    },
    {
      id: "permission",
      title: "Permission flow & iOS UX",
      items: [
        { label: "No auto-prompt on page load — explicit \"Enable Notifications\" button only", status: "done" },
        { label: "Handles default/granted/denied/unsupported/iOS-not-installed states", status: "done", note: "verified live — sandbox browser has permission pre-denied, correct copy rendered" },
        { label: "iOS Add-to-Home-Screen instructions when not running standalone", status: "done" },
      ],
    },
    {
      id: "vapid",
      title: "VAPID + backend",
      items: [
        { label: "VAPID keys generated, stored server-side only", status: "done" },
        { label: "lib/push/server.ts — sendPushNotification(userId, payload)", status: "done" },
        { label: "Auto-remove subscription on 404/410", status: "done", note: "logic verified by code path; a genuine 404/410 needs a real expired device subscription to fully exercise, not available in this environment" },
      ],
    },
    {
      id: "db",
      title: "Database models",
      items: [
        { label: "push_subscriptions extended (unique endpoint, user_agent, platform)", status: "done", note: "reused the table that already existed from the WP migration rather than creating a new one" },
        { label: "notifications (in-app source of truth)", status: "done" },
        { label: "notification_preferences — global push on/off", status: "done" },
        { label: "Per-category preferences (messages/matches/wali/profile)", status: "todo" },
        { label: "push_installations-style device labels, delivery tracking table", status: "todo" },
      ],
    },
    {
      id: "api",
      title: "API endpoints",
      items: [
        { label: "POST/GET /api/push/subscribe, DELETE to unsubscribe", status: "done" },
        { label: "POST /api/push/test — disabled in production", status: "done" },
        { label: "POST/GET /api/push/preferences", status: "done" },
      ],
    },
    {
      id: "integration",
      title: "Integration with existing features",
      items: [
        { label: "New chat message triggers a privacy-safe push", status: "done", note: "wired into the one shared createMessage() used by both the REST route and the Socket.io send path — verified both trigger it" },
        { label: "Privacy-safe wording (\"You have a new message\", never real content)", status: "done" },
        { label: "Other categories (match, wali, profile_activity) — type exists, no callers yet", status: "partial" },
        { label: "Foreground suppression (don't push if user is already viewing that chat)", status: "todo", note: "architecture supports adding it; not built this pass" },
      ],
    },
    {
      id: "ui",
      title: "Settings UI",
      items: [
        { label: "Enable/Disable Notifications button in Settings", status: "done" },
        {
          label: "Send Test Notification button",
          status: "done",
          note: "fixed a false-positive: sendPushNotification() never throws by design, so the test endpoint used to report success even when nothing was delivered (no subscription, push disabled, VAPID not configured). It now returns a delivery summary and the UI shows the real reason.",
        },
        { label: "Full Notification Centre (bell, unread count, notification list page)", status: "todo" },
        { label: "Multi-device management list (\"iPhone — last active today\", remove device)", status: "todo" },
      ],
    },
    {
      id: "admin",
      title: "Admin bulk-send + analytics",
      items: [
        { label: "Admin composer for targeted announcements", status: "todo" },
        { label: "Scheduled reminders (wali handover, etc.) via a job queue", status: "todo", note: "docx wants Redis/BullMQ — no queue infra exists in this project yet" },
        { label: "Delivery analytics", status: "todo" },
      ],
    },
  ],
};

const waliContactCard: RoadmapDoc = {
  slug: "wali-contact-card",
  title: "Wali Contact Card (Family Handover)",
  source: "User request — chat session, 2026-08-08",
  lastUpdated: "2026-08-08",
  sections: [
    {
      id: "guardian-data",
      title: "Guardian contact data",
      items: [
        {
          label: "profile_guardians table (name/contact/email/notes)",
          status: "done",
          note: "table already existed from the original migration; loadWaliContact() already read it and had a fallback to the sister's own phone — but nothing ever wrote to it",
        },
        {
          label: "Edit-profile UI to set guardian name + phone",
          status: "done",
          note: "GuardianContactManager in profile-edit-form.tsx (isSister-gated), backed by /api/profile/guardian GET+POST",
        },
        {
          label: "Fixed pre-existing bug: WaliAccessManager and new GuardianContactManager each rendered their own <form>, nested inside the page's outer <form> — invalid HTML that made their submit buttons actually submit the whole profile form instead of their own handler",
          status: "done",
        },
      ],
    },
    {
      id: "chat-card",
      title: "Send as a chat message",
      items: [
        { label: "message_type + metadata columns on messages table", status: "done" },
        { label: "createContactCardMessage() — sister-only, requires a saved guardian phone", status: "done" },
        { label: "Realtime send via contact-card:send socket event + message:new broadcast", status: "done" },
        { label: "REST fallback: POST /api/chats/[requestId]/contact-card", status: "done" },
        { label: "\"Send Wali Contact Card\" button above the composer (female viewer only)", status: "done" },
        { label: "Contact-card bubble rendering (name, tap-to-WhatsApp phone, email)", status: "done" },
        { label: "Reactions / reply / copy / report all work on contact-card messages too", status: "done" },
        {
          label: "Push notification on receipt",
          status: "done",
          note: "privacy-safe wording — \"You received a wali contact card.\", no phone number in the payload",
        },
      ],
    },
    {
      id: "gaps",
      title: "Known gaps",
      items: [
        { label: "Only one guardian per profile (profile_guardians.profile_id is unique)", status: "todo", note: "fine for the current ask; would need schema change to support multiple wali contacts" },
        { label: "No admin visibility into contact-card sends (moderation)", status: "todo" },
        { label: "No re-send/expiry — once sent, the phone number is permanent in that chat's history", status: "todo" },
      ],
    },
  ],
};

export const roadmapDocs: RoadmapDoc[] = [membershipMatching, pushNotifications, waliContactCard];

export function roadmapStats(doc: RoadmapDoc) {
  const items = doc.sections.flatMap((s) => s.items);
  const done = items.filter((i) => i.status === "done").length;
  const partial = items.filter((i) => i.status === "partial").length;
  const todo = items.filter((i) => i.status === "todo").length;
  const total = items.length;
  const scorePct = total === 0 ? 0 : Math.round(((done + partial * 0.5) / total) * 100);
  return { done, partial, todo, total, scorePct };
}
