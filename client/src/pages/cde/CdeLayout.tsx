import { Link, Outlet } from "react-router-dom";
import PortalGuard from "../../auth/PortalGuard";
import { useAuth } from "../../auth/AuthContext";
import NotificationBell from "../shared/NotificationBell";

export default function CdeLayout() {
  const { user, logout } = useAuth();

  return (
    <PortalGuard portal="cde">
      <nav className="portal-nav">
        <span>
          <strong>CDE Portal</strong> — signed in as {user?.email}
          <span className="portal-nav-links">
            <Link to="/cde">Portfolio</Link>
            <button className="btn-logout" onClick={logout}>Log out</button>
          </span>
        </span>
        <NotificationBell />
      </nav>
      <Outlet />
    </PortalGuard>
  );
}
