import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "./AuthContext";

const ROLE_PREFIX: Record<"impact" | "qalicb" | "cde", string> = {
  impact: "impact_",
  qalicb: "qalicb_",
  cde: "cde_",
};

/**
 * Gates a portal's routes on real auth: redirects to /login if not signed in, and shows
 * an access-denied message (with a way to switch accounts) if signed in as a user with no
 * membership role for this portal — e.g. a QALICB user opening /cde. With real per-user
 * login there's exactly one identity per browser session, so testing a different portal
 * means logging out and back in as a different seeded account, same as it would for real.
 */
export default function PortalGuard({ portal, children }: { portal: "impact" | "qalicb" | "cde"; children: React.ReactNode }) {
  const { user, loading, logout } = useAuth();
  const location = useLocation();

  if (loading) return <main>Loading…</main>;

  if (!user) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }

  const hasPortalRole = user.memberships.some((m) => m.roleCode.startsWith(ROLE_PREFIX[portal]));
  if (!hasPortalRole) {
    return (
      <main>
        <div className="card">
          <h1>Not authorized</h1>
          <p>
            You're signed in as <strong>{user.email}</strong>, which has no {portal} portal role.
          </p>
          <button onClick={logout}>Log out and switch accounts</button>
        </div>
      </main>
    );
  }

  return <>{children}</>;
}
