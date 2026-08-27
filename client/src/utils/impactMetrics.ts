/**
 * The impact measures a deal can commit to, in the order they're shown everywhere.
 * Shared between the entry form (Deal Setup) and the portfolio roll-up so a measure can't
 * be labelled one way when it's entered and another when it's reported.
 *
 * `actualFrom` states, in the UI, which CBR figure each commitment will be measured
 * against — whoever types a number should be able to see what it will be compared with,
 * rather than having to infer it from the dashboard later.
 */
export const IMPACT_METRICS = [
  {
    key: "permanent_jobs",
    label: "Permanent jobs",
    actualFrom: "CBR jobs marked “created”, by FTE",
  },
  {
    key: "retained_jobs",
    label: "Retained jobs",
    actualFrom: "CBR jobs marked “retained”, by FTE",
  },
  {
    key: "construction_jobs",
    label: "Construction jobs",
    actualFrom: "CBR jobs marked “construction”, by FTE",
  },
  {
    key: "lmi_jobs",
    label: "LIC/LIP-accessible jobs",
    actualFrom: "CBR jobs flagged accessible to LIC/LIP residents, by FTE",
  },
  {
    key: "people_served",
    label: "People served",
    actualFrom: "CBR community services, people served this period",
  },
  {
    key: "square_feet",
    label: "Square feet",
    actualFrom: "CBR community services and tenant records, square feet",
  },
] as const;

export type ImpactMetricKey = (typeof IMPACT_METRICS)[number]["key"];

export const IMPACT_METRIC_LABEL: Record<string, string> = Object.fromEntries(
  IMPACT_METRICS.map((m) => [m.key, m.label])
);
