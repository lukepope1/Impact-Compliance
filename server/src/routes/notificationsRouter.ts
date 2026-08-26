import { Router } from "express";
import { prisma } from "../lib/prisma";

export const notificationsRouter = Router();

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
