import type { NotificationChannel } from "@prisma/client";
import { prisma } from "./prisma";

/**
 * The fixed catalog of events a user can opt out of, independent of the raw (sometimes
 * stage-prefixed) `notificationType` strings notify() actually writes to
 * Notification.notificationType — a QALICB submitter doesn't need "impact_review_returned"
 * vs. "cde_review_returned" as separate toggles, they're the same thing from that user's
 * side: "my submission was returned."
 */
export const NOTIFICATION_EVENTS = [
  {
    key: "submission_returned",
    label: "My submission was returned",
    description: "Impact or a CDE sent one of your submissions back for revision.",
  },
  {
    key: "submission_ready_for_review",
    label: "A submission is ready for my review",
    description: "A QALICB submitted evidence and it's now awaiting Impact review.",
  },
  {
    key: "impact_approved_awaiting_cde",
    label: "Ready for CDE review",
    description: "Impact approved a submission and it's now awaiting your CDE's review.",
  },
  {
    key: "message_received",
    label: "A new request or message for me",
    description: "Someone started a message thread on a deal, addressed to an audience that includes you.",
  },
  {
    key: "message_replied",
    label: "Someone replied on a message thread",
    description: "A thread you can see got a new reply.",
  },
  {
    key: "deadline_upcoming",
    label: "A deadline is coming up",
    description: "A requirement instance just crossed into the 30-day due-soon window.",
  },
  {
    key: "deadline_overdue",
    label: "A deadline is overdue",
    description: "A requirement instance just became overdue.",
  },
] as const;

export type NotificationEventKey = (typeof NOTIFICATION_EVENTS)[number]["key"];
const EVENT_KEYS = new Set<string>(NOTIFICATION_EVENTS.map((e) => e.key));

/**
 * Maps a raw notify() notificationType (which can be stage-prefixed, e.g.
 * "impact_review_returned" / "cde_review_returned") onto the fixed preference-event key
 * it belongs to. Falls back to the raw type itself for anything not in the map — an
 * unmapped event is simply never suppressible by preference (fail open, matching this
 * app's existing "everyone gets everything by default" behavior) rather than erroring.
 */
export function toPreferenceEventKey(notificationType: string): string {
  if (notificationType.endsWith("_review_returned")) return "submission_returned";
  if (EVENT_KEYS.has(notificationType)) return notificationType;
  return notificationType;
}

const CHANNELS: NotificationChannel[] = ["in_app", "email"];

export interface PreferenceGridRow {
  eventKey: string;
  label: string;
  description: string;
  inApp: boolean;
  email: boolean;
}

/** The current user's full preference grid — every catalog event x both channels, defaulting to enabled where no override row exists. */
export async function getPreferenceGrid(userId: string): Promise<PreferenceGridRow[]> {
  const overrides = await prisma.notificationPreference.findMany({ where: { userId } });
  const overrideMap = new Map(overrides.map((o) => [`${o.eventType}:${o.channel}`, o.enabled]));

  return NOTIFICATION_EVENTS.map((event) => ({
    eventKey: event.key,
    label: event.label,
    description: event.description,
    inApp: overrideMap.get(`${event.key}:in_app`) ?? true,
    email: overrideMap.get(`${event.key}:email`) ?? true,
  }));
}

export async function setPreference(userId: string, eventKey: string, channel: NotificationChannel, enabled: boolean) {
  if (!EVENT_KEYS.has(eventKey)) throw new Error(`Unknown notification event key: ${eventKey}`);
  if (!CHANNELS.includes(channel)) throw new Error(`Unknown notification channel: ${channel}`);

  return prisma.notificationPreference.upsert({
    where: { userId_eventType_channel: { userId, eventType: eventKey, channel } },
    create: { userId, eventType: eventKey, channel, enabled },
    update: { enabled },
  });
}

/** Whether a given user has this event/channel enabled — defaults to true (opt-out model) when no override exists. */
export async function isChannelEnabled(userId: string, notificationType: string, channel: NotificationChannel): Promise<boolean> {
  const eventKey = toPreferenceEventKey(notificationType);
  const override = await prisma.notificationPreference.findUnique({
    where: { userId_eventType_channel: { userId, eventType: eventKey, channel } },
  });
  return override?.enabled ?? true;
}
