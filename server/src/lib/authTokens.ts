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
if (process.env.NODE_ENV === "production" && (JWT_SECRET.length < 32 || JWT_SECRET.includes("dev"))) {
  throw new Error("JWT_SECRET looks like a dev placeholder — refusing to start in production with a weak secret.");
}

export function signAccessToken(payload: AccessTokenPayload): string {
  return jwt.sign(payload, JWT_SECRET!, { expiresIn: TOKEN_TTL });
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  return jwt.verify(token, JWT_SECRET!) as AccessTokenPayload;
}
