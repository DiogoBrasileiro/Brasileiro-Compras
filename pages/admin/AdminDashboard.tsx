
import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { RequestStatus, RequestLevel } from '../../types';
import { Badge, Card, Button } from '../../components/UI';
import { Package, Clock, AlertTriangle, ArrowRight, RefreshCw, Hand, ShoppingCart, Building, MessageSquare, LayoutGrid, List } from 'lucide-react';
import { KanbanBoard } from '../../components/KanbanBoard';

export const AdminDashboard: React.FC<{ onViewDetail: (id: string, tab?: 'details' | 'chat') => void }> = ({ onViewDetail }) => {
  const { getRequestsAll, refreshData, loading, currentUser } = useApp();
  const allRequests = getRequestsAll();
  const [viewMode, setViewMode] = useState<'list' | 'kanban'>('list');

  // Unread Messages Logic
  const unreadRequests = allRequests.filter(req => 
      req.messages?.some(m => !m.read_at && m.sender_id !== currentUser?.id)
  );

  // KPIs
  const total = allRequests.length;
  const urgent = allRequests.filter(r => r.nivel === RequestLevel.N1).length;
  
  // 1. NOVO (New)
  const pending = allRequests.filter(r => r.status === RequestStatus.NOVO).length;

  // 4. AGUARDANDO_ACAO_CONDOMINIO (Waiting for Receive) or 5. EM_ANALISE (Waiting Decision)
  const waitingClient = allRequests.filter(r => 
      r.status === RequestStatus.AGUARDANDO_ACAO_CONDOMINIO || 
      r.status === RequestStatus.EM_ANALISE_CONDOMINIO
  ).length;
  
  // 6. APROVADO (Ready to Buy)
  const readyToBuy = allRequests.filter(r => r.status === RequestStatus.APROVADO).length;

  const recentRequests = [...allRequests].sort((a,b) => new Date(b.data_solicitacao).getTime() - new Date(a.data_solicitacao).getTime()).slice(0, 5);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard Administrativo</h1>
          <p className="text-sm text-gray-500">Visão geral da operação de compras.</p>
        </div>
        <Button onClick={() => refreshData()} variant="outline" className="hidden md:flex bg-white" disabled={loading}>
            <RefreshCw size={18} className={`mr-2 ${loading ? 'animate-spin' : ''}`} /> Atualizar Dados
        </Button>
      </div>

      {/* UNREAD MESSAGES ALERT */}
      {unreadRequests.length > 0 && (
          <div className="bg-white border-l-4 border-brand-500 rounded-xl shadow-sm p-4 animate-fadeIn flex flex-col gap-3">
              <div className="flex items-center gap-2 text-brand-700 font-bold">
                  <MessageSquare size={20} className="animate-bounce"/>
                  <h3>Novas Mensagens ({unreadRequests.length})</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {unreadRequests.map(req => {
                      const unreadCount = req.messages?.filter(m => !m.read_at && m.sender_id !== currentUser?.id).length || 0;
                      const lastMsg = req.messages?.filter(m => !m.read_at && m.sender_id !== currentUser?.id).pop();
                      
                      return (
                          <div key={req.id} onClick={() => onViewDetail(req.id, 'chat')} className="bg-brand-50 hover:bg-brand-100 border border-brand-100 rounded-lg p-3 cursor-pointer transition-colors group">
                              <div className="flex justify-between items-start mb-1">
                                  <span className="text-[10px] font-bold uppercase text-brand-800 bg-white px-1.5 py-0.5 rounded border border-brand-200 truncate max-w-[120px]">{req.condominio_nome}</span>
                                  <span className="bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">{unreadCount}</span>
                              </div>
                              <p className="text-xs font-bold text-gray-900 truncate mb-0.5">{req.titulo}</p>
                              <p className="text-[11px] text-gray-600 truncate italic">"{lastMsg?.content}"</p>
                              <div className="mt-2 text-right">
                                  <span className="text-[10px] font-bold text-brand-600 group-hover:underline flex items-center justify-end gap-1">Responder <ArrowRight size={10}/></span>
                              </div>
                          </div>
                      );
                  })}
              </div>
          </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex items-center gap-3">
            <div className="p-3 bg-blue-100 text-blue-600 rounded-full"><Package size={20}/></div>
            <div>
                <p className="text-xs font-bold text-gray-500 uppercase">Total</p>
                <h3 className="text-2xl font-extrabold text-gray-900">{total}</h3>
            </div>
        </div>
        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex items-center gap-3">
            <div className="p-3 bg-yellow-100 text-yellow-600 rounded-full"><Clock size={20}/></div>
            <div>
                <p className="text-xs font-bold text-gray-500 uppercase">Novas (Entrada)</p>
                <h3 className="text-2xl font-extrabold text-gray-900">{pending}</h3>
            </div>
        </div>
        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex items-center gap-3">
            <div className="p-3 bg-purple-100 text-purple-600 rounded-full"><Hand size={20}/></div>
            <div>
                <p className="text-xs font-bold text-gray-500 uppercase">Aguardando Cliente</p>
                <h3 className="text-2xl font-extrabold text-gray-900">{waitingClient}</h3>
            </div>
        </div>
        <div className="bg-white p-5 rounded-xl border-l-4 border-l-green-500 border border-gray-200 shadow-sm flex items-center gap-3">
            <div className="p-3 bg-green-100 text-green-600 rounded-full"><ShoppingCart size={20}/></div>
            <div>
                <p className="text-xs font-bold text-gray-500 uppercase">Aprovados (Comprar)</p>
                <h3 className="text-2xl font-extrabold text-gray-900">{readyToBuy}</h3>
            </div>
        </div>
        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex items-center gap-3">
            <div className="p-3 bg-red-100 text-red-600 rounded-full"><AlertTriangle size={20}/></div>
            <div>
                <p className="text-xs font-bold text-gray-500 uppercase">Urgentes</p>
                <h3 className="text-2xl font-extrabold text-gray-900">{urgent}</h3>
            </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="flex justify-between items-center p-4 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-900">Últimas Solicitações</h2>
              <div className="flex bg-gray-100 p-1 rounded-lg">
                  <button 
                      onClick={() => setViewMode('list')} 
                      className={`p-1.5 rounded-md transition-colors ${viewMode === 'list' ? 'bg-white text-brand-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                      title="Visualização em Lista"
                  >
                      <List size={16} />
                  </button>
                  <button 
                      onClick={() => setViewMode('kanban')} 
                      className={`p-1.5 rounded-md transition-colors ${viewMode === 'kanban' ? 'bg-white text-brand-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                      title="Visualização Kanban"
                  >
                      <LayoutGrid size={16} />
                  </button>
              </div>
          </div>
          
          <div className="p-4">
              {viewMode === 'kanban' ? (
                  <KanbanBoard requests={allRequests} onViewDetail={onViewDetail} currentUser={currentUser} />
              ) : (
                  <div className="space-y-3">
                      {recentRequests.length === 0 ? (
                          <p className="text-gray-500 text-sm text-center py-4">Nenhuma solicitação encontrada.</p>
                      ) : (
                          recentRequests.map(req => {
                              const unreadCount = req.messages?.filter(m => !m.read_at && m.sender_id !== currentUser?.id).length || 0;
                              
                              return (
                              <div key={req.id} className="flex justify-between items-center p-4 hover:bg-gray-50 rounded-xl border border-gray-100 transition-all cursor-pointer shadow-sm hover:shadow-md group" onClick={() => onViewDetail(req.id)}>
                                  <div className="min-w-0 flex-1">
                                      {/* Condominium Header - Prominent */}
                                      <div className="flex items-center gap-3 mb-2">
                                          <div className="flex items-center gap-1.5 bg-blue-50 text-blue-800 px-2.5 py-1 rounded-md border border-blue-100">
                                              <Building size={14} className="flex-shrink-0" />
                                              <span className="text-xs font-bold uppercase tracking-wide truncate max-w-[150px] md:max-w-none">{req.condominio_nome}</span>
                                          </div>
                                          <span className="text-[10px] font-mono font-bold text-gray-400">{req.id}</span>
                                      </div>

                                      <div className="flex items-center gap-2 mb-1.5">
                                          <p className="text-sm font-extrabold text-gray-900 truncate">{req.titulo}</p>
                                          {unreadCount > 0 && (
                                              <div 
                                                onClick={(e) => { e.stopPropagation(); onViewDetail(req.id, 'chat'); }}
                                                className="flex items-center gap-1 bg-red-100 text-red-600 px-2 py-0.5 rounded-full border border-red-200 hover:bg-red-200 transition-colors"
                                                title={`${unreadCount} novas mensagens`}
                                              >
                                                  <MessageSquare size={12} className="fill-current" />
                                                  <span className="text-[10px] font-bold">{unreadCount}</span>
                                              </div>
                                          )}
                                      </div>
                                      
                                      <div className="flex items-center gap-3">
                                          <Badge status={req.status} className="scale-90 origin-left" />
                                          <span className="text-xs text-gray-400 font-medium">
                                              {new Date(req.data_solicitacao).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
                                          </span>
                                      </div>
                                  </div>
                                  
                                  <div className="pl-4">
                                     <div className="bg-gray-50 p-2 rounded-full text-gray-300 group-hover:bg-brand-50 group-hover:text-brand-600 transition-colors">
                                        <ArrowRight size={18}/>
                                     </div>
                                  </div>
                              </div>
                          )})
                      )}
                  </div>
              )}
          </div>
      </div>
    </div>
  );
};
