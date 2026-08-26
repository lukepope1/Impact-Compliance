import { NavLink, Outlet } from "react-router-dom";
import PortalGuard from "../../auth/PortalGuard";
import { useAuth } from "../../auth/AuthContext";
import NotificationBell from "../shared/NotificationBell";

const NAV_ITEMS = [
  { to: "/impact/deals", label: "Portfolio", end: true },
  { to: "/impact/review-queue", label: "Review Queue" },
  { to: "/impact/amis", label: "AMIS" },
  { to: "/impact/issues", label: "Issues" },
  { to: "/impact/documents", label: "Documents" },
  { to: "/impact/audit", label: "Audit Log" },
];

export default function ImpactLayout() {
  const { user, logout } = useAuth();

  return (
    <PortalGuard portal="impact">
      <nav className="portal-nav">
        <span>
          <strong>Impact Marketplace staff</strong> — signed in as {user?.email} &nbsp;·&nbsp;
          <button className="btn-logout" onClick={logout}>Log out</button>
        </span>
        <NotificationBell />
      </nav>
      <div className="portal-shell">
        <aside className="portal-sidebar">
          {NAV_ITEMS.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.end}>
              {item.label}
            </NavLink>
          ))}
        </aside>
        <Outlet />
      </div>
    </PortalGuard>
  );
}
