
export enum UserRole {
  ADMIN = 'ADMIN',
  CONDOMINIO = 'CONDOMINIO',
  SINDICO = 'SINDICO',
  FISCAL = 'FISCAL',
  OUTRO = 'OUTRO'
}

export interface User {
  id: string;
  nome: string;
  role: UserRole;
  condominio_id?: string;
  password?: string;
  sindico_nome?: string;
  sindico_cpf?: string;
  condominio_cnpj?: string;
  observacoes?: string;
}

export enum RequestStatus {
  NOVO = 'NOVO',
  EM_COTACAO = 'EM_COTACAO',
  ORCAMENTOS_PRONTOS = 'ORCAMENTOS_PRONTOS',
  AGUARDANDO_ACAO_CONDOMINIO = 'AGUARDANDO_ACAO_CONDOMINIO',
  EM_ANALISE_CONDOMINIO = 'EM_ANALISE_CONDOMINIO',
  APROVADO = 'APROVADO',
  RECUSADO = 'RECUSADO',
  REPROVADO_BRASILEIRO = 'REPROVADO_BRASILEIRO',
  EM_PEDIDO = 'EM_PEDIDO',
  AGUARDANDO_ENTREGA = 'AGUARDANDO_ENTREGA',
  CONCLUIDO = 'CONCLUIDO',
  CANCELADO = 'CANCELADO',
  REPROVADO_SEM_RESPOSTA = 'REPROVADO_SEM_RESPOSTA'
}

export enum RequestLevel {
  N1 = 'N1',
  N2 = 'N2',
  N3 = 'N3'
}

export enum RequestType {
  RECORRENTE = 'RECORRENTE',
  AVULSA_MELHORIA = 'AVULSA_MELHORIA'
}

export interface BudgetAttachment {
  id: string;
  path: string;
  publicUrl: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  uploadedAt: string;
}

export interface BudgetItem {
  id: string;
  description: string;
  unit: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface Orcamento {
  id: string;
  protocolo_orcamento: string;
  numero: number;
  fornecedor: string;
  supplier_id?: string;
  email_fornecedor?: string;
  valor: number;
  prazo_entrega?: string;
  condicoes_pagamento?: string;
  validade?: string;
  data_orcamento: string;
  observacoes?: string;
  items: BudgetItem[];
  attachments: BudgetAttachment[];
  recomendado: boolean;
  is_melhor_proposta: boolean;
  status_orcamento: string;
  version: number;
  audit_logs: any[];
  criterio_escolha?: string;
  justificativa_melhor_proposta?: string;
}

export interface CRMQuoteHistory {
  id: string;
  date: string;
  user_name: string;
  description: string;
}

export interface CRMQuoteItem {
  id: string;
  supplier_id?: string;
  supplier_name: string;
  contact_name?: string;
  phone?: string;
  whatsapp?: string;
  email?: string;
  activity_branch?: string;
  requested_at?: string;
  channel?: 'whatsapp' | 'email' | 'phone' | 'outro';
  sent_by_name?: string;
  promised_date?: string;
  status: 'NAO_SOLICITADO' | 'SOLICITADO' | 'AGUARDANDO_RETORNO' | 'RETORNOU' | 'RETORNOU_INCOMPLETO' | 'RECUSOU' | 'SEM_RESPOSTA' | 'LANCADO' | 'APROVADO' | 'NAO_ESCOLHIDO';
  value?: number;
  delivery_days?: string;
  payment_terms?: string;
  notes?: string;
  attachment_url?: string;
  attachment_name?: string;
  launched_budget_id?: string;
  history?: CRMQuoteHistory[];
}

export interface AssemblyData {
  required: boolean;
  status: string;
  crm_quotes?: CRMQuoteItem[];
}

export interface Message {
  id: string;
  request_id: string;
  content: string;
  sender_id: string;
  sender_role: UserRole;
  created_at: string;
  read_at?: string;
}

export interface Solicitacao {
  id: string;
  condominio_id: string;
  condominio_nome: string;
  responsavel_nome: string;
  data_solicitacao: string;
  titulo: string;
  descricao: string;
  tipo: RequestType;
  categoria: string;
  category_id?: string;
  nivel: RequestLevel;
  fora_do_prazo: boolean;
  status: RequestStatus;
  assembly_data?: AssemblyData;
  orcamentos: Orcamento[];
  orcamento_escolhido?: number;
  deadline_days?: number;
  due_at?: string;
  estimated_delivery_date?: string;
  data_decisao_condominio?: string;
  autorizado_por_nome?: string;
  autorizado_por_cargo?: string;
  justificativa_condominio?: string;
  justificativa_recusa?: string;
  justificativa_encerramento?: string;
  delivered_at?: string;
  attachments?: any[];
  historico?: LogEvento[];
  stock_generated_at?: string;
  generated_from_stock?: boolean;
  stock_control_enabled?: boolean;
  messages?: Message[];
  stock_replenishment_items?: any[];
}

export interface InventoryItem {
  id: string;
  condominio_id: string;
  category_id?: string;
  name: string;
  unit: string;
  min_level: number;
  ideal_level?: number;
  max_level?: number;
  current_qty: number;
  last_updated: string;
  last_supplier?: string;
  last_unit_price?: number;
  last_buy_qty?: number;
  status: 'NORMAL' | 'LOW' | 'EMPTY' | 'OVERSTOCK';
  media_duracao_dias?: number;
  ultima_reposicao?: string;
  proxima_reposicao_prevista?: string;
  confianca_previsao?: 'BAIXA' | 'MEDIA' | 'ALTA';
}

export interface InventoryMovement {
  id: string;
  item_id: string;
  condominio_id: string;
  type: 'IN' | 'OUT';
  qty: number;
  reason: string;
  request_id?: string;
  created_by_role: UserRole;
  created_at: string;
}

export interface PurchaseCategory {
  id: string;
  name: string;
  slug: string;
  active: boolean;
  color: string;
  default_type: 'BOTH' | 'PRODUCT' | 'SERVICE';
  requires_three_quotes: boolean;
  deadline_day_of_month?: number | null;
  requires_evidence: boolean;
  inventory_enabled: boolean;
  min_quote_business_days: number;
  icon?: string;
}

export interface PurchaseRecord {
  item_key: string;
  item_nome_original: string;
  condominio_id: string;
  data_compra: string;
  quantidade: number;
  valor_total: number;
}

export interface SupplierContract {
  has_contract: boolean;
  active: boolean;
  start_date?: string;
  end_date?: string;
}

export enum SupplierType {
  AVULSO = 'AVULSO',
  RECORRENTE = 'RECORRENTE',
  AMBOS = 'AMBOS'
}

export interface Supplier {
  id: string;
  name: string;
  legal_name?: string;
  cnpj?: string;
  activity_branch: string;
  supply_type: SupplierType;
  contact_name: string;
  phone: string;
  whatsapp?: string;
  email?: string;
  active: boolean;
  contract?: SupplierContract;
}

export interface CondoContact {
  id: string;
  condominio_id: string;
  name: string;
  phone: string;
  role: 'SINDICO' | 'FISCAL' | 'OUTRO';
  active: boolean;
}

export interface LogEvento {
  id: string;
  data: string;
  usuario_nome: string;
  descricao: string;
  status?: RequestStatus;
}

export interface AIReportAnalysis {
  diagnostico: string;
  gargalos: string[];
  riscos: string[];
  recomendacoes: string[];
  sugestao_estoque: string;
}

export interface AICondoAnalysis {
    diagnostico_geral: string;
    riscos_identificados: string[];
    acoes_imediatas: string[];
    sugestao_calendario_compras: string;
    oportunidades_economia: string[];
    checklist_operacional: string[];
}

export interface AIBudgetSuggestion {
  valor_estimado: number;
  prazo_entrega_dias: number;
  condicoes_pagamento: string;
  validade_orcamento: string;
  observacoes: string;
  resumo_recomendacao: string;
}

export interface StockItem extends InventoryItem {}
