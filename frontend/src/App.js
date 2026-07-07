import React from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import AppLayout from './layouts/AppLayout';
import DashboardPage from './pages/DashboardPage';
import MarketPage from './pages/MarketPage';
import OrderBookPage from './pages/OrderBookPage';
import OrdersPage from './pages/OrdersPage';
import PositionsPage from './pages/PositionsPage';
import PredictPage from './pages/PredictPage';
import TradePage from './pages/TradePage';
import { useTradingData } from './hooks/useTradingData';
import './App.css';

function App() {
  const trading = useTradingData();

  return (
    <Routes>
      <Route element={<AppLayout trading={trading} />}>
        <Route path="/" element={<Navigate to="/trade" replace />} />
        <Route path="/dashboard" element={<DashboardPage trading={trading} />} />
        <Route path="/market" element={<MarketPage trading={trading} />} />
        <Route path="/trade" element={<TradePage trading={trading} />} />
        <Route path="/orderbook" element={<OrderBookPage trading={trading} />} />
        <Route path="/orders" element={<OrdersPage trading={trading} />} />
        <Route path="/positions" element={<PositionsPage trading={trading} />} />
        <Route path="/prediction" element={<PredictPage trading={trading} />} />
      </Route>
    </Routes>
  );
}

export default App;
