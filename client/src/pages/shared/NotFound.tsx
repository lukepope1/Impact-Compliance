import { Link, useLocation } from "react-router-dom";

/**
 * Shown for any address that matches no route. Previously an unmatched URL rendered
 * nothing at all — a blank page under the header, indistinguishable from the app having
 * crashed. Rendered inside a portal's layout when the address is under that portal, so the
 * sidebar is still there to navigate with.
 */
export default function NotFound() {
  const { pathname } = useLocation();
  const portal = ["impact", "cde", "qalicb"].find((p) => pathname.startsWith(`/${p}`));

  return (
    <main>
      <h1>Page not found</h1>
      <div className="alert alert-warning">
        Nothing lives at <code>{pathname}</code>. The link may be out of date, or the address mistyped.
      </div>
      <Link to={portal ? `/${portal === "impact" ? "impact/deals" : portal}` : "/"}>
        ← Back to {portal ? "your portal home" : "the start page"}
      </Link>
    </main>
  );
}
