import React, { useState } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import Topbar from './components/Topbar';
import Dashboard from './pages/Dashboard';
import Transactions from './pages/Transactions';
import CreateTransaction from './pages/CreateTransaction';
import TransactionDetails from './pages/TransactionDetails';
import TransactionAttempts from './pages/TransactionAttempts';
import Audit from './pages/Audit';
import Reports from './pages/Reports';
import Health from './pages/Health';
import Metrics from './pages/Metrics';
import Settings from './pages/Settings';
import NotFound from './pages/NotFound';

export default function App() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const toggleSidebar = () => {
    setSidebarOpen((prev) => !prev);
  };

  const closeSidebar = () => {
    setSidebarOpen(false);
  };

  const handleRefresh = () => {
    setRefreshTrigger((prev) => prev + 1);
  };

  return (
    <BrowserRouter>
      <div className="app-layout">
        {/* Persistent Sidebar */}
        <Sidebar isOpen={sidebarOpen} onClose={closeSidebar} />

        {/* Main Content Viewport */}
        <div className="main-wrapper">
          <Topbar onToggleSidebar={toggleSidebar} onRefresh={handleRefresh} />

          <main key={refreshTrigger}>
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/transactions" element={<Transactions />} />
              <Route path="/transactions/new" element={<CreateTransaction />} />
              <Route path="/transactions/:id" element={<TransactionDetails />} />
              <Route path="/transactions/:id/attempts" element={<TransactionAttempts />} />
              <Route path="/audit" element={<Audit />} />
              <Route path="/reports" element={<Reports />} />
              <Route path="/health" element={<Health />} />
              <Route path="/metrics" element={<Metrics />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </main>
        </div>
      </div>
    </BrowserRouter>
  );
}
