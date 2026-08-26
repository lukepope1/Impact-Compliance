import { prisma } from "./prisma";
import { computeDisplayStatus, computeIsOverdue } from "./deadlineEngine";
import { notify, resolveDealMembers } from "./notifications";

/**
 * The overdue/upcoming recompute, extracted so it can run two ways: request-triggered
 * (GET .../requirement-instances, for an instant result the moment someone looks) and
 * on a real interval sweep (see runDeadlineSweep below) so a reminder fires even if
 * nobody happens to open the app that day. Both call this — there's exactly one
 * implementation of "what changed and what does that change require notifying."
 */
export async function recomputeDealDeadlines(dealId: string, now: Date = new Date()) {
  const instances = await prisma.requirementInstance.findMany({
    where: { dealId },
    include: { requirementDefinition: { select: { title: true } } },
  });

  const updates = [];
  const remindersToSend: { instanceId: string; title: string; kind: "upcoming" | "overdue" }[] = [];

  for (const inst of instances) {
    const displayStatus = computeDisplayStatus(inst.status, inst.dueDate, now);
    const overdue = computeIsOverdue(inst.dueDate, inst.status, now);
    const becameUpcoming = displayStatus === "upcoming" && inst.status === "not_due";
    const becameOverdue = overdue && !inst.isOverdue;

    if (displayStatus !== inst.status || overdue !== inst.isOverdue) {
      updates.push(
        prisma.requirementInstance.update({
          where: { id: inst.id },
          data: { status: displayStatus as never, isOverdue: overdue },
        })
      );
      inst.status = displayStatus as never;
      inst.isOverdue = overdue;
    }

    if (becameOverdue) {
      remindersToSend.push({ instanceId: inst.id, title: inst.requirementDefinition.title, kind: "overdue" });
    } else if (becameUpcoming) {
      remindersToSend.push({ instanceId: inst.id, title: inst.requirementDefinition.title, kind: "upcoming" });
    }
  }
  if (updates.length) await prisma.$transaction(updates);

  if (remindersToSend.length > 0) {
    const targets = await resolveDealMembers(dealId, ["qalicb_admin", "qalicb_contributor"]);
    for (const reminder of remindersToSend) {
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

  return { instancesChecked: instances.length, updated: updates.length, remindersSent: remindersToSend.length };
}

/**
 * Sweeps every deal, not just the one a page happened to load. This is the real
 * scheduled job docs/NOTIFICATIONS.md previously flagged as missing — wired up in
 * index.ts on a setInterval (default hourly, DEADLINE_SWEEP_INTERVAL_MINUTES) plus once
 * at boot, so a deadline reminder fires on wall-clock time, not page traffic.
 *
 * Single-process only: an in-process interval doesn't coordinate across multiple app
 * instances. A real multi-instance production deployment should replace this with an
 * external scheduler (cron / EventBridge) invoking one designated runner, or add a
 * distributed lock — see docs/NOTIFICATIONS.md.
 */
export async function runDeadlineSweep(): Promise<{ dealsSwept: number; totalUpdated: number; totalReminders: number }> {
  const deals = await prisma.deal.findMany({ where: { status: { notIn: ["closed", "archived"] } }, select: { id: true } });
  let totalUpdated = 0;
  let totalReminders = 0;

  for (const deal of deals) {
    const result = await recomputeDealDeadlines(deal.id);
    totalUpdated += result.updated;
    totalReminders += result.remindersSent;
  }

  return { dealsSwept: deals.length, totalUpdated, totalReminders };
}
