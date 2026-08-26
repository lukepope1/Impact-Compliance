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

`lib/deadlineSweep.ts` holds the one implementation of "recompute overdue/upcoming status
and fire reminders on transitions" (`recomputeDealDeadlines`, using `deadlineEngine.ts`'s
pure status functions) — a reminder fires exactly once per transition, since the next
time that instance is recomputed, its status is already `"upcoming"` and there's nothing
left to trigger.

**Now a real interval-based scheduled job**, not just page-load-triggered: `index.ts`
starts a sweep (`runDeadlineSweep`, which recomputes every non-closed/archived deal) once
~10 seconds after boot and then on a fixed interval — `DEADLINE_SWEEP_INTERVAL_MINUTES`
(default 60). This means a deadline reminder now fires on wall-clock time even if nobody
opens the app that day, closing the gap this doc previously flagged. `GET
.../requirement-instances` still also calls `recomputeDealDeadlines` for that one deal on
every load, so a page never shows stale status mid-interval.

Verified live: ran the sweep directly against the real embedded Postgres database outside
the request cycle — it correctly found and checked the seeded deal (`dealsSwept: 1`) with
no spurious updates, confirming the extracted function behaves identically to the
request-triggered path it replaced.

**Now coordinated across multiple instances too**: `runDeadlineSweep` wraps the
recompute-and-persist step in a Postgres transaction-scoped advisory lock
(`pg_try_advisory_xact_lock`) before touching any deal. Every app instance shares the
same database, so the database — not any one process — is the thing they can all agree
on: whichever instance's tick acquires the lock does the sweep; every other instance's
concurrent tick sees `locked: false` and skips that round entirely, `ran: false` in the
return value. Nothing is lost, only delayed to the next tick, since the next sweep
recomputes from current state regardless of who ran last.

Verified live: ran two transactions concurrently against the real database, one holding
the lock open for 1.5s — the second correctly saw `locked: false` for the whole window
and only proceeded once the first committed and released it.

The lock is scoped to the DB read/update transaction only, not the email/in-app send
step — `notify()` runs after that transaction commits (and the lock releases), so a slow
SMTP send never holds a lock other instances are waiting on. This leaves a narrow window
where an instance could win the lock, crash before sending notifications, and the
recomputed status update stays committed without its reminder ever going out — that
instance's crash is the same risk any interval-based job has and isn't specific to the
locking scheme; a production deployment wanting delivery guarantees on top of this would
want an outbox/retry pattern, which is out of scope here.

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
