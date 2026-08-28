import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api, type CdeParticipation, type Deal, type DealParty, type Organization, type ProjectAddress } from "../api/client";
import { formatCurrency, humanize } from "../utils/format";
import ImpactCommitments from "./ImpactCommitments";

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
  const [address, setAddress] = useState<ProjectAddress | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [newParty, setNewParty] = useState({ legalName: "", partyRole: "borrower" });
  const [newCde, setNewCde] = useState({ cdeOrganizationId: "", subCdeName: "", isLeadCde: false });
  const [editingCdeId, setEditingCdeId] = useState<string | null>(null);
  const [cdeEdit, setCdeEdit] = useState({ allocationControlNumber: "", qeiAmount: "", allocationAmount: "" });
  const [addressDraft, setAddressDraft] = useState({
    address1: "",
    city: "",
    stateCode: "",
    postalCode: "",
    censusTract: "",
  });
  const [savingAddress, setSavingAddress] = useState(false);
  const [multiCdeProjectNumber, setMultiCdeProjectNumber] = useState("");

  function refresh() {
    if (!dealId) return;
    api
      .getDeal(dealId)
      .then((d) => {
        setDeal(d);
        setMultiCdeProjectNumber(d.multiCdeProjectNumber ?? "");
      })
      .catch((e) => setError(String(e.message ?? e)));
    api.listParties(dealId).then(setParties);
    api.listCdeParticipations(dealId).then(setCdes);
    api.getPrimaryProjectAddress(dealId).then((a) => {
      setAddress(a);
      if (a) {
        setAddressDraft({
          address1: a.address1,
          city: a.city,
          stateCode: a.stateCode,
          postalCode: a.postalCode,
          censusTract: a.censusTract ?? "",
        });
      }
    });
  }

  useEffect(() => {
    refresh();
    api.listOrganizations("cde").then(setCdeOrgs);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dealId]);

  if (!deal) return <main>{error ? <div className="alert alert-error">{error}</div> : <p className="muted is-loading">Loading…</p>}</main>;

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

  function startEditCde(c: CdeParticipation) {
    setEditingCdeId(c.id);
    setCdeEdit({
      allocationControlNumber: c.allocationControlNumber ?? "",
      qeiAmount: c.qeiAmount ?? "",
      allocationAmount: c.allocationAmount ?? "",
    });
  }

  async function saveCdeEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!dealId || !editingCdeId) return;
    try {
      await api.updateCdeParticipation(dealId, editingCdeId, {
        allocationControlNumber: cdeEdit.allocationControlNumber.trim() || undefined,
        qeiAmount: cdeEdit.qeiAmount ? Number(cdeEdit.qeiAmount) : undefined,
        allocationAmount: cdeEdit.allocationAmount ? Number(cdeEdit.allocationAmount) : undefined,
      });
      setEditingCdeId(null);
      refresh();
    } catch (e) {
      setError(String((e as Error).message ?? e));
    }
  }

  async function saveMultiCdeProjectNumber(e: React.FormEvent) {
    e.preventDefault();
    if (!dealId) return;
    try {
      await api.updateDeal(dealId, { multiCdeProjectNumber: multiCdeProjectNumber.trim() || undefined });
      refresh();
    } catch (e) {
      setError(String((e as Error).message ?? e));
    }
  }

  async function saveAddress(e: React.FormEvent) {
    e.preventDefault();
    if (!dealId || !addressDraft.address1.trim() || !addressDraft.city.trim() || addressDraft.stateCode.trim().length !== 2 || !addressDraft.postalCode.trim()) {
      setError("Address line, city, a 2-letter state code, and postal code are all required.");
      return;
    }
    setSavingAddress(true);
    setError(null);
    try {
      const saved = await api.savePrimaryProjectAddress(dealId, {
        address1: addressDraft.address1.trim(),
        city: addressDraft.city.trim(),
        stateCode: addressDraft.stateCode.trim().toUpperCase(),
        postalCode: addressDraft.postalCode.trim(),
        censusTract: addressDraft.censusTract.trim() || undefined,
      });
      setAddress(saved);
    } catch (e) {
      setError(String((e as Error).message ?? e));
    } finally {
      setSavingAddress(false);
    }
  }

  return (
    <main>
      <h1>Deal Setup</h1>
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

      {error && <div className="alert alert-error">{error}</div>}

      <div className="card">
        <h2>Deal profile</h2>
        <p>Deal code: {deal.dealCode}</p>
        <p>Legal name: {deal.legalName}</p>
        <p>Closing date: {deal.closingDate ? new Date(deal.closingDate).toLocaleDateString(undefined, { timeZone: "UTC" }) : "—"}</p>
        <p>Multi-CDE: {deal.isMultiCde ? "Yes" : "No"}</p>

        <form className="btn-row" style={{ alignItems: "flex-end" }} onSubmit={saveMultiCdeProjectNumber}>
          <div className="field">
            <label className="field-label" htmlFor="multi-cde-project-number">
              Multi-CDE Project Number
            </label>
            <input
              id="multi-cde-project-number"
              placeholder="e.g. MCDE-00001923"
              value={multiCdeProjectNumber}
              onChange={(e) => setMultiCdeProjectNumber(e.target.value)}
            />
          </div>
          <button type="submit">Save</button>
        </form>
        <p className="text-sm muted" style={{ marginBottom: 0 }}>
          The shared identifier CDEs use for the same project in AMIS. Reported by every CDE on a multi-CDE deal, so
          it is held once on the deal rather than per participation. Required for AMIS readiness.
        </p>
      </div>

      <div className="card">
        <h2>Project address</h2>
        <p className="muted" style={{ marginTop: 0 }}>
          Drives the AMIS "Project Census Tract" and "Project City / State" fields — one primary address per deal.
        </p>
        <form onSubmit={saveAddress} style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr", gap: 8, alignItems: "end" }}>
          <label>Address line
            <input value={addressDraft.address1} onChange={(e) => setAddressDraft({ ...addressDraft, address1: e.target.value })} />
          </label>
          <label>City
            <input value={addressDraft.city} onChange={(e) => setAddressDraft({ ...addressDraft, city: e.target.value })} />
          </label>
          <label>State
            <input maxLength={2} value={addressDraft.stateCode} onChange={(e) => setAddressDraft({ ...addressDraft, stateCode: e.target.value })} />
          </label>
          <label>Postal code
            <input value={addressDraft.postalCode} onChange={(e) => setAddressDraft({ ...addressDraft, postalCode: e.target.value })} />
          </label>
          <label>Census tract
            <input value={addressDraft.censusTract} onChange={(e) => setAddressDraft({ ...addressDraft, censusTract: e.target.value })} />
          </label>
          <div style={{ gridColumn: "1 / -1" }}>
            <button type="submit" disabled={savingAddress}>{address ? "Update address" : "Save address"}</button>
          </div>
        </form>
      </div>

      {dealId && <ImpactCommitments dealId={dealId} />}

      <div className="card">
        <h2>Parties & CDEs</h2>

        <table>
          <thead><tr><th>Legal name</th><th>Role</th><th>Reporting party</th></tr></thead>
          <tbody>
            {parties.map((p) => (
              <tr key={p.id}><td>{p.legalName}</td><td>{humanize(p.partyRole)}</td><td>{p.isReportingParty ? "Yes" : "No"}</td></tr>
            ))}
            {parties.length === 0 && <tr><td className="state-cell" colSpan={3}>No parties yet.</td></tr>}
          </tbody>
        </table>

        <form onSubmit={addParty} style={{ marginTop: 12, display: "flex", gap: 8, alignItems: "center" }}>
          <input
            placeholder="Legal name"
            value={newParty.legalName}
            onChange={(e) => setNewParty({ ...newParty, legalName: e.target.value })}
          />
          <select value={newParty.partyRole} onChange={(e) => setNewParty({ ...newParty, partyRole: e.target.value })}>
            {PARTY_ROLES.map((r) => <option key={r} value={r}>{humanize(r)}</option>)}
          </select>
          <button type="submit">+ Add party</button>
        </form>

        <div className="table-wrap" style={{ marginTop: 16 }}>
        <table>
          <thead><tr><th>CDE</th><th>Sub-CDE name</th><th>Lead</th><th>Allocation control #</th><th>QEI amount</th><th>Allocation amount</th><th></th></tr></thead>
          <tbody>
            {cdes.map((c) => (
              <tr key={c.id}>
                <td>{c.cdeOrganization.legalName}</td>
                <td>{c.subCdeName ?? "—"}</td>
                <td>{c.isLeadCde ? "Lead" : ""}</td>
                <td>{c.allocationControlNumber ?? "—"}</td>
                <td>{c.qeiAmount ? formatCurrency(c.qeiAmount) : "—"}</td>
                <td>{c.allocationAmount ? formatCurrency(c.allocationAmount) : "—"}</td>
                <td><button onClick={() => startEditCde(c)}>Edit</button></td>
              </tr>
            ))}
            {cdes.length === 0 && <tr><td className="state-cell" colSpan={7}>No CDEs yet.</td></tr>}
          </tbody>
        </table>
        </div>

        {editingCdeId && (
          <form onSubmit={saveCdeEdit} className="card" style={{ marginTop: 12, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <strong>Editing {cdes.find((c) => c.id === editingCdeId)?.cdeOrganization.legalName}</strong>
            <label>Allocation control #
              <input value={cdeEdit.allocationControlNumber} onChange={(e) => setCdeEdit({ ...cdeEdit, allocationControlNumber: e.target.value })} />
            </label>
            <label>QEI amount
              <input type="number" value={cdeEdit.qeiAmount} onChange={(e) => setCdeEdit({ ...cdeEdit, qeiAmount: e.target.value })} />
            </label>
            <label>Allocation amount
              <input type="number" value={cdeEdit.allocationAmount} onChange={(e) => setCdeEdit({ ...cdeEdit, allocationAmount: e.target.value })} />
            </label>
            <div className="btn-row">
              <button type="submit">Save</button>
              <button type="button" onClick={() => setEditingCdeId(null)}>Cancel</button>
            </div>
          </form>
        )}

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
