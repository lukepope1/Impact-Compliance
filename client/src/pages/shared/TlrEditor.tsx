import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useParams, useSearchParams } from "react-router-dom";
import {
  api,
  type Deal,
  type DealParty,
  type TlrDisbursementRow,
  type TlrFieldSpec,
  type TlrObjectSpec,
  type TlrWorkspace,
  type ExportBatchRow,
  ApiError,
} from "../../api/client";

/**
 * Entry for the Transaction Level Report a CDE files to AMIS each year.
 *
 * A TLR is 205 fields across four AMIS objects, so nothing here is hand-written per field:
 * the form is rendered from the catalog the server generated from a real AMIS workbook.
 * Adding a field to a future TLR is a regeneration, not a code change.
 *
 * The volume is the design problem. 114 fields on the project sheet alone is unusable as
 * one flat list, so the objects are tabs, a filter narrows to a named field, and each tab
 * reports its own completeness — a CDE filling this in over weeks needs to see what is
 * still blank without scrolling the whole thing.
 */

const OBJECT_LABELS: Record<string, string> = {
  tlr_project__c: "Project",
  tlr_address__c: "Address",
  tlr_note__c: "Notes (per QLICI)",
};

type Draft = Record<string, string>;

/** Key for a value: a note-level field is only unique once the QLICI is part of the key. */
const keyOf = (fieldCode: string, qliciId: string | null) => `${qliciId ?? "deal"}::${fieldCode}`;

function inputTypeFor(f: TlrFieldSpec) {
  if (f.dataType === "date") return "date";
  if (f.dataType === "boolean") return "checkbox";
  if (f.dataType === "text") return "text";
  return "number";
}

export default function TlrEditor({ portal }: { portal: "impact" | "cde" }) {
  const { dealId } = useParams();
  const [params, setParams] = useSearchParams();
  const { hash } = useLocation();
  const year = Number(params.get("year")) || new Date().getFullYear();

  const [data, setData] = useState<TlrWorkspace | null>(null);
  const [deal, setDeal] = useState<Deal | null>(null);
  const [parties, setParties] = useState<DealParty[] | null>(null);
  const [draft, setDraft] = useState<Draft>({});
  const [activeObject, setActiveObject] = useState("tlr_project__c");
  const [activeQlici, setActiveQlici] = useState<string | null>(null);
  const [filter, setFilter] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!dealId) return;
    setData(null);
    api
      .getTlrWorkspace(dealId, year)
      .then((w) => {
        setData(w);
        setDraft(Object.fromEntries(w.values.map((v) => [keyOf(v.fieldCode, v.qliciId), String(v.value ?? "")])));
        setActiveQlici((q) => q ?? w.qlicis[0]?.id ?? null);
      })
      .catch((e) => setError(String(e.message ?? e)));
  }, [dealId, year]);

  useEffect(() => {
    if (!dealId) return;
    api.getDeal(dealId).then(setDeal).catch(() => undefined);
    api.listParties(dealId).then(setParties).catch(() => undefined);
  }, [dealId]);

  // React Router does not honour a #hash on client-side navigation, and the field does not
  // exist until the workspace has loaded — so arriving from the export blocker needs this
  // to actually land on the field it named.
  useEffect(() => {
    if (!data || !hash) return;
    const target = document.getElementById(hash.slice(1));
    if (!target) return;
    target.scrollIntoView({ behavior: "smooth", block: "center" });
    (target as HTMLElement).focus?.({ preventScroll: true });
  }, [data, hash]);

  const object = useMemo(
    () => data?.objects.find((o) => o.amisObject === activeObject) ?? null,
    [data, activeObject]
  );

  // Note-level fields belong to the selected QLICI; project and address fields to the deal.
  const scopeId = object?.scope === "qlici" ? activeQlici : null;

  const visibleFields = useMemo(() => {
    if (!object) return [];
    // The project number has its own field above, so it is not repeated in the sheet. It
    // stays part of the object, so saving the project sheet still writes it.
    const fields = object.fields.filter((f) => f.fieldCode !== data?.projectNumberField);
    const q = filter.trim().toLowerCase();
    return q ? fields.filter((f) => f.amisFieldName.toLowerCase().includes(q)) : fields;
  }, [object, filter, data?.projectNumberField]);

  function completeness(o: TlrObjectSpec) {
    if (o.scope === "qlici") {
      // Counted across every note, since the sheet is only complete when all of them are —
      // showing only the selected note would call the tab done while others sat empty.
      const notes = data?.qlicis ?? [];
      const total = o.fields.length * notes.length;
      const filled = notes.reduce(
        (n, q) => n + o.fields.filter((f) => (draft[keyOf(f.fieldCode, q.id)] ?? "") !== "").length,
        0
      );
      return { filled, total };
    }
    return {
      filled: o.fields.filter((f) => (draft[keyOf(f.fieldCode, null)] ?? "") !== "").length,
      total: o.fields.length,
    };
  }

  async function save() {
    if (!dealId || !object) return;
    setBusy(true);
    setError(null);
    setSaved(null);
    try {
      // Sends the whole object, blanks included, so clearing a field actually removes it
      // rather than silently leaving the old value on the filing.
      const targets = object.scope === "qlici" ? (data?.qlicis ?? []).map((q) => q.id) : [null];
      const payload = targets.flatMap((qliciId) =>
        object.fields.map((f) => {
          const raw = (draft[keyOf(f.fieldCode, qliciId)] ?? "").trim();
          return {
            fieldCode: f.fieldCode,
            qliciId,
            value: raw === "" ? null : f.dataType === "boolean" ? raw === "true" : raw,
          };
        })
      );
      const res = await api.saveTlrValues(dealId, year, payload);
      setSaved(`Saved ${OBJECT_LABELS[object.amisObject] ?? object.amisObject} for ${year} (${res.written} fields).`);
    } catch (e) {
      setError(String((e as Error).message ?? e));
    } finally {
      setBusy(false);
    }
  }

  // Saved on its own rather than with the project sheet, because the export is blocked
  // without it and it is the one field someone may want to set before filling anything else.
  async function saveProjectNumber() {
    if (!dealId || !data) return;
    setBusy(true);
    setError(null);
    setSaved(null);
    try {
      const raw = (draft[keyOf(data.projectNumberField, null)] ?? "").trim();
      await api.saveTlrValues(dealId, year, [
        { fieldCode: data.projectNumberField, qliciId: null, value: raw === "" ? null : raw },
      ]);
      setSaved(raw === "" ? "Project number cleared." : `Project number saved as ${raw}.`);
    } catch (e) {
      setError(String((e as Error).message ?? e));
    } finally {
      setBusy(false);
    }
  }

  const borrower = parties?.find((p) => p.partyRole === "qalicb") ?? parties?.find((p) => p.partyRole === "borrower");

  if (error && !data) {
    return (
      <main>
        <h1>TLR Data Entry</h1>
        <div className="alert alert-error">{error}</div>
      </main>
    );
  }

  return (
    <main>
      <h1>TLR Data Entry</h1>
      {deal && (
        <p>
          {deal.legalName}
          {borrower ? ` · ${borrower.legalName}` : ""}
        </p>
      )}
      <p className="text-sm muted">
        The Transaction Level Report filed to AMIS. Fields come from the AMIS TLR
        certification format, so labels here match the workbook column headers exactly.{" "}
        <Link to={`/${portal}/deals/${dealId}/amis`}>AMIS Readiness &amp; Export</Link>
      </p>

      {error && <div className="alert alert-error">{error}</div>}
      {saved && !error && <div className="alert alert-info">{saved}</div>}

      <div className="card btn-row" style={{ alignItems: "center" }}>
        <label htmlFor="tlr-year">Reporting year</label>
        <input
          id="tlr-year"
          type="number"
          min="2000"
          max="2100"
          style={{ width: 100 }}
          value={year}
          onChange={(e) => setParams({ year: e.target.value }, { replace: true })}
        />
        <span className="muted text-sm">A TLR is filed per year, so each year holds its own figures.</span>
      </div>

      {data && (
        <div className="card">
          <div className="btn-row" style={{ alignItems: "center" }}>
            <label htmlFor="tlr-project-number">
              <strong>Project Number</strong>
            </label>
            <input
              id="tlr-project-number"
              style={{ width: 160 }}
              placeholder="e.g. 32"
              value={draft[keyOf(data.projectNumberField, null)] ?? ""}
              onChange={(e) => setDraft({ ...draft, [keyOf(data.projectNumberField, null)]: e.target.value })}
            />
            <button onClick={saveProjectNumber} disabled={busy}>
              {busy ? "Saving…" : "Save project number"}
            </button>
          </div>
          <p className="text-sm muted" style={{ marginBottom: 0 }}>
            Your <strong>Sub-CDE project number</strong> — a short number like 32, not an MCDE or TLRP code.
            Entered once here and written to three columns on export: “Project Number” on the project and address
            sheets, and “Sub-CDE” on the note sheet, which is what joins the sheets to each other.
          </p>
          <p className="text-sm muted" style={{ marginBottom: 0 }}>
            Two similarly named fields are <em>not</em> this one. “Multi-CDE Project ID” (MCDE-00001923) is the
            deal’s shared identifier, maintained by Impact in deal setup and written to the export from there. The
            note sheet’s own “Project Number” (TLRP-00021987) is assigned by AMIS and is edited with the other note
            fields.
          </p>
        </div>
      )}

      {!data ? (
        <p className="state-cell">Loading…</p>
      ) : (
        <>
          <div className="btn-row" role="tablist" aria-label="TLR objects">
            {data.objects.map((o) => {
              const { filled, total } = completeness(o);
              return (
                <button
                  key={o.amisObject}
                  role="tab"
                  aria-selected={activeObject === o.amisObject}
                  className={activeObject === o.amisObject ? "" : "btn-secondary"}
                  onClick={() => setActiveObject(o.amisObject)}
                >
                  {OBJECT_LABELS[o.amisObject] ?? o.amisObject}{" "}
                  <span className="muted">
                    {filled}/{total}
                  </span>
                </button>
              );
            })}
            <button
              role="tab"
              aria-selected={activeObject === "disbursements"}
              className={activeObject === "disbursements" ? "" : "btn-secondary"}
              onClick={() => setActiveObject("disbursements")}
            >
              Disbursements <span className="muted">{data.disbursements.length}</span>
            </button>
          </div>

          {activeObject === "disbursements" ? (
            <Disbursements
              dealId={dealId!}
              data={data}
              onChange={(rows) => setData({ ...data, disbursements: rows })}
              onError={setError}
            />
          ) : !object ? null : (
            <>
              {object.scope === "qlici" && (
                <div className="card">
                  {data.qlicis.length === 0 ? (
                    <p className="empty-state">
                      This deal has no QLICIs yet, and note fields are reported per QLICI. Add them on the deal
                      before filling in this sheet.
                    </p>
                  ) : (
                    <div className="btn-row" style={{ alignItems: "center" }}>
                      <label htmlFor="tlr-qlici">Note</label>
                      <select
                        id="tlr-qlici"
                        value={activeQlici ?? ""}
                        onChange={(e) => setActiveQlici(e.target.value)}
                      >
                        {data.qlicis.map((q) => (
                          <option key={q.id} value={q.id}>
                            {q.qliciCode} ({q.qliciType})
                          </option>
                        ))}
                      </select>
                      <span className="muted text-sm">
                        These {object.fields.length} fields are reported once per note. Saving writes every note,
                        not just this one.
                      </span>
                    </div>
                  )}
                </div>
              )}

              <div className="card btn-row" style={{ alignItems: "center" }}>
                <label htmlFor="tlr-filter">Find a field</label>
                <input
                  id="tlr-filter"
                  type="search"
                  placeholder="e.g. jobs, revenue, census"
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                  style={{ minWidth: 240 }}
                />
                <span className="muted text-sm">
                  Showing {visibleFields.length} of {object.fields.length}
                </span>
              </div>

              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th style={{ width: "45%" }}>AMIS field</th>
                      <th style={{ width: "25%" }}>Value</th>
                      <th>Example from a filed TLR</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleFields.map((f) => {
                      const k = keyOf(f.fieldCode, scopeId);
                      const value = draft[k] ?? "";
                      const disabled = object.scope === "qlici" && !activeQlici;
                      return (
                        <tr key={f.fieldCode}>
                          <td>
                            <label htmlFor={`f-${f.fieldCode}`}>{f.amisFieldName}</label>
                            <div className="muted text-sm">{f.dataType}</div>
                          </td>
                          <td>
                            {f.dataType === "boolean" ? (
                              <select
                                id={`f-${f.fieldCode}`}
                                value={value}
                                disabled={disabled}
                                onChange={(e) => setDraft({ ...draft, [k]: e.target.value })}
                              >
                                <option value="">—</option>
                                <option value="true">Yes</option>
                                <option value="false">No</option>
                              </select>
                            ) : (
                              <input
                                id={`f-${f.fieldCode}`}
                                type={inputTypeFor(f)}
                                step={f.dataType === "integer" ? "1" : "any"}
                                value={value}
                                disabled={disabled}
                                onChange={(e) => setDraft({ ...draft, [k]: e.target.value })}
                              />
                            )}
                          </td>
                          <td className="muted text-sm">
                            {f.observed.length > 0 ? f.observed.slice(0, 2).join(", ") : "—"}
                          </td>
                        </tr>
                      );
                    })}
                    {visibleFields.length === 0 && (
                      <tr>
                        <td className="state-cell" colSpan={3}>
                          No field matches “{filter}”.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <button onClick={save} disabled={busy}>
                {busy ? "Saving…" : `Save ${OBJECT_LABELS[object.amisObject] ?? object.amisObject}`}
              </button>
            </>
          )}

          <TlrExports dealId={dealId!} year={year} onError={setError} />
        </>
      )}
    </main>
  );
}

/**
 * Generates the workbook for AMIS upload and lists what has been generated before.
 *
 * Deliberately produces a file rather than filing anything: nothing here certifies or
 * submits to AMIS, matching the boundary the CSV export already sets.
 */
function TlrExports({ dealId, year, onError }: { dealId: string; year: number; onError: (e: string) => void }) {
  const [rows, setRows] = useState<ExportBatchRow[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [blockers, setBlockers] = useState<string[]>([]);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    api.listTlrExports(dealId).then(setRows).catch(() => setRows([]));
  }, [dealId]);

  async function generate() {
    setBusy(true);
    setBlockers([]);
    setNote(null);
    try {
      const created = await api.generateTlrExport(dealId, year);
      const sheets = Object.entries(created.sheetRows)
        .map(([name, n]) => `${name.replace(/^tlr_|__c$/g, "")} ${n}`)
        .join(", ");
      setNote(`Generated ${created.fileName} — ${created.cells} values across ${sheets} rows.`);
      setRows(await api.listTlrExports(dealId));
    } catch (e) {
      // The server returns its reasons as a structured list, so show them as the checklist
      // they are rather than a bare "Export blocked" with nothing actionable in it.
      const reasons = e instanceof ApiError ? e.blockers : [];
      if (reasons.length > 0) setBlockers(reasons);
      else onError(String((e as Error).message ?? e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card">
      <h2>AMIS upload file</h2>
      <p className="text-sm muted" style={{ marginTop: 0 }}>
        Builds the four-sheet TLR workbook for {year}. This produces the file you upload — it does not certify or
        submit anything to AMIS.
      </p>

      {blockers.length > 0 && (
        <div className="alert alert-warning">
          <strong>Not ready to generate:</strong>
          <ul style={{ marginBottom: 0 }}>
            {blockers.map((b) => (
              <li key={b}>{b}</li>
            ))}
          </ul>
        </div>
      )}
      {note && <div className="alert alert-info">{note}</div>}

      <button onClick={generate} disabled={busy}>
        {busy ? "Generating…" : `Generate ${year} TLR workbook`}
      </button>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>File</th>
              <th>Generated</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows?.map((r) => (
              <tr key={r.id}>
                <td className="cell-code">{r.fileName}</td>
                <td>{r.generatedAt ? new Date(r.generatedAt).toLocaleString() : "—"}</td>
                <td>{r.status}</td>
                <td>
                  <button
                    className="btn-secondary"
                    onClick={() =>
                      api
                        .downloadTlrExport(dealId, r.id, r.fileName ?? "tlr.xlsx")
                        .catch((e) => onError(String(e.message ?? e)))
                    }
                  >
                    Download
                  </button>
                </td>
              </tr>
            ))}
            {rows?.length === 0 && (
              <tr>
                <td className="state-cell" colSpan={4}>
                  No TLR workbook generated yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/**
 * Disbursements are a repeating record rather than a fixed set of fields — a note can draw
 * from several QEIs — so they get add and remove rather than a form to fill in.
 */
function Disbursements({
  dealId,
  data,
  onChange,
  onError,
}: {
  dealId: string;
  data: TlrWorkspace;
  onChange: (rows: TlrDisbursementRow[]) => void;
  onError: (e: string) => void;
}) {
  const [qliciId, setQliciId] = useState(data.qlicis[0]?.id ?? "");
  const [qeiName, setQeiName] = useState("");
  const [date, setDate] = useState("");
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);

  const codeOf = (id: string) => data.qlicis.find((q) => q.id === id)?.qliciCode ?? "—";

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!qliciId) return;
    setBusy(true);
    try {
      const created = await api.createTlrDisbursement(dealId, {
        qliciId,
        qeiName: qeiName.trim() || null,
        disbursementDate: date || null,
        sourceAmount: amount.trim() === "" ? null : Number(amount),
        isRevolving: false,
        amisNumber: null,
      });
      onChange([...data.disbursements, created]);
      setQeiName("");
      setDate("");
      setAmount("");
    } catch (err) {
      onError(String((err as Error).message ?? err));
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    try {
      await api.deleteTlrDisbursement(dealId, id);
      onChange(data.disbursements.filter((d) => d.id !== id));
    } catch (err) {
      onError(String((err as Error).message ?? err));
    }
  }

  if (data.qlicis.length === 0) {
    return (
      <p className="empty-state">
        Disbursements are draws against a QLICI note, so this deal needs QLICIs before they can be recorded.
      </p>
    );
  }

  return (
    <>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Note</th>
              <th>QEI</th>
              <th>Date</th>
              <th>Amount</th>
              <th>AMIS number</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {data.disbursements.map((d) => (
              <tr key={d.id}>
                <td className="cell-code">{codeOf(d.qliciId)}</td>
                <td>{d.qeiName ?? "—"}</td>
                <td>{d.disbursementDate?.slice(0, 10) ?? "—"}</td>
                <td>{d.sourceAmount === null ? "—" : d.sourceAmount.toLocaleString("en-US", { style: "currency", currency: "USD" })}</td>
                <td className="muted text-sm">{d.amisNumber ?? "Not yet in AMIS"}</td>
                <td>
                  <button className="btn-secondary" onClick={() => remove(d.id)}>
                    Remove
                  </button>
                </td>
              </tr>
            ))}
            {data.disbursements.length === 0 && (
              <tr>
                <td className="state-cell" colSpan={6}>
                  No disbursements recorded.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <form className="card form-stack" onSubmit={add}>
        <h2>Add a disbursement</h2>
        <div className="btn-row" style={{ alignItems: "flex-end", flexWrap: "wrap" }}>
          <div className="field">
            <label className="field-label" htmlFor="d-qlici">Note</label>
            <select id="d-qlici" value={qliciId} onChange={(e) => setQliciId(e.target.value)}>
              {data.qlicis.map((q) => (
                <option key={q.id} value={q.id}>{q.qliciCode}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label className="field-label" htmlFor="d-qei">QEI</label>
            <input id="d-qei" placeholder="QEI00014512" value={qeiName} onChange={(e) => setQeiName(e.target.value)} />
          </div>
          <div className="field">
            <label className="field-label" htmlFor="d-date">Date</label>
            <input id="d-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="field">
            <label className="field-label" htmlFor="d-amount">Amount</label>
            <input id="d-amount" type="number" min="0" step="any" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
          <button type="submit" disabled={busy || !qliciId}>{busy ? "Adding…" : "Add"}</button>
        </div>
      </form>
    </>
  );
}
