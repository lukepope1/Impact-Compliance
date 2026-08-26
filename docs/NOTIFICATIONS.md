# Notifications

Real trigger-based notifications: in-app (always) plus email (via SMTP when configured).
See `server/src/lib/notifications.ts`, `server/src/lib/email.ts`, and the three trigger
points listed below.

## What triggers a notification

| Event | Who gets notified |
|---|---|
| A submission is submitted | Impact reviewers with deal access |
| Impact returns a submission | The QALICB user who submitted it |
| Impact approves a submission | CDE reviewers with deal access (it's now ready for their review) |
| A requirement instance becomes due within 30 days | QALICB admins/contributors on the deal |
| A requirement instance becomes overdue | QALICB admins/contributors on the deal |

Every event creates **two** `Notification` rows per recipient: one `in_app` (always
recorded, visible immediately in the bell) and one `email` (attempted via SMTP; its
`status` reflects whether it actually sent — see below).

## Deadline reminders: how they actually fire

There's no real scheduled job in this build. The overdue/upcoming recompute that already
ran on every `GET .../requirement-instances` call (see `deadlineEngine.ts`) now also
checks, in that same pass, whether an instance just crossed into `"upcoming"` or just
became overdue — and fires a reminder exactly once per transition, since the next time
that same instance is loaded, its status is already `"upcoming"` and there's nothing left
to trigger.

**This means a reminder only fires when someone loads a page that lists that deal's
requirement instances.** It's a real, working mechanism — not a stub — but it depends on
page traffic, not wall-clock time. A production deployment should replace this with an
actual scheduled sweep (a cron job or, in AWS, an EventBridge-scheduled Lambda hitting the
same recompute logic) so a deadline reminder fires even if nobody happens to open the app
that day.

## Email delivery

`email.ts` wraps `nodemailer` against `SMTP_HOST`/`PORT`/`USER`/`PASS`/`FROM`. Unset
`SMTP_HOST` and email sending is disabled — **the in-app notification still gets created**,
and the corresponding email row is recorded with `status: "failed"` and a clear error
string, not silently dropped. This was verified live: a returned-submission notification
correctly produced one `in_app` row (visible in the bell, mark-as-read worked) and one
`email` row with `status: "failed"` when SMTP wasn't configured.

**Verified live** (updated after initially shipping unverified): pointed `SMTP_HOST` at a
free, disposable [Ethereal Email](https://ethereal.email) test account (created on the fly
via `nodemailer.createTestAccount()` — no pre-existing credentials needed) and submitted a
real requirement. The resulting `email` notification row came back `status: "sent"` with a
real `providerMessageId` from Ethereal's SMTP server, and the actual rendered message
(correct From/To/Subject headers, correct body) was visually confirmed at Ethereal's
message-preview URL. This proves the `nodemailer` transport and the send path genuinely
work end to end — not just the fail-visible fallback described above.

What's still not verified: delivery through a **production-grade provider** (SES,
SendGrid, etc.) with real DNS/SPF/DKIM configuration, and delivery to an actual human
inbox rather than a test-only SMTP sink. Ethereal never delivers anywhere real — it proves
the code path, not deliverability at a real domain. Point `SMTP_HOST` at your production
provider and send a real test notification before relying on this for actual users.

## API

- `GET /api/notifications` — the current user's own in-app notifications, most recent
  first (not deal-scoped — a user can have notifications across every deal they're on)
- `POST /api/notifications/:id/read` — mark one read
- `POST /api/notifications/read-all` — mark all read

## Client

`NotificationBell` (in `pages/shared/`) is mounted in all three portal layouts — it's
shared, not portal-specific, since notifications belong to the logged-in user regardless
of which portal they're in. Polls every 60 seconds (no websocket/SSE push in this build).

## What this doesn't do yet

- No real scheduled reminder sweep — see above
- No per-user notification preferences (which events, which channel)
- No digest/batching — every triggering event sends immediately, one at a time
- No push/SMS channels — only in-app and email, matching the schema's `NotificationChannel` enum
