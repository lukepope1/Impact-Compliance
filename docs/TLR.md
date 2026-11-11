# TLR (Transaction Level Report) — developer guide

How the platform captures TLR data and produces the workbook a CDE uploads to AMIS.
Read this before touching anything under `server/src/lib/tlr*`, `server/src/routes/tlr.ts`
or `client/src/pages/shared/TlrEditor.tsx`.

## What a TLR is, in this codebase

A TLR upload is one `.xlsx` with **four sheets**, each an AMIS object:

| Sheet (AMIS object)   | Columns | Rows per deal | Stored as                        |
|-----------------------|--------:|---------------|----------------------------------|
| `tlr_project__c`      |     114 | 1             | `StructuredValue`, deal-scoped   |
| `tlr_address__c`      |      22 | 1             | `StructuredValue`, deal-scoped   |
| `tlr_note__c`         |      61 | 1 per QLICI   | `StructuredValue` with `qliciId` |
| `tlr_disbursement__c` |       8 | 1 per draw    | `Disbursement` table             |

205 columns in total. They are **not hand-coded anywhere**. The entry form, the validation
and the export are all driven from one generated catalog.

## The field catalog

`server/src/lib/tlrFieldCatalog.ts` is a **generated file**. Do not edit it by hand.

It is produced from a real TLR certification workbook exported from AMIS:

```bash
cd server
node scripts/generate-tlr-catalog.mjs "<path-to-tlr.xlsx>"
npm run seed:reference        # load the regenerated catalog into the database
```

The generator reads the workbook as a zip of XML (no spreadsheet dependency) and, per
column, records the exact AMIS header, its position, an inferred data type, and a few real
values seen in the sample (`observed`).

**Types are inferred, not authoritative.** The rules live in `inferType()`. The ones that
matter:

- A label containing "date" is a date. The export writes dates as text, so the cell format
  reveals nothing and the label is the only signal.
- Identifiers (zip, FIPS, NAICS, TIN, "… ID", "… Number") are **text**. Stored as numbers
  they lose leading zeros, and AMIS matches them as strings.
- "Number of …" is a count even when the sample column is empty.
- Percent beats currency when a label matches both ("Loan-to-Value Ratio" contains
  "value" but is a ratio).
- A column whose values include anything other than yes/no (for example `NA`) stays text
  rather than being forced to a boolean.

If a type is wrong, fix the rule in the generator and regenerate. Do not patch the output.

The catalog is loaded into `FieldDefinition` (one row per column, `module = "amis"`) and
`AmisFieldMapping` (ties each definition to its AMIS object, header and column order) under
the `AmisMappingVersion` named `NMTC TLR Certification` / `2023`. Loading is done by
`server/prisma/seedTlrCatalog.ts`, is all upserts, and runs **on every boot** through
`prisma/seedReference.ts`. It is reference data, not demo data, and is deliberately not
behind `SEED_ON_START`.

## Which fields are editable

`server/src/lib/tlrScope.ts` decides what the entry form offers. A catalog column is left
out of the form in three cases, but **is still emitted by the export**:

1. **AMIS-managed** — `Result`, `AMIS Number`, `Record Type of New Record`. AMIS writes
   these; anything a filer typed would be overwritten.
2. **Derived from the project number** — `tlr_address.project_number` and
   `tlr_note.sub_cde` are filled from the single `tlr_project.project_number` value.
3. **Derived from the deal** — both `Multi-CDE Project ID` columns are filled from
   `Deal.multiCdeProjectNumber`, which Impact maintains in Deal Setup.

### The three "project numbers"

Three different identifiers have near-identical names. Confusing them breaks the filing.

| What                        | Example         | Where it is entered                        |
|-----------------------------|-----------------|--------------------------------------------|
| Sub-CDE project number      | `32`            | TLR Data Entry → Project Number            |
| Multi-CDE Project ID        | `MCDE-00001923` | Impact → Deal Setup → Deal profile         |
| Note sheet "Project Number" | `TLRP-00021987` | TLR Data Entry → Notes tab (AMIS-assigned) |

The Sub-CDE number is what joins the sheets. It appears as `Project Number` on the project
and address sheets and as `Sub-CDE` on the note sheet. It is entered once and written to
all three so they cannot disagree. The export refuses to generate without it.

## Storage

Values live in `StructuredValue`, one row per (deal, optional QLICI, field, reporting year).

- `reportingPeriodEnd` is 31 December of the reporting year. A TLR is filed annually and
  the figures differ between filings, so each year has its own values.
- `qliciId` is null for project and address fields and set for note fields. `dealId` is
  always set and is what access checks use. Nothing in the schema stops the two
  disagreeing, so **the write path verifies every QLICI belongs to the deal**. Keep that
  check if you add another writer.
- There is no unique constraint on that tuple (the model is designed to keep superseded
  history), so the editor replaces a value by delete-then-insert inside a transaction.
- Blank means "not asserted". Saving an empty field deletes the row rather than storing a
  zero.

Disbursements are a separate `Disbursement` table hanging off `Qlici`, because a note has
an open-ended number of draws. The QEI is stored per draw as its AMIS name
(`QEI00014512`): one note can draw from several QEIs, and the platform has no QEI entity.

## API

`server/src/routes/tlr.ts`, mounted at `/api/deals/:dealId/tlr`.

| Method and path                   | Who                                     | Purpose                                 |
|-----------------------------------|-----------------------------------------|-----------------------------------------|
| `GET /?year=`                     | anyone with deal access                 | Editable catalog, values, QLICIs, draws |
| `PUT /values`                     | Impact (all roles), CDE admin/reviewer  | Save or clear field values              |
| `POST /disbursements`             | same                                    | Add a draw                              |
| `DELETE /disbursements/:id`       | same                                    | Remove a draw                           |
| `POST /exports/:year`             | same                                    | Generate the workbook                   |
| `GET /exports`                    | anyone with deal access                 | List generated workbooks                |
| `GET /exports/:exportId/download` | anyone with deal access                 | Download one                            |

QALICBs can read but not write. A blocked export returns `422` with
`{ error, blockers: string[] }`; the client's `ApiError.blockers` exposes the list.

## The export

`buildTlrExport(dealId, year)` in `server/src/lib/tlrExport.ts` emits every catalog column
in catalog order, including the ones nobody filled in. A missing column is a different
failure from an empty one. The header row has been verified cell-for-cell against the
source workbook.

Deliberate behaviour:

- **Booleans follow each column's own convention** (`YES`/`NO` on the project sheet,
  `true`/`false` on disbursements), read from the catalog's `observed` values.
- **Identifiers are written as strings** so leading zeros survive.
- **The disbursement's Originator Transaction ID is read from the note**, falling back to
  the QLICI code, so the note and disbursement sheets always join.
- **Only the project number and "at least one QLICI" block generation.** A real TLR has
  legitimately empty columns.
- Each generated file is an `ExportBatch` (`exportType = amis_tlr_xlsx`) with one
  `ExportFieldLineage` row per non-empty cell.
- The workbook is written by `server/src/lib/xlsx.ts`, a small purpose-built writer
  (strings and numbers only, no styles or formulas). Its output has been opened in Excel.

### Open item: date format on upload

Dates are written exactly as they appear in the source workbook:
`Thu Mar 17 00:00:00 GMT 2022`. That workbook is a **download** from AMIS, so this is
evidence of AMIS's output format, not proof of what it accepts on upload. **It has not
been tested against a real AMIS import.** All formatting is isolated in `formatValue()` and
`formatAmisDate()`, so a correction is a one-place change. Test one real upload before
relying on this.

## The entry screen

`client/src/pages/shared/TlrEditor.tsx`. Routes: `/impact/deals/:dealId/tlr` and
`/cde/deals/:dealId/tlr`, with `?year=`.

- The form is rendered from the catalog returned by `GET /tlr`. No field is listed in the
  client.
- Unsaved edits are tracked by comparing the draft with what the server last returned.
  One **Save** writes every unsaved change on the page, whichever tab it was made on.
- Leaving with unsaved edits (another tab, another screen, a different year) is held by
  `useBlocker` with save / discard / keep-editing. This is why `main.tsx` uses a data
  router (`createBrowserRouter`): `useBlocker` does not exist under `<BrowserRouter>`.
- The reporting year comes from `useReportingYear()` in `ReportingYear.tsx`, shared with
  AMIS Readiness and the Multi-CDE Snapshot, and is carried across the deal's tabs.

## Relationship to the older "golden fields"

`server/src/lib/goldenFields.ts` still powers the 13-field **AMIS readiness** check and the
Multi-CDE snapshot. It is a readiness summary, not a filing, and is a different field set
from the TLR. The CSV it used to export has been removed. Only the download route for old
CSV batches remains, in `routes/amis.ts`.

## Known gaps

- No automated tests. Highest-value first tests: export headers equal the catalog; derived
  columns fill; a QLICI from another deal is rejected; blank clears a value.
- AMIS's `Result` column is not read back in. There is no import of an AMIS response.
- The catalog is the 2023 format. A new format means regenerating from a newer workbook
  and, if columns changed, adding a new `AmisMappingVersion` rather than editing this one.
- The seeded demo deals have one QLICI and no disbursements, so the note and disbursement
  paths are lightly exercised.
