import { prisma } from "./prisma";
import { dueSuffix, notifyThreadAudience } from "./messageNotifications";

// Arbitrary fixed key identifying this specific lock's purpose, alongside the deadline
// sweep's 84_217_003 and the email digest's 84_217_004 — pg_advisory lock keys are just
// int8s the application assigns meaning to, not tied to any table/row.
const MESSAGE_SWEEP_LOCK_KEY = 84_217_005n;

/**
 * Calls out message threads that have passed their response date. Requirement instances
 * already get this treatment via deadlineSweep.ts; message threads previously did not, so
 * a request could sail past its due date with the only trace being the Due-date filter on
 * the Messages screen — someone had to go looking to find out.
 *
 * "Overdue" is computed at read time rather than stored, because unlike a requirement
 * instance a thread's due date never moves once set. The only thing persisted is
 * overdueNotifiedAt, which exists purely so an open thread is called out once instead of
 * on every hourly tick. Claiming the rows and sending are deliberately separate: the
 * claim happens inside the locked transaction, the notification sends happen after it
 * commits, so slow SMTP never holds a lock other app instances are waiting on.
 *
 * Coordinated with the same transaction-scoped advisory lock the other sweeps use, so
 * multiple app instances against one database don't race into duplicate alerts. An
 * instance that loses the race skips the round; the next tick picks up whatever is still
 * unnotified, so nothing is lost, only delayed by at most one interval.
 */
export async function runMessageOverdueSweep(now: Date = new Date()): Promise<{
  ran: boolean;
  threadsFlagged: number;
}> {
  const claimed = await prisma.$transaction(async (tx) => {
    const [{ locked }] = await tx.$queryRaw<{ locked: boolean }[]>`SELECT pg_try_advisory_xact_lock(${MESSAGE_SWEEP_LOCK_KEY}) AS locked`;
    if (!locked) return null;

    const overdue = await tx.message.findMany({
      where: {
        // Root threads only — a reply carries no due date of its own.
        parentMessageId: null,
        // A closed thread can't be waiting on anyone.
        status: { not: "closed" },
        dueDate: { lt: now },
        overdueNotifiedAt: null,
        // Matches deadlineSweep's scope: a wound-down deal shouldn't start paging people.
        deal: { status: { notIn: ["closed", "archived"] } },
      },
      select: { id: true, dealId: true, visibility: true, subject: true, dueDate: true },
    });

    if (overdue.length > 0) {
      // Claim inside the lock so a concurrent instance can't pick the same threads up.
      await tx.message.updateMany({
        where: { id: { in: overdue.map((m) => m.id) } },
        data: { overdueNotifiedAt: now },
      });
    }

    return overdue;
  });

  if (claimed === null) return { ran: false, threadsFlagged: 0 };

  for (const thread of claimed) {
    await notifyThreadAudience({
      dealId: thread.dealId,
      visibility: thread.visibility,
      notificationType: "message_overdue",
      subject: `Response overdue: ${thread.subject ?? "a request"}`,
      body: `This request is still open past its response date.${dueSuffix(thread.dueDate)}`,
    });
  }

  return { ran: true, threadsFlagged: claimed.length };
}
