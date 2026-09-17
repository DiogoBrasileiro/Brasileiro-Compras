
import React, { useState } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { Login } from './pages/Login';
import { Layout } from './components/Layout';
import { UserRole } from './types';

// Pages
import { AdminDashboard } from './pages/admin/AdminDashboard';
import { CondoDashboard } from './pages/condo/CondoDashboard';
import { NewRequest } from './pages/condo/NewRequest';
import { DetailView } from './pages/DetailView';
import { UserManagement } from './pages/admin/UserManagement';
import { Inbox } from './pages/admin/Inbox';
import { Inventory as AdminInventory } from './pages/admin/Inventory'; // NEW Updated
import { CondoInventory } from './pages/condo/CondoInventory'; // NEW
import { Reports } from './pages/admin/Reports';
import { Settings } from './pages/admin/Settings';
import { Categories } from './pages/admin/Categories';
import { CondoHub } from './pages/admin/CondoHub';
import { Suppliers } from './pages/admin/Suppliers';
import { CentralCRM } from './pages/admin/CentralCRM';

const Main: React.FC = () => {
  const { currentUser, selectedCondoId, loading, login, users } = useApp();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [detailId, setDetailId] = useState<string | null>(null);
  const [detailTab, setDetailTab] = useState<'details' | 'chat'>('details');

  if (loading && !currentUser) {
    return (
      <div className="min-h-screen w-full flex flex-col items-center justify-center bg-slate-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-600 mb-4"></div>
        <p className="text-slate-600 font-medium">Carregando portal...</p>
      </div>
    );
  }

  if (!currentUser) return <Login />;

  const isAdmin = currentUser.role === UserRole.ADMIN;

  const handleViewDetail = (id: string, tab: 'details' | 'chat' = 'details') => {
    setDetailId(id);
    setDetailTab(tab);
  };

  const handleBack = () => {
    setDetailId(null);
    setDetailTab('details');
  };

  // Content Router
  const renderContent = () => {
    if (detailId) return <DetailView requestId={detailId} onBack={handleBack} initialTab={detailTab} />;
    
    if (isAdmin) {
      switch (activeTab) {
        case 'dashboard': return <AdminDashboard onViewDetail={handleViewDetail} />;
        case 'central-crm': return <CentralCRM onViewDetail={handleViewDetail} />;
        case 'inbox': return <Inbox onViewDetail={handleViewDetail} />;
        case 'suppliers': return <Suppliers />; 
        case 'inventory': return <AdminInventory />; // Admin Global Inventory
        case 'reports': return <Reports />;
        case 'users': return <UserManagement />;
        case 'categories': return <Categories />;
        case 'settings': return <Settings />;
        case 'condos': 
             return <CondoHub condoId={selectedCondoId !== 'all' ? selectedCondoId : undefined} onViewRequest={handleViewDetail} />;
        default: return <AdminDashboard onViewDetail={handleViewDetail} />;
      }
    } else {
      switch (activeTab) {
        case 'dashboard': return <CondoDashboard onViewDetail={handleViewDetail} />;
        case 'new': return <NewRequest onSuccess={() => setActiveTab('dashboard')} />;
        case 'inventory': return <CondoInventory />; // Client Inventory
        default: return <CondoDashboard onViewDetail={handleViewDetail} />;
      }
    }
  };

  return (
    <div className="relative min-h-screen">
      <Layout activeTab={activeTab} setActiveTab={(tab) => { setActiveTab(tab); setDetailId(null); }}>
        {renderContent()}
      </Layout>
    </div>
  );
};

const App: React.FC = () => {
  return (
    <AppProvider>
      <Main />
    </AppProvider>
  );
};

export default App;
