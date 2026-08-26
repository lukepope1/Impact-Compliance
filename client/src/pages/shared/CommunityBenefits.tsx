import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api, type CbrPeriod } from "../../api/client";

const BENEFIT_CODES = [
  { code: "paid_holidays", label: "Paid holidays" },
  { code: "paid_vacation", label: "Paid vacation" },
  { code: "health_insurance", label: "Health insurance" },
  { code: "dental_insurance", label: "Dental insurance" },
  { code: "life_insurance", label: "Life insurance" },
  { code: "education_training", label: "Education / training" },
];
const EMPLOYEE_CLASSES = ["permanent", "temporary"] as const;

function findBenefit(period: CbrPeriod, code: string, employeeClass: string) {
  return period.benefitRecords.find((b) => b.benefitCode === code && b.employeeClass === employeeClass);
}

export default function CommunityBenefits() {
  const { dealId } = useParams();
  const year = new Date().getFullYear();
  const [period, setPeriod] = useState<CbrPeriod | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [revenue, setRevenue] = useState("");
  const [newJob, setNewJob] = useState({ jobTitle: "", fteCount: "1", jobStatus: "created" });
  const [newTenant, setNewTenant] = useState({ organizationName: "", purposeGoodsServices: "" });
  const [benefitDraft, setBenefitDraft] = useState<Record<string, { isOffered: boolean; percentReceiving: string }>>({});
  const [newOutcome, setNewOutcome] = useState({ serviceName: "", serviceType: "", peopleServedCurrent: "", outcomeNarrative: "" });

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

  function benefitKey(code: string, employeeClass: string) {
    return `${code}:${employeeClass}`;
  }

  function benefitValue(code: string, employeeClass: string) {
    const key = benefitKey(code, employeeClass);
    if (benefitDraft[key]) return benefitDraft[key];
    const existing = period && findBenefit(period, code, employeeClass);
    return { isOffered: existing?.isOffered ?? false, percentReceiving: existing?.percentReceiving ?? "" };
  }

  function setBenefitField(code: string, employeeClass: string, field: "isOffered" | "percentReceiving", value: boolean | string) {
    const key = benefitKey(code, employeeClass);
    const current = benefitValue(code, employeeClass);
    setBenefitDraft({ ...benefitDraft, [key]: { ...current, [field]: value } as { isOffered: boolean; percentReceiving: string } });
  }

  async function saveBenefitRow(code: string) {
    if (!dealId) return;
    try {
      for (const employeeClass of EMPLOYEE_CLASSES) {
        const val = benefitValue(code, employeeClass);
        await api.saveBenefit(dealId, year, {
          employeeClass,
          benefitCode: code,
          isOffered: val.isOffered,
          percentReceiving: val.percentReceiving ? Number(val.percentReceiving) : undefined,
        });
      }
      refresh();
    } catch (e) {
      setError(String((e as Error).message ?? e));
    }
  }

  async function addOutcome(e: React.FormEvent) {
    e.preventDefault();
    if (!dealId || !newOutcome.serviceName.trim()) return;
    try {
      await api.addServiceOutcome(dealId, year, {
        serviceName: newOutcome.serviceName,
        serviceType: newOutcome.serviceType || undefined,
        peopleServedCurrent: newOutcome.peopleServedCurrent ? Number(newOutcome.peopleServedCurrent) : undefined,
        outcomeNarrative: newOutcome.outcomeNarrative || undefined,
      });
      setNewOutcome({ serviceName: "", serviceType: "", peopleServedCurrent: "", outcomeNarrative: "" });
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
        <h2>Job Benefits</h2>
        <p style={{ color: "#666", marginTop: 0 }}>Benefit rows can roll forward from a prior year and just need reconfirming.</p>
        <table>
          <thead>
            <tr>
              <th>Benefit</th>
              <th colSpan={2}>Permanent employees</th>
              <th colSpan={2}>Temporary employees</th>
              <th></th>
            </tr>
            <tr>
              <th></th>
              <th>Offered</th><th>% receiving</th>
              <th>Offered</th><th>% receiving</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {BENEFIT_CODES.map((b) => {
              const perm = benefitValue(b.code, "permanent");
              const temp = benefitValue(b.code, "temporary");
              return (
                <tr key={b.code}>
                  <td>{b.label}</td>
                  <td>
                    <input type="checkbox" checked={perm.isOffered} onChange={(e) => setBenefitField(b.code, "permanent", "isOffered", e.target.checked)} />
                  </td>
                  <td>
                    <input type="number" style={{ width: 60 }} value={perm.percentReceiving} onChange={(e) => setBenefitField(b.code, "permanent", "percentReceiving", e.target.value)} />%
                  </td>
                  <td>
                    <input type="checkbox" checked={temp.isOffered} onChange={(e) => setBenefitField(b.code, "temporary", "isOffered", e.target.checked)} />
                  </td>
                  <td>
                    <input type="number" style={{ width: 60 }} value={temp.percentReceiving} onChange={(e) => setBenefitField(b.code, "temporary", "percentReceiving", e.target.value)} />%
                  </td>
                  <td><button onClick={() => saveBenefitRow(b.code)}>Save</button></td>
                </tr>
              );
            })}
          </tbody>
        </table>
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

      <div className="card">
        <h2>Commercial / Community Services</h2>
        <p style={{ color: "#666", marginTop: 0 }}>Goods/services provided to low-income communities, and the outcomes they produce.</p>
        <table>
          <thead><tr><th>Service</th><th>Type</th><th>People served (current)</th><th>Outcome narrative</th></tr></thead>
          <tbody>
            {period.serviceOutcomes.map((s) => (
              <tr key={s.id}>
                <td>{s.serviceName}</td>
                <td>{s.serviceType ?? "—"}</td>
                <td>{s.peopleServedCurrent ?? "—"}</td>
                <td>{s.outcomeNarrative ?? "—"}</td>
              </tr>
            ))}
            {period.serviceOutcomes.length === 0 && <tr><td colSpan={4}>No services recorded yet.</td></tr>}
          </tbody>
        </table>
        <form onSubmit={addOutcome} style={{ marginTop: 8, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          <input
            placeholder="Service / good name"
            value={newOutcome.serviceName}
            onChange={(e) => setNewOutcome({ ...newOutcome, serviceName: e.target.value })}
          />
          <input
            placeholder="Service type (e.g. community facility)"
            value={newOutcome.serviceType}
            onChange={(e) => setNewOutcome({ ...newOutcome, serviceType: e.target.value })}
          />
          <input
            type="number"
            placeholder="People served (current)"
            value={newOutcome.peopleServedCurrent}
            onChange={(e) => setNewOutcome({ ...newOutcome, peopleServedCurrent: e.target.value })}
          />
          <input
            placeholder="Outcome narrative"
            value={newOutcome.outcomeNarrative}
            onChange={(e) => setNewOutcome({ ...newOutcome, outcomeNarrative: e.target.value })}
          />
          <div style={{ gridColumn: "span 2" }}>
            <button type="submit">+ Add service</button>
          </div>
        </form>
      </div>
    </main>
  );
}
