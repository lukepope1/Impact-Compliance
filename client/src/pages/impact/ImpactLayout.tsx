import PortalLayout, { type NavItem } from "../shared/PortalLayout";

const NAV_ITEMS: NavItem[] = [
  { to: "/impact/deals", label: "Portfolio", end: true },
  { to: "/impact/review-queue", label: "Review Queue" },
  { to: "/impact/amis", label: "AMIS" },
  { to: "/impact/issues", label: "Issues" },
  { to: "/impact/documents", label: "Documents" },
  { to: "/impact/audit", label: "Audit Log" },
];

export default function ImpactLayout() {
  return <PortalLayout portal="impact" label="Impact Marketplace" navItems={NAV_ITEMS} />;
}
