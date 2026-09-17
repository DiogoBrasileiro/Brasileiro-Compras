
import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { RequestStatus, RequestLevel } from '../../types';
import { Badge, Button, Input, Select, Card, DeadlineDisplay } from '../../components/UI';
import { Search, Filter, Eye, MoreHorizontal, AlertCircle, Clock, Calendar, Building, Tag, CheckCircle2, Paperclip, Users, UserCheck, Truck, LayoutGrid, List } from 'lucide-react';
import { KanbanBoard } from '../../components/KanbanBoard';

export const Inbox: React.FC<{ onViewDetail: (id: string, tab?: 'details' | 'chat') => void }> = ({ onViewDetail }) => {
  const { requests, updateRequestStatus, categories, getRequestsAll, currentUser } = useApp();
  const allRequests = getRequestsAll();

  // Filters State
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [levelFilter, setLevelFilter] = useState<string>('');
  const [categoryFilter, setCategoryFilter] = useState<string>('');
  const [showFilters, setShowFilters] = useState(false);
  const [viewMode, setViewMode] = useState<'list' | 'kanban'>(() => (localStorage.getItem('inboxViewMode') as 'list' | 'kanban') || 'kanban');

  // Persist view mode
  React.useEffect(() => {
    localStorage.setItem('inboxViewMode', viewMode);
  }, [viewMode]);

  // Filtering Logic
  const filteredRequests = useMemo(() => {
    return allRequests.filter(req => {
      const matchesSearch = 
        req.titulo.toLowerCase().includes(searchTerm.toLowerCase()) || 
        req.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
        req.condominio_nome.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesStatus = statusFilter ? req.status === statusFilter : true;
      const matchesLevel = levelFilter ? req.nivel === levelFilter : true;
      const matchesCategory = categoryFilter ? (req.category_id === categoryFilter || req.categoria === categoryFilter) : true;

      return matchesSearch && matchesStatus && matchesLevel && matchesCategory;
    });
  }, [allRequests, searchTerm, statusFilter, levelFilter, categoryFilter]);

  // Sorting
  const sortedRequests = useMemo(() => {
    return [...filteredRequests].sort((a, b) => {
      if (a.nivel === RequestLevel.N1 && b.nivel !== RequestLevel.N1) return -1;
      if (b.nivel === RequestLevel.N1 && a.nivel !== RequestLevel.N1) return 1;
      if (a.fora_do_prazo && !b.fora_do_prazo) return -1;
      if (b.fora_do_prazo && !a.fora_do_prazo) return 1;
      return new Date(b.data_solicitacao).getTime() - new Date(a.data_solicitacao).getTime();
    });
  }, [filteredRequests]);

  const countN1 = requests.filter(r => r.nivel === RequestLevel.N1).length;

  return (
    <div className="space-y-6 h-full flex flex-col">
      {/* Header & Stats */}
      <div className="flex flex-col gap-4">
        <div className="flex justify-between items-center">
            <div>
              <h1 className="text-xl md:text-2xl font-bold text-gray-900">Inbox</h1>
              <p className="text-sm text-gray-600 font-medium">Gestão centralizada de pedidos.</p>
            </div>
            <div className="flex items-center gap-3">
                {countN1 > 0 && (
                     <div className="animate-pulse flex items-center gap-2 bg-red-100 px-3 py-1.5 rounded-full text-red-800 text-xs font-bold border border-red-200">
                        <AlertCircle size={14} /> {countN1} Emergenciais
                     </div>
                )}
                <div className="flex bg-gray-100 p-1 rounded-lg">
                    <button 
                        onClick={() => setViewMode('list')} 
                        className={`p-1.5 rounded-md transition-colors ${viewMode === 'list' ? 'bg-white text-brand-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                        title="Visualização em Lista"
                    >
                        <List size={18} />
                    </button>
                    <button 
                        onClick={() => setViewMode('kanban')} 
                        className={`p-1.5 rounded-md transition-colors ${viewMode === 'kanban' ? 'bg-white text-brand-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                        title="Visualização Kanban"
                    >
                        <LayoutGrid size={18} />
                    </button>
                </div>
            </div>
        </div>

        {/* Search Bar & Filter Toggle */}
        <div className="flex gap-2">
            <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500" size={18} />
                <input 
                    type="text" 
                    placeholder="Buscar protocolo, título..." 
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-300 bg-white shadow-sm text-sm focus:ring-2 focus:ring-brand-500 outline-none text-gray-900 placeholder-gray-500 font-medium"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>
            <button 
                onClick={() => setShowFilters(!showFilters)}
                className={`p-2.5 rounded-xl border transition-colors ${showFilters ? 'bg-brand-100 border-brand-300 text-brand-800' : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50'}`}
            >
                <Filter size={20}/>
            </button>
        </div>

        {/* Expandable Filters */}
        {showFilters && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 p-4 bg-white rounded-2xl border border-gray-200 shadow-sm animate-fadeIn">
                <Select label="Status" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} options={[{value: '', label: 'Todos Status'}, ...Object.values(RequestStatus).map(s => ({value: s, label: s.replace(/_/g, ' ')}))]} className="mb-0"/>
                <Select label="Prioridade" value={levelFilter} onChange={(e) => setLevelFilter(e.target.value)} options={[{value: '', label: 'Todas'}, ...Object.values(RequestLevel).map(l => ({value: l, label: l}))]} className="mb-0"/>
                <Select label="Categoria" value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} options={[{value: '', label: 'Todas'}, ...categories.map(c => ({value: c.id, label: c.name}))]} className="mb-0"/>
            </div>
        )}
      </div>

      {/* Content Area */}
      <div className="flex-1">
        {viewMode === 'kanban' ? (
            <KanbanBoard requests={sortedRequests} onViewDetail={onViewDetail} currentUser={currentUser} />
        ) : (
            <>
                {/* Mobile: Card List */}
                <div className="md:hidden space-y-3 pb-20">
                    {sortedRequests.map(req => {
                        const hasAttachments = req.attachments && req.attachments.length > 0;
                        const isAssembly = req.assembly_data?.required;
                        const approverName = req.autorizado_por_nome || 
                            (req.justificativa_condominio?.match(/Autorizado por: (.*?) -/)?.[1]) || null;
                        
                        return (
                            <div key={req.id} onClick={() => onViewDetail(req.id)} className="bg-white border border-gray-200 p-4 rounded-xl active:scale-95 transition-transform shadow-sm">
                                <div className="flex justify-between items-start mb-3">
                                    <div className="flex items-center gap-2">
                                        <div className="bg-gray-100 p-1.5 rounded text-gray-700 font-bold font-mono text-xs border border-gray-200">{req.id.split('-')[1]}</div>
                                        <span className="text-xs text-gray-500 font-medium">{new Date(req.data_solicitacao).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {isAssembly && <Users size={14} className="text-purple-600"/>}
                                        <Badge status={req.status} />
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 mb-1">
                                    <h3 className="font-bold text-gray-900 text-base leading-snug">{req.titulo}</h3>
                                    {hasAttachments && <Paperclip size={14} className="text-blue-500 flex-shrink-0" />}
                                </div>
                                <div className="flex items-center gap-1 text-xs text-gray-600 font-medium mb-3">
                                    <Building size={12}/> {req.condominio_nome}
                                </div>
                                
                                {approverName && (
                                    <div className="mb-3 text-xs bg-green-50 text-green-700 px-2 py-1 rounded border border-green-100 flex items-center gap-1 w-fit">
                                        <UserCheck size={12}/> Aprovado por: <b>{approverName}</b>
                                    </div>
                                )}
                                
                                {/* Delivery Date Display Mobile */}
                                {req.estimated_delivery_date && req.status !== RequestStatus.CONCLUIDO && (
                                    <div className="mb-3 text-xs bg-teal-50 text-teal-800 px-2 py-1 rounded border border-teal-200 flex items-center gap-1 w-fit">
                                        <Truck size={12}/> Entrega: <b>{new Date(req.estimated_delivery_date).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}</b>
                                    </div>
                                )}
                                
                                {req.due_at && req.status === RequestStatus.EM_ANALISE_CONDOMINIO && (
                                    <div className="mb-3">
                                        <DeadlineDisplay dueAt={req.due_at} compact />
                                    </div>
                                )}

                                <div className="flex justify-between items-center pt-3 border-t border-gray-100">
                                    <div className="flex gap-2">
                                        <Badge level={req.nivel} />
                                    </div>
                                    <span className="text-brand-700 text-sm font-bold flex items-center">Detalhes <Eye size={14} className="ml-1"/></span>
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Desktop: Table */}
                <div className="hidden md:block bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-4 text-left text-xs font-extrabold text-gray-600 uppercase tracking-wider">Protocolo</th>
                                <th className="px-6 py-4 text-left text-xs font-extrabold text-gray-600 uppercase tracking-wider">Condomínio</th>
                                <th className="px-6 py-4 text-left text-xs font-extrabold text-gray-600 uppercase tracking-wider">Assunto / Fornecedor</th>
                                <th className="px-6 py-4 text-left text-xs font-extrabold text-gray-600 uppercase tracking-wider">Status / Prazo</th>
                                <th className="px-6 py-4 text-right text-xs font-extrabold text-gray-600 uppercase tracking-wider">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 bg-white">
                            {sortedRequests.map((req) => {
                                 const hasAttachments = req.attachments && req.attachments.length > 0;
                                 const isAssembly = req.assembly_data?.required;
                                 const approverName = req.autorizado_por_nome || 
                                    (req.justificativa_condominio?.match(/Autorizado por: (.*?) -/)?.[1]) || null;
                                 
                                 return (
                                    <tr key={req.id} className="hover:bg-gray-50 transition-colors group">
                                        <td className="px-6 py-4">
                                            <div className="text-sm font-bold text-gray-900">{req.id}</div>
                                            <div className="text-xs text-gray-500 font-medium">{new Date(req.data_solicitacao).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}</div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="text-sm font-semibold text-gray-800">{req.condominio_nome}</div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-2">
                                                <div className="text-sm text-gray-900 font-bold truncate max-w-xs">{req.titulo}</div>
                                                {isAssembly && <span title="Pauta de Assembleia"><Users size={14} className="text-purple-600" /></span>}
                                                {hasAttachments && <Paperclip size={14} className="text-blue-500 flex-shrink-0" />}
                                            </div>
                                            <div className="text-xs text-gray-500 font-medium flex gap-2 mt-1">
                                                <span className="flex items-center gap-1"><Tag size={10}/> {req.categoria}</span>
                                                <Badge level={req.nivel} />
                                            </div>
                                            {approverName && (
                                                <div className="mt-1 text-[10px] text-green-700 font-bold flex items-center gap-1">
                                                    <UserCheck size={10}/> Aprovado por: {approverName}
                                                </div>
                                            )}
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex flex-col gap-2 items-start">
                                                <Badge status={req.status} />
                                                {req.due_at && req.status === RequestStatus.EM_ANALISE_CONDOMINIO && (
                                                    <DeadlineDisplay dueAt={req.due_at} compact />
                                                )}
                                                {/* Delivery Date Display Desktop */}
                                                {req.estimated_delivery_date && req.status !== RequestStatus.CONCLUIDO && (
                                                    <div className="text-[10px] bg-teal-50 text-teal-800 px-2 py-0.5 rounded border border-teal-200 flex items-center gap-1 font-bold">
                                                        <Truck size={10}/> Entr: {new Date(req.estimated_delivery_date).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}
                                                    </div>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <Button variant="ghost" className="px-3 py-1.5 text-xs text-brand-700 hover:bg-brand-50" onClick={() => onViewDetail(req.id)}>
                                                Ver Detalhes
                                            </Button>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </>
        )}
      </div>
    </div>
  );
};
