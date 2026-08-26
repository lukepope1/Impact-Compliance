import { Link, Outlet } from "react-router-dom";
import PortalGuard from "../../auth/PortalGuard";
import { useAuth } from "../../auth/AuthContext";
import NotificationBell from "../shared/NotificationBell";

export default function QalicbLayout() {
  const { user, logout } = useAuth();

  return (
    <PortalGuard portal="qalicb">
      <nav style={{ padding: "8px 24px", background: "#eef2f6", borderBottom: "1px solid #dbe1e8", fontSize: 14, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span>
          QALICB Portal — signed in as {user?.email} &nbsp;·&nbsp;
          <Link to="/qalicb">Dashboard</Link> &nbsp;·&nbsp;
          <button onClick={logout} style={{ fontSize: 14 }}>Log out</button>
        </span>
        <NotificationBell />
      </nav>
      <Outlet />
    </PortalGuard>
  );
}
