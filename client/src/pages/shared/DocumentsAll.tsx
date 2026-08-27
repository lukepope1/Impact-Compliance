import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api, type Deal, type DocumentSummary } from "../../api/client";
import { formatDate, humanize } from "../../utils/format";
import { ScanStatusBadge } from "./StatusBadge";

type Row = DocumentSummary & { dealId: string; dealName: string };

/** Cross-deal document list — server-side share-scope enforcement (canAccessDocument) already limits each deal's list to what you can see, so this is just those lists concatenated. Shared across the Impact, CDE, and QALICB portal sidebars. */
export default function DocumentsAll({ portal }: { portal: "impact" | "cde" | "qalicb" }) {
  const [docs, setDocs] = useState<Row[] | null>(null);
  const [deals, setDeals] = useState<Deal[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [dealFilter, setDealFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");

  useEffect(() => {
    api
      .listDeals()
      .then(async (deals: Deal[]) => {
        setDeals(deals);
        const perDeal = await Promise.all(
          deals.map((d) => api.listDocuments(d.id).then((docs) => docs.map((doc) => ({ ...doc, dealId: d.id, dealName: d.legalName }))))
        );
        setDocs(perDeal.flat());
      })
      .catch((e) => setError(String(e.message ?? e)));
  }, []);

  const filtered = useMemo(() => {
    if (!docs) return docs;
    const q = search.trim().toLowerCase();
    return docs.filter((d) => {
      if (dealFilter !== "all" && d.dealId !== dealFilter) return false;
      const scanStatus = d.versions[0]?.malwareScanStatus ?? "pending";
      if (statusFilter !== "all" && scanStatus !== statusFilter) return false;
      if (q && !d.title.toLowerCase().includes(q) && !d.dealName.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [docs, dealFilter, statusFilter, search]);

  return (
    <main>
      <h1>Document Library</h1>
      <p>Searchable, versioned evidence. Share scope is enforced server-side.</p>

      {error && <div className="alert alert-error">{error}</div>}

      <div className="card filter-bar">
        <label>
          Deal
          <select value={dealFilter} onChange={(e) => setDealFilter(e.target.value)}>
            <option value="all">All</option>
            {deals?.map((d) => <option key={d.id} value={d.id}>{d.legalName}</option>)}
          </select>
        </label>
        <label>
          Status
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="all">All</option>
            <option value="clean">Clean</option>
            <option value="pending">Pending</option>
            <option value="failed">Failed</option>
            <option value="infected">Infected</option>
          </select>
        </label>
        <label className="filter-search">
          Search
          <input placeholder="Document or deal…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </label>
      </div>

      <div className="table-wrap">
      <table>
        <thead>
          <tr><th>Document</th><th>Deal</th><th>Type</th><th>Entity / Period</th><th>Version</th><th>Sharing</th><th>Status</th><th></th></tr>
        </thead>
        <tbody>
          {filtered?.map((d) => {
            const scanStatus = d.versions[0]?.malwareScanStatus ?? "pending";
            return (
              <tr key={d.id}>
                <td>{d.title}</td>
                <td>{d.dealName}</td>
                <td>{humanize(d.documentType)}</td>
                <td>
                  {d.legalEntityParty ? d.legalEntityParty.legalName : "Deal-level"}
                  {d.reportingPeriodEnd ? ` · ${formatDate(d.reportingPeriodEnd)}` : ""}
                </td>
                <td>v{d.currentVersion}</td>
                <td>{humanize(d.shareScope)}</td>
                <td><ScanStatusBadge status={scanStatus} /></td>
                <td><Link to={`/${portal}/deals/${d.dealId}/documents`}>View</Link></td>
              </tr>
            );
          })}
          {filtered && filtered.length === 0 && <tr><td className="state-cell" colSpan={8}>{docs && docs.length > 0 ? "No documents match this filter." : "No documents yet."}</td></tr>}
          {!docs && !error && <tr><td className="state-cell" colSpan={8}>Loading…</td></tr>}
        </tbody>
      </table>
      </div>
    </main>
  );
}
