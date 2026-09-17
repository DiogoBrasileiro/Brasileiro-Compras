
import React from 'react';
import { RequestStatus, RequestLevel } from './types';
import { 
  CheckCircle2, 
  Clock, 
  FileText, 
  Send,
  Inbox,
  Eye,
  ThumbsUp,
  Search,
  XCircle,
  Truck,
  ShoppingCart,
  AlertCircle
} from 'lucide-react';

export const STATUS_LABELS: Record<RequestStatus, string> = {
  [RequestStatus.NOVO]: "1. Novo",
  [RequestStatus.EM_COTACAO]: "2. Em Cotação",
  [RequestStatus.ORCAMENTOS_PRONTOS]: "3. Orçamentos Prontos",
  [RequestStatus.AGUARDANDO_ACAO_CONDOMINIO]: "4. Aguardando Recebimento",
  [RequestStatus.EM_ANALISE_CONDOMINIO]: "5. Em Análise (Cliente)",
  [RequestStatus.APROVADO]: "6. Aprovado",
  [RequestStatus.RECUSADO]: "Recusado",
  [RequestStatus.REPROVADO_BRASILEIRO]: "Reprovado pela Brasileiro",
  [RequestStatus.REPROVADO_SEM_RESPOSTA]: "Reprovado sem resposta",
  [RequestStatus.EM_PEDIDO]: "7. Em Pedido",
  [RequestStatus.AGUARDANDO_ENTREGA]: "8. Aguardando Entrega",
  [RequestStatus.CONCLUIDO]: "9. Concluído",
  
  [RequestStatus.CANCELADO]: "Cancelado",
};

export const STATUS_COLORS: Record<RequestStatus, string> = {
  [RequestStatus.NOVO]: "bg-gray-100 text-gray-700 border-gray-200",
  [RequestStatus.EM_COTACAO]: "bg-blue-100 text-blue-800 border-blue-200",
  [RequestStatus.ORCAMENTOS_PRONTOS]: "bg-indigo-100 text-indigo-800 border-indigo-200",
  [RequestStatus.AGUARDANDO_ACAO_CONDOMINIO]: "bg-yellow-100 text-yellow-800 border-yellow-200 animate-pulse",
  [RequestStatus.EM_ANALISE_CONDOMINIO]: "bg-orange-100 text-orange-800 border-orange-200",
  [RequestStatus.APROVADO]: "bg-green-100 text-green-800 border-green-200",
  [RequestStatus.RECUSADO]: "bg-red-100 text-red-800 border-red-200",
  [RequestStatus.REPROVADO_BRASILEIRO]: "bg-red-50 text-red-900 border-red-200 ring-1 ring-red-300",
  [RequestStatus.REPROVADO_SEM_RESPOSTA]: "bg-gray-500 text-white border-gray-600",
  [RequestStatus.EM_PEDIDO]: "bg-cyan-100 text-cyan-800 border-cyan-200",
  [RequestStatus.AGUARDANDO_ENTREGA]: "bg-teal-100 text-teal-800 border-teal-200",
  [RequestStatus.CONCLUIDO]: "bg-emerald-100 text-emerald-800 border-emerald-200",
  
  [RequestStatus.CANCELADO]: "bg-gray-200 text-gray-600 border-gray-300",
};

export const LEVEL_COLORS: Record<RequestLevel, string> = {
  [RequestLevel.N1]: "bg-red-600 text-white",
  [RequestLevel.N2]: "bg-blue-600 text-white",
  [RequestLevel.N3]: "bg-emerald-600 text-white",
};

export const LEVEL_LABELS: Record<RequestLevel, string> = {
  [RequestLevel.N1]: "N1 - Emergencial",
  [RequestLevel.N2]: "N2 - Operacional",
  [RequestLevel.N3]: "N3 - Planejável",
};

export const getStatusIcon = (status: RequestStatus) => {
  switch (status) {
    case RequestStatus.NOVO: return <Inbox size={16} />;
    case RequestStatus.EM_COTACAO: return <Search size={16} />;
    case RequestStatus.ORCAMENTOS_PRONTOS: return <FileText size={16} />;
    case RequestStatus.AGUARDANDO_ACAO_CONDOMINIO: return <Send size={16} />;
    case RequestStatus.EM_ANALISE_CONDOMINIO: return <Clock size={16} />;
    case RequestStatus.APROVADO: return <ThumbsUp size={16} />;
    case RequestStatus.RECUSADO: return <XCircle size={16} />;
    case RequestStatus.REPROVADO_BRASILEIRO: return <XCircle size={16} />;
    case RequestStatus.REPROVADO_SEM_RESPOSTA: return <XCircle size={16} />;
    case RequestStatus.EM_PEDIDO: return <ShoppingCart size={16} />;
    case RequestStatus.AGUARDANDO_ENTREGA: return <Truck size={16} />;
    case RequestStatus.CONCLUIDO: return <CheckCircle2 size={16} />;
    case RequestStatus.CANCELADO: return <XCircle size={16} />;
    default: return <FileText size={16} />;
  }
};

export const LOGO_URL = "./logo.png";
