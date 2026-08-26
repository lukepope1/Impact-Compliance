import { useEffect } from "react";
import { Outlet } from "react-router-dom";
import { setActingUser } from "../../api/client";

const IMPACT_USER_EMAIL = "compliance@impactmarketplace.com";

export default function ImpactLayout() {
  useEffect(() => {
    setActingUser(IMPACT_USER_EMAIL);
  }, []);

  return <Outlet />;
}
