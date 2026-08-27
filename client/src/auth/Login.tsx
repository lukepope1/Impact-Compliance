import { useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "./AuthContext";
import type { AuthUser } from "../api/client";

const DEMO_ACCOUNTS = [
  { label: "Impact — compliance manager", email: "compliance@impactmarketplace.com" },
  { label: "QALICB — Millennium Holdings admin", email: "jane.doe@millenniumholdings.example" },
  { label: "CDE — Enterprise Financial reviewer", email: "reviewer@enterprisecde.example" },
];
const DEMO_PASSWORD = "password123";

function portalForRole(roleCode: string) {
  if (roleCode.startsWith("impact_")) return "/impact/deals";
  if (roleCode.startsWith("qalicb_")) return "/qalicb";
  if (roleCode.startsWith("cde_")) return "/cde";
  return "/impact/deals";
}

// The `from` path (where PortalGuard bounced an unauthenticated visit from) is only worth
// honoring if the user who just logged in actually has a role for that portal — otherwise
// a demo-button login (or any login that isn't the same person retrying) would land back
// on a page the new user can't use, immediately hitting PortalGuard's "not authorized"
// screen instead of their own portal. This bit us in testing: logging in as the QALICB
// demo user from a page that had redirected from /impact/deals sent her right back there.
function destinationFor(user: AuthUser, from?: string) {
  const homePortal = portalForRole(user.memberships[0]?.roleCode ?? "");
  if (!from) return homePortal;
  const fromPortal = from.split("/")[1]; // "/impact/deals" -> "impact"
  const hasRoleForFromPortal = user.memberships.some((m) => m.roleCode.startsWith(`${fromPortal}_`));
  return hasRoleForFromPortal ? from : homePortal;
}

export default function Login() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (user) {
    const from = (location.state as { from?: string } | null)?.from;
    return <Navigate to={destinationFor(user, from)} replace />;
  }

  async function submit(e: React.FormEvent, useEmail?: string, usePassword?: string) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const loggedInUser = await login(useEmail ?? email, usePassword ?? password);
      const from = (location.state as { from?: string } | null)?.from;
      navigate(destinationFor(loggedInUser, from));
    } catch (e) {
      setError(String((e as Error).message ?? e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main style={{ maxWidth: 420, marginTop: 40 }}>
      <h1>Sign in</h1>
      <p className="muted" style={{ marginTop: 0 }}>NMTC Compliance Platform</p>

      {error && <div className="alert alert-error">{error}</div>}

      <form className="card form-stack" onSubmit={(e) => submit(e)}>
        <label>Email
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </label>
        <label>Password
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </label>
        <button type="submit" disabled={busy}>{busy ? "Signing in…" : "Sign in"}</button>
      </form>

      <div className="card">
        <p className="muted text-sm" style={{ marginTop: 0 }}>
          Dev demo accounts (password <code>{DEMO_PASSWORD}</code> for all — real login, not a header switch):
        </p>
        <div style={{ display: "grid", gap: 8 }}>
          {DEMO_ACCOUNTS.map((a) => (
            <button
              key={a.email}
              className="btn-secondary"
              style={{ display: "block", width: "100%", textAlign: "left" }}
              onClick={(e) => submit(e, a.email, DEMO_PASSWORD)}
              disabled={busy}
            >
              <strong style={{ color: "inherit" }}>{a.label}</strong>
              <div style={{ fontSize: 12, fontWeight: 400, opacity: 0.8 }}>{a.email}</div>
            </button>
          ))}
        </div>
      </div>
    </main>
  );
}
