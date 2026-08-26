import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api, type Deal, type DocumentSummary } from "../../api/client";

/** Cross-deal document list — server-side share-scope enforcement (canAccessDocument) already limits each deal's list to what this CDE can see, so this is just those lists concatenated. */
export default function CdeDocumentsAll() {
  const [docs, setDocs] = useState<(DocumentSummary & { dealId: string; dealName: string })[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    api
      .listDeals()
      .then(async (deals: Deal[]) => {
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
    if (!q) return docs;
    return docs.filter((d) => d.title.toLowerCase().includes(q) || d.dealName.toLowerCase().includes(q));
  }, [docs, search]);

  return (
    <main>
      <h1>Documents</h1>
      <p>Evidence visible to this CDE across every deal it participates in.</p>

      {error && <div className="card" style={{ color: "#b00" }}>{error}</div>}

      <div className="card">
        <label>
          Search title or deal
          <input placeholder="e.g. Balance Sheet, Riverside…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </label>
      </div>

      <table>
        <thead>
          <tr><th>Document</th><th>Deal</th><th>Type</th><th>Sharing</th><th>Versions</th><th></th></tr>
        </thead>
        <tbody>
          {filtered?.map((d) => (
            <tr key={d.id}>
              <td>{d.title}</td>
              <td>{d.dealName}</td>
              <td>{d.documentType}</td>
              <td>{d.shareScope}</td>
              <td>v{d.currentVersion}</td>
              <td><Link to={`/cde/deals/${d.dealId}/documents`}>View</Link></td>
            </tr>
          ))}
          {filtered && filtered.length === 0 && <tr><td colSpan={6}>No documents match.</td></tr>}
          {!docs && !error && <tr><td colSpan={6}>Loading…</td></tr>}
        </tbody>
      </table>
    </main>
  );
}
