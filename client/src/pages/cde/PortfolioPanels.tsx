import { Link } from "react-router-dom";
import type { PortfolioSummary } from "../../api/client";
import { formatNumber } from "../../utils/format";
import { IMPACT_METRIC_LABEL } from "../../utils/impactMetrics";

/**
 * The three analytic panels under the portfolio deal table, plus the community-impact
 * roll-up. Every figure here is a link: the design rule for this dashboard is that a
 * chart exists to route someone to the underlying records, not to decorate the page, so
 * nothing renders as a dead statistic. Segments with a zero count deliberately stay
 * unlinked — sending someone to an empty filtered list is worse than not offering.
 */

const HEALTH_SEGMENTS = [
  { key: "current", label: "Current", color: "var(--success)" },
  { key: "dueSoon", label: "Due < 30 days", color: "var(--warning)" },
  { key: "overdue", label: "Overdue", color: "var(--danger)" },
  { key: "materialIssues", label: "Material issues", color: "var(--ink)" },
] as const;

/** Where each health segment sends you — the actual records behind the number. */
const HEALTH_LINK: Record<string, string> = {
  current: "/cde/deals",
  dueSoon: "/cde/review-queue?due=30_days",
  overdue: "/cde/review-queue?due=overdue",
  materialIssues: "/cde/issues?severity=high",
};

function Donut({ health }: { health: PortfolioSummary["health"] }) {
  const total = HEALTH_SEGMENTS.reduce((s, seg) => s + health[seg.key], 0);
  const currentPercent = total > 0 ? Math.round((health.current / total) * 100) : 0;

  // Hand-drawn with stroke-dasharray on concentric circles rather than pulling in a chart
  // library for one donut. r=60 gives a circumference of ~377, which each segment claims a
  // slice of; offsets accumulate so the segments sit end to end.
  const r = 60;
  const circumference = 2 * Math.PI * r;
  let offset = 0;

  return (
    <div style={{ display: "flex", gap: 18, alignItems: "center", flexWrap: "wrap" }}>
      <svg width="150" height="150" viewBox="0 0 150 150" role="img" aria-label={`${currentPercent}% of deals current`}>
        <circle cx="75" cy="75" r={r} fill="none" stroke="var(--border)" strokeWidth="18" />
        {total > 0 &&
          HEALTH_SEGMENTS.map((seg) => {
            const value = health[seg.key];
            if (value === 0) return null;
            const length = (value / total) * circumference;
            const dash = `${length} ${circumference - length}`;
            const el = (
              <circle
                key={seg.key}
                cx="75"
                cy="75"
                r={r}
                fill="none"
                stroke={seg.color}
                strokeWidth="18"
                strokeDasharray={dash}
                strokeDashoffset={-offset}
                transform="rotate(-90 75 75)"
              />
            );
            offset += length;
            return el;
          })}
        <text x="75" y="70" textAnchor="middle" fontSize="26" fontWeight="700" fill="var(--ink)">{currentPercent}%</text>
        <text x="75" y="90" textAnchor="middle" fontSize="11" fill="var(--text-muted)">Current</text>
      </svg>

      <div style={{ flex: "1 1 180px", minWidth: 160 }}>
        {HEALTH_SEGMENTS.map((seg) => {
          const value = health[seg.key];
          const row = (
            <span style={{ display: "flex", alignItems: "center", gap: 8, width: "100%" }}>
              <span style={{ width: 10, height: 10, borderRadius: 2, background: seg.color, flexShrink: 0 }} />
              <span style={{ flex: 1 }}>{seg.label}</span>
              <strong>{value}</strong>
            </span>
          );
          return (
            <div key={seg.key} style={{ padding: "5px 0", borderBottom: "1px solid var(--border)" }}>
              {value > 0 ? <Link to={HEALTH_LINK[seg.key]} style={{ color: "inherit", fontWeight: 400 }}>{row}</Link> : row}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Deadlines({ deadlines }: { deadlines: PortfolioSummary["deadlines"] }) {
  // The panel is about the next 90 days, but the long tail is real and large — these are
  // seven-year compliance periods, so most instances sit years out. Scaling the bars to
  // the whole range would flatten the actionable buckets into slivers, so the 90+ figure
  // is reported as context beneath rather than as a competing bar.
  const near = deadlines.filter((d) => d.key !== "90_plus");
  const beyond = deadlines.find((d) => d.key === "90_plus");
  const max = Math.max(1, ...near.map((d) => d.count));

  return (
    <>
      <div className="field-label" style={{ marginBottom: 8 }}>Next 90 days</div>
      {near.map((b) => {
        const bar = (
          <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span className="text-sm" style={{ width: 74, flexShrink: 0, color: "var(--text-muted)" }}>{b.label}</span>
            <span style={{ flex: 1, background: "var(--bg)", borderRadius: 3, height: 18, overflow: "hidden" }}>
              <span
                style={{
                  display: "block",
                  height: "100%",
                  width: `${Math.max(b.count > 0 ? 6 : 0, (b.count / max) * 100)}%`,
                  background: b.count > 0 ? "var(--brand-bright)" : "transparent",
                }}
              />
            </span>
            <strong style={{ width: 28, textAlign: "right" }}>{b.count}</strong>
          </span>
        );
        return (
          <div key={b.key} style={{ padding: "5px 0" }}>
            {b.count > 0 ? (
              <Link to={`/cde/review-queue?due=${b.key}`} style={{ color: "inherit", fontWeight: 400 }}>{bar}</Link>
            ) : (
              bar
            )}
          </div>
        );
      })}
      {beyond && (
        <p className="text-sm muted" style={{ marginTop: 10, marginBottom: 0 }}>
          {beyond.count > 0 ? (
            <Link to="/cde/review-queue?due=90_plus">{formatNumber(beyond.count)} more</Link>
          ) : (
            "None"
          )}{" "}
          scheduled beyond 90 days.
        </p>
      )}
    </>
  );
}

function AmisReadiness({ amis, year }: { amis: PortfolioSummary["amis"]; year: number }) {
  return (
    <>
      <div className="field-label" style={{ marginBottom: 8 }}>{year} AMIS reporting</div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <span className="text-sm muted">Portfolio readiness</span>
        <strong style={{ fontSize: 18 }}>{amis.readinessPercent}%</strong>
      </div>
      <div style={{ background: "var(--bg)", borderRadius: 3, height: 12, overflow: "hidden", margin: "6px 0 12px" }}>
        <span style={{ display: "block", height: "100%", width: `${amis.readinessPercent}%`, background: "var(--success)" }} />
      </div>

      <div className="btn-row" style={{ marginBottom: 12 }}>
        <span className="badge badge-success">{amis.ready} ready</span>
        <span className={`badge ${amis.incomplete ? "badge-warning" : "badge-neutral"}`}>{amis.incomplete} incomplete</span>
        <span className={`badge ${amis.notStarted ? "badge-danger" : "badge-neutral"}`}>{amis.notStarted} not started</span>
      </div>

      <div className="field-label" style={{ marginBottom: 4 }}>Missing fields</div>
      {amis.missingByCategory.length === 0 && <p className="text-sm muted" style={{ margin: 0 }}>Nothing outstanding.</p>}
      {amis.missingByCategory.map((c) => (
        <div key={c.category} style={{ padding: "5px 0", borderBottom: "1px solid var(--border)" }}>
          <Link
            to={`/cde/amis?category=${encodeURIComponent(c.category)}`}
            style={{ color: "inherit", fontWeight: 400, display: "flex", justifyContent: "space-between", gap: 8 }}
          >
            <span>{c.category}</span>
            <strong>{c.count}</strong>
          </Link>
        </div>
      ))}
    </>
  );
}

function achievementBadge(pct: number | null) {
  if (pct === null) return "badge-neutral";
  if (pct >= 100) return "badge-success";
  if (pct >= 85) return "badge-warning";
  return "badge-danger";
}

function CommunityImpact({ impact, year }: { impact: PortfolioSummary["impact"]; year: number }) {
  if (impact.length === 0) {
    return (
      <p className="empty-state">
        No impact commitments recorded yet. Add them per deal to compare committed against actual.
      </p>
    );
  }

  return (
    <>
      <p className="text-sm muted" style={{ marginTop: 0 }}>
        CY {year} actuals reported by QALICBs, against the commitments recorded for each deal. A measure only
        counts deals that committed to it, so the achievement column compares like with like.
      </p>
      <div className="table-wrap">
        <table>
          <thead>
            <tr><th>Measure</th><th>Committed</th><th>Actual</th><th>Achievement</th><th>Deals</th></tr>
          </thead>
          <tbody>
            {impact.map((row) => (
              <tr key={row.metric}>
                <td>{IMPACT_METRIC_LABEL[row.metric] ?? row.metric}</td>
                <td>{formatNumber(row.committed)}</td>
                <td>{formatNumber(row.actual)}</td>
                <td><span className={`badge ${achievementBadge(row.achievementPercent)}`}>{row.achievementPercent === null ? "—" : `${row.achievementPercent}%`}</span></td>
                <td className="muted">{row.dealsCommitted}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

export default function PortfolioPanels({ summary }: { summary: PortfolioSummary }) {
  return (
    <>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16, marginBottom: 18 }}>
        <div className="card">
          <h2>Portfolio compliance health</h2>
          <Donut health={summary.health} />
        </div>
        <div className="card">
          <h2>Upcoming compliance deadlines</h2>
          <Deadlines deadlines={summary.deadlines} />
        </div>
        <div className="card">
          <h2>AMIS readiness</h2>
          <AmisReadiness amis={summary.amis} year={summary.year} />
        </div>
      </div>

      <div className="card">
        <h2>Portfolio community impact</h2>
        <CommunityImpact impact={summary.impact} year={summary.year} />
      </div>
    </>
  );
}
