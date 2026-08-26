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
import CdeLayout from "./pages/cde/CdeLayout";
import CdePortfolio from "./pages/cde/CdePortfolio";
import ReviewQueue from "./pages/shared/ReviewQueue";
import ReviewDetail from "./pages/shared/ReviewDetail";
import Issues from "./pages/shared/Issues";
import CommunityBenefits from "./pages/shared/CommunityBenefits";
import MultiCdeSnapshot from "./pages/shared/MultiCdeSnapshot";
import AmisCenter from "./pages/shared/AmisCenter";

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
          <Route path="deals/:dealId/issues" element={<Issues />} />
          <Route path="deals/:dealId/cbr" element={<CommunityBenefits />} />
          <Route path="deals/:dealId/snapshot" element={<MultiCdeSnapshot portal="impact" />} />
          <Route path="deals/:dealId/amis" element={<AmisCenter />} />
          <Route
            path="deals/:dealId/review-queue"
            element={<ReviewQueue stage="impact" portal="impact" title="I-01 — Impact Review Queue" />}
          />
          <Route
            path="deals/:dealId/review/:instanceId"
            element={<ReviewDetail stage="impact" portal="impact" />}
          />
        </Route>

        <Route path="/qalicb" element={<QalicbLayout />}>
          <Route index element={<QalicbDashboard />} />
          <Route path="deals/:dealId/requirements/:instanceId" element={<RequirementWorkspace />} />
          <Route path="deals/:dealId/cbr" element={<CommunityBenefits />} />
        </Route>

        <Route path="/cde" element={<CdeLayout />}>
          <Route index element={<CdePortfolio />} />
          <Route path="deals/:dealId/documents" element={<Documents />} />
          <Route path="deals/:dealId/issues" element={<Issues />} />
          <Route path="deals/:dealId/snapshot" element={<MultiCdeSnapshot portal="cde" />} />
          <Route path="deals/:dealId/amis" element={<AmisCenter />} />
          <Route
            path="deals/:dealId/review-queue"
            element={<ReviewQueue stage="cde" portal="cde" title="C-03 — CDE Review Queue" />}
          />
          <Route
            path="deals/:dealId/review/:instanceId"
            element={<ReviewDetail stage="cde" portal="cde" />}
          />
        </Route>
      </Routes>
    </>
  );
}
