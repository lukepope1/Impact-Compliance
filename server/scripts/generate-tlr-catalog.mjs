import { readFileSync, writeFileSync, mkdtempSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";

/**
 * Turns a real AMIS TLR certification workbook into the field catalog the platform seeds
 * from (server/prisma/tlrFieldCatalog.ts).
 *
 *   node server/scripts/generate-tlr-catalog.mjs <path-to-tlr.xlsx>
 *
 * An .xlsx is a zip of XML, so this reads it directly rather than depending on a
 * spreadsheet library — the catalog is generated rarely and committed, so a build-time
 * dependency would cost more than it saves.
 *
 * Types are *inferred* and are a starting point, not gospel. Each field keeps a few real
 * observed values so a wrong guess is visible rather than silent.
 */

const source = process.argv[2];
if (!source) {
  console.error("Usage: node server/scripts/generate-tlr-catalog.mjs <path-to-tlr.xlsx>");
  process.exit(1);
}

const work = mkdtempSync(join(tmpdir(), "tlr-"));
execFileSync("unzip", ["-o", "-q", source, "-d", work]);
const rd = (p) => readFileSync(join(work, p), "utf8");

const decode = (s) =>
  s
    .replace(/&#10;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");

const shared = [...rd("xl/sharedStrings.xml").matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) =>
  decode([...m[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((t) => t[1]).join(""))
);

const sheetNames = [...rd("xl/workbook.xml").matchAll(/<sheet[^>]*name="([^"]*)"/g)].map((m) => decode(m[1]));

// Money, rates, and identifiers can't be told apart from a bare number, so the label
// carries that meaning. Identifiers in particular must stay text: a zip or FIPS code
// stored as a number silently loses its leading zero, and AMIS matches them as strings.
const CURRENCY_HINT = /(amount|cost|revenue|\bfee|balance|value|income|proceeds|charged off|recovered|reserve)/i;
const PERCENT_HINT = /(rate|ratio|percent|%)/i;
const IDENTIFIER_HINT = /(zip code|fips|naics|\btin\b|\bid\b|certification number|project number|amis number|sub-cde|transaction id|client id)/i;
// "Number of ..." / "Num ..." are genuine counts, not identifiers.
const COUNT_LABEL = /^(number of|num )/i;
// This export writes dates as Java Date.toString() text ("Thu Mar 17 00:00:00 GMT 2022")
// rather than xlsx date serials, so the cell's number format reveals nothing and the
// label is the only reliable signal that a column is a date.
const DATE_LABEL = /\bdate\b/i;
// "... Measure" fields are AMIS picklists (Job Quality Measure, Job Accessibility
// Measure), which arrive as codes but are not quantities.
const MEASURE_LABEL = /\bmeasure\b/i;

function inferType(label, values) {
  if (DATE_LABEL.test(label)) return "date";
  if (MEASURE_LABEL.test(label)) return "text";
  if (IDENTIFIER_HINT.test(label) && !COUNT_LABEL.test(label)) return "text";
  if (values.length === 0) {
    // Nothing observed, so fall back to what the label claims rather than defaulting
    // everything to text — "Number of Quality Jobs" is a count even in a sample where
    // every project left it blank.
    if (CURRENCY_HINT.test(label)) return "currency";
    if (COUNT_LABEL.test(label)) return "integer";
    return "text";
  }

  const allNumeric = values.every((v) => v !== "" && !Number.isNaN(Number(v)));
  const allBool = values.every((v) => /^(y|n|yes|no|true|false)$/i.test(v));
  if (allBool) return "boolean";
  if (!allNumeric) return "text";
  if (CURRENCY_HINT.test(label)) return "currency";
  if (PERCENT_HINT.test(label)) return "percent";
  // "0.00" is a decimal even though its numeric value is whole — FTE counts arrive this
  // way and rounding them to integers would quietly lose fractional jobs.
  const anyFractionalNotation = values.some((v) => String(v).includes("."));
  return anyFractionalNotation ? "decimal" : "integer";
}

const codeFor = (label) =>
  label.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 60);

const objects = sheetNames.map((amisObject, i) => {
  const xml = rd(`xl/worksheets/sheet${i + 1}.xml`);
  const rows = [...xml.matchAll(/<row[^>]*r="\d+"[^>]*>([\s\S]*?)<\/row>/g)];

  const cellsOf = (body) => {
    const out = {};
    for (const m of body.matchAll(/<c[^>]*r="([A-Z]+)\d+"([^>]*)>(?:<v>([\s\S]*?)<\/v>)?<\/c>/g)) {
      const type = m[2].match(/t="([^"]*)"/)?.[1];
      let value = m[3];
      if (type === "s" && value !== undefined) value = shared[Number(value)] ?? "";
      out[m[1]] = value === undefined ? "" : decode(String(value)).trim();
    }
    return out;
  };

  const header = cellsOf(rows[0][1]);
  const dataRows = rows.slice(1).map((r) => cellsOf(r[1]));
  const seen = new Set();

  const fields = Object.keys(header)
    .filter((col) => header[col] !== "")
    .map((col, idx) => {
      const label = header[col];
      const values = dataRows.map((r) => r[col]).filter((v) => v !== undefined && v !== "");

      let code = codeFor(label);
      while (seen.has(code)) code = `${code}_x`;
      seen.add(code);

      return {
        fieldCode: `${amisObject.replace(/__c$/, "")}.${code}`,
        amisFieldName: label,
        column: col,
        sortOrder: idx + 1,
        dataType: inferType(label, values),
        observed: [...new Set(values)].slice(0, 5),
        populated: values.length,
      };
    });

  return { amisObject, sampleRowCount: rows.length - 1, fields };
});

const total = objects.reduce((sum, o) => sum + o.fields.length, 0);

const file = `// GENERATED FILE — do not edit by hand.
// Produced by server/scripts/generate-tlr-catalog.mjs from a real TLR certification
// workbook exported from AMIS. To regenerate:
//   node server/scripts/generate-tlr-catalog.mjs <path-to-tlr.xlsx>
//
// ${total} fields across ${objects.length} AMIS objects, which is the real shape of a TLR upload:
// one project row, many note rows (one per QLICI), many disbursements, one address row.
//
// Note the source workbook is a *download* from AMIS, so its formatting is AMIS's output
// convention — dates arrive as Java Date.toString() strings, for instance. What AMIS
// accepts on upload is not necessarily identical and needs confirming against an actual
// import before the export generator is trusted.
//
// dataType is inferred from sample values plus the field label, so it is a starting point
// rather than authoritative. \`observed\` keeps a few real values per field so a wrong
// guess is visible instead of silent.

export type TlrDataType = "text" | "integer" | "decimal" | "currency" | "percent" | "boolean" | "date";

export interface TlrFieldSpec {
  /** Stable internal code, prefixed by AMIS object so labels repeated across sheets don't collide. */
  fieldCode: string;
  /** The exact column header AMIS uses — this is what an export has to emit. */
  amisFieldName: string;
  /** Column letter in the source workbook, for tracing a field back to the sample. */
  column: string;
  sortOrder: number;
  dataType: TlrDataType;
  /** A few real values seen in the sample, for sanity-checking the inferred type. */
  observed: string[];
  /** How many sample rows carried a value; 0 means the type came from the label alone. */
  populated: number;
}

export interface TlrObjectSpec {
  amisObject: string;
  sampleRowCount: number;
  fields: TlrFieldSpec[];
}

export const TLR_MAPPING_NAME = "NMTC TLR Certification";
export const TLR_MAPPING_VERSION = "2023";

export const TLR_CATALOG: TlrObjectSpec[] = ${JSON.stringify(objects, null, 2)};

export const TLR_FIELD_COUNT = ${total};
`;

const out = join(process.cwd(), "prisma", "tlrFieldCatalog.ts");
writeFileSync(out, file);

console.log(`${total} fields across ${objects.length} objects -> ${out}`);
for (const o of objects) {
  const byType = o.fields.reduce((acc, f) => ({ ...acc, [f.dataType]: (acc[f.dataType] ?? 0) + 1 }), {});
  console.log(`  ${o.amisObject.padEnd(22)} ${String(o.fields.length).padStart(3)} fields  ${JSON.stringify(byType)}`);
}
