import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api, type CbrPeriod } from "../../api/client";

export default function CommunityBenefits() {
  const { dealId } = useParams();
  const year = new Date().getFullYear();
  const [period, setPeriod] = useState<CbrPeriod | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [revenue, setRevenue] = useState("");
  const [newJob, setNewJob] = useState({ jobTitle: "", fteCount: "1", jobStatus: "created" });
  const [newTenant, setNewTenant] = useState({ organizationName: "", purposeGoodsServices: "" });

  function refresh() {
    if (!dealId) return;
    api.getCbrPeriod(dealId, year).then((p) => {
      setPeriod(p);
      setRevenue(p.projectProfile?.annualGrossRevenue ?? "");
    }).catch((e) => setError(String(e.message ?? e)));
  }

  useEffect(refresh, [dealId]);

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    if (!dealId) return;
    try {
      await api.saveCbrProfile(dealId, year, { annualGrossRevenue: revenue ? Number(revenue) : undefined });
      refresh();
    } catch (e) {
      setError(String((e as Error).message ?? e));
    }
  }

  async function addJob(e: React.FormEvent) {
    e.preventDefault();
    if (!dealId || !newJob.jobTitle.trim()) return;
    try {
      await api.addJobRecord(dealId, year, { jobTitle: newJob.jobTitle, fteCount: Number(newJob.fteCount), jobStatus: newJob.jobStatus });
      setNewJob({ jobTitle: "", fteCount: "1", jobStatus: "created" });
      refresh();
    } catch (e) {
      setError(String((e as Error).message ?? e));
    }
  }

  async function addTenant(e: React.FormEvent) {
    e.preventDefault();
    if (!dealId || !newTenant.organizationName.trim()) return;
    try {
      await api.addTenant(dealId, year, newTenant);
      setNewTenant({ organizationName: "", purposeGoodsServices: "" });
      refresh();
    } catch (e) {
      setError(String((e as Error).message ?? e));
    }
  }

  if (!period) return <main>{error ? <div className="card">{error}</div> : "Loading…"}</main>;

  const totalJobsCreated = period.jobRecords.filter((j) => j.jobStatus === "created").reduce((s, j) => s + Number(j.fteCount), 0);

  return (
    <main>
      <h1>Community Benefits Report — CY {year}</h1>
      <p>Status: {period.status}</p>

      {error && <div className="card" style={{ color: "#b00" }}>{error}</div>}

      <form className="card" onSubmit={saveProfile} style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <h2 style={{ margin: 0 }}>Project Profile</h2>
        <label>Annual gross revenue
          <input type="number" value={revenue} onChange={(e) => setRevenue(e.target.value)} />
        </label>
        <button type="submit">Save</button>
      </form>

      <div className="card">
        <h2>Jobs & Workforce — {totalJobsCreated} FTE created</h2>
        <table>
          <thead><tr><th>Title</th><th>FTE</th><th>Status</th></tr></thead>
          <tbody>
            {period.jobRecords.map((j) => <tr key={j.id}><td>{j.jobTitle}</td><td>{j.fteCount}</td><td>{j.jobStatus}</td></tr>)}
            {period.jobRecords.length === 0 && <tr><td colSpan={3}>No jobs recorded yet.</td></tr>}
          </tbody>
        </table>
        <form onSubmit={addJob} style={{ marginTop: 8, display: "flex", gap: 8 }}>
          <input placeholder="Job title" value={newJob.jobTitle} onChange={(e) => setNewJob({ ...newJob, jobTitle: e.target.value })} />
          <input type="number" style={{ width: 70 }} value={newJob.fteCount} onChange={(e) => setNewJob({ ...newJob, fteCount: e.target.value })} />
          <select value={newJob.jobStatus} onChange={(e) => setNewJob({ ...newJob, jobStatus: e.target.value })}>
            <option value="created">Created</option>
            <option value="retained">Retained</option>
            <option value="construction">Construction</option>
          </select>
          <button type="submit">+ Add job</button>
        </form>
      </div>

      <div className="card">
        <h2>Tenants & Occupants</h2>
        <table>
          <thead><tr><th>Organization</th><th>Purpose</th></tr></thead>
          <tbody>
            {period.tenantOccupants.map((t) => <tr key={t.id}><td>{t.organizationName}</td><td>{t.purposeGoodsServices}</td></tr>)}
            {period.tenantOccupants.length === 0 && <tr><td colSpan={2}>No tenants recorded yet.</td></tr>}
          </tbody>
        </table>
        <form onSubmit={addTenant} style={{ marginTop: 8, display: "flex", gap: 8 }}>
          <input placeholder="Organization name" value={newTenant.organizationName} onChange={(e) => setNewTenant({ ...newTenant, organizationName: e.target.value })} />
          <input placeholder="Purpose" value={newTenant.purposeGoodsServices} onChange={(e) => setNewTenant({ ...newTenant, purposeGoodsServices: e.target.value })} />
          <button type="submit">+ Add tenant</button>
        </form>
      </div>
    </main>
  );
}
