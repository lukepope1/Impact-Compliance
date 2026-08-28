import { NavLink, Outlet, useMatch } from "react-router-dom";
import PortalGuard from "../../auth/PortalGuard";
import { useAuth } from "../../auth/AuthContext";
import NotificationBell from "./NotificationBell";
import DealNav from "./DealNav";

export interface NavItem {
  to: string;
  label: string;
  end?: boolean;
}

/**
 * The shell every portal shares: identity bar, notification bell, log-out, and the
 * sticky sidebar. The three portals previously each carried their own copy of this
 * markup, which had drifted apart — Impact put its log-out button inline in the identity
 * sentence while CDE and QALICB wrapped theirs in .portal-nav-links, so the same control
 * sat in a different place depending on which portal you were signed into.
 */
export default function PortalLayout({
  portal,
  label,
  navItems,
}: {
  portal: "impact" | "qalicb" | "cde";
  label: string;
  navItems: NavItem[];
}) {
  const { user, logout } = useAuth();
  const membership = user?.memberships[0];

  // Matched here rather than in each page so every deal-scoped screen gets the same
  // navigation without twelve pages having to remember to render it. The trailing splat
  // makes this match the deal's landing route and everything nested under it alike.
  const dealMatch = useMatch(`/${portal}/deals/:dealId/*`);
  const dealId = dealMatch?.params.dealId;
  // "new" is the create-a-deal form, not a deal — it has no sections to navigate between.
  const showDealNav = Boolean(dealId) && dealId !== "new";

  return (
    <PortalGuard portal={portal}>
      <nav className="portal-nav">
        <span className="portal-nav-identity">
          <strong>{label}</strong>
          <span className="muted">
            {membership?.organizationName ? `${membership.organizationName} · ` : ""}
            {user?.email}
          </span>
        </span>
        <span className="portal-nav-links">
          <NotificationBell />
          <button className="btn-logout" onClick={logout}>Log out</button>
        </span>
      </nav>
      <div className="portal-shell">
        <aside className="portal-sidebar">
          {navItems.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.end}>
              {item.label}
            </NavLink>
          ))}
        </aside>
        <div className="portal-content">
          {showDealNav && dealId && <DealNav portal={portal} dealId={dealId} />}
          <Outlet />
        </div>
      </div>
    </PortalGuard>
  );
}
