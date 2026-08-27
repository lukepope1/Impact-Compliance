import { NavLink, Outlet } from "react-router-dom";
import PortalGuard from "../../auth/PortalGuard";
import { useAuth } from "../../auth/AuthContext";
import NotificationBell from "../shared/NotificationBell";

const NAV_ITEMS = [
  { to: "/qalicb", label: "Dashboard", end: true },
  { to: "/qalicb/tasks", label: "Compliance Tasks" },
  { to: "/qalicb/benefits", label: "Community Benefits" },
  { to: "/qalicb/documents", label: "Documents" },
  { to: "/qalicb/messages", label: "Messages" },
];

export default function QalicbLayout() {
  const { user, logout } = useAuth();

  return (
    <PortalGuard portal="qalicb">
      <nav className="portal-nav">
        <span>
          <strong>QALICB Portal</strong> — signed in as {user?.email}
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
