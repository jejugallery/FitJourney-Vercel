import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
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
import './index.css';

function App() {
  return (
    <LiffProvider>
      <Router>
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
        </Routes>
      </Router>
    </LiffProvider>
  );
}

export default App;
