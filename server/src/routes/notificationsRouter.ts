import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { getPreferenceGrid, setPreference } from "../lib/notificationPreferences";

export const notificationsRouter = Router();

/** The current user's preference grid — every catalog event x in-app/email, defaulting to enabled. */
notificationsRouter.get("/preferences", async (req, res) => {
  const grid = await getPreferenceGrid(req.user!.id);
  res.json(grid);
});

const preferenceSchema = z.object({
  eventKey: z.string().min(1),
  channel: z.enum(["in_app", "email"]),
  enabled: z.boolean(),
});

notificationsRouter.put("/preferences", async (req, res) => {
  const parsed = preferenceSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  try {
    await setPreference(req.user!.id, parsed.data.eventKey, parsed.data.channel, parsed.data.enabled);
  } catch (e) {
    return res.status(400).json({ error: (e as Error).message });
  }

  const grid = await getPreferenceGrid(req.user!.id);
  res.json(grid);
});

/** The current user's own in-app notifications — not deal-scoped, since a user can have notifications across deals. */
notificationsRouter.get("/", async (req, res) => {
  const notifications = await prisma.notification.findMany({
    where: { userId: req.user!.id, channel: "in_app" },
    include: {
      deal: { select: { dealCode: true, legalName: true } },
      requirementInstance: { select: { id: true, dealId: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  res.json(notifications);
});

notificationsRouter.post("/:id/read", async (req, res) => {
  const existing = await prisma.notification.findUnique({ where: { id: req.params.id } });
  if (!existing || existing.userId !== req.user!.id) return res.status(404).json({ error: "Notification not found" });

  const updated = await prisma.notification.update({ where: { id: existing.id }, data: { readAt: new Date() } });
  res.json(updated);
});

/** Convenience bulk action for a notification bell's "mark all read." */
notificationsRouter.post("/read-all", async (req, res) => {
  await prisma.notification.updateMany({
    where: { userId: req.user!.id, channel: "in_app", readAt: null },
    data: { readAt: new Date() },
  });
  res.json({ ok: true });
});
