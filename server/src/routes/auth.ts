import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { signAccessToken, verifyAccessToken } from "../lib/authTokens";

export const authRouter = Router();

const loginSchema = z.object({ email: z.string().email(), password: z.string().min(1) });

authRouter.post("/login", async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const user = await prisma.user.findUnique({
    where: { email: parsed.data.email },
    include: { memberships: { where: { status: "active" }, include: { organization: true } } },
  });

  // Same generic error whether the email doesn't exist or the password is wrong — do not
  // let a login attempt reveal which accounts exist.
  const genericError = { error: "Invalid email or password" };

  if (!user || user.status !== "active" || !user.passwordHash) {
    return res.status(401).json(genericError);
  }

  const valid = await bcrypt.compare(parsed.data.password, user.passwordHash);
  if (!valid) return res.status(401).json(genericError);

  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });

  const token = signAccessToken({ sub: user.id, email: user.email });

  res.json({
    token,
    user: {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      memberships: user.memberships.map((m) => ({
        organizationId: m.organizationId,
        organizationName: m.organization.legalName,
        organizationType: m.organization.organizationType,
        roleCode: m.roleCode,
      })),
    },
  });
});

authRouter.get("/me", async (req, res) => {
  const authHeader = req.header("authorization");
  if (!authHeader?.startsWith("Bearer ")) return res.status(401).json({ error: "Not authenticated" });

  try {
    const payload = verifyAccessToken(authHeader.slice("Bearer ".length));
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      include: { memberships: { where: { status: "active" }, include: { organization: true } } },
    });
    if (!user || user.status !== "active") return res.status(401).json({ error: "Not authenticated" });

    res.json({
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      memberships: user.memberships.map((m) => ({
        organizationId: m.organizationId,
        organizationName: m.organization.legalName,
        organizationType: m.organization.organizationType,
        roleCode: m.roleCode,
      })),
    });
  } catch {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
});
