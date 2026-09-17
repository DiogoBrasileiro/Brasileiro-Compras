
import React, { useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { RequestStatus } from '../../types';
import { Card, Badge, Button, DeadlineDisplay } from '../../components/UI';
import { ArrowRight, RefreshCw, Building2, Paperclip, AlertOctagon, UserCheck, Truck, CalendarClock, MessageSquare } from 'lucide-react';

export const CondoDashboard: React.FC<{ onViewDetail: (id: string, tab?: 'details' | 'chat') => void }> = ({ onViewDetail }) => {
  const { currentUser, getRequestsByCondo, refreshData, loading } = useApp();
  const myRequests = getRequestsByCondo(currentUser?.condominio_id || '');

  // Unread Messages Logic
  const unreadRequests = myRequests.filter(req => 
      req.messages?.some(m => !m.read_at && m.sender_id !== currentUser?.id)
  );

  // 4, 5 & 8. Waiting for Condo Action (Receive, Approve, or Confirm Receipt)
  const pendingApproval = myRequests.filter(r => 
      r.status === RequestStatus.AGUARDANDO_ACAO_CONDOMINIO || 
      r.status === RequestStatus.EM_ANALISE_CONDOMINIO ||
      r.status === RequestStatus.AGUARDANDO_ENTREGA // Agora aparece aqui para confirmar recebimento
  );
  
  // Urgent items (Expiring approvals)
  const urgentApprovals = useMemo(() => {
      return myRequests.filter(r => 
        r.status === RequestStatus.EM_ANALISE_CONDOMINIO && 
        r.due_at
      ).sort((a,b) => new Date(a.due_at!).getTime() - new Date(b.due_at!).getTime());
  }, [myRequests]);

  // Incoming Deliveries (Scheduled)
  const incomingDeliveries = useMemo(() => {
      return myRequests.filter(r => 
          r.status === RequestStatus.AGUARDANDO_ENTREGA && 
          r.estimated_delivery_date
      ).sort((a,b) => new Date(a.estimated_delivery_date!).getTime() - new Date(b.estimated_delivery_date!).getTime());
  }, [myRequests]);

  // In Progress (1, 2, 3, 7)
  const inProgress = myRequests.filter(r => [
      RequestStatus.NOVO, 
      RequestStatus.EM_COTACAO, 
      RequestStatus.ORCAMENTOS_PRONTOS,
      RequestStatus.EM_PEDIDO
  ].includes(r.status));
  
  // Finished (9)
  const finished = myRequests.filter(r => r.status === RequestStatus.CONCLUIDO);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Building2 className="text-brand-600" />
            Painel do Condomínio
          </h1>
          <p className="text-sm text-gray-500">Acompanhe seus pedidos e orçamentos.</p>
        </div>
        <Button onClick={() => refreshData()} variant="outline" className="hidden md:flex bg-white" disabled={loading}>
            <RefreshCw size={18} className={`mr-2 ${loading ? 'animate-spin' : ''}`} /> Atualizar
        </Button>
      </div>

      {/* UNREAD MESSAGES ALERT */}
      {unreadRequests.length > 0 && (
          <div className="bg-white border-l-4 border-brand-500 rounded-xl shadow-sm p-4 animate-fadeIn flex flex-col gap-3">
              <div className="flex items-center gap-2 text-brand-700 font-bold">
                  <MessageSquare size={20} className="animate-bounce"/>
                  <h3>Mensagens do Administrador ({unreadRequests.length})</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {unreadRequests.map(req => {
                      const unreadCount = req.messages?.filter(m => !m.read_at && m.sender_id !== currentUser?.id).length || 0;
                      const lastMsg = req.messages?.filter(m => !m.read_at && m.sender_id !== currentUser?.id).pop();
                      
                      return (
                          <div key={req.id} onClick={() => onViewDetail(req.id, 'chat')} className="bg-brand-50 hover:bg-brand-100 border border-brand-100 rounded-lg p-3 cursor-pointer transition-colors group">
                              <div className="flex justify-between items-start mb-1">
                                  <span className="text-[10px] font-bold uppercase text-brand-800 bg-white px-1.5 py-0.5 rounded border border-brand-200 truncate max-w-[120px]">Admin</span>
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

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-yellow-50 p-4 rounded-xl border border-yellow-200 shadow-sm">
          <h3 className="text-yellow-800 font-bold text-lg">{pendingApproval.length}</h3>
          <p className="text-sm text-yellow-700 font-medium">Aguardando sua Ação</p>
        </div>
        <div className="bg-blue-50 p-4 rounded-xl border border-blue-200 shadow-sm">
          <h3 className="text-blue-800 font-bold text-lg">{inProgress.length}</h3>
          <p className="text-sm text-blue-700 font-medium">Em Andamento (Brasileiro)</p>
        </div>
        <div className="bg-green-50 p-4 rounded-xl border border-green-200 shadow-sm">
          <h3 className="text-green-800 font-bold text-lg">{finished.length}</h3>
          <p className="text-sm text-green-700 font-medium">Concluídas</p>
        </div>
      </div>

      {/* URGENT ALERTS SECTION */}
      {urgentApprovals.length > 0 && (
          <div className="bg-red-50 border-2 border-red-100 rounded-2xl p-5 shadow-sm animate-fadeIn">
              <h3 className="font-extrabold text-red-900 mb-4 flex items-center gap-2 text-lg">
                  <AlertOctagon className="text-red-600" size={24}/> Atenção: Prazos de Aprovação
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {urgentApprovals.map(req => (
                      <div key={req.id} className="bg-white p-4 rounded-xl border border-red-200 shadow-sm relative overflow-hidden group hover:border-red-400 transition-all cursor-pointer" onClick={() => onViewDetail(req.id)}>
                           <div className="absolute top-0 left-0 w-1 h-full bg-red-500"></div>
                           <h4 className="font-bold text-gray-900 mb-1">{req.titulo}</h4>
                           <p className="text-xs text-gray-500 mb-3">Protocolo: {req.id}</p>
                           <DeadlineDisplay dueAt={req.due_at} />
                           <div className="mt-3 text-right">
                                <span className="text-xs font-bold text-red-600 flex items-center justify-end group-hover:underline">
                                    Resolver Agora <ArrowRight size={12} className="ml-1"/>
                                </span>
                           </div>
                      </div>
                  ))}
              </div>
          </div>
      )}

      {/* INCOMING DELIVERIES SECTION (NEW) */}
      {incomingDeliveries.length > 0 && (
          <div className="bg-teal-50 border-2 border-teal-100 rounded-2xl p-5 shadow-sm animate-fadeIn">
              <h3 className="font-extrabold text-teal-900 mb-4 flex items-center gap-2 text-lg">
                  <CalendarClock className="text-teal-600" size={24}/> Próximas Entregas
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {incomingDeliveries.map(req => (
                      <div key={req.id} onClick={() => onViewDetail(req.id)} className="bg-white p-4 rounded-xl border border-teal-200 shadow-sm relative overflow-hidden group hover:border-teal-400 transition-all cursor-pointer">
                           <div className="absolute top-0 left-0 w-1 h-full bg-teal-500"></div>
                           <div className="pl-2">
                               <div className="flex justify-between items-start mb-2">
                                   <h4 className="font-bold text-gray-900 truncate pr-2">{req.titulo}</h4>
                                   <span className="text-[10px] font-mono bg-teal-100 text-teal-800 px-1.5 py-0.5 rounded font-bold shrink-0">{req.id.split('-')[1]}</span>
                               </div>
                               <div className="flex items-center gap-2 mb-3">
                                   <div className="bg-teal-100 p-1.5 rounded-full text-teal-700">
                                       <Truck size={16}/>
                                   </div>
                                   <div>
                                       <p className="text-[10px] text-gray-500 font-bold uppercase leading-none">Chega em</p>
                                       <p className="text-lg font-black text-teal-800 leading-none mt-0.5">
                                           {new Date(req.estimated_delivery_date!).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}
                                       </p>
                                   </div>
                               </div>
                               <div className="text-right">
                                    <span className="text-xs font-bold text-teal-600 flex items-center justify-end group-hover:underline">
                                        Confirmar Entrega <ArrowRight size={12} className="ml-1"/>
                                    </span>
                               </div>
                           </div>
                      </div>
                  ))}
              </div>
          </div>
      )}

      <Card title="Minhas Solicitações Recentes">
        {myRequests.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            Você ainda não tem solicitações registradas.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {myRequests.map((req) => {
                const approverName = req.autorizado_por_nome || 
                  (req.justificativa_condominio?.match(/Autorizado por: (.*?) -/)?.[1]) || null;
                
                const unreadCount = req.messages?.filter(m => !m.read_at && m.sender_id !== currentUser?.id).length || 0;

                return (
                    <div key={req.id} onClick={() => onViewDetail(req.id)} className="bg-white border text-left border-gray-200 rounded-xl p-4 hover:border-brand-500 hover:shadow-md transition-all cursor-pointer group flex flex-col md:flex-row md:items-center justify-between gap-4">
                       <div className="flex-1">
                           <div className="flex items-center gap-2 mb-1">
                               <span className="text-xs font-mono font-bold text-gray-500 bg-gray-100 px-2 py-0.5 rounded">{req.id}</span>
                               <span className="text-xs text-gray-400 font-medium whitespace-nowrap">{new Date(req.data_solicitacao).toLocaleDateString('pt-BR')}</span>
                           </div>
                           <h3 className="font-bold text-gray-900 text-base flex flex-wrap items-center gap-2">
                               {req.titulo}
                               {req.attachments && req.attachments.length > 0 && (
                                   <Paperclip size={14} className="text-blue-500" />
                               )}
                               {unreadCount > 0 && (
                                   <button 
                                     onClick={(e) => { e.stopPropagation(); onViewDetail(req.id, 'chat'); }}
                                     className="flex items-center gap-1 bg-red-100 text-red-600 px-2 py-0.5 rounded-full border border-red-200 hover:bg-red-200 transition-colors animate-pulse"
                                     title={`${unreadCount} novas mensagens`}
                                   >
                                       <MessageSquare size={12} className="fill-current" />
                                       <span className="text-[10px] font-bold">{unreadCount}</span>
                                   </button>
                               )}
                           </h3>
                           <div className="mt-3 flex flex-wrap gap-2 items-center">
                               <Badge status={req.status} />
                               
                               {approverName && (
                                   <div className="text-[10px] text-green-700 font-bold flex items-center gap-1 bg-green-50 px-2 py-0.5 rounded border border-green-100">
                                       <UserCheck size={10}/> {approverName}
                                   </div>
                               )}
                               
                               {/* Delivery Date for Condo */}
                               {req.estimated_delivery_date && req.status !== RequestStatus.CONCLUIDO && (
                                   <div className="text-[10px] bg-teal-100 text-teal-800 px-2 py-0.5 rounded border border-teal-200 flex items-center gap-1 font-bold">
                                       <Truck size={10}/> {new Date(req.estimated_delivery_date).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}
                                   </div>
                               )}
                           </div>
                       </div>
                       <div className="flex-shrink-0 w-full md:w-auto mt-2 md:mt-0">
                           <Button variant="outline" className="w-full md:w-auto text-xs py-2 px-4 group-hover:bg-brand-50 group-hover:text-brand-700 group-hover:border-brand-200">
                               Ver Detalhes <ArrowRight size={14} className="ml-1 opacity-50 group-hover:opacity-100" />
                           </Button>
                       </div>
                    </div>
                );
            })}
          </div>
        )}
      </Card>
    </div>
  );
};
