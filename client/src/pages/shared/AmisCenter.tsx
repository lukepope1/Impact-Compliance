import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api, type Deal, type DealParty, type ExportBatchRow, type GoldenFieldRow } from "../../api/client";
import { formatCurrency, formatDate, formatNumber } from "../../utils/format";

// goldenFields.ts (server) is the source of truth for which fields are dollar amounts vs.
// plain counts vs. dates vs. text — mirrored here since the readiness API returns raw
// values, not a display type.
const CURRENCY_FIELDS = new Set(["annual_gross_revenue", "annual_net_operating_income", "total_qei_amount", "total_qlici_original_principal"]);
const COUNT_FIELDS = new Set(["jobs_created_actual", "jobs_retained_actual", "jobs_construction_actual", "tenant_count"]);
const DATE_FIELDS = new Set(["project_closing_date"]);

function formatFieldValue(fieldCode: string, value: string | number | null) {
  if (CURRENCY_FIELDS.has(fieldCode)) return formatCurrency(value);
  if (COUNT_FIELDS.has(fieldCode)) return formatNumber(value);
  if (DATE_FIELDS.has(fieldCode)) return formatDate(value as string | null);
  return value ?? "—";
}

// Where each field's underlying value can actually be seen/edited, per portal — only
// fields where the target page genuinely renders that value. Several golden fields (the
// QLICI principal total, the multi-CDE project number) have no page that surfaces them
// today, so they're deliberately left out rather than linking somewhere that wouldn't
// show what the row claims to source.
const CBR_FIELDS = new Set([
  "annual_gross_revenue",
  "annual_net_operating_income",
  "jobs_created_actual",
  "jobs_retained_actual",
  "jobs_construction_actual",
  "tenant_count",
]);
const IMPACT_SETUP_FIELDS = new Set([
  "project_closing_date",
  "total_qei_amount",
  "lead_cde_allocation_control_number",
  "project_census_tract",
  "project_city_state",
]);

function sourceLink(fieldCode: string, portal: "impact" | "cde", dealId: string): string | null {
  if (CBR_FIELDS.has(fieldCode)) return `/${portal}/deals/${dealId}/cbr`;
  if (portal === "impact" && IMPACT_SETUP_FIELDS.has(fieldCode)) return `/impact/deals/${dealId}/setup`;
  return null;
}

export default function AmisCenter({ portal }: { portal: "impact" | "cde" }) {
  const { dealId } = useParams();
  const year = new Date().getFullYear();
  const [readiness, setReadiness] = useState<GoldenFieldRow[] | null>(null);
  const [exports, setExports] = useState<ExportBatchRow[] | null>(null);
  const [deal, setDeal] = useState<Deal | null>(null);
  const [parties, setParties] = useState<DealParty[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function refresh() {
    if (!dealId) return;
    api.getAmisReadiness(dealId, year).then(setReadiness).catch((e) => setError(String(e.message ?? e)));
    api.listAmisExports(dealId).then(setExports).catch((e) => setError(String(e.message ?? e)));
    api.getDeal(dealId).then(setDeal).catch(() => setDeal(null));
    api.listParties(dealId).then(setParties).catch(() => setParties([]));
  }

  useEffect(refresh, [dealId]);

  async function generateExport() {
    if (!dealId) return;
    setBusy(true);
    setError(null);
    try {
      await api.generateAmisExport(dealId, year);
      refresh();
    } catch (e) {
      setError(String((e as Error).message ?? e));
    } finally {
      setBusy(false);
    }
  }

  async function download(exportId: string, fileName: string) {
    if (!dealId) return;
    try {
      await api.downloadAmisExport(dealId, exportId, fileName);
    } catch (e) {
      setError(String((e as Error).message ?? e));
    }
  }

  const readyCount = readiness?.filter((r) => r.status === "ready").length ?? 0;
  const missingCount = readiness?.filter((r) => r.status === "missing").length ?? 0;

  // "Which QALICB is this" — the deal's borrower/operating-company party, same lookup
  // used on the CDE Deal Overview page. Deals aren't 1:1 with a single QALICB org in the
  // schema (a party is just a labeled row), so this is the same best-real-answer the rest
  // of the app already gives, not a new concept.
  const borrower = parties?.find((p) => p.partyRole === "qalicb") ?? parties?.find((p) => p.partyRole === "borrower");

  return (
    <main>
      <h1>AMIS Readiness & Export Center</h1>
      {deal && (
        <p>
          {deal.legalName}
          {borrower ? ` · ${borrower.legalName}` : ""}
        </p>
      )}
      <p>Controlled files only. Phase 1 does not automatically certify or submit in AMIS.</p>

      {error && <div className="card" style={{ color: "#b00" }}>{error}</div>}

      <div className="card">
        <strong>{readyCount}</strong> ready &nbsp;·&nbsp; <strong style={{ color: missingCount ? "#b00" : undefined }}>{missingCount}</strong> missing
      </div>

      <table>
        <thead><tr><th>AMIS field</th><th>Internal field</th><th>Value</th><th>Source</th><th>Status</th><th></th></tr></thead>
        <tbody>
          {readiness?.map((r) => {
            const link = dealId ? sourceLink(r.fieldCode, portal, dealId) : null;
            return (
              <tr key={r.fieldCode}>
                <td>{r.label}</td>
                <td style={{ color: "var(--text-muted)", fontFamily: "monospace", fontSize: 12.5 }}>{r.fieldCode}</td>
                <td>{formatFieldValue(r.fieldCode, r.value)}</td>
                <td>{r.source}</td>
                <td style={r.status === "missing" ? { color: "#b00" } : { color: "#1f7a8c" }}>{r.status.toUpperCase()}</td>
                <td>{link && <Link to={link}>{r.status === "missing" ? "Resolve" : "View source"}</Link>}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <div className="card">
        <button onClick={generateExport} disabled={busy || missingCount > 0}>
          {busy ? "Generating…" : "Generate CSV"}
        </button>
        {missingCount > 0 && <span style={{ marginLeft: 8, color: "#b00" }}>Resolve missing fields before exporting.</span>}
      </div>

      <table>
        <thead><tr><th>Generated</th><th>Type</th><th>Status</th><th></th></tr></thead>
        <tbody>
          {exports?.map((e) => (
            <tr key={e.id}>
              <td>{new Date(e.generatedAt).toLocaleString()}</td>
              <td>{e.exportType}</td>
              <td>{e.status}</td>
              <td>{e.fileName && <button onClick={() => download(e.id, e.fileName!)}>Download</button>}</td>
            </tr>
          ))}
          {exports && exports.length === 0 && <tr><td colSpan={4}>No exports generated yet.</td></tr>}
        </tbody>
      </table>
    </main>
  );
}
