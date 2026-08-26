import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "./prisma";
import { computeDisplayStatus, computeIsOverdue } from "./deadlineEngine";
import { notify, resolveDealMembers } from "./notifications";

type Db = PrismaClient | Prisma.TransactionClient;

interface ReminderToSend {
  instanceId: string;
  title: string;
  kind: "upcoming" | "overdue";
}

/** Recomputes and persists status/overdue for one deal's instances; returns what changed without sending notifications yet. */
async function recomputeAndCollect(db: Db, dealId: string, now: Date): Promise<{ updated: number; reminders: ReminderToSend[] }> {
  const instances = await db.requirementInstance.findMany({
    where: { dealId },
    include: { requirementDefinition: { select: { title: true } } },
  });

  const updates = [];
  const reminders: ReminderToSend[] = [];

  for (const inst of instances) {
    const displayStatus = computeDisplayStatus(inst.status, inst.dueDate, now);
    const overdue = computeIsOverdue(inst.dueDate, inst.status, now);
    const becameUpcoming = displayStatus === "upcoming" && inst.status === "not_due";
    const becameOverdue = overdue && !inst.isOverdue;

    if (displayStatus !== inst.status || overdue !== inst.isOverdue) {
      updates.push(
        db.requirementInstance.update({
          where: { id: inst.id },
          data: { status: displayStatus as never, isOverdue: overdue },
        })
      );
      inst.status = displayStatus as never;
      inst.isOverdue = overdue;
    }

    if (becameOverdue) {
      reminders.push({ instanceId: inst.id, title: inst.requirementDefinition.title, kind: "overdue" });
    } else if (becameUpcoming) {
      reminders.push({ instanceId: inst.id, title: inst.requirementDefinition.title, kind: "upcoming" });
    }
  }
  if (updates.length) await Promise.all(updates);

  return { updated: updates.length, reminders };
}

async function sendReminders(dealId: string, reminders: ReminderToSend[]) {
  if (reminders.length === 0) return;
  const targets = await resolveDealMembers(dealId, ["qalicb_admin", "qalicb_contributor"]);
  for (const reminder of reminders) {
    await notify({
      targets,
      dealId,
      requirementInstanceId: reminder.instanceId,
      notificationType: `deadline_${reminder.kind}`,
      subject: reminder.kind === "overdue" ? `Overdue: ${reminder.title}` : `Due soon: ${reminder.title}`,
      body:
        reminder.kind === "overdue"
          ? `"${reminder.title}" is now overdue.`
          : `"${reminder.title}" is due within 30 days.`,
    });
  }
}

/**
 * The overdue/upcoming recompute for a single deal, used by the request-triggered path
 * (GET .../requirement-instances, for an instant result the moment someone looks). No
 * locking here — concurrent requests recomputing the same deal is a benign race (each
 * transition is idempotent and reminders dedupe on the status change itself), unlike the
 * cross-instance sweep below, which needs real coordination since it runs unprompted.
 */
export async function recomputeDealDeadlines(dealId: string, now: Date = new Date()) {
  const { updated, reminders } = await recomputeAndCollect(prisma, dealId, now);
  await sendReminders(dealId, reminders);
  return { updated, remindersSent: reminders.length };
}

// Arbitrary fixed key identifying this specific lock's purpose — pg_advisory lock keys
// are just int8s the application assigns meaning to, not tied to any table/row.
const SWEEP_LOCK_KEY = 84_217_003n;

/**
 * Sweeps every deal, not just the one a page happened to load — the real scheduled job
 * docs/NOTIFICATIONS.md previously flagged as missing, wired up in index.ts on a
 * setInterval (default hourly) plus once at boot, so a deadline reminder fires on
 * wall-clock time, not page traffic.
 *
 * Coordinated via a Postgres transaction-scoped advisory lock (pg_try_advisory_xact_lock)
 * so multiple app instances sharing the same database can run this on the same schedule
 * without racing each other into duplicate reminders — the DB, not this process, is the
 * one thing every instance already agrees on. The lock is scoped to the recompute-and-
 * persist transaction only; email/in-app notification sends happen after it commits
 * (and releases the lock) so slow SMTP I/O never holds a lock other instances are
 * waiting on. Whichever instance's tick loses the race simply skips this round — the
 * next tick recomputes from current state either way, so nothing is lost, only delayed
 * by at most one interval.
 */
export async function runDeadlineSweep(): Promise<{
  ran: boolean;
  dealsSwept: number;
  totalUpdated: number;
  totalReminders: number;
}> {
  const now = new Date();

  const perDealReminders = await prisma.$transaction(async (tx) => {
    const [{ locked }] = await tx.$queryRaw<{ locked: boolean }[]>`SELECT pg_try_advisory_xact_lock(${SWEEP_LOCK_KEY}) AS locked`;
    if (!locked) return null;

    const deals = await tx.deal.findMany({ where: { status: { notIn: ["closed", "archived"] } }, select: { id: true } });
    const results: { dealId: string; updated: number; reminders: ReminderToSend[] }[] = [];
    for (const deal of deals) {
      const { updated, reminders } = await recomputeAndCollect(tx, deal.id, now);
      results.push({ dealId: deal.id, updated, reminders });
    }
    return results;
  });

  if (perDealReminders === null) {
    return { ran: false, dealsSwept: 0, totalUpdated: 0, totalReminders: 0 };
  }

  let totalUpdated = 0;
  let totalReminders = 0;
  for (const { dealId, updated, reminders } of perDealReminders) {
    totalUpdated += updated;
    totalReminders += reminders.length;
    await sendReminders(dealId, reminders);
  }

  return { ran: true, dealsSwept: perDealReminders.length, totalUpdated, totalReminders };
}
