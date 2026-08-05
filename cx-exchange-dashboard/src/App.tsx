import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Layout } from './components/layout/Layout';
import { OverviewDashboard } from './pages/OverviewDashboard';
import { JasaMallExchange } from './pages/JasaMallExchange';
import { OebuMallExchange } from './pages/OebuMallExchange';
import { DefectiveAnalysis } from './pages/DefectiveAnalysis';
import { LeadTime } from './pages/LeadTime';
import { StuckCases } from './pages/StuckCases';
import { ExchangePerformance } from './pages/ExchangePerformance';
import { LowStockAlerts } from './pages/LowStockAlerts';
import { ProductDetail } from './pages/ProductDetail';
import { ReportCenter } from './pages/ReportCenter';
import { PantosOps } from './pages/PantosOps';
import { ReturnizeUpload } from './pages/ReturnizeUpload';
import { Landing } from './pages/Landing';
import { SalesView } from './pages/SalesView';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        {/* 세일즈팀 전용 화면 — CX 운영 사이드바(Layout) 없이 독립 렌더 */}
        <Route path="sales" element={<SalesView />} />
        <Route element={<Layout />}>
          <Route path="dashboard" element={<OverviewDashboard />} />
          <Route path="jasa-exchange" element={<JasaMallExchange />} />
          <Route path="oebu-exchange" element={<OebuMallExchange />} />
          <Route path="defective-analysis" element={<DefectiveAnalysis />} />
          <Route path="lead-time" element={<LeadTime />} />
          <Route path="stuck-cases" element={<StuckCases />} />
          <Route path="exchange-performance" element={<ExchangePerformance />} />
          <Route path="low-stock-alerts" element={<LowStockAlerts />} />
          <Route path="product-detail" element={<ProductDetail />} />
          <Route path="report-center" element={<ReportCenter />} />
          <Route path="pantos" element={<PantosOps />} />
          <Route path="returnize-upload" element={<ReturnizeUpload />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
