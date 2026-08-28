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
import QalicbComplianceTasks from "./pages/qalicb/QalicbComplianceTasks";
import RequirementWorkspace from "./pages/qalicb/RequirementWorkspace";
import CdeLayout from "./pages/cde/CdeLayout";
import CdePortfolio from "./pages/cde/CdePortfolio";
import CdeDealOverview from "./pages/cde/CdeDealOverview";
import ImpactAuditAll from "./pages/impact/ImpactAuditAll";
import QalicbCbrRedirect from "./pages/qalicb/QalicbCbrRedirect";
import QalicbCommunityBenefitsOverview from "./pages/qalicb/QalicbCommunityBenefitsOverview";
import MessagesAll from "./pages/shared/MessagesAll";
import ReviewQueueAll from "./pages/shared/ReviewQueueAll";
import IssuesAll from "./pages/shared/IssuesAll";
import DocumentsAll from "./pages/shared/DocumentsAll";
import AmisAll from "./pages/shared/AmisAll";
import DealsListAll from "./pages/shared/DealsListAll";
import ReviewQueue from "./pages/shared/ReviewQueue";
import ReviewDetail from "./pages/shared/ReviewDetail";
import Issues from "./pages/shared/Issues";
import CommunityBenefits from "./pages/shared/CommunityBenefits";
import MultiCdeSnapshot from "./pages/shared/MultiCdeSnapshot";
import AmisCenter from "./pages/shared/AmisCenter";
import TlrEditor from "./pages/shared/TlrEditor";
import NotificationPreferences from "./pages/shared/NotificationPreferences";
import Login from "./auth/Login";

export default function App() {
  return (
    <>
      <header className="app-header">
        <img className="app-logo" src="/brand/logo-reversed.svg" alt="Impact Marketplace" />
        <span className="app-header-divider" aria-hidden="true" />
        <span className="app-header-product">NMTC Compliance</span>
      </header>
      <Routes>
        <Route path="/" element={<Navigate to="/impact/deals" replace />} />
        <Route path="/login" element={<Login />} />
        <Route path="/notifications/preferences" element={<NotificationPreferences />} />

        <Route path="/impact" element={<ImpactLayout />}>
          <Route path="deals" element={<DealList />} />
          <Route path="deals/new" element={<NewDeal />} />
          <Route path="review-queue" element={<ReviewQueueAll portal="impact" stage="impact" />} />
          <Route path="amis" element={<AmisAll portal="impact" />} />
          <Route path="issues" element={<IssuesAll portal="impact" />} />
          <Route path="documents" element={<DocumentsAll portal="impact" />} />
          <Route path="messages" element={<MessagesAll portal="impact" />} />
          <Route path="audit" element={<ImpactAuditAll />} />
          <Route path="deals/:dealId" element={<DealDetail />} />
          <Route path="deals/:dealId/setup" element={<DealSetup />} />
          <Route path="deals/:dealId/requirements" element={<RequirementBuilder />} />
          <Route path="deals/:dealId/deadlines" element={<Deadlines />} />
          <Route path="deals/:dealId/documents" element={<Documents />} />
          <Route path="deals/:dealId/audit" element={<AuditLog />} />
          <Route path="deals/:dealId/issues" element={<Issues />} />
          <Route path="deals/:dealId/cbr" element={<CommunityBenefits />} />
          <Route path="deals/:dealId/snapshot" element={<MultiCdeSnapshot portal="impact" />} />
          <Route path="deals/:dealId/amis" element={<AmisCenter portal="impact" />} />
          <Route path="deals/:dealId/tlr" element={<TlrEditor portal="impact" />} />
          <Route
            path="deals/:dealId/review-queue"
            element={<ReviewQueue stage="impact" portal="impact" title="Impact Review Queue" />}
          />
          <Route
            path="deals/:dealId/review/:instanceId"
            element={<ReviewDetail stage="impact" portal="impact" />}
          />
        </Route>

        <Route path="/qalicb" element={<QalicbLayout />}>
          <Route index element={<QalicbDashboard />} />
          <Route path="tasks" element={<QalicbComplianceTasks />} />
          <Route path="benefits" element={<QalicbCommunityBenefitsOverview />} />
          <Route path="cbr" element={<QalicbCbrRedirect />} />
          <Route path="documents" element={<DocumentsAll portal="qalicb" />} />
          <Route path="messages" element={<MessagesAll portal="qalicb" />} />
          <Route path="deals/:dealId/requirements/:instanceId" element={<RequirementWorkspace />} />
          <Route path="deals/:dealId/cbr" element={<CommunityBenefits />} />
          <Route path="deals/:dealId/documents" element={<Documents />} />
        </Route>

        <Route path="/cde" element={<CdeLayout />}>
          <Route index element={<CdePortfolio />} />
          <Route path="deals" element={<DealsListAll portal="cde" rowLinkSuffix="" />} />
          <Route path="review-queue" element={<ReviewQueueAll portal="cde" stage="cde" />} />
          <Route path="issues" element={<IssuesAll portal="cde" />} />
          <Route path="documents" element={<DocumentsAll portal="cde" />} />
          <Route path="messages" element={<MessagesAll portal="cde" />} />
          <Route path="amis" element={<AmisAll portal="cde" />} />
          <Route path="deals/:dealId" element={<CdeDealOverview />} />
          <Route path="deals/:dealId/documents" element={<Documents />} />
          <Route path="deals/:dealId/issues" element={<Issues />} />
          <Route path="deals/:dealId/cbr" element={<CommunityBenefits />} />
          <Route path="deals/:dealId/snapshot" element={<MultiCdeSnapshot portal="cde" />} />
          <Route path="deals/:dealId/amis" element={<AmisCenter portal="cde" />} />
          <Route path="deals/:dealId/tlr" element={<TlrEditor portal="cde" />} />
          <Route
            path="deals/:dealId/review-queue"
            element={<ReviewQueue stage="cde" portal="cde" title="CDE Review Queue" />}
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
