import { Router } from "express";
import { prisma } from "../lib/prisma";

export const organizationsRouter = Router();

/** Lightweight lookup list for pickers (deal setup wizard's CDE/party selectors). */
organizationsRouter.get("/", async (req, res) => {
  const type = typeof req.query.type === "string" ? req.query.type : undefined;
  const organizations = await prisma.organization.findMany({
    where: { status: "active", ...(type ? { organizationType: type as never } : {}) },
    orderBy: { legalName: "asc" },
  });
  res.json(organizations);
});
