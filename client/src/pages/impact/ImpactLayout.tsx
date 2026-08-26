import { Outlet } from "react-router-dom";
import PortalGuard from "../../auth/PortalGuard";
import { useAuth } from "../../auth/AuthContext";
import NotificationBell from "../shared/NotificationBell";

export default function ImpactLayout() {
  const { user, logout } = useAuth();

  return (
    <PortalGuard portal="impact">
      <nav style={{ padding: "8px 24px", background: "#eef2f6", borderBottom: "1px solid #dbe1e8", fontSize: 14, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span>Impact Marketplace staff — signed in as {user?.email} &nbsp;·&nbsp; <button onClick={logout} style={{ fontSize: 14 }}>Log out</button></span>
        <NotificationBell />
      </nav>
      <Outlet />
    </PortalGuard>
  );
}
