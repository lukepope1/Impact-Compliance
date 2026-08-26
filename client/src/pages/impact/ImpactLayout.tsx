import { Outlet } from "react-router-dom";
import PortalGuard from "../../auth/PortalGuard";
import { useAuth } from "../../auth/AuthContext";

export default function ImpactLayout() {
  const { user, logout } = useAuth();

  return (
    <PortalGuard portal="impact">
      <nav style={{ padding: "8px 24px", background: "#eef2f6", borderBottom: "1px solid #dbe1e8", fontSize: 14 }}>
        Impact Marketplace staff — signed in as {user?.email} &nbsp;·&nbsp;
        <button onClick={logout} style={{ fontSize: 14 }}>Log out</button>
      </nav>
      <Outlet />
    </PortalGuard>
  );
}
