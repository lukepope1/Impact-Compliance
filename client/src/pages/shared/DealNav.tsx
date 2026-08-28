import { useEffect, useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { api, type Deal } from "../../api/client";

/**
 * Lateral navigation between one deal's screens.
 *
 * The sidebar is portfolio-scoped, so once you opened a deal there was no way across to
 * another of its screens: from Deal Setup you had to go back to the portfolio and drill in
 * again to reach AMIS Readiness. This puts the deal's own screens one click apart and keeps
 * the deal you are in named on the page, which the inner screens otherwise only implied.
 *
 * Tabs are per portal because the portals genuinely have different deal routes — linking a
 * CDE to Impact's Deal Setup would just be a 404 with extra steps.
 */

interface DealTab {
  /** Appended to /{portal}/deals/{dealId}; "" is the deal's own landing screen. */
  suffix: string;
  label: string;
  /**
   * A tab that lives outside the deal, given as a full path. Used for the QALICB's task
   * list: its requirement pages are deal-scoped but the list they belong to is not, and
   * leaving it out is what made the requirement screen a dead end.
   */
  absolute?: string;
  /**
   * Extra deal-relative paths this tab covers. The QALICB requirement workspace is under
   * /deals/:id/requirements/:instanceId, which is no tab's own route — without this the
   * strip rendered with nothing highlighted, which reads as broken.
   */
  alsoMatches?: RegExp;
}

const TABS: Record<"impact" | "cde" | "qalicb", DealTab[]> = {
  impact: [
    { suffix: "", label: "Overview" },
    { suffix: "/setup", label: "Deal setup" },
    { suffix: "/requirements", label: "Requirements" },
    { suffix: "/deadlines", label: "Deadlines" },
    { suffix: "/review-queue", label: "Review queue" },
    { suffix: "/cbr", label: "Community benefits" },
    { suffix: "/snapshot", label: "Snapshot" },
    { suffix: "/amis", label: "AMIS readiness" },
    { suffix: "/tlr", label: "TLR data entry" },
    { suffix: "/documents", label: "Documents" },
    { suffix: "/issues", label: "Issues" },
    { suffix: "/audit", label: "Audit" },
  ],
  cde: [
    { suffix: "", label: "Overview" },
    { suffix: "/review-queue", label: "Review queue" },
    { suffix: "/cbr", label: "Community benefits" },
    { suffix: "/snapshot", label: "Snapshot" },
    { suffix: "/amis", label: "AMIS readiness" },
    { suffix: "/tlr", label: "TLR data entry" },
    { suffix: "/documents", label: "Documents" },
    { suffix: "/issues", label: "Issues" },
  ],
  // The QALICB portal has no deal overview of its own. Its requirement pages are reached
  // from the task list, so that list is included here as the way back — it is the screen a
  // QALICB returns to after each submission.
  qalicb: [
    { suffix: "", label: "Compliance tasks", absolute: "/qalicb/tasks", alsoMatches: /^\/requirements\// },
    { suffix: "/cbr", label: "Community benefits" },
    { suffix: "/documents", label: "Documents" },
  ],
};

/** Where "back to the list" goes, which is not the same route in every portal. */
const PORTFOLIO: Record<"impact" | "cde" | "qalicb", { to: string; label: string }> = {
  impact: { to: "/impact/deals", label: "Portfolio" },
  cde: { to: "/cde/deals", label: "Deals" },
  qalicb: { to: "/qalicb", label: "Dashboard" },
};

export default function DealNav({ portal, dealId }: { portal: "impact" | "cde" | "qalicb"; dealId: string }) {
  const [deal, setDeal] = useState<Deal | null>(null);
  const { pathname } = useLocation();

  useEffect(() => {
    let active = true;
    setDeal(null);
    // Failure is silent on purpose: this is navigation furniture, and the page it sits
    // above will report the real problem if the deal genuinely can't be loaded.
    api
      .getDeal(dealId)
      .then((d) => active && setDeal(d))
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [dealId]);

  const tabs = TABS[portal];
  const back = PORTFOLIO[portal];

  // Whatever follows /{portal}/deals/{dealId} — "" on the deal's own screen.
  const suffix = pathname.replace(`/${portal}/deals/${dealId}`, "") || "";

  function isActive(t: DealTab) {
    if (t.alsoMatches?.test(suffix)) return true;
    return t.absolute ? pathname === t.absolute : suffix === t.suffix;
  }

  return (
    <nav className="deal-nav" aria-label="Deal sections">
      <div className="deal-nav-heading">
        <Link to={back.to} className="deal-nav-back">
          ← {back.label}
        </Link>
        <span className="deal-nav-title">
          {/* Reserves the line before the fetch resolves so the tabs don't jump down. */}
          {deal ? (
            <>
              <strong>{deal.dealCode}</strong>
              <span className="muted"> · {deal.legalName}</span>
            </>
          ) : (
            <span className="muted">Loading deal…</span>
          )}
        </span>
      </div>
      <div className="deal-nav-tabs">
        {tabs.map((t) =>
          // Tabs needing a custom match rule are rendered as plain links with the active
          // class decided here; NavLink can only compare against its own href.
          t.absolute || t.alsoMatches ? (
            <Link
              key={t.label}
              to={t.absolute ?? `/${portal}/deals/${dealId}${t.suffix}`}
              className={isActive(t) ? "active" : undefined}
            >
              {t.label}
            </Link>
          ) : (
            <NavLink
              key={t.label}
              to={`/${portal}/deals/${dealId}${t.suffix}`}
              // Only the bare deal route needs `end`; without it the Overview tab would
              // stay highlighted on every child route beneath it.
              end={t.suffix === ""}
            >
              {t.label}
            </NavLink>
          )
        )}
      </div>
    </nav>
  );
}
