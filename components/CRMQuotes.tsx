import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { Solicitacao, Supplier, CRMQuoteItem, CRMQuoteHistory, Orcamento, UserRole } from '../types';
import { 
  Building, Phone, Mail, MessageSquare, Clipboard, Send, Plus, Search, 
  Trash2, Edit2, CheckCircle2, AlertTriangle, Clock, RefreshCw, Filter, 
  Briefcase, Activity, Calendar, Download, ExternalLink, ArrowRight, X, 
  Paperclip, Globe, Eye
} from 'lucide-react';
import { uploadBudgetFile } from '../services/storageService';
import { SupplierQuoteRequestModal } from './SupplierQuoteRequestModal';

interface CRMQuotesProps {
  request: Solicitacao;
}

export const PRETTY_CRM_STATUS: Record<string, string> = {
  NAO_SOLICITADO: 'Não solicitado',
  SOLICITADO: 'Solicitado',
  AGUARDANDO_RETORNO: 'Aguardando retorno',
  RETORNOU: 'Retornou',
  RETORNOU_INCOMPLETO: 'Retornou incompleto',
  RECUSOU: 'Recusou enviar',
  SEM_RESPOSTA: 'Sem resposta',
  LANCADO: 'Orçamento lançado',
  APROVADO: 'Aprovado',
  NAO_ESCOLHIDO: 'Não escolhido'
};

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

export default function CRMQuotes({ request }: CRMQuotesProps) {
  const { suppliers, addSupplier, updateRequest, saveBudget, currentUser } = useApp();

  // Internal Quote State (stored in assembly_data.crm_quotes)
  const quotesList = useMemo(() => {
    return (request.assembly_data?.crm_quotes || []) as CRMQuoteItem[];
  }, [request.assembly_data]);

  // General Component States
  const [activeView, setActiveView] = useState<'list' | 'funnel'>('list');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'name' | 'requested_at' | 'promised_date' | 'status' | 'value'>('requested_at');
  const [searchTerm, setSearchTerm] = useState('');

  // Modals / Wizards
  const [isNewSupOpen, setIsNewSupOpen] = useState(false);
  const [isGeneratorOpen, setIsGeneratorOpen] = useState(false);
  const [isLogQuoteOpen, setIsLogQuoteOpen] = useState(false);
  const [selectedQuote, setSelectedQuote] = useState<CRMQuoteItem | null>(null);

  // Dedicated Supplier Quote Request Modal State
  const [isQuoteRequestModalOpen, setIsQuoteRequestModalOpen] = useState(false);
  const [quoteRequestSupplierId, setQuoteRequestSupplierId] = useState<string | undefined>(undefined);
  const [quoteRequestMode, setQuoteRequestMode] = useState<'REQUEST' | 'REMINDER'>('REQUEST');

  const handleOpenSupplierQuoteRequest = (supplierId?: string, mode: 'REQUEST' | 'REMINDER' = 'REQUEST') => {
    setQuoteRequestSupplierId(supplierId);
    setQuoteRequestMode(mode);
    setIsQuoteRequestModalOpen(true);
  };

  // Auto-generation Text Setup
  const [generatedText, setGeneratedText] = useState('');

  // New Supplier form state
  const [newSupplierForm, setNewSupplierForm] = useState({
    useExisting: true,
    selectedId: '',
    name: '',
    contact_name: '',
    phone: '',
    whatsapp: '',
    email: '',
    activity_branch: '',
    saveToGlobal: true
  });

  // Log response / officialize budget state
  const [logResponseForm, setLogResponseForm] = useState({
    status: 'RETORNOU' as CRMQuoteItem['status'],
    value: 0,
    delivery_days: '',
    payment_terms: '',
    notes: '',
    attachmentFile: null as File | null,
    attachmentUrl: '',
    attachmentName: '',
    isUploading: false,
    officializeBudget: false
  });

  // Format currency helper
  const formatCurrency = (val?: number) => {
    if (!val) return 'R$ 0,00';
    return val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  // Helper: check if a supplier quote is highlighting a warning / delay (Ex: requested 3 days ago & no response)
  const getIsDelayed = (quote: CRMQuoteItem) => {
    if (!quote.requested_at) return false;
    const reqDate = new Date(quote.requested_at);
    const daysSince = Math.floor((Date.now() - reqDate.getTime()) / (1000 * 60 * 60 * 24));
    
    const isPending = ['SOLICITADO', 'AGUARDANDO_RETORNO'].includes(quote.status);
    return isPending && daysSince >= 2; // more than 2 days without response is delayed / needs cobranca
  };

  // 1. CALCULATE CRM COUNTERS
  const counters = useMemo(() => {
    const totalAcionados = quotesList.filter(q => q.status !== 'NAO_SOLICITADO').length;
    const responderam = quotesList.filter(q => ['RETORNOU', 'RETORNOU_INCOMPLETO', 'LANCADO', 'APROVADO'].includes(q.status)).length;
    const faltamResponder = quotesList.filter(q => ['SOLICITADO', 'AGUARDANDO_RETORNO'].includes(q.status)).length;
    const semResposta = quotesList.filter(q => q.status === 'SEM_RESPOSTA').length;
    const lancadosOficiais = quotesList.filter(q => q.status === 'LANCADO' || q.status === 'APROVADO').length;
    const descartados = quotesList.filter(q => q.status === 'NAO_ESCOLHIDO').length;
    const aprovados = quotesList.filter(q => q.status === 'APROVADO').length;

    return {
      totalAcionados,
      responderam,
      faltamResponder,
      semResposta,
      lancadosOficiais,
      descartados,
      aprovados
    };
  }, [quotesList]);

  // 2. HELPER TO SAVE CRM QUOTES LIST BACK TO REQUEST
  const saveCRMQuotes = async (updatedList: CRMQuoteItem[], logDescription?: string) => {
    const currentHist = request.historico || [];
    let updatedHist = [...currentHist];
    if (logDescription) {
      updatedHist.push({
        id: `log-${Date.now()}`,
        data: new Date().toISOString(),
        usuario_nome: currentUser?.nome || 'Operador',
        descricao: logDescription,
        status: request.status
      });
    }

    try {
      await updateRequest(request.id, {
        assembly_data: {
          ...request.assembly_data,
          required: request.assembly_data?.required || false,
          status: request.assembly_data?.status || '',
          crm_quotes: updatedList
        },
        historico: updatedHist
      });
    } catch (e) {
      console.error("Erro ao persistir cotações no banco:", e);
      alert("Houve um problema de persistência ao salvar as cotações.");
    }
  };

  // 3. ACTION: OPEN TEXT GENERATOR
  const handleOpenGenerator = (supplierName?: string) => {
    // Generate text base
    let itemsText = '';
    if (request.stock_replenishment_items && request.stock_replenishment_items.length > 0) {
      itemsText = request.stock_replenishment_items.map((it: any) => `- ${it.name}: ${it.qty || it.current_qty || 1} ${it.unit || 'un'}`).join('\n');
    } else {
      itemsText = request.descricao;
    }

    const deadDays = request.deadline_days || 3;
    const targetSup = supplierName ? ` para a empresa *${supplierName}*` : '';

    const text = `Olá, tudo bem?\n\nPreciso de um orçamento${targetSup} referente ao *Condomínio ${request.condominio_nome}*.\n\n*Pedido / Projeto:* ${request.titulo}\n\n*Itens e especificações solicitados:*\n${itemsText}\n\n*Prazo máximo sugerido para retorno:* ${deadDays} dias úteis (${new Date(Date.now() + deadDays * 24 * 60 * 60 * 1000).toLocaleDateString('pt-BR')})\n\nPor favor, envie sua proposta comercial preenchida com valores unitários, prazo de entrega e condições de pagamento desejados.\n\nAgradeço e fico no aguardo!`;
    
    setGeneratedText(text);
    setIsGeneratorOpen(true);
  };

  const handleCopyText = () => {
    navigator.clipboard.writeText(generatedText);
    alert('Texto de solicitação copiado com sucesso para a área de transferência!');
  };

  const handleOpenWhatsapp = (phone?: string) => {
    navigator.clipboard.writeText(generatedText);
    const cleanPhone = phone ? phone.replace(/[^\D]/g, '') : '';
    const textEncoded = encodeURIComponent(generatedText);
    const url = cleanPhone 
      ? `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${textEncoded}`
      : `https://api.whatsapp.com/send?text=${textEncoded}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const handleOpenEmail = (email?: string) => {
    const subject = encodeURIComponent(`Solicitação de Cotação - Condomínio ${request.condominio_nome}`);
    const body = encodeURIComponent(generatedText);
    const mailToUrl = email 
      ? `mailto:${email}?subject=${subject}&body=${body}`
      : `mailto:?subject=${subject}&body=${body}`;
    window.open(mailToUrl, '_blank');
  };

  // 4. ACTION: LINK SUPPLIER (And optionally add to global roster)
  const handleAddSupplierRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    let supName = '';
    let supId = '';
    let supPhone = '';
    let supWhatsapp = '';
    let supEmail = '';
    let supBranch = '';
    let supContact = '';

    if (newSupplierForm.useExisting) {
      if (!newSupplierForm.selectedId) return alert("Selecione um fornecedor existente.");
      const existing = suppliers.find(s => s.id === newSupplierForm.selectedId);
      if (!existing) return;
      supName = existing.name;
      supId = existing.id;
      supPhone = existing.phone;
      supWhatsapp = existing.whatsapp || existing.phone;
      supEmail = existing.email || '';
      supBranch = existing.activity_branch || '';
      supContact = existing.contact_name || '';
    } else {
      if (!newSupplierForm.name.trim()) return alert("Digite o nome do fornecedor.");
      supName = newSupplierForm.name.trim();
      supPhone = newSupplierForm.phone;
      supWhatsapp = newSupplierForm.whatsapp || newSupplierForm.phone;
      supEmail = newSupplierForm.email;
      supBranch = newSupplierForm.activity_branch;
      supContact = newSupplierForm.contact_name;

      if (newSupplierForm.saveToGlobal) {
        // save to global context of suppliers
        try {
          supId = await addSupplier({
            name: supName,
            contact_name: supContact,
            phone: supPhone,
            whatsapp: supWhatsapp,
            email: supEmail,
            activity_branch: supBranch,
            supply_type: 'AVULSO' as any,
            active: true
          });
        } catch (err) {
          console.error("Erro ao salvar no banco geral de fornecedores", err);
          supId = `crm-gen-${Date.now()}`;
        }
      } else {
        supId = `crm-loc-${Date.now()}`;
      }
    }

    // Check duplicate
    if (quotesList.some(q => q.supplier_id === supId || q.supplier_name.toLowerCase() === supName.toLowerCase())) {
      return alert("Este fornecedor já está vinculado a cotação deste pedido.");
    }

    // Add list item
    const newItem: CRMQuoteItem = {
      id: `quote-${Date.now()}`,
      supplier_id: supId,
      supplier_name: supName,
      contact_name: supContact,
      phone: supPhone,
      whatsapp: supWhatsapp,
      email: supEmail,
      activity_branch: supBranch,
      status: 'NAO_SOLICITADO',
      history: [{
        id: `hist-${Date.now()}`,
        date: new Date().toISOString(),
        user_name: currentUser?.nome || 'Operador',
        description: 'Fornecedor vinculado ao pedido para cotação.'
      }]
    };

    const nextList = [...quotesList, newItem];
    await saveCRMQuotes(nextList, `Vinculou fornecedor ${supName} para CRM de cotações.`);
    
    // reset form
    setNewSupplierForm({
      useExisting: true,
      selectedId: '',
      name: '',
      contact_name: '',
      phone: '',
      whatsapp: '',
      email: '',
      activity_branch: '',
      saveToGlobal: true
    });
    setIsNewSupOpen(false);
  };

  // 5. REMOVE SUPPLIER QUOTE VINCLE
  const handleRemoveQuote = async (id: string, name: string) => {
    if (!confirm(`Tem certeza que deseja desvincular o fornecedor ${name} deste painel de cotações?`)) return;
    const nextList = quotesList.filter(q => q.id !== id);
    await saveCRMQuotes(nextList, `Removeu fornecedor ${name} do CRM de cotações.`);
  };

  // 6. UPDATE CRM STATUS QUICKLY
  const handleUpdateStatus = async (quoteId: string, newStatus: CRMQuoteItem['status'], quickNotes?: string) => {
    const nextList = quotesList.map(q => {
      if (q.id === quoteId) {
        const hist: CRMQuoteHistory = {
          id: `hist-${Date.now()}`,
          date: new Date().toISOString(),
          user_name: currentUser?.nome || 'Operador',
          description: `Alterou status para: ${PRETTY_CRM_STATUS[newStatus]}${quickNotes ? ` (${quickNotes})` : ''}`
        };
        const updatedHistory = [...(q.history || []), hist];

        return {
          ...q,
          status: newStatus,
          requested_at: newStatus === 'SOLICITADO' ? new Date().toISOString() : q.requested_at,
          sent_by_name: newStatus === 'SOLICITADO' ? (currentUser?.nome || 'Operador') : q.sent_by_name,
          channel: newStatus === 'SOLICITADO' ? ('whatsapp' as any) : q.channel,
          history: updatedHistory
        };
      }
      return q;
    });

    const target = quotesList.find(q => q.id === quoteId);
    await saveCRMQuotes(nextList, `Atualizou cotação do fornecedor ${target?.supplier_name} para ${PRETTY_CRM_STATUS[newStatus]}`);
  };

  // 7. PREPARE MODAL TO LOG RESPONSE
  const handleOpenLogResponse = (quote: CRMQuoteItem) => {
    setSelectedQuote(quote);
    setLogResponseForm({
      status: quote.status === 'NAO_SOLICITADO' || quote.status === 'SOLICITADO' || quote.status === 'AGUARDANDO_RETORNO' ? 'RETORNOU' : quote.status,
      value: quote.value || 0,
      delivery_days: quote.delivery_days || '',
      payment_terms: quote.payment_terms || '',
      notes: quote.notes || '',
      attachmentFile: null,
      attachmentUrl: quote.attachment_url || '',
      attachmentName: quote.attachment_name || '',
      isUploading: false,
      officializeBudget: quote.status === 'LANCADO' || quote.status === 'APROVADO'
    });
    setIsLogQuoteOpen(true);
  };

  // Handle Response Attachment upload
  const handleResponseFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedQuote) return;

    setLogResponseForm(prev => ({ ...prev, isUploading: true }));
    const condoId = request.condominio_id || 'geral';
    
    try {
      const result = await uploadBudgetFile(file, condoId, request.id, `crm-${selectedQuote.id}`);
      if (result) {
        setLogResponseForm(prev => ({
          ...prev,
          attachmentUrl: result.publicUrl,
          attachmentName: result.fileName,
          isUploading: false
        }));
      } else {
        alert("Erro no upload do arquivo.");
        setLogResponseForm(prev => ({ ...prev, isUploading: false }));
      }
    } catch (err) {
      console.error(err);
      alert("Houve uma falha ao processar o arquivo.");
      setLogResponseForm(prev => ({ ...prev, isUploading: false }));
    }
  };

  // 8. FINAL SAVE RESPONSE & OFFICIALIZE BUDGET
  const handleSaveResponse = async () => {
    if (!selectedQuote) return;

    // Validate if officialize is checked
    if (logResponseForm.officializeBudget && logResponseForm.status !== 'RECUSOU' && logResponseForm.status !== 'SEM_RESPOSTA') {
      if (logResponseForm.value <= 0) {
        return alert("Para lançar um orçamento oficial, informe o valor total do orçamento.");
      }
    }

    let finalStatus = logResponseForm.status;
    let budgetId = selectedQuote.launched_budget_id || '';

    // A. If "officializeBudget" is marked and status is acceptable, we turn it into an official budget
    if (logResponseForm.officializeBudget && ['RETORNOU', 'RETORNOU_INCOMPLETO', 'LANCADO', 'APROVADO'].includes(finalStatus)) {
      // Set state to launched unless approved
      if (finalStatus !== 'APROVADO') {
        finalStatus = 'LANCADO';
      }

      // Generate next official number
      const currentOfficialBudgetsCount = request.orcamentos?.length || 0;
      const nextNumero = currentOfficialBudgetsCount + 1;
      const proto = `ORC-${request.condominio_nome.substring(0,3).toUpperCase()}-${Date.now().toString().slice(-6)}`;

      const officialBudget: Orcamento = {
        id: budgetId || `orc-${Date.now()}`,
        protocolo_orcamento: proto,
        numero: nextNumero,
        fornecedor: selectedQuote.supplier_name,
        supplier_id: selectedQuote.supplier_id,
        email_fornecedor: selectedQuote.email,
        valor: logResponseForm.value,
        prazo_entrega: logResponseForm.delivery_days ? `${logResponseForm.delivery_days} dias` : 'Não informado',
        condicoes_pagamento: logResponseForm.payment_terms || 'Não informado',
        data_orcamento: new Date().toISOString(),
        observacoes: logResponseForm.notes,
        items: [],
        attachments: logResponseForm.attachmentUrl ? [{
          id: `att-${Date.now()}`,
          path: '',
          publicUrl: logResponseForm.attachmentUrl,
          fileName: logResponseForm.attachmentName,
          fileType: 'PDF/Imagem',
          fileSize: 1024,
          uploadedAt: new Date().toISOString()
        }] : [],
        recomendado: false,
        is_melhor_proposta: false,
        status_orcamento: 'CADASTRADO',
        version: 1,
        audit_logs: []
      };

      try {
        await saveBudget(request.id, officialBudget);
        budgetId = officialBudget.id;
      } catch (err) {
        console.error("Erro ao salvar orçamento oficial:", err);
        return alert("Não foi possível registrar o orçamento oficial.");
      }
    }

    // B. Save to CRM Quote structure
    const updatedList = quotesList.map(q => {
      if (q.id === selectedQuote.id) {
        const h: CRMQuoteHistory = {
          id: `hist-${Date.now()}`,
          date: new Date().toISOString(),
          user_name: currentUser?.nome || 'Operador',
          description: `Orçamento registrado: ${formatCurrency(logResponseForm.value)} | Status: ${PRETTY_CRM_STATUS[finalStatus]}`
        };

        return {
          ...q,
          status: finalStatus,
          value: logResponseForm.value,
          delivery_days: logResponseForm.delivery_days,
          payment_terms: logResponseForm.payment_terms,
          notes: logResponseForm.notes,
          attachment_url: logResponseForm.attachmentUrl,
          attachment_name: logResponseForm.attachmentName,
          launched_budget_id: budgetId || undefined,
          history: [...(q.history || []), h]
        };
      }
      return q;
    });

    await saveCRMQuotes(updatedList, `Registrou resposta do fornecedor ${selectedQuote.supplier_name}. Valor: ${formatCurrency(logResponseForm.value)}.`);
    setIsLogQuoteOpen(false);
    setSelectedQuote(null);
  };

  // 9. FILTER AND SORT CRITERIAS FOR CRM LIST
  const filteredAndSortedQuotes = useMemo(() => {
    let result = [...quotesList];

    // Search filter
    if (searchTerm.trim()) {
      const qLower = searchTerm.toLowerCase();
      result = result.filter(q => 
        q.supplier_name.toLowerCase().includes(qLower) || 
        (q.contact_name && q.contact_name.toLowerCase().includes(qLower)) ||
        (q.notes && q.notes.toLowerCase().includes(qLower))
      );
    }

    // Status category filter
    if (filterStatus !== 'all') {
      if (filterStatus === 'pendente') {
        result = result.filter(q => ['SOLICITADO', 'AGUARDANDO_RETORNO'].includes(q.status));
      } else if (filterStatus === 'respondido') {
        result = result.filter(q => ['RETORNOU', 'RETORNOU_INCOMPLETO', 'LANCADO', 'APROVADO'].includes(q.status));
      } else if (filterStatus === 'atrasado') {
        result = result.filter(q => getIsDelayed(q));
      } else {
        result = result.filter(q => q.status === filterStatus);
      }
    }

    // Sort order
    result.sort((a, b) => {
      if (sortBy === 'name') {
        return a.supplier_name.localeCompare(b.supplier_name);
      }
      if (sortBy === 'status') {
        return a.status.localeCompare(b.status);
      }
      if (sortBy === 'value') {
        return (a.value || 0) - (b.value || 0);
      }
      if (sortBy === 'promised_date') {
        const da = a.promised_date ? new Date(a.promised_date).getTime() : 0;
        const db = b.promised_date ? new Date(b.promised_date).getTime() : 0;
        return da - db;
      }
      // default: requested_at
      const da = a.requested_at ? new Date(a.requested_at).getTime() : 0;
      const db = b.requested_at ? new Date(b.requested_at).getTime() : 0;
      return db - da; // most recent first
    });

    return result;
  }, [quotesList, searchTerm, filterStatus, sortBy]);

  // List of funnel stage columns
  const funnelStages = [
    { key: 'NAO_SOLICITADO', title: 'Não solicitados', bg: 'bg-zinc-50 border-zinc-200' },
    { key: 'SOLICITADO', title: 'Solicitados / Pendentes', bg: 'bg-indigo-50/50 border-indigo-100' },
    { key: 'RETORNOU', title: 'Respondidos', bg: 'bg-emerald-50/50 border-emerald-100' },
    { key: 'LANCADO', title: 'Lançados no Pedido', bg: 'bg-blue-50/50 border-blue-100' },
    { key: 'OUTROS', title: 'Outros (Recusado / Não escol.)', bg: 'bg-gray-100/70 border-gray-200' }
  ];

  const getFunnelStageList = (stageKey: string) => {
    if (stageKey === 'OUTROS') {
      return quotesList.filter(q => ['RETORNOU_INCOMPLETO', 'RECUSOU', 'SEM_RESPOSTA', 'NAO_ESCOLHIDO'].includes(q.status));
    }
    if (stageKey === 'SOLICITADO') {
      return quotesList.filter(q => ['SOLICITADO', 'AGUARDANDO_RETORNO'].includes(q.status));
    }
    if (stageKey === 'RETORNOU') {
      return quotesList.filter(q => q.status === 'RETORNOU' || q.status === 'APROVADO');
    }
    return quotesList.filter(q => q.status === stageKey);
  };

  return (
    <div className="space-y-6">
      {/* HEADER CONTROLS */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-4 rounded-2xl border border-gray-100">
        <div>
          <h2 className="text-xl font-extrabold text-gray-900 flex items-center gap-2">
            <Briefcase className="text-brand-600" /> CRM de Cotações com Fornecedores
          </h2>
          <p className="text-xs text-gray-500 mt-1">
            Controle e organize internamente os orçamentos solicitados aos fornecedores antes de oficializar na cotação.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={() => handleOpenSupplierQuoteRequest(undefined, 'REQUEST')}
            className="flex items-center gap-2 bg-gradient-to-r from-emerald-600 to-teal-700 text-white font-bold px-4 py-2.5 rounded-xl hover:from-emerald-700 hover:to-teal-800 transition-all text-xs shadow-md"
          >
            <Send size={14} /> Solicitar Orçamento ao Fornecedor
          </button>
          <button 
            onClick={() => {
              setNewSupplierForm(prev => ({ ...prev, useExisting: true, selectedId: '' }));
              setIsNewSupOpen(true);
            }}
            className="flex items-center gap-2 bg-brand-600 text-white font-bold px-4 py-2.5 rounded-xl hover:bg-brand-700 transition-all text-xs shadow-md"
          >
            <Plus size={14} /> Vincular Fornecedor
          </button>
        </div>
      </div>

      {/* METRIC CARDS / CONTADORES */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        <div className="bg-white border p-3 rounded-xl shadow-sm hover:border-gray-300 transition-all">
          <p className="text-[10px] uppercase font-extrabold text-gray-500">Acionados</p>
          <p className="text-xl font-extrabold text-indigo-700 mt-1">{counters.totalAcionados}</p>
          <span className="text-[9px] text-zinc-400 mt-0.5 block">Total de solicitações</span>
        </div>
        <div className="bg-white border p-3 rounded-xl shadow-sm hover:border-gray-300 transition-all">
          <p className="text-[10px] uppercase font-extrabold text-gray-500 text-amber-500">Pendentes</p>
          <p className="text-xl font-extrabold text-amber-700 mt-1">{counters.faltamResponder}</p>
          <span className="text-[9px] text-zinc-400 mt-0.5 block">Aguardando envio/retorno</span>
        </div>
        <div className="bg-white border p-3 rounded-xl shadow-sm hover:border-gray-300 transition-all">
          <p className="text-[10px] uppercase font-extrabold text-gray-500 text-emerald-500">Responderam</p>
          <p className="text-xl font-extrabold text-emerald-700 mt-1">{counters.responderam}</p>
          <span className="text-[9px] text-zinc-400 mt-0.5 block">Retorno recebido</span>
        </div>
        <div className="bg-white border p-3 rounded-xl shadow-sm hover:border-gray-300 transition-all">
          <p className="text-[10px] uppercase font-extrabold text-gray-500 text-red-500">Sem Resposta</p>
          <p className="text-xl font-extrabold text-red-700 mt-1">{counters.semResposta}</p>
          <span className="text-[9px] text-zinc-400 mt-0.5 block">Prazo expirado</span>
        </div>
        <div className="bg-white border p-3 rounded-xl shadow-sm hover:border-gray-300 transition-all">
          <p className="text-[10px] uppercase font-extrabold text-gray-500 text-blue-500 font-mono">No Pedido</p>
          <p className="text-xl font-extrabold text-blue-700 mt-1">{counters.lancadosOficiais}</p>
          <span className="text-[9px] text-zinc-400 mt-0.5 block">Oficializados no pedido</span>
        </div>
        <div className="bg-white border p-3 rounded-xl shadow-sm hover:border-gray-300 transition-all col-span-1">
          <p className="text-[10px] uppercase font-extrabold text-green-600">Aprovados</p>
          <p className="text-xl font-extrabold text-green-700 mt-1">{counters.aprovados}</p>
          <span className="text-[9px] text-zinc-400 mt-0.5 block">Vencedor selecionado</span>
        </div>
        <div className="bg-white border p-3 rounded-xl shadow-sm hover:border-gray-300 transition-all col-span-1">
          <p className="text-[10px] uppercase font-extrabold text-gray-400">Descartados</p>
          <p className="text-xl font-extrabold text-gray-500 mt-1">{counters.descartados}</p>
          <span className="text-[9px] text-zinc-400 mt-0.5 block">Não escolhidos</span>
        </div>
      </div>

      {/* VIEW TABS AND FILTERS */}
      <div className="bg-white p-4 rounded-2xl border border-gray-100 flex flex-col md:flex-row gap-4 items-center justify-between">
        {/* Toggle list or funnel */}
        <div className="flex border rounded-lg overflow-hidden shrink-0">
          <button 
            onClick={() => setActiveView('list')}
            className={`px-4 py-2 text-xs font-bold transition-all ${activeView === 'list' ? 'bg-zinc-900 text-white' : 'bg-gray-50 text-gray-600 hover:bg-gray-100'}`}
          >
            Lista de Fornecedores
          </button>
          <button 
            onClick={() => setActiveView('funnel')}
            className={`px-4 py-2 text-xs font-bold transition-all ${activeView === 'funnel' ? 'bg-zinc-900 text-white' : 'bg-gray-50 text-gray-600 hover:bg-gray-100'}`}
          >
            Funil Visual (Pipeline)
          </button>
        </div>

        {/* Search & filters (Only shown or adapted) */}
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto justify-end">
          <div className="relative flex-1 md:flex-initial">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input 
              type="text"
              placeholder="Pesquisar fornecedor..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 pr-3 py-2 border rounded-xl text-xs w-full min-w-[180px] focus:outline-none focus:ring-1 focus:ring-brand-500 focus:border-brand-500"
            />
          </div>

          <div className="flex items-center gap-1.5 shrink-0 border-l pl-3">
            <Filter size={12} className="text-gray-400" />
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="border rounded-xl text-xs py-2 px-1 focus:outline-none bg-white"
            >
              <option value="all">Filtros Rápidos</option>
              <option value="all">Todos ({quotesList.length})</option>
              <option value="NAO_SOLICITADO">Não Solicitado</option>
              <option value="pendente">Aguardando Retorno / Solicitados ({counters.faltamResponder})</option>
              <option value="respondido">Respondidos ({counters.responderam})</option>
              <option value="atrasado">Atrasados (Sem retorno +2 dias)</option>
              <option value="LANCADO">Lançados no Pedido</option>
              <option value="APROVADO">Aprovados</option>
              <option value="RECUSOU">Recusaram</option>
            </select>
          </div>

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="border rounded-xl text-xs py-2 px-2 bg-white shrink-0"
          >
            <option value="requested_at">Ordenar: Mais recentes</option>
            <option value="name">Ordenar: Nome Fornecedor</option>
            <option value="status">Ordenar: Status</option>
            <option value="value">Ordenar: Valor</option>
            <option value="promised_date">Ordenar: Prazo Resposta</option>
          </select>
        </div>
      </div>

      {/* MAIN CRM DASHBOARD VIEWS */}
      {quotesList.length === 0 ? (
        <div className="bg-white border rounded-2xl p-12 text-center max-w-xl mx-auto">
          <Briefcase size={40} className="mx-auto text-gray-300 mb-3" />
          <h3 className="text-base font-bold text-gray-900">CRM de Cotações Vazio</h3>
          <p className="text-xs text-gray-500 mt-1 max-w-sm mx-auto">
            Este pedido ainda não tem fornecedores vinculados para cotação interna. Clique no botão "Vincular Fornecedor" para começar.
          </p>
          <div className="mt-4 flex justify-center gap-3">
            <button 
              onClick={() => {
                setNewSupplierForm(prev => ({ ...prev, useExisting: true, selectedId: '' }));
                setIsNewSupOpen(true);
              }}
              className="bg-brand-600 text-white font-bold px-4 py-2 rounded-xl text-xs hover:bg-brand-700 transition"
            >
              Começar a Cotar
            </button>
          </div>
        </div>
      ) : activeView === 'list' ? (
        /* LIST VIEW */
        <div className="bg-white border rounded-2xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-gray-50 border-b text-gray-500 font-bold uppercase tracking-wider">
                  <th className="p-4">Fornecedor</th>
                  <th className="p-4">Contato</th>
                  <th className="p-4">Data Envio</th>
                  <th className="p-4">Canal / Responsável</th>
                  <th className="p-4">Status Interno</th>
                  <th className="p-4 text-right">Orçamento C CRM</th>
                  <th className="p-4 text-center">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y text-gray-700">
                {filteredAndSortedQuotes.map((quote) => {
                  const isDelayed = getIsDelayed(quote);
                  return (
                    <tr 
                      key={quote.id} 
                      className={`hover:bg-gray-50/50 transition-colors ${isDelayed ? 'bg-red-50/20' : ''}`}
                    >
                      <td className="p-4">
                        <div className="font-bold text-gray-900 text-sm flex items-center gap-1.5">
                          {quote.supplier_name}
                          {isDelayed && (
                            <span className="bg-red-100 text-red-800 text-[9px] font-bold px-1.5 py-0.5 rounded-full animate-pulse flex items-center gap-0.5">
                              <AlertTriangle size={8} /> Cobrar!
                            </span>
                          )}
                        </div>
                        {quote.activity_branch && (
                          <span className="text-[10px] text-gray-400 block mt-0.5">{quote.activity_branch}</span>
                        )}
                      </td>
                      <td className="p-4">
                        <div className="font-medium text-gray-900">{quote.contact_name || '(Sem nome)'}</div>
                        <div className="flex items-center gap-2 mt-1 text-[10px] text-gray-400">
                          {quote.whatsapp && (
                            <button 
                              onClick={() => {
                                handleOpenGenerator(quote.supplier_name);
                                setTimeout(() => handleOpenWhatsapp(quote.whatsapp), 300);
                              }}
                              className="hover:text-emerald-600 transition flex items-center gap-0.5 font-bold"
                              title="Chamar WhatsApp"
                            >
                              <Phone size={10} className="text-emerald-500" /> {quote.whatsapp}
                            </button>
                          )}
                          {quote.email && (
                            <button 
                              onClick={() => {
                                handleOpenGenerator(quote.supplier_name);
                                setTimeout(() => handleOpenEmail(quote.email), 300);
                              }}
                              className="hover:text-blue-600 transition flex items-center gap-0.5 font-bold ml-1"
                              title="Enviar E-mail"
                            >
                              <Mail size={10} className="text-blue-500" /> Email
                            </button>
                          )}
                        </div>
                      </td>
                      <td className="p-4 whitespace-nowrap">
                        {quote.requested_at ? (
                          <div>
                            <span className="font-medium">{new Date(quote.requested_at).toLocaleDateString('pt-BR')}</span>
                            <span className="text-[10px] text-gray-400 block mt-0.5">
                              {Math.floor((Date.now() - new Date(quote.requested_at).getTime()) / (1000 * 60 * 60 * 24))} dias atrás
                            </span>
                          </div>
                        ) : (
                          <button 
                            onClick={() => handleUpdateStatus(quote.id, 'SOLICITADO')}
                            className="text-indigo-600 font-bold hover:underline"
                          >
                            Marcar como Enviado
                          </button>
                        )}
                      </td>
                      <td className="p-4">
                        {quote.channel ? (
                          <div>
                            <span className="capitalize font-medium block text-gray-800">{quote.channel}</span>
                            <span className="text-[10px] text-gray-400 block mt-0.5">{quote.sent_by_name || 'Brasileiro'}</span>
                          </div>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="p-4 whitespace-nowrap">
                        <div className="flex flex-col gap-1.5">
                          <select
                            value={quote.status}
                            onChange={(e) => handleUpdateStatus(quote.id, e.target.value as any)}
                            className={`border text-[11px] font-bold rounded-lg px-2 py-1 shadow-sm focus:outline-none ${CRM_STATUS_COLORS[quote.status]}`}
                          >
                            {Object.entries(PRETTY_CRM_STATUS).map(([k, v]) => (
                              <option key={k} value={k}>{v}</option>
                            ))}
                          </select>
                        </div>
                      </td>
                      <td className="p-4 text-right whitespace-nowrap">
                        {quote.value ? (
                          <div>
                            <span className="font-extrabold text-sm text-gray-900 block">{formatCurrency(quote.value)}</span>
                            {quote.delivery_days && <span className="text-[10px] text-gray-400 block mt-0.5">{quote.delivery_days} d úteis</span>}
                          </div>
                        ) : (
                          <button 
                            onClick={() => handleOpenLogResponse(quote)}
                            className="bg-zinc-100 text-zinc-700 hover:bg-zinc-200 font-bold py-1 px-2.5 rounded-lg text-[10px]"
                          >
                            Registrar Resposta
                          </button>
                        )}
                      </td>
                      <td className="p-4 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1.5">
                          {['SOLICITADO', 'AGUARDANDO_RETORNO', 'SEM_RESPOSTA'].includes(quote.status) && (
                            <button 
                              onClick={() => handleOpenSupplierQuoteRequest(quote.supplier_id, 'REMINDER')}
                              className="p-1 px-2.5 bg-amber-50 hover:bg-amber-100 rounded-lg text-amber-800 font-bold flex items-center gap-1 border border-amber-200 text-[11px] shadow-xs transition"
                              title="Reenviar / Cobrar Orçamento pelo WhatsApp"
                            >
                              <RefreshCw size={11} className="text-amber-700" /> Cobrar
                            </button>
                          )}

                          <button 
                            onClick={() => handleOpenSupplierQuoteRequest(quote.supplier_id, 'REQUEST')}
                            className="p-1 px-2.5 bg-emerald-50 hover:bg-emerald-100 rounded-lg text-emerald-800 font-bold flex items-center gap-1 border border-emerald-200 text-[11px] shadow-xs transition"
                            title="Solicitar Orçamento / Baixar PDF"
                          >
                            <Send size={11} className="text-emerald-700" /> Solicitar
                          </button>

                          <button 
                            onClick={() => handleOpenLogResponse(quote)}
                            className="p-1 px-2 hover:bg-gray-100 rounded text-brand-600 font-bold flex items-center gap-0.5 text-[11px]"
                            title="Registrar resposta / Valores"
                          >
                            <Edit2 size={12} /> Registrar
                          </button>
                          
                          <button 
                            onClick={() => handleRemoveQuote(quote.id, quote.supplier_name)}
                            className="p-1 hover:bg-red-50 rounded text-red-500"
                            title="Excluir"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* KANBAN PIPELINE FUNNEL VIEW */
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
          {funnelStages.map((stage) => {
            const list = getFunnelStageList(stage.key);

            return (
              <div 
                key={stage.key} 
                className={`border rounded-2xl p-3 flex flex-col h-[400px] bg-slate-50 ${stage.bg}`}
              >
                <div className="flex items-center justify-between font-bold text-xs pb-2.5 border-b mb-3 border-gray-200">
                  <span className="text-gray-900 truncate pr-1">{stage.title}</span>
                  <span className="bg-zinc-200 text-zinc-700 font-bold px-1.5 py-0.5 rounded-md font-mono text-[10px]">
                    {list.length}
                  </span>
                </div>

                <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                  {list.length === 0 ? (
                    <div className="h-full flex items-center justify-center text-gray-400 text-[10px] text-center border border-dashed rounded-xl p-4 bg-white/40">
                      Nenhum nesta etapa
                    </div>
                  ) : (
                    list.map((item) => (
                      <div 
                        key={item.id} 
                        className="bg-white border rounded-xl p-3 shadow-xs hover:shadow-sm transition-all text-xs"
                      >
                        <div className="flex items-start justify-between gap-1.5">
                          <span className="font-bold text-gray-900 leading-snug">{item.supplier_name}</span>
                          <button 
                            onClick={() => handleRemoveQuote(item.id, item.supplier_name)}
                            className="text-gray-400 hover:text-red-500"
                          >
                            <X size={10} />
                          </button>
                        </div>

                        {item.activity_branch && (
                          <div className="text-[9px] text-gray-400 mt-0.5">{item.activity_branch}</div>
                        )}

                        <div className="mt-3 flex items-center justify-between border-t pt-2 gap-1.5">
                          <span className="text-[10px] font-extrabold text-indigo-700">
                            {item.value ? formatCurrency(item.value) : 'Pendente'}
                          </span>
                          
                          <button 
                            onClick={() => handleOpenLogResponse(item)}
                            className="text-[10px] text-brand-600 font-bold hover:underline"
                          >
                            Registrar
                          </button>
                        </div>

                        {/* Fast stage actions */}
                        <div className="grid grid-cols-2 gap-1 mt-2">
                          {item.status === 'NAO_SOLICITADO' && (
                            <button 
                              onClick={() => handleOpenSupplierQuoteRequest(item.supplier_id, 'REQUEST')} 
                              className="col-span-2 text-center text-[9px] bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-1 rounded flex items-center justify-center gap-1 shadow-xs"
                            >
                              <Send size={10} /> Solicitar Orçamento
                            </button>
                          )}
                          {['SOLICITADO', 'AGUARDANDO_RETORNO'].includes(item.status) && (
                            <>
                              <button 
                                onClick={() => handleOpenSupplierQuoteRequest(item.supplier_id, 'REMINDER')} 
                                className="col-span-2 text-center text-[9px] bg-amber-600 hover:bg-amber-700 text-white font-bold py-1 rounded flex items-center justify-center gap-1 shadow-xs"
                              >
                                <RefreshCw size={10} /> Cobrar Orçamento (WhatsApp)
                              </button>
                              <button 
                                onClick={() => handleUpdateStatus(item.id, 'RETORNOU')} 
                                className="text-center text-[8px] bg-emerald-600 text-white py-1 rounded font-bold"
                              >
                                Responderam
                              </button>
                              <button 
                                onClick={() => handleUpdateStatus(item.id, 'SEM_RESPOSTA')} 
                                className="text-center text-[8px] bg-red-100 text-red-700 py-1 rounded"
                              >
                                Sem Resposta
                              </button>
                            </>
                          )}
                          {item.status === 'RETORNOU' && (
                            <button 
                              onClick={() => handleOpenLogResponse(item)} 
                              className="col-span-2 text-center text-[9px] bg-blue-600 text-white py-1 rounded font-bold"
                            >
                              Lançar no Pedido
                            </button>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* CRM ACTIVITY REGISTER LOGS FOR TRACEABILITY */}
      <div className="bg-white p-5 border rounded-2xl shadow-xs">
        <h3 className="font-extrabold text-sm text-gray-900 mb-3 flex items-center gap-1.5 border-b pb-2">
          <Activity size={14} className="text-brand-600" /> Histórico Interno de Cotações
        </h3>
        <div className="space-y-3 max-h-[220px] overflow-y-auto pr-2">
          {quotesList.flatMap(q => (q.history || []).map(h => ({ ...h, supplier: q.supplier_name }))).length === 0 ? (
            <p className="text-xs text-gray-400 italic">Nenhum evento registrado ainda.</p>
          ) : (
            quotesList
              .flatMap(q => (q.history || []).map(h => ({ ...h, supplier: q.supplier_name })))
              .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()) // newer first
              .map(h => (
                <div key={h.id} className="text-xs flex items-start justify-between gap-3 border-b border-gray-50 pb-2">
                  <div>
                    <span className="font-bold text-brand-700">{h.supplier}</span> • <span>{h.description}</span>
                    <span className="text-[10px] text-gray-400 block mt-0.5 flex items-center gap-1">
                      Responsável: {h.user_name}
                    </span>
                  </div>
                  <span className="text-[10px] text-gray-400 shrink-0">
                    {new Date(h.date).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
                  </span>
                </div>
              ))
          )}
        </div>
      </div>

      {/* MODAL: SOLICITAR ORCAMENTO (TEXT GENERATOR BASE) */}
      {isGeneratorOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl border">
            <div className="bg-slate-900 text-white p-6 flex justify-between items-center">
              <div>
                <h3 className="font-extrabold text-lg flex items-center gap-2">
                  <MessageSquare /> Mensagem Pronta de Solicitação
                </h3>
                <p className="text-xs text-zinc-400 mt-1">Copiamos os dados do condomínio automaticamente para facilitar.</p>
              </div>
              <button 
                onClick={() => setIsGeneratorOpen(false)}
                className="text-zinc-400 hover:text-white transition"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1.5 uppercase">Texto Gerado (Dê o seu retoque antes de enviar)</label>
                <textarea
                  value={generatedText}
                  onChange={(e) => setGeneratedText(e.target.value)}
                  rows={10}
                  className="w-full text-xs font-mono p-3 border rounded-xl bg-slate-50 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                ></textarea>
              </div>

              {/* Botões rápidos de envio e cópia */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <button 
                  onClick={handleCopyText}
                  className="bg-zinc-100 hover:bg-zinc-200 text-zinc-900 font-bold py-3 px-4 rounded-xl text-xs flex items-center justify-center gap-2 transition"
                >
                  <Clipboard size={14} /> Copiar para Área
                </button>
                <button 
                  onClick={() => handleOpenWhatsapp()}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 px-4 rounded-xl text-xs flex items-center justify-center gap-2 transition"
                >
                  <Phone size={14} /> Abrir WhatsApp
                </button>
                <button 
                  onClick={() => handleOpenEmail()}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-4 rounded-xl text-xs flex items-center justify-center gap-2 transition"
                >
                  <Mail size={14} /> Enviar por E-mail
                </button>
              </div>
            </div>

            <div className="bg-gray-50 p-4 border-t flex justify-end">
              <button 
                onClick={() => setIsGeneratorOpen(false)}
                className="bg-white border text-gray-700 font-bold px-5 py-2 rounded-xl text-xs hover:bg-gray-100 transition shadow-sm"
              >
                Voltar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: VINCULAR NOVO / EXISTENTE FORNECEDOR */}
      {isNewSupOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <form 
            onSubmit={handleAddSupplierRequest}
            className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl border"
          >
            <div className="bg-zinc-900 text-white p-5 flex justify-between items-center">
              <div>
                <h3 className="font-extrabold text-base">Vincular Fornecedor à Cotação</h3>
                <p className="text-xs text-zinc-400 mt-1">Busque na base ativa ou cadastre um novo na hora.</p>
              </div>
              <button 
                type="button"
                onClick={() => setIsNewSupOpen(false)}
                className="text-zinc-400 hover:text-white transition"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {/* Type Switcher */}
              <div className="flex bg-gray-100 rounded-lg p-1">
                <button
                  type="button"
                  onClick={() => setNewSupplierForm(prev => ({ ...prev, useExisting: true }))}
                  className={`flex-1 py-1.5 text-xs font-bold rounded-md transition ${newSupplierForm.useExisting ? 'bg-white text-zinc-950 shadow-xs' : 'text-zinc-500 hover:text-zinc-800'}`}
                >
                  Existente
                </button>
                <button
                  type="button"
                  onClick={() => setNewSupplierForm(prev => ({ ...prev, useExisting: false }))}
                  className={`flex-1 py-1.5 text-xs font-bold rounded-md transition ${!newSupplierForm.useExisting ? 'bg-white text-zinc-950 shadow-xs' : 'text-zinc-500 hover:text-zinc-800'}`}
                >
                  Novo Cadastro Rápido
                </button>
              </div>

              {newSupplierForm.useExisting ? (
                /* Select existing supplier */
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1">Selecione o Fornecedor registrado</label>
                  <select
                    value={newSupplierForm.selectedId}
                    onChange={(e) => setNewSupplierForm(prev => ({ ...prev, selectedId: e.target.value }))}
                    className="w-full border rounded-xl py-2.5 px-3 text-xs bg-white focus:ring-1 focus:ring-brand-500"
                    required
                  >
                    <option value="">Selecione...</option>
                    {suppliers.filter(s => s.active).map(s => (
                      <option key={s.id} value={s.id}>{s.name} ({s.activity_branch || 'Sem ramo'})</option>
                    ))}
                  </select>
                </div>
              ) : (
                /* Quick Add Supplier Form */
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-bold text-gray-500 mb-0.5">Nome do Fornecedor / Razão Social *</label>
                    <input 
                      type="text"
                      value={newSupplierForm.name}
                      onChange={(e) => setNewSupplierForm(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="Ex: Madeireira São José"
                      className="w-full text-xs p-2 border rounded-lg focus:ring-1 focus:ring-brand-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 mb-0.5">Contato Principal (Nome)</label>
                    <input 
                      type="text"
                      value={newSupplierForm.contact_name}
                      onChange={(e) => setNewSupplierForm(prev => ({ ...prev, contact_name: e.target.value }))}
                      placeholder="Ex: Carlos Albuquerque"
                      className="w-full text-xs p-2 border rounded-lg focus:ring-1 focus:ring-brand-500"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs font-bold text-gray-500 mb-0.5">Telefone / Whats *</label>
                      <input 
                        type="text"
                        value={newSupplierForm.phone}
                        onChange={(e) => setNewSupplierForm(prev => ({ ...prev, phone: e.target.value }))}
                        placeholder="Ex: (11) 98888-8888"
                        className="w-full text-xs p-2 border rounded-lg focus:ring-1 focus:ring-brand-500"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-500 mb-0.5">Ramo de Atividade</label>
                      <input 
                        type="text"
                        value={newSupplierForm.activity_branch}
                        onChange={(e) => setNewSupplierForm(prev => ({ ...prev, activity_branch: e.target.value }))}
                        placeholder="Ex: Madeiras"
                        className="w-full text-xs p-2 border rounded-lg focus:ring-1 focus:ring-brand-500"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 mb-0.5">Email Fornecedor</label>
                    <input 
                      type="email"
                      value={newSupplierForm.email}
                      onChange={(e) => setNewSupplierForm(prev => ({ ...prev, email: e.target.value }))}
                      placeholder="Ex: comercial@fornecedor.com"
                      className="w-full text-xs p-2 border rounded-lg focus:ring-1 focus:ring-brand-500"
                    />
                  </div>

                  {/* Save to Global checkbox */}
                  <label className="flex items-center gap-2 text-xs font-semibold text-gray-700 pt-1 cursor-pointer">
                    <input 
                      type="checkbox"
                      checked={newSupplierForm.saveToGlobal}
                      onChange={(e) => setNewSupplierForm(prev => ({ ...prev, saveToGlobal: e.target.checked }))}
                      className="rounded border-gray-300 text-brand-600 focus:ring-brand-500"
                    />
                    Salvar também no cadastro principal (Base Geral)
                  </label>
                </div>
              )}
            </div>

            <div className="bg-gray-50 p-4 border-t flex justify-end gap-2.5">
              <button 
                type="button"
                onClick={() => setIsNewSupOpen(false)}
                className="bg-white border text-gray-700 font-bold px-4 py-2 rounded-xl text-xs hover:bg-gray-100"
              >
                Cancelar
              </button>
              <button 
                type="submit"
                className="bg-brand-600 hover:bg-brand-700 text-white font-bold px-5 py-2 rounded-xl text-xs"
              >
                Vincular
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL: REGISTRAR RESPOSTA / VALORES / OFICIALIZAR */}
      {isLogQuoteOpen && selectedQuote && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl border">
            <div className="bg-indigo-950 text-white p-5 flex justify-between items-center">
              <div>
                <h3 className="font-extrabold text-base flex items-center gap-1.5">
                  <Activity size={18} /> Registrar Cotação: {selectedQuote.supplier_name}
                </h3>
                <p className="text-xs text-zinc-400 mt-1">Insira os termos respondidos pelo parceiro comercial.</p>
              </div>
              <button 
                onClick={() => setIsLogQuoteOpen(false)}
                className="text-zinc-400 hover:text-white transition"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {/* Status Selector */}
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1.5">Status Geral</label>
                <select
                  value={logResponseForm.status}
                  onChange={(e) => setLogResponseForm(prev => ({ ...prev, status: e.target.value as any }))}
                  className="w-full border rounded-xl py-2 px-3 text-xs focus:ring-1 focus:ring-indigo-500 bg-white"
                >
                  {Object.entries(PRETTY_CRM_STATUS).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
              </div>

              {/* Only show numeric inputs if NOT declined / unresponsive */}
              {!['RECUSOU', 'SEM_RESPOSTA', 'NAO_SOLICITADO'].includes(logResponseForm.status) && (
                <>
                  {/* Total Value */}
                  <div>
                    <label className="block text-xs font-bold text-gray-500 mb-1">Valor Total Cotado (R$)</label>
                    <input 
                      type="number"
                      step="0.01"
                      value={logResponseForm.value || ''}
                      onChange={(e) => setLogResponseForm(prev => ({ ...prev, value: parseFloat(e.target.value) || 0 }))}
                      placeholder="Ex: 1540.50"
                      className="w-full text-xs p-2.5 border rounded-lg focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-xs font-bold text-gray-500 mb-1">Prazo de Entrega (dias)</label>
                      <input 
                        type="text"
                        value={logResponseForm.delivery_days}
                        onChange={(e) => setLogResponseForm(prev => ({ ...prev, delivery_days: e.target.value }))}
                        placeholder="Ex: 5"
                        className="w-full text-xs p-2.5 border rounded-lg focus:ring-1 focus:ring-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-500 mb-1">Pagamento</label>
                      <input 
                        type="text"
                        value={logResponseForm.payment_terms}
                        onChange={(e) => setLogResponseForm(prev => ({ ...prev, payment_terms: e.target.value }))}
                        placeholder="Ex: Pix 30 dias"
                        className="w-full text-xs p-2.5 border rounded-lg focus:ring-1 focus:ring-indigo-500"
                      />
                    </div>
                  </div>

                  {/* Attachment Upload widget */}
                  <div>
                    <label className="block text-xs font-bold text-gray-500 mb-1 flex justify-between items-center">
                      <span>Proposta Comercial (PDF / Foto)</span>
                      {logResponseForm.isUploading && <span className="text-[10px] text-zinc-500 animate-pulse flex items-center gap-1"><RefreshCw size={10} className="animate-spin" /> Salvando...</span>}
                    </label>
                    {logResponseForm.attachmentUrl ? (
                      <div className="flex items-center justify-between p-2.5 border rounded-xl bg-indigo-50/50 border-indigo-100 text-xs text-indigo-950 font-medium">
                        <div className="flex items-center gap-1.5 truncate">
                          <Paperclip size={14} className="text-indigo-600 shrink-0" />
                          <span className="truncate">{logResponseForm.attachmentName}</span>
                        </div>
                        <button 
                          onClick={() => setLogResponseForm(prev => ({ ...prev, attachmentUrl: '', attachmentName: '' }))}
                          className="text-red-500 hover:text-red-700 shrink-0"
                          title="Remover"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ) : (
                      <input 
                        type="file"
                        accept="image/*,application/pdf"
                        onChange={handleResponseFileChange}
                        disabled={logResponseForm.isUploading}
                        className="block w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-[11px] file:font-semibold file:bg-zinc-100 file:text-zinc-700 hover:file:bg-zinc-200 cursor-pointer"
                      />
                    )}
                  </div>

                  {/* Officialize budget in parent request checkbox */}
                  <label className="flex items-start gap-2.5 text-xs font-bold text-indigo-900 pt-1.5 cursor-pointer bg-indigo-50 p-3 rounded-2xl border border-indigo-100">
                    <input 
                      type="checkbox"
                      checked={logResponseForm.officializeBudget}
                      onChange={(e) => setLogResponseForm(prev => ({ ...prev, officializeBudget: e.target.checked }))}
                      className="rounded border-indigo-400 text-indigo-600 focus:ring-indigo-500 mt-0.5"
                    />
                    <div>
                      <span>Lançar diretamente no orçamento oficial</span>
                      <p className="text-[10px] text-indigo-600 font-normal mt-0.5">
                        Registrará automaticamente como um orçamento oficial no pedido do condomínio, evitando redigitação manual.
                      </p>
                    </div>
                  </label>
                </>
              )}

              {/* Short fast notes */}
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">Notas Rápidas / Observações</label>
                <textarea
                  value={logResponseForm.notes}
                  onChange={(e) => setLogResponseForm(prev => ({ ...prev, notes: e.target.value }))}
                  placeholder="Insira detalhes adicionais sobre o retorno ou recusa."
                  rows={2.5}
                  className="w-full text-xs p-2.5 border rounded-lg focus:ring-1 focus:ring-indigo-500"
                ></textarea>
              </div>
            </div>

            <div className="bg-gray-50 p-4 border-t flex justify-end gap-2.5">
              <button 
                type="button"
                onClick={() => setIsLogQuoteOpen(false)}
                className="bg-white border text-gray-700 font-bold px-4 py-2 rounded-xl text-xs hover:bg-gray-100"
              >
                Cancelar
              </button>
              <button 
                type="button"
                onClick={handleSaveResponse}
                disabled={logResponseForm.isUploading}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-5 py-2 rounded-xl text-xs shadow-md shadow-indigo-600/15"
              >
                Registrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DEDICATED SUPPLIER QUOTE REQUEST MODAL */}
      <SupplierQuoteRequestModal
        isOpen={isQuoteRequestModalOpen}
        onClose={() => setIsQuoteRequestModalOpen(false)}
        request={request}
        initialSupplierId={quoteRequestSupplierId}
        initialMode={quoteRequestMode}
        onSuccess={() => {
          setIsQuoteRequestModalOpen(false);
        }}
      />
    </div>
  );
}
