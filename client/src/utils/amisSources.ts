/**
 * Where each AMIS golden field is actually entered, per portal.
 *
 * Shared by the per-deal AMIS Center and the portfolio-wide readiness list so the two can't
 * disagree about where a field is fixed — a readiness row that reports something missing
 * without saying where to fix it is the gap this exists to close.
 *
 * Only fields whose target page genuinely renders the value are listed. Anything absent
 * has no entry screen today, which noEntryReason() states plainly rather than leaving the
 * reader at a dead end.
 */

const CBR_FIELDS = new Set([
  "annual_gross_revenue",
  "annual_net_operating_income",
  "jobs_created_actual",
  "jobs_retained_actual",
  "jobs_construction_actual",
  "tenant_count",
]);

/** Closing-time deal facts, maintained by Impact in Deal Setup. */
export const IMPACT_SETUP_FIELDS = new Set([
  "project_closing_date",
  "total_qei_amount",
  "lead_cde_allocation_control_number",
  "project_census_tract",
  "project_city_state",
  "multi_cde_project_number",
]);

/** The CDE's own participation data, which they maintain on their deal overview. */
const CDE_PARTICIPATION_FIELDS = new Set(["total_qei_amount", "lead_cde_allocation_control_number"]);

/**
 * Deal Setup is a long page and these fields sit well down it, so the link carries an
 * anchor to the field itself. Landing at the top of a page that holds a dozen fields is
 * barely better than no link at all.
 */
const SETUP_ANCHOR: Record<string, string> = {
  multi_cde_project_number: "multi-cde-project-number",
  project_census_tract: "project-address",
  project_city_state: "project-address",
  total_qei_amount: "cde-participations",
  lead_cde_allocation_control_number: "cde-participations",
  project_closing_date: "deal-profile",
};

export function sourceLink(fieldCode: string, portal: "impact" | "cde", dealId: string): string | null {
  if (CBR_FIELDS.has(fieldCode)) return `/${portal}/deals/${dealId}/cbr`;
  // Checked before the Impact branch because the two sets overlap: a CDE edits its own QEI
  // amount on its overview, while Impact edits every CDE's from deal setup.
  if (portal === "cde" && CDE_PARTICIPATION_FIELDS.has(fieldCode)) return `/cde/deals/${dealId}`;
  if (portal === "impact" && IMPACT_SETUP_FIELDS.has(fieldCode)) {
    const anchor = SETUP_ANCHOR[fieldCode];
    return `/impact/deals/${dealId}/setup${anchor ? `#${anchor}` : ""}`;
  }
  return null;
}

/** Why a field offers no link in this portal, so "Missing" is never a dead end. */
export function noEntryReason(fieldCode: string, portal: "impact" | "cde"): string | null {
  if (portal === "cde" && IMPACT_SETUP_FIELDS.has(fieldCode)) return "Impact maintains this in deal setup";
  if (fieldCode === "total_qlici_original_principal") return "Totalled from QLICI records";
  return null;
}
