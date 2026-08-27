import PortalLayout, { type NavItem } from "../shared/PortalLayout";

const NAV_ITEMS: NavItem[] = [
  { to: "/cde", label: "Portfolio", end: true },
  { to: "/cde/review-queue", label: "Review Queue" },
  { to: "/cde/deals", label: "Deals" },
  { to: "/cde/amis", label: "AMIS" },
  { to: "/cde/issues", label: "Issues" },
  { to: "/cde/documents", label: "Documents" },
];

export default function CdeLayout() {
  return <PortalLayout portal="cde" label="CDE Portal" navItems={NAV_ITEMS} />;
}
