import { useEffect } from "react";
import { Link, Outlet } from "react-router-dom";
import { setActingUser } from "../../api/client";

// Dev-only stand-in for real auth — see the note on setActingUser in api/client.ts.
const CDE_USER_EMAIL = "reviewer@enterprisecde.example";

export default function CdeLayout() {
  useEffect(() => {
    setActingUser(CDE_USER_EMAIL);
  }, []);

  return (
    <div>
      <nav style={{ padding: "8px 24px", background: "#eef2f6", borderBottom: "1px solid #dbe1e8", fontSize: 14 }}>
        CDE Portal — acting as {CDE_USER_EMAIL} &nbsp;·&nbsp;
        <Link to="/cde">Portfolio</Link>
      </nav>
      <Outlet />
    </div>
  );
}
