import { TLR_CATALOG, type TlrDataType } from "./tlrFieldCatalog";

/**
 * How each TLR object is scoped, which the catalog itself doesn't say.
 *
 * The sample workbook is one CDE's annual filing covering seven projects: 7 project rows,
 * 7 address rows, and 14 note rows. So per deal a TLR carries one project row, one address
 * row, and one note row per QLICI — which is what decides whether a field's value hangs off
 * the deal or off a specific note.
 *
 * Disbursements are absent here on purpose. They are typed columns on their own table
 * rather than StructuredValue rows, because unlike the other three objects a disbursement
 * is a repeating record with no fixed count per note, so it needs add and remove rather
 * than a fixed set of fields to fill in.
 */
export type TlrScope = "deal" | "qlici";

// Ordered as the filing reads — the project, then where it is, then the notes against it —
// rather than the alphabetical sheet order the workbook happens to be stored in.
export const TLR_OBJECT_SCOPE: Record<string, TlrScope> = {
  tlr_project__c: "deal",
  tlr_address__c: "deal",
  tlr_note__c: "qlici",
};

/**
 * Columns AMIS owns rather than the filer. "Result" is the outcome AMIS writes back after
 * an upload, and "AMIS Number" and "Record Type of New Record" are its own record
 * identifiers. They stay in the catalog, because the catalog describes the report and an
 * export still has to emit these columns — but offering them as form fields would invite
 * someone to type a value AMIS overwrites.
 */
const AMIS_MANAGED = /^(result|amis number|record type of new record)$/i;

/**
 * The deal's project number, entered once.
 *
 * The same Sub-CDE project number appears in three columns across the workbook, under two
 * different labels — "Project Number" on the project and address sheets, "Sub-CDE" on the
 * note sheet (the sample shows all three carrying the same "32"). Asking for it three
 * times would invite three different answers, so it is captured once here and written to
 * all three columns at export.
 *
 * Note that the note sheet also has its own "Project Number" holding an AMIS-assigned id
 * ("TLRP-00021987"), which is different data despite the identical label and stays a
 * separate field.
 */
export const PROJECT_NUMBER_FIELD = "tlr_project.project_number";

/** Columns the export fills from PROJECT_NUMBER_FIELD rather than from their own entry. */
export const DERIVED_FROM_PROJECT_NUMBER = ["tlr_address.project_number", "tlr_note.sub_cde"];

/**
 * The TLR's "Multi-CDE Project ID" columns, filled from the deal's own
 * multiCdeProjectNumber rather than entered again here.
 *
 * That value already exists on the deal, is what AMIS readiness reports on, and is
 * maintained by Impact in deal setup. Offering it a second time as a TLR field gave the
 * same fact two homes that could disagree — and next to the TLR's unrelated "Project
 * Number" (the Sub-CDE number) the pair was genuinely hard to tell apart.
 */
export const DERIVED_FROM_MULTI_CDE_PROJECT_NUMBER = [
  "tlr_project.multi_cde_project_id",
  "tlr_address.multi_cde_project_id",
];

// Not offered as form fields, since they are written from a single value held elsewhere.
// They stay in the catalog because the export still has to emit those columns.
const DERIVED = new Set([...DERIVED_FROM_PROJECT_NUMBER, ...DERIVED_FROM_MULTI_CDE_PROJECT_NUMBER]);

export interface EditableTlrField {
  fieldCode: string;
  amisFieldName: string;
  dataType: TlrDataType;
  sortOrder: number;
  observed: string[];
}

export interface EditableTlrObject {
  amisObject: string;
  scope: TlrScope;
  fields: EditableTlrField[];
}

/** The three objects the field editor can write, in filing order. */
export const EDITABLE_TLR_OBJECTS: EditableTlrObject[] = Object.keys(TLR_OBJECT_SCOPE)
  .map((name) => TLR_CATALOG.find((o) => o.amisObject === name)!)
  .filter(Boolean)
  .map((o) => ({
  amisObject: o.amisObject,
  scope: TLR_OBJECT_SCOPE[o.amisObject],
  fields: o.fields
    .filter((f) => !AMIS_MANAGED.test(f.amisFieldName) && !DERIVED.has(f.fieldCode))
    .map((f) => ({
      fieldCode: f.fieldCode,
      amisFieldName: f.amisFieldName,
      dataType: f.dataType,
      sortOrder: f.sortOrder,
      observed: f.observed,
    }))
    .sort((a, b) => a.sortOrder - b.sortOrder),
}));

export const EDITABLE_FIELD_BY_CODE = new Map(
  EDITABLE_TLR_OBJECTS.flatMap((o) => o.fields.map((f) => [f.fieldCode, { ...f, scope: o.scope, amisObject: o.amisObject }] as const))
);

/**
 * Which StructuredValue column a value belongs in. StructuredValue keeps one typed column
 * per shape rather than a single stringified blob, so a wrong type fails on write instead
 * of surfacing as a bad TLR months later.
 */
export function columnForDataType(dataType: TlrDataType): "valueText" | "valueNumber" | "valueBoolean" | "valueDate" {
  switch (dataType) {
    case "boolean":
      return "valueBoolean";
    case "date":
      return "valueDate";
    case "integer":
    case "decimal":
    case "currency":
    case "percent":
      return "valueNumber";
    default:
      return "valueText";
  }
}
