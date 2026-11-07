import { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { LiffProvider } from './context/LiffContext';
import Home from './pages/Home';
import RegisterAdmin from './pages/RegisterAdmin';
import RegisterTrainee from './pages/RegisterTrainee';
import NutritionCalculator from './pages/NutritionCalculator';
import FoodHistoryPage from './pages/FoodHistoryPage';
import ShareKnowledgePage from './pages/ShareKnowledgePage';
import ShareNotePage from './pages/ShareNotePage';
import ShareEventPage from './pages/ShareEventPage';
import PaymentPage from './pages/PaymentPage';
import DownloadICSPage from './pages/DownloadICSPage';
import BodyMetricsAnalysisPage from './pages/BodyMetricsAnalysisPage';
import SupplementCoursePdfPage from './pages/SupplementCoursePdfPage';
import SupplementCourseDashboardPage from './pages/SupplementCourseDashboardPage';
import SpyGamePage from './pages/SpyGamePage';
import './index.css';

function LiffRedirectHandler() {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const liffState = searchParams.get('liff.state');
    if (liffState) {
      try {
        const decoded = decodeURIComponent(liffState);
        if (decoded.includes('spy-game')) {
          try {
            sessionStorage.setItem('is_spy_game', '1');
          } catch {}
          return;
        }
        if (decoded.startsWith('/') && location.pathname !== decoded) {
          navigate(decoded, { replace: true });
        }
      } catch (err) {
        console.warn('Error parsing liff.state:', err);
      }
    }
  }, [navigate, location.pathname]);

  return null;
}

function AuthenticatedRoutes() {
  return (
    <LiffProvider>
      <LiffRedirectHandler />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/record-metrics" element={<Home isRecordOnly={true} />} />
        <Route path="/review-food/:reviewTraineeId" element={<Home />} />
        <Route path="/register-admin" element={<RegisterAdmin />} />
        <Route path="/register-trainee" element={<RegisterTrainee />} />
        <Route path="/calculator/:targetId" element={<NutritionCalculator />} />
        <Route path="/food-history/:targetId" element={<FoodHistoryPage />} />
        <Route path="/shareKnowledge" element={<ShareKnowledgePage />} />
        <Route path="/shareLink" element={<ShareNotePage />} />
        <Route path="/shareEvent" element={<ShareEventPage />} />
        <Route path="/payment/:billingId" element={<PaymentPage />} />
        <Route path="/download-ics" element={<DownloadICSPage />} />
        <Route path="/body-analysis/:traineeId" element={<BodyMetricsAnalysisPage />} />
        <Route path="/spy-game" element={<SpyGamePage />} />
        <Route path="/spy-game/:roomId" element={<SpyGamePage />} />
      </Routes>
    </LiffProvider>
  );
}

function App() {
  return <Router><Routes>
    <Route path="/supplement-course-pdf" element={<SupplementCoursePdfPage />} />
    <Route path="/supplement-course-dashboard" element={<SupplementCourseDashboardPage />} />
    <Route path="*" element={<AuthenticatedRoutes />} />
  </Routes></Router>;
}

export default App;
