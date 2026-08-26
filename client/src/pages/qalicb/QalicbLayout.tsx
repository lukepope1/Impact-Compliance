import { useEffect } from "react";
import { Link, Outlet } from "react-router-dom";
import { setActingUser } from "../../api/client";

// Dev-only stand-in for real auth — see the note on setActingUser in api/client.ts.
const QALICB_USER_EMAIL = "jane.doe@millenniumholdings.example";

export default function QalicbLayout() {
  useEffect(() => {
    setActingUser(QALICB_USER_EMAIL);
  }, []);

  return (
    <div>
      <nav style={{ padding: "8px 24px", background: "#eef2f6", borderBottom: "1px solid #dbe1e8", fontSize: 14 }}>
        QALICB Portal — acting as {QALICB_USER_EMAIL} &nbsp;·&nbsp;
        <Link to="/qalicb">Dashboard</Link>
      </nav>
      <Outlet />
    </div>
  );
}
