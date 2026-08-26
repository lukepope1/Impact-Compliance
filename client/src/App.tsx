import { Route, Routes, Navigate } from "react-router-dom";
import DealList from "./pages/DealList";
import DealDetail from "./pages/DealDetail";
import DealSetup from "./pages/DealSetup";
import RequirementBuilder from "./pages/RequirementBuilder";
import Documents from "./pages/Documents";
import AuditLog from "./pages/AuditLog";
import NewDeal from "./pages/NewDeal";

export default function App() {
  return (
    <>
      <header className="app-header">Impact Marketplace | NMTC Compliance</header>
      <Routes>
        <Route path="/" element={<Navigate to="/impact/deals" replace />} />
        <Route path="/impact/deals" element={<DealList />} />
        <Route path="/impact/deals/new" element={<NewDeal />} />
        <Route path="/impact/deals/:dealId" element={<DealDetail />} />
        <Route path="/impact/deals/:dealId/setup" element={<DealSetup />} />
        <Route path="/impact/deals/:dealId/requirements" element={<RequirementBuilder />} />
        <Route path="/impact/deals/:dealId/documents" element={<Documents />} />
        <Route path="/impact/deals/:dealId/audit" element={<AuditLog />} />
      </Routes>
    </>
  );
}
