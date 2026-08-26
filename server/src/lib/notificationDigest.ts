import type { EmailDigestFrequency } from "@prisma/client";
import { prisma } from "./prisma";
import { sendEmail } from "./email";

/** Whether this user gets email immediately (default) or batched into a daily digest. */
export async function getEmailDigestFrequency(userId: string): Promise<EmailDigestFrequency> {
  const settings = await prisma.userNotificationSettings.findUnique({ where: { userId } });
  return settings?.emailDigestFrequency ?? "immediate";
}

export async function setEmailDigestFrequency(userId: string, frequency: EmailDigestFrequency) {
  return prisma.userNotificationSettings.upsert({
    where: { userId },
    create: { userId, emailDigestFrequency: frequency },
    update: { emailDigestFrequency: frequency },
  });
}

function buildDigestBody(items: { subject: string | null; body: string | null; createdAt: Date }[]): string {
  const lines = items.map((n) => `• ${n.subject ?? "(no subject)"}\n  ${n.body ?? ""}`.trim());
  return (
    `You have ${items.length} update${items.length === 1 ? "" : "s"} from the NMTC Compliance Platform:\n\n` +
    lines.join("\n\n") +
    "\n\n— Sent as a daily digest. Change this in Notification Preferences."
  );
}

// Arbitrary fixed key identifying this lock's purpose — distinct from deadlineSweep.ts's
// key so the two scheduled jobs never contend with each other.
const DIGEST_LOCK_KEY = 84_217_004n;

/**
 * Sends one consolidated email per user in "daily" digest mode, covering every email
 * Notification row still sitting at status "queued" for them (created by notify() when
 * it found the recipient in digest mode instead of sending immediately — see
 * notifications.ts). Each digested row is updated to "sent" (or "failed" together, if
 * the one consolidated send fails) with a shared providerMessageId, so a digest email is
 * indistinguishable in the data model from any other "sent" notification except that
 * several rows share one send.
 *
 * Coordinated the same way as the deadline sweep (lib/deadlineSweep.ts): a Postgres
 * transaction-scoped advisory lock, so multiple app instances sharing a schedule don't
 * double-send the same user's digest. See that file's doc comment for the fuller
 * rationale — this mirrors it exactly, just with its own lock key.
 */
export async function runDigestSweep(): Promise<{ ran: boolean; usersDigested: number; notificationsSent: number }> {
  const acquired = await prisma.$transaction(async (tx) => {
    const [{ locked }] = await tx.$queryRaw<{ locked: boolean }[]>`SELECT pg_try_advisory_xact_lock(${DIGEST_LOCK_KEY}) AS locked`;
    return locked;
  });
  if (!acquired) return { ran: false, usersDigested: 0, notificationsSent: 0 };

  const digestUsers = await prisma.userNotificationSettings.findMany({
    where: { emailDigestFrequency: "daily" },
    select: { userId: true },
  });

  let usersDigested = 0;
  let notificationsSent = 0;

  for (const { userId } of digestUsers) {
    const queued = await prisma.notification.findMany({
      where: { userId, channel: "email", status: "queued" },
      orderBy: { createdAt: "asc" },
    });
    if (queued.length === 0) continue;

    const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
    if (!user) continue;

    const result = await sendEmail({
      to: user.email,
      subject: `NMTC Compliance Platform: ${queued.length} update${queued.length === 1 ? "" : "s"}`,
      body: buildDigestBody(queued),
    });

    await prisma.notification.updateMany({
      where: { id: { in: queued.map((n) => n.id) } },
      data: {
        status: result.status,
        sentAt: result.status === "sent" ? new Date() : undefined,
        providerMessageId: result.providerMessageId,
      },
    });

    usersDigested++;
    notificationsSent += queued.length;
  }

  return { ran: true, usersDigested, notificationsSent };
}
