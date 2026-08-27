import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  api,
  type CbrPeriod,
  type CdeParticipation,
  type Deal,
  type DealParty,
  type GoldenFieldRow,
  type IssueRow,
  type QliciRow,
  type RequirementInstance,
} from "../../api/client";
import { useAuth } from "../../auth/AuthContext";
import { dealStatusBadgeClass } from "../shared/StatusBadge";
import { formatCurrency } from "../../utils/format";

function fmt(d: string | null) {
  return d ? new Date(d).toLocaleDateString(undefined, { timeZone: "UTC" }) : "—";
}

const IMPACT_LABEL: Record<string, string> = {
  not_due: "Upcoming",
  upcoming: "Upcoming",
  draft_submitted: "Awaiting",
  submitted: "Awaiting",
  impact_review: "Awaiting",
  returned: "Returned",
  impact_approved: "Approved",
  cde_review: "Approved",
  cde_approved: "Approved",
  amis_ready: "Approved",
  exported_filed: "Approved",
  closed: "Approved",
  waived: "Waived",
};

/**
 * A per-deal landing page for the CDE portal, matching a low-fidelity wireframe: stat
 * cards for compliance/exceptions/CBR/AMIS, a requirements table, and a "CDE-specific
 * deal data" panel scoped to *this* CDE's own participation — its own QLICIs and
 * allocation numbers, not another CDE's, on a multi-CDE deal like Millennium.
 */
export default function CdeDealOverview() {
  const { dealId } = useParams();
  const { user } = useAuth();
  const year = new Date().getFullYear();

  const [deal, setDeal] = useState<Deal | null>(null);
  const [parties, setParties] = useState<DealParty[] | null>(null);
  const [instances, setInstances] = useState<RequirementInstance[] | null>(null);
  const [issues, setIssues] = useState<IssueRow[] | null>(null);
  const [cbrPeriod, setCbrPeriod] = useState<CbrPeriod | null>(null);
  const [amisFields, setAmisFields] = useState<GoldenFieldRow[] | null>(null);
  const [participations, setParticipations] = useState<CdeParticipation[] | null>(null);
  const [qlicis, setQlicis] = useState<QliciRow[] | null>(null);
  const [privateNoteCount, setPrivateNoteCount] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!dealId) return;
    api.getDeal(dealId).then(setDeal).catch((e) => setError(String(e.message ?? e)));
    api.listParties(dealId).then(setParties).catch(() => setParties([]));
    api.listRequirementInstances(dealId).then(setInstances).catch((e) => setError(String(e.message ?? e)));
    api.listIssues(dealId).then(setIssues).catch(() => setIssues([]));
    api.getCbrPeriod(dealId, year).then(setCbrPeriod).catch(() => setCbrPeriod(null));
    api.getAmisReadiness(dealId, year).then(setAmisFields).catch(() => setAmisFields([]));
    api.listCdeParticipations(dealId).then(setParticipations).catch(() => setParticipations([]));
    api.listQlicis(dealId).then(setQlicis).catch(() => setQlicis([]));
  }, [dealId, year]);

  useEffect(() => {
    if (!dealId || !issues) return;
    Promise.all(issues.map((i) => api.listIssueNotes(dealId, i.id).catch(() => [])))
      .then((lists) => setPrivateNoteCount(lists.reduce((sum, l) => sum + l.length, 0)))
      .catch(() => setPrivateNoteCount(0));
  }, [dealId, issues]);

  if (error) return <main><div className="alert alert-error">{error}</div></main>;
  if (!deal) return <main><p className="muted is-loading">Loading…</p></main>;

  const myOrgId = user?.memberships[0]?.organizationId;
  const myParticipation = participations?.find((p) => p.cdeOrganization.id === myOrgId);
  const myQlicis = qlicis?.filter((q) => q.cdeParticipation.cdeOrganizationId === myOrgId) ?? [];
  const borrower = parties?.find((p) => p.partyRole === "borrower");

  const overdueCount = instances?.filter((i) => i.isOverdue).length ?? 0;
  const upcomingCount = instances?.filter((i) => i.status === "upcoming").length ?? 0;
  const returnedCount = instances?.filter((i) => i.status === "returned").length ?? 0;
  const complianceLabel = overdueCount > 0 ? "Attention needed" : returnedCount > 0 ? "Needs revision" : "Current";

  const openIssues = issues?.filter((i) => i.status !== "resolved") ?? [];
  const mostRecentIssue = issues?.[0];

  // Lightweight, real completeness proxy — not a canonical CBR completion score (no such
  // field exists yet) — just "how many of the three sections this app collects have any
  // data at all," so the number reflects what's actually there instead of being invented.
  const cbrSections = cbrPeriod
    ? [!!cbrPeriod.projectProfile?.annualGrossRevenue, cbrPeriod.jobRecords.length > 0, cbrPeriod.tenantOccupants.length > 0]
    : [];
  const cbrSectionsFilled = cbrSections.filter(Boolean).length;
  const cbrPercent = cbrSections.length > 0 ? Math.round((cbrSectionsFilled / cbrSections.length) * 100) : 0;

  const amisReady = amisFields?.filter((f) => f.status === "ready").length ?? 0;
  const amisTotal = amisFields?.length ?? 0;
  const amisMissing = amisTotal - amisReady;

  return (
    <main>
      <h1>Deal Overview</h1>
      <p>
        {deal.legalName}
        {myParticipation?.subCdeName ? ` · ${myParticipation.subCdeName}` : ""}
        {participations?.find((p) => p.isLeadCde) ? ` · Lead CDE: ${participations.find((p) => p.isLeadCde)?.cdeOrganization.legalName}` : ""}
        {" · "}
        <span className={`badge ${dealStatusBadgeClass(deal.status)}`}>{deal.status.replace("_", " ")}</span>
      </p>

      <div className="stat-grid">
        <div className={`stat-card${overdueCount > 0 ? " stat-danger" : ""}`}>
          <div className="stat-label" style={{ marginBottom: 6 }}>Compliance status</div>
          <div className="stat-value" style={{ fontSize: 20 }}>{complianceLabel}</div>
          {(upcomingCount > 0 || overdueCount > 0) && (
            <div className="badge-stack">
              {upcomingCount > 0 && <span className="badge badge-warning">{upcomingCount} upcoming</span>}
              {overdueCount > 0 && <span className="badge badge-danger">{overdueCount} overdue</span>}
            </div>
          )}
        </div>
        <div className="stat-card">
          <div className="stat-label" style={{ marginBottom: 6 }}>Open exceptions</div>
          <div className="stat-value">{openIssues.length}</div>
          {mostRecentIssue && (
            <div className="badge-stack">
              <span className={`badge ${mostRecentIssue.status === "resolved" ? "badge-success" : "badge-warning"}`}>
                {mostRecentIssue.title.length > 28 ? `${mostRecentIssue.title.slice(0, 28)}…` : mostRecentIssue.title}
              </span>
            </div>
          )}
        </div>
        <Link to={`/cde/deals/${dealId}/cbr`} className="stat-card">
          <div className="stat-label" style={{ marginBottom: 6 }}>CBR progress</div>
          <div className="stat-value">{cbrPercent}%</div>
          <div className="badge-stack"><span className="badge badge-navy">CY {year}</span></div>
        </Link>
        <div className={`stat-card${amisMissing > 0 ? " stat-warning" : ""}`}>
          <div className="stat-label" style={{ marginBottom: 6 }}>AMIS readiness</div>
          <div className="stat-value">{amisReady} / {amisTotal}</div>
          {amisMissing > 0 && <div className="badge-stack"><span className="badge badge-warning">{amisMissing} missing</span></div>}
        </div>
      </div>

      <div className="split">
        <div className="split-main">
          <table>
            <thead>
              <tr><th>Requirement</th><th>Entity / period</th><th>Due</th><th>Impact</th><th>CDE</th></tr>
            </thead>
            <tbody>
              {instances?.map((i) => (
                <tr key={i.id}>
                  <td>{i.requirementDefinition.title}</td>
                  <td>{i.responsibleParty ? i.responsibleParty.legalName : "Deal-level"} · {fmt(i.reportingPeriodEnd)}</td>
                  <td>{fmt(i.dueDate)}</td>
                  <td>{i.isOverdue ? "Overdue" : (IMPACT_LABEL[i.status] ?? i.status)}</td>
                  <td>
                    {i.status === "impact_approved" ? (
                      <Link to={`/cde/deals/${dealId}/review-queue`}>Review</Link>
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              ))}
              {instances && instances.length === 0 && <tr><td colSpan={5} className="state-cell">No requirement instances yet.</td></tr>}
              {!instances && <tr><td colSpan={5} className="state-cell">Loading…</td></tr>}
            </tbody>
          </table>
        </div>

        <div className="card split-aside">
          <h2>CDE-specific deal data</h2>

          {myQlicis.length > 0 ? (
            myQlicis.map((q) => (
              <div key={q.id} className="field">
                <div className="field-label">{q.qliciCode}{q.noteClass ? ` (Note ${q.noteClass})` : ""}</div>
                <div className="field-value" style={{ fontWeight: 600 }}>{formatCurrency(q.originalPrincipal)}</div>
              </div>
            ))
          ) : (
            <p className="muted text-sm" style={{ marginTop: 0 }}>No QLICI records on this deal yet.</p>
          )}

          <div className="field">
            <div className="field-label">Allocation control no.</div>
            <div className="field-value">{myParticipation?.allocationControlNumber ?? "—"}</div>
          </div>

          <div className="field">
            <div className="field-label">Private notes</div>
            <div className="field-value">{privateNoteCount === null ? "…" : `${privateNoteCount} note${privateNoteCount === 1 ? "" : "s"}`}</div>
          </div>

          <div className="field">
            <div className="field-label">Borrower</div>
            <div className="field-value">{borrower?.legalName ?? "—"}</div>
          </div>

          <div className="field">
            <div className="field-label">Shared project outcomes</div>
            <div className="field-value"><Link to={`/cde/deals/${dealId}/snapshot`}>View Multi-CDE snapshot</Link></div>
          </div>
        </div>
      </div>
    </main>
  );
}
