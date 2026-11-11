import { useSearchParams } from "react-router-dom";

/**
 * The reporting year a screen is looking at, held in the URL as ?year=.
 *
 * AMIS filings are made for the prior year, so a screen pinned to today's year cannot
 * produce the report people actually file. Keeping the year in the URL rather than in
 * component state means it survives a reload, can be linked to, and carries across the
 * deal's tabs — moving from AMIS Readiness to TLR Data Entry stays on the same year.
 */
export function useReportingYear(): [number, (year: number) => void] {
  const [params, setParams] = useSearchParams();
  const parsed = Number(params.get("year"));
  const year = Number.isInteger(parsed) && parsed >= 2000 && parsed <= 2100 ? parsed : new Date().getFullYear();

  function setYear(next: number) {
    // Other params (a category filter, say) are kept; only the year changes.
    const updated = new URLSearchParams(params);
    updated.set("year", String(next));
    setParams(updated, { replace: true });
  }

  return [year, setYear];
}

/** Years offered: the allocation-era floor through next year, newest first. */
function yearOptions(selected: number) {
  const latest = new Date().getFullYear() + 1;
  const years: number[] = [];
  for (let y = latest; y >= 2015; y--) years.push(y);
  // A year arriving by link that falls outside the list is still shown as selected.
  if (!years.includes(selected)) years.push(selected);
  return years.sort((a, b) => b - a);
}

export function YearPicker({ year, onChange, id = "reporting-year" }: { year: number; onChange: (year: number) => void; id?: string }) {
  return (
    <label className="year-picker" htmlFor={id}>
      Reporting year
      <select id={id} value={year} onChange={(e) => onChange(Number(e.target.value))}>
        {yearOptions(year).map((y) => (
          <option key={y} value={y}>
            {y}
          </option>
        ))}
      </select>
    </label>
  );
}
