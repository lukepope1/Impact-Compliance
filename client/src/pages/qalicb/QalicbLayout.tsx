import PortalLayout, { type NavItem } from "../shared/PortalLayout";

const NAV_ITEMS: NavItem[] = [
  { to: "/qalicb", label: "Dashboard", end: true },
  { to: "/qalicb/tasks", label: "Compliance Tasks" },
  { to: "/qalicb/benefits", label: "Community Benefits" },
  { to: "/qalicb/documents", label: "Documents" },
  { to: "/qalicb/messages", label: "Messages" },
];

export default function QalicbLayout() {
  return <PortalLayout portal="qalicb" label="QALICB Portal" navItems={NAV_ITEMS} />;
}
