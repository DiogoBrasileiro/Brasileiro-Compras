import React from 'react';
import { Solicitacao, RequestStatus, RequestLevel } from '../types';
import { Badge } from './UI';
import { Building, MessageSquare, Paperclip, Clock, AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react';

interface KanbanBoardProps {
  requests: Solicitacao[];
  onViewDetail: (id: string, tab?: 'details' | 'chat') => void;
  currentUser?: any;
}

const KANBAN_COLUMNS = [
  { id: 'entrada', title: 'Entrada', statuses: [RequestStatus.NOVO] },
  { id: 'cotacao', title: 'Cotação', statuses: [RequestStatus.EM_COTACAO, RequestStatus.ORCAMENTOS_PRONTOS] },
  { id: 'aprovacao', title: 'Aprovação Cliente', statuses: [RequestStatus.AGUARDANDO_ACAO_CONDOMINIO, RequestStatus.EM_ANALISE_CONDOMINIO] },
  { id: 'compras', title: 'Compras & Entrega', statuses: [RequestStatus.APROVADO, RequestStatus.EM_PEDIDO, RequestStatus.AGUARDANDO_ENTREGA] },
  { id: 'finalizados', title: 'Finalizados', statuses: [RequestStatus.CONCLUIDO, RequestStatus.RECUSADO, RequestStatus.REPROVADO_BRASILEIRO, RequestStatus.REPROVADO_SEM_RESPOSTA, RequestStatus.CANCELADO] }
];

const getPriorityColors = (level: RequestLevel) => {
  switch (level) {
    case RequestLevel.N1: return 'border-l-4 border-l-red-500 bg-red-50/50 hover:bg-red-50';
    case RequestLevel.N2: return 'border-l-4 border-l-orange-500 bg-orange-50/50 hover:bg-orange-50';
    case RequestLevel.N3: return 'border-l-4 border-l-blue-500 bg-blue-50/50 hover:bg-blue-50';
    default: return 'border-l-4 border-l-gray-400 bg-gray-50/50 hover:bg-gray-50';
  }
};

export const KanbanBoard: React.FC<KanbanBoardProps> = ({ requests, onViewDetail, currentUser }) => {
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const [expandedColumns, setExpandedColumns] = React.useState<Record<string, boolean>>(
    KANBAN_COLUMNS.reduce((acc, col) => ({ ...acc, [col.id]: col.id !== 'finalizados' }), {})
  );
  const [showAllCards, setShowAllCards] = React.useState<Record<string, boolean>>({});

  const toggleColumn = (columnId: string) => {
    setExpandedColumns(prev => ({ ...prev, [columnId]: !prev[columnId] }));
  };

  const toggleShowAll = (columnId: string) => {
    setShowAllCards(prev => ({ ...prev, [columnId]: !prev[columnId] }));
  };

  return (
    <div className="flex flex-col gap-2">
      {/* Top Scrollbar */}
      <div 
        className="overflow-x-auto pb-1"
        onScroll={(e) => {
          if (scrollRef.current) scrollRef.current.scrollLeft = e.currentTarget.scrollLeft;
        }}
      >
        <div style={{ width: '1564px' }} className="h-2"></div>
      </div>
      
      {/* Kanban Content */}
      <div className="flex gap-4 overflow-x-auto pb-4 snap-x" ref={scrollRef}>
        {KANBAN_COLUMNS.map(column => {
          const columnRequests = requests.filter(req => column.statuses.includes(req.status));
          const isExpanded = expandedColumns[column.id];
          const isShowingAll = showAllCards[column.id];
          const visibleRequests = isShowingAll ? columnRequests : columnRequests.slice(0, 6);
          const hasMore = columnRequests.length > 6;
          
          return (
            <div key={column.id} className={`min-w-[300px] w-[300px] flex-shrink-0 bg-gray-100/50 rounded-2xl p-3 flex flex-col snap-start border border-gray-200/50 ${!isExpanded ? 'h-fit' : ''}`}>
              <div className="flex justify-between items-center mb-3 px-1 cursor-pointer" onClick={() => toggleColumn(column.id)}>
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-gray-700 text-sm uppercase tracking-wider">{column.title}</h3>
                  <span className="bg-white text-gray-500 text-xs font-bold px-2 py-0.5 rounded-full shadow-sm border border-gray-200">
                    {columnRequests.length}
                  </span>
                </div>
                <button className="text-gray-500 hover:text-gray-700">
                  {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </button>
              </div>
              
              {isExpanded && (
                <div className="flex-1 overflow-y-auto space-y-3 pr-1 custom-scrollbar">
                  {visibleRequests.map(req => {
                    const unreadCount = req.messages?.filter(m => !m.read_at && m.sender_id !== currentUser?.id).length || 0;
                    const hasAttachments = req.attachments && req.attachments.length > 0;
                    const priorityColors = getPriorityColors(req.nivel);
                    
                    return (
                      <div 
                        key={req.id} 
                        onClick={() => onViewDetail(req.id)}
                        className={`p-3 rounded-xl border border-gray-200 shadow-sm cursor-pointer transition-all ${priorityColors}`}
                      >
                        <div className="flex justify-between items-start mb-2">
                          <div className="flex items-center gap-1.5 bg-white/80 px-2 py-0.5 rounded border border-gray-200/50">
                            <Building size={10} className="text-gray-500" />
                            <span className="text-[10px] font-bold text-gray-700 uppercase truncate max-w-[120px]">{req.condominio_nome}</span>
                          </div>
                          <span className="text-[10px] font-bold text-gray-500 bg-white/50 px-1.5 py-0.5 rounded">{new Date(req.data_solicitacao).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })}</span>
                        </div>
                        
                        <div className="flex items-start gap-2 mb-2">
                            <p className="text-sm font-extrabold text-gray-900 leading-tight flex-1">{req.titulo}</p>
                            {unreadCount > 0 && (
                                <div 
                                  onClick={(e) => { e.stopPropagation(); onViewDetail(req.id, 'chat'); }}
                                  className="flex items-center gap-1 bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full border border-red-200 hover:bg-red-200 transition-colors flex-shrink-0"
                                  title={`${unreadCount} novas mensagens`}
                                >
                                    <MessageSquare size={10} className="fill-current" />
                                    <span className="text-[9px] font-bold">{unreadCount}</span>
                                </div>
                            )}
                        </div>
                        
                        <div className="flex flex-wrap items-center gap-2 mt-3">
                            <Badge status={req.status} className="scale-75 origin-left -ml-1" />
                            {hasAttachments && <Paperclip size={12} className="text-blue-500" />}
                            {req.nivel === RequestLevel.N1 && <AlertTriangle size={12} className="text-red-500" />}
                        </div>
                      </div>
                    );
                  })}
                  
                  {hasMore && (
                    <button 
                      onClick={() => toggleShowAll(column.id)}
                      className="w-full text-center py-2 text-xs font-bold text-gray-500 hover:text-gray-700 bg-white/50 rounded-lg border border-gray-200/50 transition-colors"
                    >
                      {isShowingAll ? 'Ver menos' : 'Ver mais'}
                    </button>
                  )}

                  {columnRequests.length === 0 && (
                    <div className="text-center py-6 text-gray-400 text-xs font-medium border-2 border-dashed border-gray-200 rounded-xl">
                      Nenhum pedido
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
