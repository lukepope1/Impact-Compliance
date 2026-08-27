/** $1,234,567 — no decimals, since every dollar figure in this app (revenue, etc.) is a whole-dollar amount. */
export function formatCurrency(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === "") return "—";
  const num = typeof value === "string" ? Number(value) : value;
  if (Number.isNaN(num)) return "—";
  return num.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

/** 1,234 — thousands-separated, non-dollar counts (jobs, FTE, people served, square feet, etc.). */
export function formatNumber(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === "") return "—";
  const num = typeof value === "string" ? Number(value) : value;
  if (Number.isNaN(num)) return "—";
  return num.toLocaleString("en-US");
}

// Domain acronyms that should stay uppercase rather than being title-cased into "Cde"
// or "Amis" by humanize() below.
const ACRONYMS = new Set(["cde", "cdes", "amis", "qalicb", "qei", "qlici", "qlicis", "cbr", "csv", "nmtc", "fte", "lic", "lip", "hs", "id", "noi"]);

/**
 * Turns a raw snake_case enum value into readable label text — "document_collection" ->
 * "Document collection", "amis_csv" -> "AMIS CSV". Screens that need a specific wording
 * (or a badge color) still map statuses explicitly; this is the fallback so a value never
 * reaches the UI as a bare identifier, which several tables were previously doing.
 */
export function humanize(value: string | null | undefined): string {
  if (!value) return "—";
  const words = value.split(/[_\s-]+/).filter(Boolean);
  if (words.length === 0) return "—";
  return words
    .map((word, i) => {
      const lower = word.toLowerCase();
      if (ACRONYMS.has(lower)) return lower.toUpperCase();
      if (i === 0) return lower.charAt(0).toUpperCase() + lower.slice(1);
      return lower;
    })
    .join(" ");
}

/** Formats a calendar-date string (e.g. "2025-10-06") in UTC so it never shifts a day from local-timezone rendering. */
export function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, { timeZone: "UTC" });
}
