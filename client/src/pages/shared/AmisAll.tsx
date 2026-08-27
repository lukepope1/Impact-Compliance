import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api, type Deal, type GoldenFieldRow } from "../../api/client";

/**
 * Field-level AMIS readiness across the portfolio. This previously reported only an
 * "n/13 ready" count per deal, which told a CDE something was missing but not what — the
 * next step was always to open each deal and compare by eye. Listing the individual
 * outstanding fields, filterable by the same categories the portfolio dashboard charts,
 * is what makes the dashboard's "Jobs — 8" link land somewhere useful.
 */

// Mirrors AMIS_FIELD_CATEGORY in server/src/lib/goldenFields.ts. Duplicated rather than
// fetched because it's a display grouping, not data — the server already sends every
// field code, and a round trip to learn how to label them would buy nothing.
const FIELD_CATEGORY: Record<string, string> = {
  jobs_created_actual: "Jobs",
  jobs_retained_actual: "Jobs",
  jobs_construction_actual: "Jobs",
  tenant_count: "Community impacts",
  annual_gross_revenue: "QALICB financial data",
  annual_net_operating_income: "QALICB financial data",
  project_census_tract: "Addresses / geocoding",
  project_city_state: "Addresses / geocoding",
  multi_cde_project_number: "Deal & CDE data",
  project_closing_date: "Deal & CDE data",
  total_qei_amount: "Deal & CDE data",
  total_qlici_original_principal: "Deal & CDE data",
  lead_cde_allocation_control_number: "Deal & CDE data",
};

type Row = GoldenFieldRow & { dealId: string; dealName: string; category: string };

export default function AmisAll({ portal }: { portal: "impact" | "cde" }) {
  const year = new Date().getFullYear();
  const [searchParams] = useSearchParams();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Seeded from ?category= so the portfolio dashboard's missing-field links open already
  // narrowed, with the dropdowns reflecting it so the filter stays visible and reversible.
  // Arriving via that link also implies "missing", since that's what the chart counted.
  const categoryParam = searchParams.get("category");
  const [categoryFilter, setCategoryFilter] = useState(categoryParam ?? "all");
  const [statusFilter, setStatusFilter] = useState(categoryParam ? "missing" : "all");
  const [dealFilter, setDealFilter] = useState("all");

  useEffect(() => {
    api
      .listDeals()
      .then(async (deals: Deal[]) => {
        const perDeal = await Promise.all(
          deals.map((deal) =>
            api.getAmisReadiness(deal.id, year).then((fields) =>
              fields.map((f) => ({
                ...f,
                dealId: deal.id,
                dealName: deal.legalName,
                category: FIELD_CATEGORY[f.fieldCode] ?? "Other",
              }))
            )
          )
        );
        setRows(perDeal.flat());
      })
      .catch((e) => setError(String(e.message ?? e)));
  }, [year]);

  const filtered = useMemo(() => {
    if (!rows) return rows;
    return rows.filter((r) => {
      if (categoryFilter !== "all" && r.category !== categoryFilter) return false;
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (dealFilter !== "all" && r.dealId !== dealFilter) return false;
      return true;
    });
  }, [rows, categoryFilter, statusFilter, dealFilter]);

  const categories = [...new Set(rows?.map((r) => r.category) ?? [])].sort();
  const readyCount = rows?.filter((r) => r.status === "ready").length ?? 0;
  const missingCount = rows?.filter((r) => r.status === "missing").length ?? 0;

  return (
    <main>
      <h1>AMIS Readiness</h1>
      <p>Field-level readiness for CY {year}, across every deal in your portfolio.</p>

      {error && <div className="alert alert-error">{error}</div>}

      <div className="card btn-row">
        <span className="badge badge-success">{readyCount} ready</span>
        <span className={`badge ${missingCount ? "badge-danger" : "badge-neutral"}`}>{missingCount} missing</span>
      </div>

      <div className="card filter-bar">
        <label>
          Deal
          <select value={dealFilter} onChange={(e) => setDealFilter(e.target.value)}>
            <option value="all">All</option>
            {Array.from(new Map(rows?.map((r) => [r.dealId, r.dealName])).entries()).map(([id, name]) => (
              <option key={id} value={id}>{name}</option>
            ))}
          </select>
        </label>
        <label>
          Category
          <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
            <option value="all">All</option>
            {categories.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </label>
        <label>
          Status
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="all">All</option>
            <option value="missing">Missing</option>
            <option value="ready">Ready</option>
          </select>
        </label>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr><th>Deal</th><th>AMIS field</th><th>Category</th><th>Source</th><th>Status</th><th></th></tr>
          </thead>
          <tbody>
            {filtered?.map((r) => (
              <tr key={`${r.dealId}:${r.fieldCode}`}>
                <td>{r.dealName}</td>
                <td>{r.label}</td>
                <td className="muted">{r.category}</td>
                <td className="muted">{r.source}</td>
                <td>
                  <span className={`badge ${r.status === "missing" ? "badge-danger" : "badge-success"}`}>
                    {r.status === "missing" ? "Missing" : "Ready"}
                  </span>
                </td>
                <td><Link to={`/${portal}/deals/${r.dealId}/amis`}>Open</Link></td>
              </tr>
            ))}
            {filtered && filtered.length === 0 && (
              <tr><td className="state-cell" colSpan={6}>{rows && rows.length > 0 ? "No fields match this filter." : "No deals assigned."}</td></tr>
            )}
            {!rows && !error && <tr><td className="state-cell" colSpan={6}>Loading…</td></tr>}
          </tbody>
        </table>
      </div>
    </main>
  );
}
