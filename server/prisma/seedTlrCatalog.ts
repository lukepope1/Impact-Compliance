import type { FieldDataType, PrismaClient } from "@prisma/client";
import { TLR_CATALOG, TLR_FIELD_COUNT, TLR_MAPPING_NAME, TLR_MAPPING_VERSION, type TlrDataType } from "../src/lib/tlrFieldCatalog";

/**
 * Loads the TLR field catalog into the generic field machinery the schema already
 * provides: a FieldDefinition per TLR column, and an AmisFieldMapping tying each one to
 * the AMIS object and column header it has to be written back as.
 *
 * This is deliberately data rather than code. The platform's original AMIS support
 * hardcoded 13 "golden fields" in lib/goldenFields.ts as a shortcut, with a comment
 * admitting a real build would drive this from field_definitions. A TLR is 205 fields
 * across 4 related objects, which is well past what's sane to hand-write — and driving it
 * from the catalog means the editor UI, validation, and the export generator can all be
 * rendered from one source rather than each maintaining its own copy of the field list.
 *
 * Idempotent: every write is an upsert keyed on a natural unique constraint, so this can
 * run on every seed and be re-run after regenerating the catalog from a newer TLR export.
 */

// The catalog's inferred types are a superset of what FieldDefinition stores; both use the
// same vocabulary, so this is a narrowing rather than a translation.
const DATA_TYPE: Record<TlrDataType, FieldDataType> = {
  text: "text",
  integer: "integer",
  decimal: "decimal",
  currency: "currency",
  percent: "percent",
  boolean: "boolean",
  date: "date",
};

export async function seedTlrCatalog(prisma: PrismaClient) {
  const mappingVersion = await prisma.amisMappingVersion.upsert({
    where: {
      mappingName_versionCode_transport: {
        mappingName: TLR_MAPPING_NAME,
        versionCode: TLR_MAPPING_VERSION,
        transport: "manual_review_xlsx",
      },
    },
    create: {
      mappingName: TLR_MAPPING_NAME,
      versionCode: TLR_MAPPING_VERSION,
      // A TLR is uploaded to AMIS as a multi-sheet workbook, not the flat CSV the existing
      // golden-field export produces, so it gets its own transport and its own mapping
      // version rather than extending that one.
      transport: "manual_review_xlsx",
      status: "active",
      templateFileName: "TLRCertificationPreview.xlsx",
    },
    update: { status: "active" },
  });

  let fields = 0;
  let mappings = 0;

  for (const object of TLR_CATALOG) {
    for (const spec of object.fields) {
      const definition = await prisma.fieldDefinition.upsert({
        where: { fieldCode_version: { fieldCode: spec.fieldCode, version: 1 } },
        create: {
          fieldCode: spec.fieldCode,
          version: 1,
          label: spec.amisFieldName,
          module: "amis",
          dataType: DATA_TYPE[spec.dataType],
          // Real values seen in the sample export. Kept as a hint for whoever reviews the
          // inferred type or turns a free-text field into a proper picklist — not
          // treated as an authoritative option list, since one export can't prove the
          // full domain of a field.
          optionValues: spec.observed.length > 0 ? { observedSamples: spec.observed } : undefined,
        },
        update: {
          label: spec.amisFieldName,
          dataType: DATA_TYPE[spec.dataType],
        },
      });
      fields += 1;

      await prisma.amisFieldMapping.upsert({
        where: {
          mappingVersionId_amisObject_amisFieldName: {
            mappingVersionId: mappingVersion.id,
            amisObject: object.amisObject,
            amisFieldName: spec.amisFieldName,
          },
        },
        create: {
          mappingVersionId: mappingVersion.id,
          internalFieldCode: spec.fieldCode,
          fieldDefinitionId: definition.id,
          amisObject: object.amisObject,
          amisFieldName: spec.amisFieldName,
          sortOrder: spec.sortOrder,
        },
        update: {
          internalFieldCode: spec.fieldCode,
          fieldDefinitionId: definition.id,
          sortOrder: spec.sortOrder,
        },
      });
      mappings += 1;
    }
  }

  return {
    mappingVersionId: mappingVersion.id,
    objects: TLR_CATALOG.length,
    fields,
    mappings,
    expected: TLR_FIELD_COUNT,
  };
}
