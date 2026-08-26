import { Outlet } from "react-router-dom";
import PortalGuard from "../../auth/PortalGuard";
import { useAuth } from "../../auth/AuthContext";
import NotificationBell from "../shared/NotificationBell";

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
      <Outlet />
    </PortalGuard>
  );
}
