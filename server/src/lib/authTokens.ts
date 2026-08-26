import jwt from "jsonwebtoken";

/**
 * Interim local-credential JWT signing/verification. This is the swap-out point for a
 * real IdP (AWS Cognito or equivalent, per the schema's original implementation notes)
 * — when that lands, requireAuth in middleware/auth.ts changes to verify the IdP's
 * tokens instead of these, and login/register in routes/auth.ts go away entirely.
 */
export interface AccessTokenPayload {
  sub: string; // user id
  email: string;
}

const JWT_SECRET = process.env.JWT_SECRET;
const TOKEN_TTL = "12h";

if (!JWT_SECRET) {
  throw new Error(
    "JWT_SECRET is not set. Copy server/.env.example to server/.env and set a real secret before starting the server."
  );
}
// Applies regardless of NODE_ENV — a weak secret is just as exploitable in a staging or
// misconfigured deployment as it is in one correctly labeled "production", and nothing
// here should depend on an env var being set exactly right to get real protection.
if (JWT_SECRET.length < 32 || JWT_SECRET.includes("dev")) {
  throw new Error("JWT_SECRET looks like a dev placeholder — refusing to start with a weak secret.");
}

export function signAccessToken(payload: AccessTokenPayload): string {
  return jwt.sign(payload, JWT_SECRET!, { expiresIn: TOKEN_TTL, algorithm: "HS256" });
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  // Pin the algorithm explicitly — without this, jwt.verify trusts whatever alg the
  // token itself claims, which is how the classic "alg: none" / algorithm-confusion
  // forgery works. Requiring HS256 means only a token signed with our own secret verifies.
  return jwt.verify(token, JWT_SECRET!, { algorithms: ["HS256"] }) as AccessTokenPayload;
}
