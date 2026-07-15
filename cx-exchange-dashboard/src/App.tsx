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

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<OverviewDashboard />} />
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
