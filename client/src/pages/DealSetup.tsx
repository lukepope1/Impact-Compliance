import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api, type CdeParticipation, type Deal, type DealParty, type Organization } from "../api/client";

const PARTY_ROLES = [
  "borrower",
  "qalicb",
  "project_business",
  "guarantor",
  "tenant",
  "cde_lender",
  "allocatee",
  "investment_fund",
  "investor",
  "leverage_lender",
  "property_owner",
  "operating_company",
  "other",
];

export default function DealSetup() {
  const { dealId } = useParams();
  const [deal, setDeal] = useState<Deal | null>(null);
  const [parties, setParties] = useState<DealParty[]>([]);
  const [cdes, setCdes] = useState<CdeParticipation[]>([]);
  const [cdeOrgs, setCdeOrgs] = useState<Organization[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [newParty, setNewParty] = useState({ legalName: "", partyRole: "borrower" });
  const [newCde, setNewCde] = useState({ cdeOrganizationId: "", subCdeName: "", isLeadCde: false });

  function refresh() {
    if (!dealId) return;
    api.getDeal(dealId).then(setDeal).catch((e) => setError(String(e.message ?? e)));
    api.listParties(dealId).then(setParties);
    api.listCdeParticipations(dealId).then(setCdes);
  }

  useEffect(() => {
    refresh();
    api.listOrganizations("cde").then(setCdeOrgs);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dealId]);

  if (!deal) return <main>{error ? <div className="card">{error}</div> : "Loading…"}</main>;

  const checklist = [
    ["Profile", true],
    ["Parties", parties.length > 0],
    ["CDEs", cdes.length > 0],
    ["Requirements", false],
  ] as const;

  async function addParty(e: React.FormEvent) {
    e.preventDefault();
    if (!dealId || !newParty.legalName.trim()) return;
    await api.createParty(dealId, newParty);
    setNewParty({ legalName: "", partyRole: "borrower" });
    refresh();
  }

  async function addCde(e: React.FormEvent) {
    e.preventDefault();
    if (!dealId || !newCde.cdeOrganizationId) return;
    try {
      await api.createCdeParticipation(dealId, newCde);
      setNewCde({ cdeOrganizationId: "", subCdeName: "", isLeadCde: false });
      refresh();
    } catch (e) {
      setError(String((e as Error).message ?? e));
    }
  }

  return (
    <main>
      <h1>I-02 — Deal Setup</h1>
      <p>{deal.dealCode} · {deal.legalName}</p>

      <div className="card">
        <strong>Onboarding: </strong>
        {checklist.map(([label, done], i) => (
          <span key={label}>
            {i > 0 && " · "}
            {label} {done ? "✓" : "○"}
          </span>
        ))}
      </div>

      {error && <div className="card" style={{ color: "#b00" }}>{error}</div>}

      <div className="card">
        <h2>Deal profile</h2>
        <p>Deal code: {deal.dealCode}</p>
        <p>Legal name: {deal.legalName}</p>
        <p>Closing date: {deal.closingDate ? new Date(deal.closingDate).toLocaleDateString(undefined, { timeZone: "UTC" }) : "—"}</p>
        <p>Multi-CDE: {deal.isMultiCde ? "Yes" : "No"}</p>
      </div>

      <div className="card">
        <h2>Parties & CDEs</h2>

        <table>
          <thead><tr><th>Legal name</th><th>Role</th><th>Reporting party</th></tr></thead>
          <tbody>
            {parties.map((p) => (
              <tr key={p.id}><td>{p.legalName}</td><td>{p.partyRole}</td><td>{p.isReportingParty ? "Yes" : "No"}</td></tr>
            ))}
            {parties.length === 0 && <tr><td colSpan={3}>No parties yet.</td></tr>}
          </tbody>
        </table>

        <form onSubmit={addParty} style={{ marginTop: 12, display: "flex", gap: 8, alignItems: "center" }}>
          <input
            placeholder="Legal name"
            value={newParty.legalName}
            onChange={(e) => setNewParty({ ...newParty, legalName: e.target.value })}
          />
          <select value={newParty.partyRole} onChange={(e) => setNewParty({ ...newParty, partyRole: e.target.value })}>
            {PARTY_ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
          <button type="submit">+ Add party</button>
        </form>

        <table style={{ marginTop: 16 }}>
          <thead><tr><th>CDE</th><th>Sub-CDE name</th><th>Lead</th></tr></thead>
          <tbody>
            {cdes.map((c) => (
              <tr key={c.id}><td>{c.cdeOrganization.legalName}</td><td>{c.subCdeName ?? "—"}</td><td>{c.isLeadCde ? "Lead" : ""}</td></tr>
            ))}
            {cdes.length === 0 && <tr><td colSpan={3}>No CDEs yet.</td></tr>}
          </tbody>
        </table>

        <form onSubmit={addCde} style={{ marginTop: 12, display: "flex", gap: 8, alignItems: "center" }}>
          <select
            value={newCde.cdeOrganizationId}
            onChange={(e) => setNewCde({ ...newCde, cdeOrganizationId: e.target.value })}
          >
            <option value="">Select CDE organization…</option>
            {cdeOrgs.map((o) => <option key={o.id} value={o.id}>{o.legalName}</option>)}
          </select>
          <input
            placeholder="Sub-CDE name (optional)"
            value={newCde.subCdeName}
            onChange={(e) => setNewCde({ ...newCde, subCdeName: e.target.value })}
          />
          <label style={{ fontSize: 14 }}>
            <input
              type="checkbox"
              checked={newCde.isLeadCde}
              onChange={(e) => setNewCde({ ...newCde, isLeadCde: e.target.checked })}
            /> Lead CDE
          </label>
          <button type="submit">+ Add CDE</button>
        </form>
      </div>

      <p><Link to={`/impact/deals/${dealId}/requirements`}>Next step: configure requirements →</Link></p>
    </main>
  );
}
