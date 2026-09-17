
import React, { useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { UserRole } from '../types';
import { LogOut, LayoutDashboard, PlusCircle, List, Settings as SettingsIcon, Package, BarChart3, UserCircle, Users, Tags, Building, RefreshCw, Truck, Briefcase } from 'lucide-react';
import { LOGO_URL } from '../constants';

interface LayoutProps {
  children: React.ReactNode;
  activeTab?: string;
  setActiveTab?: (tab: string) => void;
}

export const Layout: React.FC<LayoutProps> = ({ children, activeTab, setActiveTab }) => {
  const { currentUser, logout, isOnline, logoUrl, users, selectedCondoId, setSelectedCondoId, refreshData, loading, requests } = useApp();
  const isAdmin = currentUser?.role === UserRole.ADMIN;
  const displayLogo = logoUrl || LOGO_URL;

  // Calculate Unread Messages
  const unreadCount = useMemo(() => {
      if (!currentUser) return 0;
      let count = 0;
      requests.forEach(req => {
          if (req.messages) {
              const unread = req.messages.filter(m => !m.read_at && m.sender_id !== currentUser.id);
              // If Admin, count all unread from condos. If Condo, count unread from Admin.
              // The filter above handles "sender_id !== currentUser.id", so it counts messages SENT TO me.
              count += unread.length;
          }
      });
      return count;
  }, [requests, currentUser]);
  const condos = useMemo(() => {
    return users.filter(u => u.role === UserRole.CONDOMINIO && u.condominio_id);
  }, [users]);

  // Handle Navigation
  const handleNav = (tab: string) => {
    setActiveTab?.(tab);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleManualRefresh = async () => {
      await refreshData();
  };

  return (
    <div className="flex flex-col md:flex-row min-h-screen">
      
      {/* ================= DESKTOP SIDEBAR (Hidden on Mobile) ================= */}
      <aside className="hidden md:flex flex-col w-64 lg:w-72 bg-white border-r border-gray-200 fixed h-full z-30 transition-all shadow-sm">
        {/* Logo Area */}
        <div className="h-20 flex items-center justify-center border-b border-gray-100 px-6">
            <img src={displayLogo} alt="Logo" className="h-10 w-auto object-contain drop-shadow-sm" />
        </div>

        {/* Global Filter (Admin Only) */}
        {isAdmin && (
            <div className="px-4 py-4 bg-slate-50 border-b border-gray-100">
                <select 
                    className="w-full bg-white text-gray-800 border border-gray-300 rounded-lg text-xs font-semibold p-2 focus:ring-1 focus:ring-brand-500 outline-none shadow-sm"
                    value={selectedCondoId}
                    onChange={(e) => setSelectedCondoId(e.target.value)}
                >
                    <option value="all">🏢 Todos Condomínios</option>
                    {condos.map(c => (
                        <option key={c.condominio_id} value={c.condominio_id}>{c.nome}</option>
                    ))}
                </select>
            </div>
        )}

        {/* Navigation Items */}
        <nav className="flex-1 py-6 px-3 space-y-1 overflow-y-auto">
          {isAdmin ? (
            <>
              <NavItem icon={<LayoutDashboard />} label="Dashboard" active={activeTab === 'dashboard'} onClick={() => handleNav('dashboard')} />
              <NavItem 
                  icon={<List />} 
                  label="Solicitações" 
                  active={activeTab === 'inbox'} 
                  onClick={() => handleNav('inbox')} 
                  badge={unreadCount > 0 ? unreadCount : undefined}
              />
              <NavItem icon={<Briefcase />} label="CRM Cotações" active={activeTab === 'central-crm'} onClick={() => handleNav('central-crm')} />
              <NavItem icon={<Building />} label="Hub Clientes" active={activeTab === 'condos'} onClick={() => handleNav('condos')} />
              <NavItem icon={<Package />} label="Estoque" active={activeTab === 'inventory'} onClick={() => handleNav('inventory')} />
              <NavItem icon={<Truck />} label="Fornecedores" active={activeTab === 'suppliers'} onClick={() => handleNav('suppliers')} />
              <NavItem icon={<BarChart3 />} label="Relatórios" active={activeTab === 'reports'} onClick={() => handleNav('reports')} />
              <NavItem icon={<Tags />} label="Categorias" active={activeTab === 'categories'} onClick={() => handleNav('categories')} />
              <NavItem icon={<Users />} label="Usuários" active={activeTab === 'users'} onClick={() => handleNav('users')} />
              <div className="pt-4 border-t border-gray-100 mt-4">
                 <NavItem icon={<SettingsIcon />} label="Ajustes" active={activeTab === 'settings'} onClick={() => handleNav('settings')} />
              </div>
            </>
          ) : (
            <>
              <NavItem icon={<LayoutDashboard />} label="Painel" active={activeTab === 'dashboard'} onClick={() => handleNav('dashboard')} />
              <NavItem icon={<PlusCircle />} label="Nova Solicitação" active={activeTab === 'new'} onClick={() => handleNav('new')} />
              <NavItem icon={<Package />} label="Meu Estoque" active={activeTab === 'inventory'} onClick={() => handleNav('inventory')} />
            </>
          )}
        </nav>

        {/* Footer User Profile */}
        <div className="p-4 border-t border-gray-100 bg-slate-50">
          <div className="flex items-center gap-3 mb-3">
             <div className="h-9 w-9 rounded-full bg-brand-100 text-brand-600 flex items-center justify-center shadow-sm">
                <UserCircle size={20}/>
             </div>
             <div className="flex-1 min-w-0">
                <p className="font-bold text-sm text-gray-900 truncate">{currentUser?.nome}</p>
                <p className="text-xs text-gray-600 truncate">{isAdmin ? 'Administrador' : 'Gestor'}</p>
             </div>
             <button 
                onClick={handleManualRefresh} 
                className="p-1.5 text-gray-500 hover:text-brand-600 hover:bg-gray-100 rounded-full transition-colors"
                title="Atualizar Dados"
                disabled={loading}
             >
                 <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
             </button>
          </div>
          <button onClick={logout} className="w-full flex items-center justify-center gap-2 p-2 rounded-lg text-xs font-bold text-red-600 hover:bg-red-50 transition-colors">
             <LogOut size={14} /> Sair
          </button>
        </div>
      </aside>


      {/* ================= MOBILE HEADER (Fixed Top) ================= */}
      <header className="md:hidden fixed top-0 left-0 right-0 h-14 bg-white/95 backdrop-blur-md z-40 flex items-center justify-between px-4 pb-safe border-b border-gray-200 shadow-sm">
         <div className="flex items-center gap-3">
            <img src={displayLogo} alt="Logo" className="h-6 object-contain" />
         </div>
         <div className="flex items-center gap-3">
             {unreadCount > 0 && (
                 <div className="flex items-center justify-center bg-red-500 text-white text-[10px] font-bold w-5 h-5 rounded-full animate-pulse">
                     {unreadCount > 9 ? '9+' : unreadCount}
                 </div>
             )}
             <button 
                onClick={handleManualRefresh}
                className="p-2 text-brand-600 active:bg-brand-50 rounded-full"
                disabled={loading}
             >
                <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
             </button>
            <div className={`w-2 h-2 rounded-full ${isOnline ? 'bg-green-500' : 'bg-red-500'}`}></div>
         </div>
      </header>


      {/* ================= MAIN CONTENT ================= */}
      <main className="flex-1 md:ml-64 lg:ml-72 flex flex-col h-screen overflow-hidden bg-slate-50 relative">
        {/* Warning / Status Bar */}
        <div className="mt-14 md:mt-0 bg-brand-50 border-b border-brand-100 px-4 py-2 text-[11px] md:text-xs text-center text-brand-900 font-semibold flex justify-between items-center z-10">
           <span className="truncate flex-1 text-left">💡 Dica: Mantenha seus dados sempre atualizados.</span>
           {isAdmin && selectedCondoId !== 'all' && (
              <span className="bg-white px-2 py-0.5 rounded shadow-sm text-[10px] font-bold uppercase tracking-wider ml-2 border border-brand-100 text-brand-700">
                 {users.find(u => u.condominio_id === selectedCondoId)?.nome?.substring(0,12)}...
              </span>
           )}
        </div>
        
        <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 md:p-8 pb-24 md:pb-8 scroll-smooth">
          <div className="max-w-7xl mx-auto animate-fadeIn">
            {children}
          </div>
        </div>
      </main>


      {/* ================= MOBILE BOTTOM NAV (Fixed Bottom) ================= */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 h-[80px] bg-white border-t border-gray-200 z-50 flex justify-around items-start pt-3 pb-safe shadow-[0_-4px_20px_rgba(0,0,0,0.03)]">
         {isAdmin ? (
            <>
                <BottomNavItem icon={<LayoutDashboard />} label="Painel" active={activeTab === 'dashboard'} onClick={() => handleNav('dashboard')} />
                <BottomNavItem icon={<List />} label="Inbox" active={activeTab === 'inbox'} onClick={() => handleNav('inbox')} />
                <BottomNavItem icon={<Briefcase />} label="CRM" active={activeTab === 'central-crm'} onClick={() => handleNav('central-crm')} />
                <BottomNavItem icon={<Package />} label="Estoque" active={activeTab === 'inventory'} onClick={() => handleNav('inventory')} />
                <BottomNavItem icon={<Truck />} label="Forn." active={activeTab === 'suppliers'} onClick={() => handleNav('suppliers')} />
                <div className="relative group">
                     <button onClick={logout} className="flex flex-col items-center justify-center w-full px-2 text-red-500 hover:bg-red-50 rounded-lg">
                        <LogOut size={22} strokeWidth={2} />
                        <span className="text-[10px] font-medium mt-1">Sair</span>
                     </button>
                </div>
            </>
         ) : (
            <>
                <div className="flex-1 flex justify-center">
                  <BottomNavItem icon={<LayoutDashboard />} label="Painel" active={activeTab === 'dashboard'} onClick={() => handleNav('dashboard')} />
                </div>
                <div className="flex-1 flex justify-center">
                  <BottomNavItem icon={<Package />} label="Estoque" active={activeTab === 'inventory'} onClick={() => handleNav('inventory')} />
                </div>
                <div className="-mt-6 flex-1 flex justify-center">
                    <button 
                        onClick={() => handleNav('new')}
                        className="bg-brand-600 text-white p-4 rounded-full shadow-lg shadow-brand-500/40 active:scale-90 transition-transform"
                    >
                        <PlusCircle size={28} />
                    </button>
                </div>
                <div className="flex-1 flex justify-center">
                  <button onClick={logout} className="flex flex-col items-center justify-center w-full px-1 text-red-500">
                      <LogOut size={24} className="mb-1" />
                      <span className="text-[10px] font-bold tracking-tight">Sair</span>
                  </button>
                </div>
            </>
         )}
      </nav>

    </div>
  );
};

const NavItem = ({ icon, label, active, onClick, badge }: { icon: React.ReactNode, label: string, active?: boolean, onClick?: () => void, badge?: number }) => (
  <button 
    onClick={onClick}
    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group font-bold text-sm relative ${
      active 
        ? 'nav-item-active shadow-sm text-brand-700' 
        : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
    }`}
  >
    {React.cloneElement(icon as React.ReactElement<any>, { size: 18, strokeWidth: active ? 2.5 : 2 })}
    <span className="truncate flex-1 text-left">{label}</span>
    {badge && badge > 0 && (
        <span className="bg-red-500 text-white text-[10px] font-extrabold px-2 py-0.5 rounded-full shadow-sm animate-pulse">
            {badge > 99 ? '99+' : badge}
        </span>
    )}
  </button>
);

const BottomNavItem = ({ icon, label, active, onClick }: { icon: React.ReactNode, label: string, active?: boolean, onClick?: () => void }) => (
    <button 
      onClick={onClick}
      className={`flex flex-col items-center justify-center w-full px-1 transition-all active:scale-95 ${
        active ? 'text-brand-600' : 'text-gray-400'
      }`}
    >
        <div className={`mb-1 transition-all duration-300 ${active ? '-translate-y-1' : ''}`}>
             {React.cloneElement(icon as React.ReactElement<any>, { size: 24, strokeWidth: active ? 2.5 : 2, fill: active ? 'currentColor' : 'none', className: active ? 'opacity-20' : '' })}
             {active && <div className="absolute inset-0 flex items-center justify-center">{React.cloneElement(icon as React.ReactElement<any>, { size: 24, strokeWidth: 2.5, fill: 'none' })}</div>}
        </div>
        <span className="text-[10px] font-bold tracking-tight">{label}</span>
    </button>
);
