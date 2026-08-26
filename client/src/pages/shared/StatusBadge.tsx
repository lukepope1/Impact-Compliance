// Central status -> badge-color mapping so every dashboard/table renders the same
// requirement-instance status the same way instead of each screen picking its own colors.
const STATUS_CLASSES: Record<string, string> = {
  not_due: "badge-neutral",
  upcoming: "badge-warning",
  draft_submitted: "badge-navy",
  submitted: "badge-navy",
  impact_review: "badge-navy",
  returned: "badge-danger",
  impact_approved: "badge-navy",
  cde_review: "badge-navy",
  cde_approved: "badge-success",
  amis_ready: "badge-success",
  exported_filed: "badge-success",
  closed: "badge-success",
  waived: "badge-neutral",
};

const STATUS_LABELS: Record<string, string> = {
  not_due: "Not due",
  upcoming: "Upcoming",
  draft_submitted: "Draft submitted",
  submitted: "Submitted",
  impact_review: "Impact review",
  returned: "Returned",
  impact_approved: "Impact approved",
  cde_review: "CDE review",
  cde_approved: "CDE approved",
  amis_ready: "AMIS ready",
  exported_filed: "Filed",
  closed: "Closed",
  waived: "Waived",
};

export default function StatusBadge({ status, isOverdue }: { status: string; isOverdue?: boolean }) {
  if (isOverdue) return <span className="badge badge-danger">Overdue</span>;
  return <span className={`badge ${STATUS_CLASSES[status] ?? "badge-neutral"}`}>{STATUS_LABELS[status] ?? status}</span>;
}

export function dealStatusBadgeClass(status: string): string {
  switch (status) {
    case "onboarding":
      return "badge-neutral";
    case "active":
      return "badge-success";
    case "exception":
      return "badge-danger";
    case "winding_down":
      return "badge-warning";
    case "closed":
    case "archived":
      return "badge-neutral";
    default:
      return "badge-neutral";
  }
}
