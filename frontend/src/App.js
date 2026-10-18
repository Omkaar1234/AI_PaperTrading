import React from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './auth/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { ProtectedRoute, PublicOnlyRoute } from './auth/ProtectedRoute';
import AppLayout from './layouts/AppLayout';
import DashboardPage from './pages/DashboardPage';
import GoogleSetupPage from './pages/GoogleSetupPage';
import LoginPage from './pages/LoginPage';
import MarketPage from './pages/MarketPage';
import OrderBookPage from './pages/OrderBookPage';
import OrdersPage from './pages/OrdersPage';
import PositionsPage from './pages/PositionsPage';
import PredictPage from './pages/PredictPage';
import DisciplinePage from './pages/DisciplinePage';
import RegisterPage from './pages/RegisterPage';
import TradePage from './pages/TradePage';
import { useTradingData } from './hooks/useTradingData';
import './App.css';

function AppRoutes() {
  const auth = useAuth();
  const trading = useTradingData(auth.user);

  return (
    <Routes>
      <Route element={<PublicOnlyRoute />}>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
      </Route>

      <Route path="/google-setup" element={<GoogleSetupPage />} />

      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout trading={trading} auth={auth} />}>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<DashboardPage trading={trading} />} />
          <Route path="/market" element={<MarketPage trading={trading} />} />
          <Route path="/markets" element={<Navigate to="/market" replace />} />
          <Route path="/trade" element={<TradePage trading={trading} />} />
          <Route path="/orderbook" element={<OrderBookPage trading={trading} />} />
          <Route path="/orders" element={<OrdersPage trading={trading} />} />
          <Route path="/positions" element={<PositionsPage trading={trading} />} />
          <Route path="/portfolio" element={<Navigate to="/positions" replace />} />
          <Route path="/prediction" element={<PredictPage trading={trading} />} />
          <Route path="/ai-analysis" element={<Navigate to="/prediction" replace />} />
          <Route path="/discipline" element={<DisciplinePage trading={trading} />} />
          <Route path="/habits" element={<Navigate to="/discipline" replace />} />
          <Route path="/learning" element={<Navigate to="/discipline" replace />} />
          <Route path="/gamification" element={<Navigate to="/discipline" replace />} />
          <Route path="/academy" element={<Navigate to="/discipline" replace />} />
          <Route path="/settings" element={<Navigate to="/dashboard" replace />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
