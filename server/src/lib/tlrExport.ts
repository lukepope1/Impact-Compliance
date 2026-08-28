import { prisma } from "./prisma";
import { buildXlsx, type XlsxSheet } from "./xlsx";
import { TLR_CATALOG, type TlrFieldSpec } from "./tlrFieldCatalog";
import { PROJECT_NUMBER_FIELD, DERIVED_FROM_PROJECT_NUMBER, DERIVED_FROM_MULTI_CDE_PROJECT_NUMBER, TLR_OBJECT_SCOPE } from "./tlrScope";

/**
 * Builds the four-sheet workbook a CDE uploads to AMIS.
 *
 * Sheets and column headers come from the catalog generated from a real AMIS export, so
 * the output carries every column AMIS expects — including the ones nobody fills in, since
 * a missing column is a different failure from an empty one.
 *
 * The workbook this was derived from is a *download* from AMIS. That makes its conventions
 * AMIS's output format, which is the best available evidence of the shape it wants back
 * but is not proof: what AMIS accepts on upload needs confirming against a real import
 * before this is trusted. The formatting choices are deliberately isolated in
 * formatValue() below so that confirmation is a one-place change.
 */

// Mirrors the sample exactly — AMIS writes dates as Java's Date.toString(). Emitting the
// same text is the most defensible default when the sample is the only ground truth, but
// it is also the single likeliest thing to need changing after a real upload test.
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function formatAmisDate(d: Date) {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${DAYS[d.getUTCDay()]} ${MONTHS[d.getUTCMonth()]} ${p(d.getUTCDate())} 00:00:00 GMT ${d.getUTCFullYear()}`;
}

/**
 * Booleans are not written the same way across the workbook: the project sheet uses
 * YES/NO while the disbursement sheet uses true/false. Rather than pick one and be wrong
 * on half the file, each field is written back in the style actually observed in that
 * column of the sample.
 */
function formatBoolean(value: boolean, observed: string[]) {
  const sample = observed.find((o) => /^(y|n|yes|no|true|false)$/i.test(o));
  if (sample && /^(true|false)$/i.test(sample)) return value ? "true" : "false";
  if (sample && /^(y|n)$/i.test(sample)) return value ? "Y" : "N";
  return value ? "YES" : "NO";
}

function formatValue(field: TlrFieldSpec, value: unknown): string | number | null {
  if (value === null || value === undefined || value === "") return null;
  if (field.dataType === "boolean") return formatBoolean(value === true || value === "true", field.observed);
  if (field.dataType === "date") {
    const d = value instanceof Date ? value : new Date(String(value));
    return Number.isNaN(d.getTime()) ? null : formatAmisDate(d);
  }
  if (field.dataType === "text") return String(value);
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export interface TlrExportResult {
  buffer: Buffer;
  /** Per-sheet row counts, so the caller can report what was actually produced. */
  sheetRows: Record<string, number>;
  /** Flat list for export lineage: every non-empty cell and where it came from. */
  cells: { amisObject: string; amisFieldName: string; fieldCode: string; value: string }[];
  projectNumber: string | null;
  blockers: string[];
}

export async function buildTlrExport(dealId: string, year: number): Promise<TlrExportResult> {
  const periodEnd = new Date(Date.UTC(year, 11, 31));

  const [deal, qlicis, values, disbursements] = await Promise.all([
    prisma.deal.findUnique({ where: { id: dealId }, select: { multiCdeProjectNumber: true } }),
    prisma.qlici.findMany({ where: { dealId }, orderBy: { qliciCode: "asc" } }),
    prisma.structuredValue.findMany({
      where: { dealId, reportingPeriodEnd: periodEnd },
      select: {
        qliciId: true,
        valueText: true,
        valueNumber: true,
        valueBoolean: true,
        valueDate: true,
        fieldDefinition: { select: { fieldCode: true } },
      },
    }),
    prisma.disbursement.findMany({
      where: { qlici: { dealId } },
      orderBy: [{ disbursementDate: "asc" }, { createdAt: "asc" }],
    }),
  ]);

  const key = (fieldCode: string, qliciId: string | null) => `${qliciId ?? "deal"}::${fieldCode}`;
  const stored = new Map<string, unknown>();
  for (const v of values) {
    const raw =
      v.valueBoolean ??
      v.valueDate ??
      (v.valueNumber === null ? null : Number(v.valueNumber)) ??
      v.valueText;
    stored.set(key(v.fieldDefinition.fieldCode, v.qliciId), raw);
  }

  const projectNumber = (stored.get(key(PROJECT_NUMBER_FIELD, null)) as string | undefined) ?? null;
  const cells: TlrExportResult["cells"] = [];

  // Resolution order matters: the derived project-number columns are filled from the single
  // entered value, never from a stored value of their own, so the three columns can't
  // disagree.
  function resolve(field: TlrFieldSpec, qliciId: string | null): unknown {
    if (DERIVED_FROM_PROJECT_NUMBER.includes(field.fieldCode)) return projectNumber;
    if (DERIVED_FROM_MULTI_CDE_PROJECT_NUMBER.includes(field.fieldCode)) return deal?.multiCdeProjectNumber ?? null;
    return stored.get(key(field.fieldCode, qliciId)) ?? null;
  }

  function rowFor(fields: TlrFieldSpec[], amisObject: string, qliciId: string | null) {
    return fields.map((f) => {
      const out = formatValue(f, resolve(f, qliciId));
      if (out !== null) {
        cells.push({ amisObject, amisFieldName: f.amisFieldName, fieldCode: f.fieldCode, value: String(out) });
      }
      return out;
    });
  }

  const sheets: XlsxSheet[] = [];
  const sheetRows: Record<string, number> = {};

  for (const object of TLR_CATALOG) {
    const fields = [...object.fields].sort((a, b) => a.sortOrder - b.sortOrder);
    const header = fields.map((f) => f.amisFieldName);
    let rows: (string | number | null)[][];

    if (object.amisObject === "tlr_disbursement__c") {
      // Disbursements are typed columns on their own table rather than StructuredValue
      // rows, so they are mapped by name instead of resolved from the catalog.
      const codeOf = new Map(qlicis.map((q) => [q.id, q.qliciCode]));
      const noteTransactionId = new Map(
        qlicis
          .map((q) => [q.id, stored.get(key("tlr_note.originator_transaction_id", q.id))] as const)
          .filter((e): e is readonly [string, string] => typeof e[1] === "string" && e[1] !== "")
      );
      rows = disbursements.map((d) =>
        fields.map((f) => {
          const out = ((): string | number | null => {
          switch (f.amisFieldName) {
            case "Originator Transaction ID":
              // This is the note's id, and it is what joins the two sheets, so it is read
              // from the note rather than stored again on the draw. Prefer whatever the
              // filer entered on the note sheet: it is the CDE's own loan id in their
              // servicing system ("L1654041001" in the sample), which the platform's
              // internal QLICI code is only a stand-in for. Taking the QLICI code here
              // while the note sheet carried the real id would break the join.
              return noteTransactionId.get(d.qliciId) ?? codeOf.get(d.qliciId) ?? null;
            case "QEI Name":
              return d.qeiName;
            case "Disbursement Date":
              return d.disbursementDate ? formatAmisDate(d.disbursementDate) : null;
            case "Source Amount":
              return d.sourceAmount === null ? null : Number(d.sourceAmount);
            case "Revolving Loan":
              return formatBoolean(d.isRevolving, f.observed);
            case "AMIS Number":
              return d.amisNumber;
            default:
              // "Result" and "Record Type of New Record" are AMIS's own columns. Emitted
              // as headers so the sheet has the shape AMIS expects, left empty because
              // AMIS fills them.
              return null;
          }
          })();
          if (out !== null) {
            cells.push({ amisObject: object.amisObject, amisFieldName: f.amisFieldName, fieldCode: f.fieldCode, value: String(out) });
          }
          return out;
        })
      );
    } else if (TLR_OBJECT_SCOPE[object.amisObject] === "qlici") {
      rows = qlicis.map((q) => rowFor(fields, object.amisObject, q.id));
    } else {
      rows = [rowFor(fields, object.amisObject, null)];
    }

    sheets.push({ name: object.amisObject, rows: [header, ...rows] });
    sheetRows[object.amisObject] = rows.length;
  }

  // Reported rather than enforced beyond the project number: a TLR has legitimately empty
  // columns, so refusing to generate until all 205 are filled would block every real
  // filing. The project number is different — without it the sheets cannot be joined to
  // each other, so the export would be unusable rather than merely incomplete.
  const blockers: string[] = [];
  if (!projectNumber) blockers.push("Project Number is required — it joins the project, address and note sheets.");
  if (qlicis.length === 0) blockers.push("This deal has no QLICIs, so the note sheet would be empty.");

  return { buffer: buildXlsx(sheets), sheetRows, cells, projectNumber, blockers };
}
