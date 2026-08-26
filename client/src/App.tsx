import { Route, Routes, Navigate } from "react-router-dom";
import DealList from "./pages/DealList";
import DealDetail from "./pages/DealDetail";

export default function App() {
  return (
    <>
      <header className="app-header">Impact Marketplace | NMTC Compliance</header>
      <Routes>
        <Route path="/" element={<Navigate to="/impact/deals" replace />} />
        <Route path="/impact/deals" element={<DealList />} />
        <Route path="/impact/deals/:dealId" element={<DealDetail />} />
      </Routes>
    </>
  );
}
