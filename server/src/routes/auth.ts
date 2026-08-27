import { Router } from "express";
import bcrypt from "bcryptjs";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { signAccessToken, verifyAccessToken } from "../lib/authTokens";

export const authRouter = Router();

/**
 * Credential-stuffing / brute-force guard. Keyed on IP (express-rate-limit's default) so
 * it can't be used to lock a legitimate user out by hammering their email from elsewhere;
 * the login route already gives a generic error either way, so this only slows down
 * automated guessing, not a single mistyped password.
 *
 * Both numbers are configurable because the production-appropriate value (10 per 15
 * minutes) is far too tight for local development and demos: one person signing in and
 * out across the four seeded accounts trips it in a couple of minutes, and a whole team
 * behind one office IP shares a single budget — so a few people fumbling passwords locks
 * out everyone else.
 *
 * The defaults stay strict rather than keying off NODE_ENV, matching how the rest of this
 * codebase fails closed (see scanner.ts, which never silently reports "clean"): a
 * deployment that forgets to set anything gets the safe limit, and loosening it has to be
 * a deliberate act. server/.env sets a development value — see docs/LOCAL_DEV.md.
 */
const LOGIN_RATE_LIMIT = Number(process.env.LOGIN_RATE_LIMIT ?? 10);
const LOGIN_RATE_WINDOW_MINUTES = Number(process.env.LOGIN_RATE_WINDOW_MINUTES ?? 15);

const loginLimiter = rateLimit({
  windowMs: LOGIN_RATE_WINDOW_MINUTES * 60 * 1000,
  limit: LOGIN_RATE_LIMIT,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many login attempts. Try again in a few minutes." },
});

const loginSchema = z.object({ email: z.string().email(), password: z.string().min(1) });

authRouter.post("/login", loginLimiter, async (req, res) => {
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
