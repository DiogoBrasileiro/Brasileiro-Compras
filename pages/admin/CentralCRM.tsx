import React, { useState, useMemo, useRef } from 'react';
import { useApp } from '../../context/AppContext';
import { CRMQuoteItem, RequestStatus, Solicitacao, UserRole } from '../../types';
import { 
  Building, Phone, Mail, MessageSquare, Clipboard, Send, Search, 
  CheckCircle2, AlertTriangle, Clock, Briefcase, Activity, Calendar, ArrowRight, Filter,
  ChevronLeft, ChevronRight
} from 'lucide-react';
import { PRETTY_CRM_STATUS } from '../../components/CRMQuotes';

// Duplicate local definitions
const CRM_STATUS_COLORS: Record<string, string> = {
  NAO_SOLICITADO: 'bg-zinc-100 text-zinc-700 border-zinc-200',
  SOLICITADO: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  AGUARDANDO_RETORNO: 'bg-amber-50 text-amber-700 border-amber-200',
  RETORNOU: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  RETORNOU_INCOMPLETO: 'bg-orange-50 text-orange-700 border-orange-200',
  RECUSOU: 'bg-rose-50 text-rose-700 border-rose-200',
  SEM_RESPOSTA: 'bg-red-50 text-red-700 border-red-200',
  LANCADO: 'bg-blue-50 text-blue-700 border-blue-200',
  APROVADO: 'bg-green-100 text-green-800 border-green-300',
  NAO_ESCOLHIDO: 'bg-zinc-100 text-zinc-400 border-zinc-200 opacity-60'
};

interface ExpandedQuote extends CRMQuoteItem {
   request_id: string;
   request_titulo: string;
   request_protocolo: string;
   condominio_nome: string;
   condominio_id: string;
   is_delayed: boolean;
   request_status: RequestStatus;
}

interface CentralCRMProps {
  onViewDetail: (id: string, tab?: 'details' | 'chat' | 'crm') => void;
}

export const CentralCRM: React.FC<CentralCRMProps> = ({ onViewDetail }) => {
  const { requests, updateRequest, currentUser } = useApp();
  
  const [activeTab, setActiveTab] = useState<'ativos' | 'vencidos' | 'sem_resposta' | 'todos'>('ativos');
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState<'lista' | 'funil' | 'resumo'>('resumo');
  const funnelRef = useRef<HTMLDivElement>(null);

  const scrollFunnel = (direction: 'left' | 'right') => {
      if (funnelRef.current) {
          const scrollAmount = 350; // Width of one column + gap
          funnelRef.current.scrollBy({ left: direction === 'left' ? -scrollAmount : scrollAmount, behavior: 'smooth' });
      }
  };

  // Extract and expand all quotes
  const allQuotes: ExpandedQuote[] = useMemo(() => {
     let list: ExpandedQuote[] = [];
     requests.forEach(req => {
        // Skip default completed/cancelled unless we are looking specifically for them
        // The user said: "mostrar apenas pedidos não concluídos, ocultar pedidos finalizados por padrão"
        if (req.status === RequestStatus.CONCLUIDO || req.status === RequestStatus.CANCELADO) {
            return;
        }

        const quotes = req.assembly_data?.crm_quotes || [];
        quotes.forEach(q => {
            const isDelayed = (() => {
                if (!q.requested_at) return false;
                const reqDate = new Date(q.requested_at);
                const diffDays = (new Date().getTime() - reqDate.getTime()) / (1000 * 3600 * 24);
                if (q.status === 'AGUARDANDO_RETORNO' || q.status === 'SEM_RESPOSTA') {
                   // If there is a promised_date, use it
                   if (q.promised_date) {
                      const promiseDate = new Date(q.promised_date);
                      return promiseDate.getTime() < new Date().getTime();
                   }
                   return diffDays > 3; // default overdue logic
                }
                return false;
            })();

            list.push({
                ...q,
                request_id: req.id,
                request_titulo: req.titulo,
                request_protocolo: req.id,
                condominio_nome: req.condominio_nome,
                condominio_id: req.condominio_id,
                is_delayed: isDelayed,
                request_status: req.status
            });
        });
     });
     
     // Sort by most recent request by default
     list.sort((a, b) => {
         const dA = a.requested_at ? new Date(a.requested_at).getTime() : 0;
         const dB = b.requested_at ? new Date(b.requested_at).getTime() : 0;
         return dB - dA;
     });

     return list;
  }, [requests]);

  // Filtering
  const filteredQuotes = useMemo(() => {
     return allQuotes.filter(q => {
         // Filter by activeTab
         if (activeTab === 'ativos') {
             // Exclude those not requested yet, or already chosen/discarded maybe? 
             // "mostrar apenas pedidos não concluídos" - handled above. active=all except not requested
             if (q.status === 'NAO_SOLICITADO') return false;
         } else if (activeTab === 'vencidos') {
             if (!q.is_delayed) return false;
         } else if (activeTab === 'sem_resposta') {
             if (q.status !== 'SEM_RESPOSTA') return false;
         }
         
         // Search
         if (searchTerm) {
             const lowerSearch = searchTerm.toLowerCase();
             if (
                 !q.supplier_name.toLowerCase().includes(lowerSearch) &&
                 !q.request_titulo.toLowerCase().includes(lowerSearch) &&
                 !q.condominio_nome.toLowerCase().includes(lowerSearch) &&
                 !q.request_id.toLowerCase().includes(lowerSearch)
             ) {
                 return false;
             }
         }
         
         return true;
     });
  }, [allQuotes, activeTab, searchTerm]);

  // Stats Counters
  const stats = useMemo(() => {
     return {
         total: allQuotes.length,
         acionados: allQuotes.filter(q => q.status !== 'NAO_SOLICITADO').length,
         aguardando: allQuotes.filter(q => q.status === 'AGUARDANDO_RETORNO').length,
         retornaram: allQuotes.filter(q => ['RETORNOU', 'RETORNOU_INCOMPLETO'].includes(q.status)).length,
         incompletos: allQuotes.filter(q => q.status === 'RETORNOU_INCOMPLETO').length,
         sem_resposta: allQuotes.filter(q => q.status === 'SEM_RESPOSTA').length,
         prazo_vencido: allQuotes.filter(q => q.is_delayed).length,
         lancados: allQuotes.filter(q => q.status === 'LANCADO').length,
         aprovados: allQuotes.filter(q => q.status === 'APROVADO').length,
         descartados: allQuotes.filter(q => q.status === 'NAO_ESCOLHIDO' || q.status === 'RECUSOU').length,
     }
  }, [allQuotes]);

  // Handler for quick status update
  const handleQuickStatusChange = async (quote: ExpandedQuote, newStatus: string) => {
      const parentReq = requests.find(r => r.id === quote.request_id);
      if (!parentReq) return;

      const oldQuotes = parentReq.assembly_data?.crm_quotes || [];
      const updatedQuotes = oldQuotes.map(q => {
          if (q.id === quote.id) {
               const history = [...(q.history || []), {
                   id: Date.now().toString(),
                   date: new Date().toISOString(),
                   user_name: currentUser?.nome || 'Admin',
                   description: `Status alterado de ${PRETTY_CRM_STATUS[q.status]} para ${PRETTY_CRM_STATUS[newStatus]} via Central CRM`
               }];
               return { ...q, status: newStatus as any, history };
          }
          return q;
      });

      await updateRequest(parentReq.id, {
          assembly_data: {
               ...parentReq.assembly_data,
               required: parentReq.assembly_data?.required || false,
               status: parentReq.assembly_data?.status || 'PENDING',
               crm_quotes: updatedQuotes
          }
      });
  };

  const formatCurrency = (val?: number) => {
    if (!val) return 'R$ 0,00';
    return val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  return (
    <div className="space-y-6 animate-fadeIn pb-20">
       {/* Header */}
       <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
           <div>
               <h1 className="text-2xl font-black text-gray-900 tracking-tight flex items-center gap-2">
                   <Briefcase className="text-brand-600" /> Central de Cotações
               </h1>
               <p className="text-sm font-medium text-gray-500 mt-1">Acompanhe todos os fornecedores acionados nos pedidos em aberto.</p>
           </div>
           
           <div className="flex bg-gray-100 p-1 rounded-lg">
                <button onClick={() => setViewMode('resumo')} className={`px-4 py-2 rounded-md text-xs font-bold transition-colors ${viewMode === 'resumo' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>Resumo & Cards</button>
                <button onClick={() => setViewMode('lista')} className={`px-4 py-2 rounded-md text-xs font-bold transition-colors ${viewMode === 'lista' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>Lista Operacional</button>
                <button onClick={() => setViewMode('funil')} className={`px-4 py-2 rounded-md text-xs font-bold transition-colors ${viewMode === 'funil' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>Funil Visual</button>
           </div>
       </div>

       {/* Resumo Executivo */}
       {(viewMode === 'resumo' || viewMode === 'lista') && (
           <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-4">
               <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                   <p className="text-[10px] text-gray-500 font-extrabold uppercase mb-1">Acionados</p>
                   <p className="text-2xl font-black text-gray-900">{stats.acionados}</p>
               </div>
               <div className="bg-amber-50 p-4 rounded-xl border border-amber-200 shadow-sm">
                   <p className="text-[10px] text-amber-700 font-extrabold uppercase mb-1 flex items-center gap-1"><Clock size={12}/> Aguardando Retorno</p>
                   <p className="text-2xl font-black text-amber-900">{stats.aguardando}</p>
               </div>
               <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-200 shadow-sm">
                   <p className="text-[10px] text-emerald-700 font-extrabold uppercase mb-1 flex items-center gap-1"><CheckCircle2 size={12}/> Retornaram</p>
                   <p className="text-2xl font-black text-emerald-900">{stats.retornaram}</p>
               </div>
               <div className="bg-red-50 p-4 rounded-xl border border-red-200 shadow-sm">
                   <p className="text-[10px] text-red-700 font-extrabold uppercase mb-1 flex items-center gap-1"><AlertTriangle size={12}/> Prazo Vencido</p>
                   <p className="text-2xl font-black text-red-900">{stats.prazo_vencido}</p>
               </div>
               <div className="bg-blue-50 p-4 rounded-xl border border-blue-200 shadow-sm hidden xl:block">
                   <p className="text-[10px] text-blue-700 font-extrabold uppercase mb-1 flex items-center gap-1"><Clipboard size={12}/> Lançados no Pedido</p>
                   <p className="text-2xl font-black text-blue-900">{stats.lancados}</p>
               </div>
           </div>
       )}

       {/* Toolbar (Pesquisa e Abas) */}
       {viewMode !== 'resumo' && (
       <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-3 rounded-xl border border-gray-200 shadow-sm">
            <div className="flex bg-gray-50 p-1 rounded-lg border border-gray-100 overflow-x-auto hide-scrollbar">
                <button onClick={() => setActiveTab('ativos')} className={`px-4 py-2 rounded-md text-xs font-bold whitespace-nowrap transition-colors ${activeTab === 'ativos' ? 'bg-white shadow-sm text-brand-700 ring-1 ring-gray-200' : 'text-gray-500 hover:text-gray-700'}`}>Ativos</button>
                <button onClick={() => setActiveTab('sem_resposta')} className={`px-4 py-2 rounded-md text-xs font-bold whitespace-nowrap transition-colors ${activeTab === 'sem_resposta' ? 'bg-white shadow-sm text-red-600 ring-1 ring-gray-200' : 'text-gray-500 hover:text-gray-700'}`}>Sem Resposta</button>
                <button onClick={() => setActiveTab('vencidos')} className={`px-4 py-2 rounded-md text-xs font-bold whitespace-nowrap transition-colors ${activeTab === 'vencidos' ? 'bg-white shadow-sm text-amber-600 ring-1 ring-gray-200' : 'text-gray-500 hover:text-gray-700'}`}>Atrasados</button>
                <button onClick={() => setActiveTab('todos')} className={`px-4 py-2 rounded-md text-xs font-bold whitespace-nowrap transition-colors ${activeTab === 'todos' ? 'bg-white shadow-sm text-gray-900 ring-1 ring-gray-200' : 'text-gray-500 hover:text-gray-700'}`}>Todos</button>
            </div>
            <div className="relative w-full md:w-64">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                    <Search size={16} />
                </div>
                <input
                    type="text"
                    placeholder="Buscar fornecedor, pedido..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="block w-full pl-10 pr-3 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50 focus:bg-white focus:ring-2 focus:ring-brand-500 outline-none transition-all"
                />
            </div>
       </div>
       )}

       {/* Lista Operacional */}
       {viewMode === 'lista' && (
           <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
               <div className="overflow-x-auto pb-2">
                   <table className="w-full text-left text-sm min-w-[700px]">
                       <thead className="bg-gray-50 border-b border-gray-200 text-xs font-bold text-gray-500 uppercase">
                           <tr>
                               <th className="px-4 py-3">Fornecedor</th>
                               <th className="px-4 py-3">Pedido & Condomínio</th>
                               <th className="px-4 py-3">Status / Data</th>
                               <th className="px-4 py-3 text-right">Ações</th>
                           </tr>
                       </thead>
                       <tbody className="divide-y divide-gray-100">
                           {filteredQuotes.map(quote => (
                               <tr key={quote.id} className="hover:bg-brand-50/50 transition-colors group">
                                   <td className="px-4 py-4 max-w-[200px]">
                                       <div className="font-bold text-gray-900 truncate" title={quote.supplier_name}>{quote.supplier_name}</div>
                                       <div className="text-xs text-brand-600 mt-1 font-bold">{formatCurrency(quote.value)}</div>
                                       {quote.channel && (
                                           <div className={`mt-1 text-[10px] px-1.5 py-0.5 rounded inline-flex font-bold border ${quote.channel === 'whatsapp' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-gray-100 text-gray-700 border-gray-200'}`}>
                                              {quote.channel.toUpperCase()}
                                           </div>
                                       )}
                                   </td>
                                   <td className="px-4 py-4 max-w-[250px]">
                                       <div className="flex items-center gap-1.5 cursor-pointer hover:underline text-gray-900 font-bold truncate" onClick={() => onViewDetail(quote.request_id, 'crm')} title={quote.request_titulo}>
                                           {quote.request_titulo}
                                       </div>
                                       <div className="text-xs text-gray-500 mt-1 truncate" title={quote.condominio_nome}>
                                           <Building size={10} className="inline mr-1"/>{quote.condominio_nome}
                                       </div>
                                   </td>
                                   <td className="px-4 py-4">
                                       <div className="flex flex-col items-start gap-1">
                                           <select 
                                              value={quote.status}
                                              onChange={(e) => handleQuickStatusChange(quote, e.target.value)}
                                              className={`border text-[11px] font-bold rounded flex-shrink-0 px-2 py-1 shadow-sm focus:outline-none focus:ring-2 focus:ring-brand-500 w-full max-w-[140px] truncate ${CRM_STATUS_COLORS[quote.status]}`}
                                              title={PRETTY_CRM_STATUS[quote.status]}
                                           >
                                              {Object.keys(PRETTY_CRM_STATUS).map(k => (
                                                 <option key={k} value={k} className="bg-white text-gray-900">{PRETTY_CRM_STATUS[k]}</option>
                                              ))}
                                           </select>
                                           <div className="text-[10px] text-gray-500 font-medium">Data: {quote.requested_at ? new Date(quote.requested_at).toLocaleDateString('pt-BR') : '-'}</div>
                                           {quote.is_delayed && (
                                              <div className="text-[10px] text-red-600 font-bold flex items-center gap-1">
                                                 <AlertTriangle size={10}/> Atrasado
                                              </div>
                                           )}
                                       </div>
                                   </td>
                                   <td className="px-4 py-4 text-right">
                                       <div className="flex items-center justify-end gap-2">
                                           {quote.whatsapp && (
                                               <a href={`https://wa.me/${quote.whatsapp.replace(/\D/g, '')}?text=Ol%C3%A1%2C%20estamos%20aguardando%20o%20retorno%20da%20cota%C3%A7%C3%A3o%20que%20solicitamos%2E%20Consegue%20verificar%3F`} target="_blank" rel="noopener noreferrer" className="p-1.5 bg-gray-50 border border-gray-200 rounded-md text-gray-500 hover:text-green-600 hover:border-green-200 hover:bg-green-50 transition-colors" title="Cobrar no WhatsApp"><MessageSquare size={14}/></a>
                                           )}
                                           {quote.status !== 'SEM_RESPOSTA' && (
                                              <button 
                                                 onClick={() => handleQuickStatusChange(quote, 'SEM_RESPOSTA')}
                                                 className="p-1.5 bg-gray-50 border border-gray-200 rounded-md text-gray-500 hover:text-red-600 hover:border-red-200 hover:bg-red-50 transition-colors"
                                                 title="Marcar Sem Resposta"
                                              >
                                                  <AlertTriangle size={14}/>
                                              </button>
                                           )}
                                           <button 
                                              onClick={() => onViewDetail(quote.request_id, 'crm')}
                                              className="text-xs bg-white border border-gray-200 text-gray-700 font-bold px-3 py-1.5 rounded-lg hover:border-brand-500 hover:text-brand-600 transition-colors shadow-sm inline-flex items-center gap-1 ml-1"
                                              title="Abrir CRM do pedido para lançar retorno, PDF ou aprovar."
                                           >
                                               Abrir CRM
                                           </button>
                                       </div>
                                   </td>
                               </tr>
                           ))}
                           {filteredQuotes.length === 0 && (
                               <tr>
                                   <td colSpan={4} className="text-center py-12 text-gray-400">
                                       <Activity size={32} className="mx-auto mb-3 opacity-20"/>
                                       <p>Nenhuma cotação encontrada para os filtros atuais.</p>
                                   </td>
                               </tr>
                           )}
                       </tbody>
                   </table>
               </div>
           </div>
       )}

       {/* Funil Visual */}
       {viewMode === 'funil' && (
           <div className="relative">
               <div className="flex items-center justify-between mb-3 bg-white p-2 rounded-xl border border-gray-200 shadow-sm">
                   <p className="text-sm font-bold text-gray-700 pl-2">Fluxo de Fornecedores</p>
                   <div className="flex gap-2 pr-1">
                       <button onClick={() => scrollFunnel('left')} className="p-1.5 border border-gray-200 bg-white rounded-lg shadow-sm hover:bg-gray-50 text-gray-700 transition" title="Rolar para esquerda"><ChevronLeft size={16} /></button>
                       <button onClick={() => scrollFunnel('right')} className="p-1.5 border border-gray-200 bg-white rounded-lg shadow-sm hover:bg-gray-50 text-gray-700 transition" title="Rolar para direita"><ChevronRight size={16} /></button>
                   </div>
               </div>
               <div ref={funnelRef} className="flex gap-4 overflow-x-auto pb-4 scroll-smooth snap-x snap-mandatory" style={{ scrollbarWidth: 'thin', scrollbarColor: '#E5E7EB transparent' }}>
                   {[
                       { title: 'Aguardando Retorno', statuses: ['SOLICITADO', 'AGUARDANDO_RETORNO'], color: 'amber' },
                       { title: 'Respondidos', statuses: ['RETORNOU', 'RETORNOU_INCOMPLETO'], color: 'emerald' },
                       { title: 'Sem Resposta', statuses: ['SEM_RESPOSTA'], color: 'red' },
                       { title: 'Processados', statuses: ['LANCADO', 'APROVADO'], color: 'blue' }
                   ].map(column => (
                       <div key={column.title} className="w-80 snap-start flex-shrink-0 bg-gray-50/80 rounded-xl p-3 border border-gray-200 flex flex-col max-h-[70vh]">
                           <div className="flex items-center justify-between mb-3 px-1">
                               <h3 className={`text-sm font-bold text-${column.color}-900`}>{column.title}</h3>
                               <span className={`bg-${column.color}-100 text-${column.color}-800 text-xs font-bold px-2 py-0.5 rounded-full border border-${column.color}-200`}>
                                   {allQuotes.filter(q => column.statuses.includes(q.status)).length}
                               </span>
                           </div>
                           <div className="flex-1 overflow-y-auto space-y-3 pr-2 scroll-smooth" style={{ scrollbarWidth: 'thin' }}>
                               {allQuotes
                                   .filter(q => column.statuses.includes(q.status))
                                   .map(quote => (
                                   <div key={quote.id} className="bg-white p-3 rounded-xl border border-gray-200 shadow-sm hover:border-brand-300 hover:shadow-md transition-all cursor-pointer" onClick={() => onViewDetail(quote.request_id, 'crm')}>
                                       <div className="flex justify-between items-start mb-1">
                                           <p className="font-bold text-gray-900 text-sm truncate pr-2">{quote.supplier_name}</p>
                                           {quote.is_delayed && <AlertTriangle size={14} className="text-red-500 flex-shrink-0"/>}
                                       </div>
                                       <p className="text-[11px] text-gray-500 font-medium truncate mb-2" title={quote.request_titulo}>{quote.request_titulo}</p>
                                       <div className="flex items-center justify-between mt-3 pt-2 border-t border-gray-100">
                                           <div className={`text-[10px] font-bold px-2 py-1 rounded-md border ${CRM_STATUS_COLORS[quote.status]}`}>
                                               {PRETTY_CRM_STATUS[quote.status]}
                                           </div>
                                           {quote.value ? (
                                               <span className="text-xs font-black text-gray-900">{formatCurrency(quote.value)}</span>
                                           ) : (
                                               <span className="text-[10px] text-gray-400 font-bold">{quote.requested_at ? new Date(quote.requested_at).toLocaleDateString('pt-BR') : ''}</span>
                                           )}
                                       </div>
                                   </div>
                               ))}
                           </div>
                       </div>
                   ))}
               </div>
           </div>
       )}
    </div>
  );
};
