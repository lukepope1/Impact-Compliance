import { NavLink, Outlet } from "react-router-dom";
import PortalGuard from "../../auth/PortalGuard";
import { useAuth } from "../../auth/AuthContext";
import NotificationBell from "../shared/NotificationBell";

const NAV_ITEMS = [
  { to: "/cde", label: "Portfolio", end: true },
  { to: "/cde/review-queue", label: "Review Queue" },
  { to: "/cde/deals", label: "Deals" },
  { to: "/cde/amis", label: "AMIS" },
  { to: "/cde/issues", label: "Issues" },
  { to: "/cde/documents", label: "Documents" },
];

export default function CdeLayout() {
  const { user, logout } = useAuth();

  return (
    <PortalGuard portal="cde">
      <nav className="portal-nav">
        <span>
          <strong>CDE Portal</strong> — signed in as {user?.email}
          <span className="portal-nav-links">
            <button className="btn-logout" onClick={logout}>Log out</button>
          </span>
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
