import { Route, Routes, Navigate } from "react-router-dom";
import ImpactLayout from "./pages/impact/ImpactLayout";
import DealList from "./pages/DealList";
import DealDetail from "./pages/DealDetail";
import DealSetup from "./pages/DealSetup";
import RequirementBuilder from "./pages/RequirementBuilder";
import Documents from "./pages/Documents";
import AuditLog from "./pages/AuditLog";
import Deadlines from "./pages/Deadlines";
import NewDeal from "./pages/NewDeal";
import QalicbLayout from "./pages/qalicb/QalicbLayout";
import QalicbDashboard from "./pages/qalicb/QalicbDashboard";
import RequirementWorkspace from "./pages/qalicb/RequirementWorkspace";

export default function App() {
  return (
    <>
      <header className="app-header">Impact Marketplace | NMTC Compliance</header>
      <Routes>
        <Route path="/" element={<Navigate to="/impact/deals" replace />} />

        <Route path="/impact" element={<ImpactLayout />}>
          <Route path="deals" element={<DealList />} />
          <Route path="deals/new" element={<NewDeal />} />
          <Route path="deals/:dealId" element={<DealDetail />} />
          <Route path="deals/:dealId/setup" element={<DealSetup />} />
          <Route path="deals/:dealId/requirements" element={<RequirementBuilder />} />
          <Route path="deals/:dealId/deadlines" element={<Deadlines />} />
          <Route path="deals/:dealId/documents" element={<Documents />} />
          <Route path="deals/:dealId/audit" element={<AuditLog />} />
        </Route>

        <Route path="/qalicb" element={<QalicbLayout />}>
          <Route index element={<QalicbDashboard />} />
          <Route path="deals/:dealId/requirements/:instanceId" element={<RequirementWorkspace />} />
        </Route>
      </Routes>
    </>
  );
}
