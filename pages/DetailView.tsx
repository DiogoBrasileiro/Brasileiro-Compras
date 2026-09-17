
import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { RequestStatus, UserRole, Orcamento, Solicitacao, RequestLevel, RequestType } from '../types';
import { Card, Badge, Button, Input, Textarea, DeadlineDisplay, Select } from '../components/UI';
import { ArrowLeft, CheckCircle, FileText, Download, MessageSquare, Plus, Edit2, Trash2, Eye, Send, Clock, Users, Timer, Paperclip, Trophy, ShoppingCart, Calendar, AlertTriangle, Play, XCircle, Truck, FileDown, ChevronDown, Building, ShieldCheck, UserCheck, X, Package, List, Loader2, Check, CalendarClock, AlertOctagon, ToggleLeft, ToggleRight, Box, BrainCircuit, UploadCloud, File } from 'lucide-react';
import { generateBudgetPdf } from '../utils/generateBudgetPdf';
import { LOGO_URL } from '../constants';
import { BudgetModal } from '../components/BudgetModal';
import { BudgetPreviewModal } from '../components/BudgetPreviewModal';
import { formatCurrency } from '../utils/formatters';
import CRMQuotes from '../components/CRMQuotes';
import { SupplierQuoteRequestModal } from '../components/SupplierQuoteRequestModal';

interface DetailViewProps {
  requestId: string;
  onBack: () => void;
  initialTab?: 'details' | 'chat';
}

export const DetailView: React.FC<DetailViewProps> = ({ requestId, onBack, initialTab = 'details' }) => {
  const { requests, currentUser, updateRequestStatus, updateRequest, deleteRequest, logoUrl, deleteBudget, saveBudget, fetchLastPurchase, recordPurchaseMemory, triggerManualNotification, sendMessage, markMessagesAsRead, categories } = useApp();
  const request = requests.find(r => r.id === requestId);
  
  if (!request) {
    return (
      <div className="p-8 text-center bg-white rounded-2xl shadow-sm border border-gray-100 animate-fadeIn">
        <AlertTriangle size={48} className="mx-auto text-yellow-500 mb-4" />
        <h2 className="text-xl font-bold text-gray-900 mb-2">Solicitação não encontrada</h2>
        <p className="text-gray-500 mb-6">O pedido que você está tentando acessar não existe ou foi removido.</p>
        <Button onClick={onBack} className="bg-brand-600 hover:bg-brand-700 text-white">
          <ArrowLeft size={16} className="mr-2" /> Voltar para a lista
        </Button>
      </div>
    );
  }
  // Local UI State
  const [activeTab, setActiveTab] = useState<'details' | 'chat' | 'crm'>(initialTab as any);
  const [rejectReason, setRejectReason] = useState('');
  const [isRejecting, setIsRejecting] = useState(false);
  const [deadlineDaysInput, setDeadlineDaysInput] = useState<number>(3); // Default 3 dias
  const [isProcessingAction, setIsProcessingAction] = useState(false);
  const [pdfMenuOpen, setPdfMenuOpen] = useState(false);
  const [isSavingToggle, setIsSavingToggle] = useState(false);
  const [isDeclineModalOpen, setIsDeclineModalOpen] = useState(false);
  const [isCloseModalOpen, setIsCloseModalOpen] = useState(false);
  const [closeReason, setCloseReason] = useState('Pedido encerrado por falta de resposta do cliente dentro do prazo de aprovação.');
  
  // Delivery Date Modal
  const [isDeliveryModalOpen, setIsDeliveryModalOpen] = useState(false);
  const [deliveryDateInput, setDeliveryDateInput] = useState('');

  // Edit Request Modal
  const [isEditRequestModalOpen, setIsEditRequestModalOpen] = useState(false);
  const [editRequestData, setEditRequestData] = useState<Partial<Solicitacao>>({});

  // Approval Form State
  const [isApprovalFormOpen, setIsApprovalFormOpen] = useState(false);
  const [pendingBudgetToApprove, setPendingBudgetToApprove] = useState<number | null>(null);
  const [approvalData, setApprovalData] = useState({ name: '', role: '' });

  // Chat
  const [chatInput, setChatInput] = useState('');
  const chatEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  // Modals
  const [isBudgetModalOpen, setIsBudgetModalOpen] = useState(false);
  const [editingBudget, setEditingBudget] = useState<Orcamento | undefined>(undefined);
  const [viewingBudget, setViewingBudget] = useState<Orcamento | null>(null);
  const [isSupplierQuoteModalOpen, setIsSupplierQuoteModalOpen] = useState(false);

  // Scroll on Tab Open
  useEffect(() => {
    if (activeTab === 'chat') {
        // Small timeout to ensure rendering
        setTimeout(() => {
            if (chatEndRef.current) {
                chatEndRef.current.scrollIntoView({ behavior: 'auto' });
            }
        }, 100);
        markMessagesAsRead(requestId);
    }
  }, [activeTab, requestId]);

  // Scroll on New Message (only if near bottom)
  useEffect(() => {
      if (activeTab === 'chat' && request?.messages) {
          const container = chatContainerRef.current;
          if (container) {
              const { scrollTop, scrollHeight, clientHeight } = container;
              // Check if user is near bottom (within 200px)
              const isNearBottom = scrollHeight - scrollTop - clientHeight < 200;
              
              if (isNearBottom) {
                  chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
              }
          }
      }
  }, [request?.messages]);

  // Pre-fill delivery date input if editing
  useEffect(() => {
      if (request?.estimated_delivery_date) {
          const datePart = request.estimated_delivery_date.split('T')[0];
          setDeliveryDateInput(datePart);
      }
  }, [request?.estimated_delivery_date]);

  if (!request) return <div>Solicitação não encontrada.</div>;

  const isAdmin = currentUser?.role === UserRole.ADMIN;
  const isCondo = currentUser?.role ? [UserRole.CONDOMINIO, UserRole.SINDICO, UserRole.FISCAL, UserRole.OUTRO].includes(currentUser.role) : false;
  const displayLogo = logoUrl || LOGO_URL;
  const canEditRequest = isCondo && (request.status === RequestStatus.NOVO || request.status === RequestStatus.EM_COTACAO);

  const isInternalPhase = [
    RequestStatus.NOVO,
    RequestStatus.EM_COTACAO,
    RequestStatus.ORCAMENTOS_PRONTOS,
    RequestStatus.REPROVADO_BRASILEIRO
  ].includes(request.status);
  const shouldHideBudgets = isCondo && isInternalPhase;

  // --- LOGICA DE EXTRAÇÃO DE AUTORIZAÇÃO (Fallback Robusto) ---
  const approverName = request.autorizado_por_nome || 
    (request.justificativa_condominio?.match(/Autorizado por: (.*?) -/)?.[1]) ||
    (request.justificativa_condominio?.match(/Aprovação formal por (.*?)\./)?.[1]) || 
    'N/A';
  
  const approverRole = request.autorizado_por_cargo || 
    (request.justificativa_condominio?.match(/- Cargo: (.*?)]/)?.[1]) || 
    'N/A';

  const canManageBudgets = (isAdmin && request.status !== RequestStatus.CONCLUIDO && request.status !== RequestStatus.CANCELADO) || 
                           (isCondo && request.status === RequestStatus.NOVO);

  const handleAdminAction = async (action: string) => {
      if (isProcessingAction) return;
      
      // INTERCEPT MARK_DELIVERING TO ASK FOR DATE
      if (action === 'MARK_DELIVERING') {
          const today = new Date().toISOString().split('T')[0];
          setDeliveryDateInput(today);
          setIsDeliveryModalOpen(true);
          return;
      }

      setIsProcessingAction(true);
      let nextStatus: RequestStatus | null = null;
      let msg = '';
      let updates: any = {};

      try {
        switch (action) {
            case 'START_QUOTE':
                nextStatus = RequestStatus.EM_COTACAO;
                msg = "Iniciando processo de cotação com fornecedores.";
                break;
            case 'FINISH_QUOTES':
                if (request.orcamentos.length === 0) {
                    setIsProcessingAction(false);
                    return alert("Adicione pelo menos um orçamento.");
                }
                nextStatus = RequestStatus.ORCAMENTOS_PRONTOS;
                msg = "Cotações finalizadas internamente.";
                break;
            case 'SEND_TO_CLIENT':
                if (!deadlineDaysInput || deadlineDaysInput < 1) {
                    setIsProcessingAction(false);
                    return alert("Defina um prazo de validade.");
                }
                nextStatus = RequestStatus.AGUARDANDO_ACAO_CONDOMINIO;
                msg = `Orçamentos enviados. Prazo: ${deadlineDaysInput} dias.`;
                updates = { deadline_days: deadlineDaysInput };
                break;
            case 'CONFIRM_ORDER':
                nextStatus = RequestStatus.EM_PEDIDO;
                msg = "Pedido de compra confirmado com o fornecedor.";
                break;
        }
        if (nextStatus) await updateRequestStatus(request.id, nextStatus, msg, updates);
      } finally {
        setIsProcessingAction(false);
      }
  };

  const confirmDeliveryWithDate = async () => {
      if (!deliveryDateInput) return alert("Por favor, informe a data prevista.");
      
      setIsProcessingAction(true);
      try {
          await updateRequest(request.id, { estimated_delivery_date: deliveryDateInput });
          const [y, m, d] = deliveryDateInput.split('-');
          const displayDate = `${d}/${m}/${y}`;

          const success = await updateRequestStatus(
              request.id, 
              RequestStatus.AGUARDANDO_ENTREGA, 
              `Entrega agendada. Previsão informada: ${displayDate}.`
          );
          
          if (success) {
            setIsDeliveryModalOpen(false);
          } else {
            alert("Status atualizado, mas verifique se a data persistiu.");
          }
      } catch (err) {
          console.error(err);
          alert("ERRO: Verifique conexão.");
      } finally {
          setIsProcessingAction(false);
      }
  };

  const handleUpdateDeliveryDate = async () => {
      if (!deliveryDateInput) return;
      setIsProcessingAction(true);
      try {
          await updateRequest(request.id, { estimated_delivery_date: deliveryDateInput });
          alert("Data prevista atualizada!");
          setIsDeliveryModalOpen(false);
      } catch (e) {
          alert("Erro ao salvar data.");
      } finally {
          setIsProcessingAction(false);
      }
  };

  const handleEditRequestSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!editRequestData.titulo || !editRequestData.descricao) return alert("Preencha os campos obrigatórios.");
      setIsProcessingAction(true);
      try {
          await updateRequest(request.id, editRequestData);
          setIsEditRequestModalOpen(false);
      } catch (e) {
          alert("Erro ao salvar alterações.");
      } finally {
          setIsProcessingAction(false);
      }
  };

  const openEditRequestModal = () => {
      setEditRequestData({
          titulo: request.titulo,
          descricao: request.descricao,
          tipo: request.tipo,
          category_id: request.category_id,
          categoria: request.categoria,
          nivel: request.nivel,
          assembly_data: request.assembly_data
      });
      setIsEditRequestModalOpen(true);
  };

  const handleReceiveQuotes = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (isProcessingAction) return;
    if (!window.confirm("Confirma o recebimento para iniciar a análise dos orçamentos?")) return;
    setIsProcessingAction(true);
    try {
        const days = request.deadline_days || 3;
        const deadline = new Date();
        deadline.setDate(deadline.getDate() + days);
        await updateRequestStatus(request.id, RequestStatus.EM_ANALISE_CONDOMINIO, `Orçamentos recebidos. Prazo de ${days} dias iniciado.`, { due_at: deadline.toISOString() });
    } catch (err) {
        alert("Erro ao confirmar recebimento.");
    } finally {
        setIsProcessingAction(false);
    }
  };

  const handleConfirmReceipt = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (isProcessingAction) return;
    const confirmed = window.confirm("Você confirma que recebeu o pedido e deseja finalizá-lo?");
    if (!confirmed) return;
    setIsProcessingAction(true);
    try {
        await updateRequestStatus(request.id, RequestStatus.CONCLUIDO, "Entrega confirmada pelo cliente. Pedido encerrado com sucesso.");
    } catch (err) {
        alert("Ocorreu um erro ao processar sua solicitação.");
    } finally {
        setIsProcessingAction(false);
    }
  };

  const handleFinalApproval = async () => {
      if (!approvalData.name.trim() || !approvalData.role.trim()) {
          return alert("É obrigatório informar seu Nome Completo e Cargo para registrar a autorização.");
      }
      if (isProcessingAction || pendingBudgetToApprove === null) return;
      
      setIsProcessingAction(true);
      try {
          const chosenBudget = request.orcamentos.find(o => o.numero === pendingBudgetToApprove);
          if (!chosenBudget) throw new Error("Orçamento inválido.");
          
          const updates = {
              orcamento_escolhido: pendingBudgetToApprove,
              data_decisao_condominio: new Date().toISOString(),
              autorizado_por_nome: approvalData.name,
              autorizado_por_cargo: approvalData.role,
              justificativa_condominio: `Aprovação formal por ${approvalData.name}. [Autorizado por: ${approvalData.name} - Cargo: ${approvalData.role}]`
          };
          
          const success = await updateRequestStatus(request.id, RequestStatus.APROVADO, `Aprovação formal por ${approvalData.name} (${approvalData.role}).`, updates);
          
          if (success) {
              await recordPurchaseMemory(request, chosenBudget);
              setIsApprovalFormOpen(false);
              setPendingBudgetToApprove(null);
              setApprovalData({ name: '', role: '' });
              alert("Aprovação registrada com sucesso!");
          } else {
              alert("Não foi possível salvar a aprovação. Verifique sua conexão ou contate o suporte.");
          }
      } catch (err) {
          console.error(err);
          alert("Erro ao salvar. Tente novamente.");
      } finally {
          setIsProcessingAction(false);
      }
  };

  const handleDeclineRequest = async () => {
      if (!rejectReason.trim()) return alert("A justificativa é obrigatória para declinar o pedido.");
      if (isProcessingAction) return;

      setIsProcessingAction(true);
      try {
          const success = await updateRequestStatus(
              request.id,
              RequestStatus.REPROVADO_BRASILEIRO,
              "Solicitação reprovada pela Brasileiro.",
              { justificativa_recusa: rejectReason }
          );
          if (success) {
              setIsDeclineModalOpen(false);
              setRejectReason('');
          } else {
              alert("Erro ao salvar no banco de dados. Verifique sua conexão.");
          }
      } catch (err) {
          alert("Erro ao declinar solicitação.");
      } finally {
          setIsProcessingAction(false);
      }
  };

  const handleCloseRequest = async () => {
      if (!closeReason.trim()) return alert("A justificativa é obrigatória para encerrar o pedido.");
      if (isProcessingAction) return;

      setIsProcessingAction(true);
      try {
          const success = await updateRequestStatus(
              request.id,
              RequestStatus.REPROVADO_SEM_RESPOSTA,
              "Pedido encerrado por falta de resposta.",
              { justificativa_encerramento: closeReason }
          );
          if (success) {
              setIsCloseModalOpen(false);
              setCloseReason('Pedido encerrado por falta de resposta do cliente dentro do prazo de aprovação.');
          } else {
              alert("Erro ao salvar no banco de dados. Verifique sua conexão.");
          }
      } catch (err) {
          alert("Erro ao encerrar solicitação.");
      } finally {
          setIsProcessingAction(false);
      }
  };

  const handleDeleteRequest = async () => {
    if (!confirm("Tem certeza que deseja excluir permanentemente esta solicitação?")) return;
    try { await deleteRequest(request.id); onBack(); } catch (err) { alert("Erro ao excluir solicitação."); }
  };

  const initiateCondoApproval = (budgetNumber: number) => {
    setPendingBudgetToApprove(budgetNumber);
    setApprovalData({ name: '', role: '' });
    setIsApprovalFormOpen(true);
  };

  const handleDeleteBudget = async (budgetId: string) => {
    if (!confirm("Tem certeza que deseja remover este orçamento?")) return;
    try { 
        const message = isAdmin ? "Removido pelo administrador" : "Removido pelo condomínio";
        await deleteBudget(request.id, budgetId, message); 
    } catch (err) { 
        alert("Erro ao remover orçamento."); 
    }
  };

  // --- NEW: Toggle Stock Control Function ---
  const toggleStockControl = async () => {
      if (isSavingToggle) return;
      setIsSavingToggle(true);
      const newValue = !request.stock_control_enabled;
      try {
          // This saves the selection field to DB
          await updateRequest(request.id, { stock_control_enabled: newValue });
      } catch (e) {
          alert("Erro ao atualizar configuração de estoque. Verifique se o script SQL foi executado.");
      } finally {
          setTimeout(() => setIsSavingToggle(false), 500);
      }
  };

  const handleReviewStockItems = () => {
      const chosen = request.orcamentos.find(o => o.numero === request.orcamento_escolhido);
      if (!chosen) return alert("Nenhum orçamento escolhido ainda.");
      
      const itemList = chosen.items && chosen.items.length > 0 
        ? chosen.items.map(i => `• ${i.quantity} ${i.unit || 'un'} - ${i.description}`).join('\n')
        : 'Nenhum item detalhado no orçamento.';
        
      alert(`📦 ITENS QUE ENTRARÃO NO ESTOQUE:\n\n${itemList}\n\nNota: A entrada ocorrerá automaticamente quando o status for "CONCLUÍDO".`);
  };

  const formatDeliveryDate = (dateStr: string) => {
      if(!dateStr) return 'Data não informada';
      if (dateStr.includes('T')) return new Date(dateStr).toLocaleDateString('pt-BR', { timeZone: 'UTC' });
      const [year, month, day] = dateStr.split('-');
      return `${day}/${month}/${year}`;
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-24">
      {/* HEADER */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 flex flex-col md:flex-row justify-between items-start gap-4">
         <div className="flex-1">
            <button onClick={onBack} className="flex items-center text-gray-500 hover:text-brand-600 text-sm font-bold mb-3">
                <ArrowLeft size={16} className="mr-1" /> Voltar
            </button>
            <div className="flex items-center gap-2 mb-1 text-brand-700 bg-brand-50 w-fit px-3 py-1 rounded-lg border border-brand-100">
                <Building size={16} />
                <span className="font-bold text-sm uppercase tracking-wide">{request.condominio_nome}</span>
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mt-2">
                <div className="flex-1 min-w-0">
                    <h1 className="text-2xl font-extrabold text-gray-900 flex flex-wrap items-center gap-3">
                        {request.titulo}
                        {request.generated_from_stock && (
                            <span className="bg-purple-100 text-purple-700 text-xs px-2 py-1 rounded-full border border-purple-200 flex items-center gap-1">
                                <BrainCircuit size={12}/> SUGESTÃO AUTOMÁTICA
                            </span>
                        )}
                    </h1>
                    <div className="flex flex-wrap items-center gap-3 mt-2 text-sm text-gray-500">
                        <span className="bg-gray-100 px-2 py-0.5 rounded font-bold">{request.id}</span>
                        <span className="hidden sm:inline">•</span>
                        <Badge status={request.status} />
                    </div>
                </div>
                {request.orcamentos.length > 0 && !shouldHideBudgets && (
                    <div className="relative mt-2 sm:mt-0 w-full sm:w-auto flex-shrink-0">
                        <Button variant="outline" onClick={() => setPdfMenuOpen(!pdfMenuOpen)} className="text-xs h-10 w-full sm:w-auto">
                            <FileDown size={16} className="mr-2"/> Baixar Relatório <ChevronDown size={14} className="ml-2"/>
                        </Button>
                        {pdfMenuOpen && (
                             <div className="absolute top-full right-0 mt-2 w-full sm:w-48 bg-white border border-gray-200 rounded-xl shadow-xl z-50 overflow-hidden">
                                <button onClick={() => { generateBudgetPdf({ request, logoDataUrl: displayLogo, mode: 'SUMMARY' }); setPdfMenuOpen(false); }} className="w-full text-left px-4 py-3 text-xs font-bold hover:bg-brand-50">Resumido (Síndico)</button>
                                <button onClick={() => { generateBudgetPdf({ request, logoDataUrl: displayLogo, mode: 'DETAILED' }); setPdfMenuOpen(false); }} className="w-full text-left px-4 py-3 text-xs font-bold hover:bg-brand-50 border-t">Completo (Técnico)</button>
                            </div>
                        )}
                    </div>
                )}
            </div>
         </div>

         {/* ADMIN ACTIONS */}
         {isAdmin && (
             <div className="flex flex-col gap-2 items-stretch md:items-end w-full md:w-auto min-w-[200px] mt-4 md:mt-0">
                <Button 
                    onClick={() => setIsSupplierQuoteModalOpen(true)} 
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold w-full shadow-sm text-xs py-2.5"
                >
                    <Send size={15} className="mr-2"/> Solicitar Orçamento ao Fornecedor
                </Button>

                {request.status === RequestStatus.NOVO && (
                    <>
                        <Button onClick={() => handleAdminAction('START_QUOTE')} className="bg-blue-600 w-full"><Play size={16} className="mr-2"/> Iniciar Cotação</Button>
                        <Button onClick={() => setIsDeclineModalOpen(true)} className="bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 w-full mt-1"><XCircle size={16} className="mr-2"/> Declinar</Button>
                    </>
                )}
                {request.status === RequestStatus.EM_COTACAO && <Button onClick={() => handleAdminAction('FINISH_QUOTES')} className="bg-indigo-600 w-full"><CheckCircle size={16} className="mr-2"/> Finalizar Cotações</Button>}
                {request.status === RequestStatus.ORCAMENTOS_PRONTOS && <Button onClick={() => handleAdminAction('SEND_TO_CLIENT')} className="bg-yellow-600 w-full text-white"><Send size={16} className="mr-2"/> Enviar p/ Cliente</Button>}
                {request.status === RequestStatus.EM_ANALISE_CONDOMINIO && (
                    <Button onClick={() => setIsCloseModalOpen(true)} className="bg-red-600 w-full hover:bg-red-700">
                        <XCircle size={16} className="mr-2"/> Encerrar Pedido
                    </Button>
                )}
                {request.status === RequestStatus.APROVADO && <Button onClick={() => handleAdminAction('CONFIRM_ORDER')} className="bg-green-600 w-full"><ShoppingCart size={16} className="mr-2"/> Fazer Pedido</Button>}
                {request.status === RequestStatus.EM_PEDIDO && <Button onClick={() => handleAdminAction('MARK_DELIVERING')} className="bg-teal-600 w-full"><Truck size={16} className="mr-2"/> Marcar Entrega</Button>}
                <Button onClick={handleDeleteRequest} variant="ghost" className="text-red-500 text-xs w-full justify-center md:justify-end"><Trash2 size={14} className="mr-1"/> Excluir Pedido</Button>
             </div>
         )}

         {isCondo && (
             <div className="flex flex-col gap-2 items-stretch md:items-end w-full md:w-auto min-w-[200px] mt-4 md:mt-0">
                {canEditRequest && (
                    <Button onClick={openEditRequestModal} variant="outline" className="w-full text-brand-700 border-brand-200 hover:bg-brand-50">
                        <Edit2 size={16} className="mr-2"/> Editar Solicitação
                    </Button>
                )}
                {request.status === RequestStatus.AGUARDANDO_ACAO_CONDOMINIO && (
                    <div className="flex flex-col gap-2 w-full animate-fadeIn">
                        <span className="text-[10px] text-gray-500 text-center md:text-right font-medium bg-yellow-50 px-2 py-1 rounded border border-yellow-100">Confirme para ver os orçamentos e prazo.</span>
                        <Button type="button" onClick={(e) => handleReceiveQuotes(e)} disabled={isProcessingAction} className="bg-orange-600 w-full hover:bg-orange-700 text-white shadow-md transition-all"><CheckCircle size={16} className="mr-2"/> Confirmar Recebimento</Button>
                    </div>
                )}
                {request.status === RequestStatus.AGUARDANDO_ENTREGA && (
                    <Button type="button" onClick={(e) => handleConfirmReceipt(e)} disabled={isProcessingAction} className="bg-green-600 w-full hover:bg-green-700 shadow-md transition-all"><CheckCircle size={16} className="mr-2"/> Confirmar Entrega</Button>
                )}
             </div>
         )}
      </div>

      {/* DELIVERY DATE BANNER */}
      {request.estimated_delivery_date && (
          <div className="bg-teal-50 border border-teal-200 rounded-xl p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-sm animate-fadeIn ring-2 ring-teal-100">
              <div className="flex items-start md:items-center gap-3">
                  <div className="bg-white p-2.5 rounded-full text-teal-600 shadow-sm border border-teal-100 flex-shrink-0"><Truck size={24}/></div>
                  <div>
                      <h3 className="font-extrabold text-teal-900 text-sm uppercase tracking-wider mb-0.5">Previsão de Entrega</h3>
                      <p className="font-black text-gray-900 leading-none flex flex-wrap items-center gap-2">
                          <span className="text-xl">{formatDeliveryDate(request.estimated_delivery_date)}</span>
                          <span className="text-xs text-teal-600 font-bold bg-teal-100 px-2 py-0.5 rounded-full">AGENDADO</span>
                      </p>
                  </div>
              </div>
              {isAdmin && request.status !== RequestStatus.CONCLUIDO && (
                  <Button variant="outline" onClick={() => setIsDeliveryModalOpen(true)} className="bg-white text-xs border-teal-200 text-teal-700 hover:bg-teal-100 w-full md:w-auto">
                      <Edit2 size={14} className="mr-1"/> Alterar Data
                  </Button>
              )}
          </div>
      )}

      {/* ASSEMBLEIA ALERT */}
      {request.assembly_data?.required && (
          <div className="bg-purple-50 border border-purple-200 rounded-xl p-5 flex items-start gap-4 shadow-sm animate-fadeIn ring-2 ring-purple-100">
               <div className="bg-white p-3 rounded-xl border border-purple-100 text-purple-600 shadow-sm"><Users size={28}/></div>
               <div className="flex-1">
                   <h3 className="font-black text-purple-900 text-xs uppercase tracking-widest mb-1">Pauta de Assembleia</h3>
                   <p className="text-sm text-purple-800 font-bold leading-tight">Este pedido foi marcado pelo condomínio para ser levado à Assembleia. Não finalize a compra sem a aprovação em ata.</p>
               </div>
          </div>
      )}

      {/* REJECTION ALERT */}
      {(request.status === RequestStatus.REPROVADO_BRASILEIRO || request.status === RequestStatus.REPROVADO_SEM_RESPOSTA) && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-5 flex items-start gap-4 shadow-sm animate-fadeIn ring-2 ring-red-100">
               <div className="bg-white p-3 rounded-xl border border-red-100 text-red-600 shadow-sm"><XCircle size={28}/></div>
               <div className="flex-1">
                   <h3 className="font-black text-red-900 text-xs uppercase tracking-widest mb-1">
                       {request.status === RequestStatus.REPROVADO_BRASILEIRO ? 'Solicitação Reprovada' : 'Pedido Encerrado'}
                   </h3>
                   <p className="text-sm text-red-800 font-bold leading-tight mb-2">
                       {request.status === RequestStatus.REPROVADO_BRASILEIRO ? 'Este pedido foi declinado pela administração.' : 'Este pedido foi encerrado por falta de resposta do cliente.'}
                   </p>
                   {(request.justificativa_recusa || request.justificativa_encerramento) ? (
                       <div className="bg-white/50 p-3 rounded-lg border border-red-100 text-red-900 text-sm italic">
                           "{request.justificativa_recusa || request.justificativa_encerramento}"
                       </div>
                   ) : (
                       <div className="bg-white/50 p-3 rounded-lg border border-red-100 text-red-900 text-sm italic">
                           (Sem justificativa registrada)
                       </div>
                   )}
               </div>
          </div>
      )}

      {/* TABS E CONTEÚDO */}
      <div className="flex overflow-x-auto border-b border-gray-200 bg-gray-50/50 px-2 rounded-t-xl mb-4 hide-scrollbar">
          <button onClick={() => setActiveTab('details')} className={`py-3 px-6 text-sm font-bold border-b-2 whitespace-nowrap ${activeTab === 'details' ? 'border-brand-600 text-brand-700' : 'border-transparent text-gray-500'}`}>Detalhes & Orçamentos</button>
          <button onClick={() => setActiveTab('chat')} className={`py-3 px-6 text-sm font-bold border-b-2 whitespace-nowrap ${activeTab === 'chat' ? 'border-brand-600 text-brand-700' : 'border-transparent text-gray-500'}`}>Chat</button>
          {isAdmin && (
              <button 
                onClick={() => setActiveTab('crm')} 
                className={`py-3 px-6 text-sm font-bold border-b-2 whitespace-nowrap ${activeTab === 'crm' ? 'border-brand-600 text-brand-700' : 'border-transparent text-gray-500'} flex items-center gap-1.5`}
              >
                  CRM de Cotações
                  <span className="bg-brand-100 text-brand-800 text-[10px] px-2 py-0.5 rounded font-extrabold font-mono">
                      {request.assembly_data?.crm_quotes?.filter((q: any) => q.status !== 'NAO_SOLICITADO').length || 0}
                  </span>
              </button>
          )}
      </div>

      {activeTab === 'crm' && isAdmin ? (
          <div className="animate-fadeIn">
              <CRMQuotes request={request} />
          </div>
      ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
            {activeTab === 'details' && (
                <>
                    <Card title="Descrição do Pedido"><p className="text-gray-900 whitespace-pre-line leading-relaxed">{request.descricao}</p></Card>
                    
                    {request.attachments && request.attachments.length > 0 && (
                        <Card title="Anexos da Solicitação">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                {request.attachments.map(att => (
                                    <a key={att.id} href={att.publicUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 p-3 rounded-xl border border-gray-200 hover:border-brand-500 hover:bg-brand-50 transition-colors group bg-white shadow-sm">
                                        <div className="bg-brand-100 text-brand-600 p-2 rounded-lg group-hover:bg-brand-200"><Paperclip size={20}/></div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-bold text-gray-900 truncate">{att.fileName}</p>
                                            <p className="text-xs text-gray-500">{(att.fileSize / 1024).toFixed(1)} KB</p>
                                        </div>
                                        <Download size={16} className="text-gray-400 group-hover:text-brand-600" />
                                    </a>
                                ))}
                            </div>
                        </Card>
                    )}

                    <div className="space-y-4">
                        <div className="flex justify-between items-center">
                            <h3 className="font-bold text-gray-900 text-lg flex items-center gap-2"><ShoppingCart className="text-brand-600"/> Orçamentos</h3>
                            {canManageBudgets && !shouldHideBudgets && <Button variant="secondary" onClick={() => { setEditingBudget(undefined); setIsBudgetModalOpen(true); }} className="text-xs py-2"><Plus size={14} className="mr-1"/> Adicionar</Button>}
                        </div>
                        {shouldHideBudgets ? (
                            <div className="p-8 text-center bg-gray-50 rounded-xl border border-dashed border-gray-300">
                               <Clock size={40} className="mx-auto text-gray-400 mb-4" />
                               <h4 className="text-lg font-bold text-gray-700 mb-2">Em Análise Interna</h4>
                               <p className="text-sm text-gray-500 max-w-md mx-auto">
                                   Sua solicitação está em análise e cotação pela equipe da Brasileiro. Os orçamentos ficarão disponíveis assim que forem enviados para sua aprovação.
                               </p>
                            </div>
                        ) : request.orcamentos.length === 0 ? (
                            <div className="text-center py-8 bg-gray-50 rounded-xl border-2 border-dashed">Nenhum orçamento anexado.</div>
                        ) : (
                            <div className="grid grid-cols-1 gap-4">
                                {request.orcamentos.map((budget) => (
                                    <div key={budget.id} className={`relative bg-white border rounded-xl p-4 transition-all ${budget.is_melhor_proposta ? 'border-yellow-400 ring-1 ring-yellow-400' : 'border-gray-200'} ${request.orcamento_escolhido === budget.numero ? 'border-green-500 ring-2 ring-green-500 bg-green-50' : ''}`}>
                                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-2 gap-1 sm:gap-4" onClick={() => setViewingBudget(budget)}>
                                            <div className="cursor-pointer break-words w-full sm:w-auto"><h4 className="font-bold text-gray-900 text-lg hover:text-brand-600 leading-tight">{budget.fornecedor}</h4></div>
                                            <span className="font-mono text-xl font-extrabold text-gray-900">{formatCurrency(budget.valor)}</span>
                                        </div>
                                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mt-4 pt-3 border-t">
                                            <div className="flex flex-wrap gap-2 items-center">
                                                <span className="bg-gray-800 text-white text-[10px] px-2 py-0.5 rounded font-mono whitespace-nowrap">#{budget.numero}</span>
                                                {budget.is_melhor_proposta && <span className="bg-yellow-100 text-yellow-800 text-[10px] px-2 py-0.5 rounded font-bold border border-yellow-200 whitespace-nowrap">RECOMENDADO</span>}
                                                {request.orcamento_escolhido === budget.numero && <span className="bg-green-600 text-white text-[10px] px-2 py-0.5 rounded font-bold whitespace-nowrap">APROVADO</span>}
                                            </div>
                                            <div className="flex items-center gap-3 self-end sm:self-auto">
                                                {canManageBudgets && (
                                                    <><button onClick={(e) => { e.stopPropagation(); setEditingBudget(budget); setIsBudgetModalOpen(true); }} className="text-gray-400 hover:text-brand-600 transition-colors" title="Editar Orçamento"><Edit2 size={16} /></button><button onClick={(e) => { e.stopPropagation(); handleDeleteBudget(budget.id); }} className="text-gray-400 hover:text-red-600 transition-colors" title="Excluir Orçamento"><Trash2 size={16} /></button></>
                                                )}
                                                <button onClick={(e) => { e.stopPropagation(); setViewingBudget(budget); }} className="text-sm font-bold text-brand-600 flex items-center gap-1 hover:underline whitespace-nowrap">Ver Detalhes <Eye size={14}/></button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </>
            )}
            {activeTab === 'chat' && (
                <div className="flex flex-col h-[600px] bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                    <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50" id="chat-container" ref={chatContainerRef}>
                        {(!request.messages || request.messages.length === 0) && (
                            <div className="flex flex-col items-center justify-center h-full text-gray-400">
                                <MessageSquare size={48} className="mb-2 opacity-20"/>
                                <p className="text-sm font-medium">Nenhuma mensagem ainda.</p>
                                <p className="text-xs">Inicie a conversa com o {isAdmin ? 'condomínio' : 'administrador'}.</p>
                            </div>
                        )}
                        
                        {request.messages?.map((msg) => {
                            const isMe = msg.sender_id === currentUser?.id;
                            const isSystem = msg.sender_role === 'SYSTEM';
                            
                            if (isSystem) {
                                return (
                                    <div key={msg.id} className="flex justify-center my-4">
                                        <span className="bg-gray-100 text-gray-500 text-[10px] px-3 py-1 rounded-full uppercase tracking-wider font-bold">
                                            {msg.content}
                                        </span>
                                    </div>
                                );
                            }

                            return (
                                <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                                    <div className={`max-w-[80%] rounded-2xl p-4 ${isMe ? 'bg-brand-600 text-white rounded-tr-none' : 'bg-white border border-gray-200 text-gray-800 rounded-tl-none shadow-sm'}`}>
                                        <div className="flex justify-between items-baseline gap-4 mb-1">
                                            <span className={`text-[10px] font-bold uppercase tracking-wider ${isMe ? 'text-brand-100' : 'text-gray-500'}`}>
                                                {isMe ? 'Você' : (msg.sender_role === UserRole.ADMIN ? 'Administrador' : request.condominio_nome)}
                                            </span>
                                            <span className={`text-[10px] ${isMe ? 'text-brand-200' : 'text-gray-400'}`}>
                                                {new Date(msg.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                            </span>
                                        </div>
                                        <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                                        {isMe && (
                                            <div className="flex justify-end mt-1">
                                                {msg.read_at ? (
                                                    <span className="flex items-center text-[10px] text-brand-200" title={`Lido em ${new Date(msg.read_at).toLocaleString()}`}>
                                                        <Check size={12} className="mr-0.5"/> Lido
                                                    </span>
                                                ) : (
                                                    <span className="text-[10px] text-brand-300">Enviado</span>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                        <div ref={chatEndRef} />
                    </div>
                    <div className="p-4 bg-white border-t border-gray-100">
                        <div className="flex gap-2">
                            <Textarea 
                                className="flex-1 min-h-[50px] max-h-[120px] resize-none !mb-0" 
                                placeholder="Digite sua mensagem..." 
                                value={chatInput}
                                onChange={e => setChatInput(e.target.value)}
                                onKeyDown={e => {
                                    if (e.key === 'Enter' && !e.shiftKey) {
                                        e.preventDefault();
                                        if (chatInput.trim()) {
                                            sendMessage(request.id, chatInput);
                                            setChatInput('');
                                        }
                                    }
                                }}
                            />
                            <Button 
                                onClick={() => {
                                    if (chatInput.trim()) {
                                        sendMessage(request.id, chatInput);
                                        setChatInput('');
                                    }
                                }} 
                                disabled={!chatInput.trim()}
                                className="h-auto px-6"
                            >
                                <Send size={20} />
                            </Button>
                        </div>
                        <p className="text-[10px] text-gray-400 mt-2 text-center flex items-center justify-center gap-1">
                            <ShieldCheck size={10}/> Ambiente seguro. Apenas você e a administração têm acesso a esta conversa.
                        </p>
                    </div>
                </div>
            )}
        </div>
        <div className="space-y-6">
            <Card title="Resumo do Status">
                <div className="text-center p-4 bg-gray-50 rounded-xl border mb-4">
                    <p className="text-xs text-gray-500 font-bold uppercase mb-1">Status Atual</p>
                    <Badge status={request.status} className="text-sm py-1 px-3"/>
                </div>
                
                {/* HISTORY TIMELINE */}
                <div className="mb-4">
                    <h4 className="text-xs text-gray-500 font-bold uppercase mb-3 flex items-center gap-1">
                        <Clock size={12}/> Histórico
                    </h4>
                    <div className="space-y-4 relative before:absolute before:inset-0 before:ml-[6px] before:h-full before:w-0.5 before:bg-gray-200">
                        
                        <div className="relative flex items-start justify-between gap-3">
                             <div className="absolute left-[3px] top-1.5 w-2 h-2 rounded-full ring-4 ring-white bg-gray-300 z-10"></div>
                             <div className="pl-6 min-w-0 flex-1">
                                 <p className="text-xs font-bold text-gray-900 leading-tight">Solicitação Criada</p>
                             </div>
                             <div className="text-right flex-shrink-0">
                                 <span className="text-[10px] font-medium text-gray-500">{new Date(request.data_solicitacao).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}</span>
                             </div>
                        </div>

                        {request.historico?.sort((a,b) => new Date(a.data).getTime() - new Date(b.data).getTime()).map((log) => (
                            <div key={log.id} className="relative flex items-start justify-between gap-3">
                                <div className="absolute left-[3px] top-1.5 w-2 h-2 rounded-full ring-4 ring-white bg-brand-500 z-10"></div>
                                <div className="pl-6 min-w-0 flex-1">
                                    <p className="text-xs font-bold text-gray-900 leading-tight" title={log.descricao}>{log.descricao.split('.')[0]}</p>
                                    <p className="text-[10px] text-gray-400 font-medium break-words">{log.usuario_nome}</p>
                                </div>
                                <div className="text-right flex-shrink-0">
                                    <span className="text-[10px] font-medium text-gray-500">{new Date(log.data).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
                
                {/* DATE DISPLAY */}
                {(request.estimated_delivery_date || request.status === RequestStatus.AGUARDANDO_ENTREGA) && (
                     <div className={`rounded-lg p-3 text-center animate-fadeIn border-2 ${request.estimated_delivery_date ? 'bg-teal-50 border-teal-200' : 'bg-orange-50 border-orange-200'}`}>
                         <p className={`text-[10px] font-bold uppercase mb-1 flex items-center justify-center gap-1 ${request.estimated_delivery_date ? 'text-teal-800' : 'text-orange-800'}`}>
                            {request.estimated_delivery_date ? <Truck size={12}/> : <AlertOctagon size={12}/>} Chegada Prevista
                         </p>
                         {request.estimated_delivery_date ? (
                             <>
                                <p className="text-lg font-black text-gray-900">{formatDeliveryDate(request.estimated_delivery_date)}</p>
                                <p className="text-[10px] text-teal-600 font-medium mt-1">Agendado pelo Admin</p>
                             </>
                         ) : (
                             <>
                                <p className="text-sm font-bold text-orange-700">Pendente de Agendamento</p>
                                {isAdmin && <button onClick={() => setIsDeliveryModalOpen(true)} className="mt-2 text-xs font-bold text-white bg-orange-500 px-3 py-1 rounded-full hover:bg-orange-600 transition-colors w-full">Definir Data Agora</button>}
                             </>
                         )}
                     </div>
                )}

                {/* STOCK CONTROL TOGGLE (ADMIN ONLY) */}
                {isAdmin && (
                    <div className="mt-4 pt-4 border-t border-gray-100">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-xs font-bold text-gray-600 uppercase flex items-center gap-1"><Box size={12}/> Controle de Estoque</p>
                                <p className="text-[10px] text-gray-400 leading-tight mt-0.5">Gerar estoque ao concluir?</p>
                            </div>
                            <button 
                                onClick={toggleStockControl} 
                                disabled={isSavingToggle}
                                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 ${request.stock_control_enabled ? 'bg-green-500' : 'bg-gray-200'}`}
                            >
                                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${request.stock_control_enabled ? 'translate-x-6' : 'translate-x-1'}`} />
                            </button>
                        </div>
                        {request.stock_control_enabled && request.orcamento_escolhido && (
                            <button onClick={handleReviewStockItems} className="mt-2 text-[10px] text-brand-600 font-bold hover:underline w-full text-right">
                                Ver itens que entrarão
                            </button>
                        )}
                    </div>
                )}

                {request.due_at && request.status === RequestStatus.EM_ANALISE_CONDOMINIO && <div className="mt-4"><DeadlineDisplay dueAt={request.due_at} /></div>}

                {/* APPROVER INFO */}
                {(request.status === RequestStatus.APROVADO || 
                  request.status === RequestStatus.EM_PEDIDO || 
                  request.status === RequestStatus.AGUARDANDO_ENTREGA || 
                  request.status === RequestStatus.CONCLUIDO) && (
                    <div className="mt-4 p-3 bg-green-50 rounded-xl border border-green-100 animate-fadeIn">
                        <p className="text-[10px] font-bold text-green-800 uppercase mb-2 flex items-center gap-1">
                            <UserCheck size={12}/> Autorização do Cliente
                        </p>
                        <div className="space-y-1">
                            <p className="text-sm font-bold text-gray-900">{approverName}</p>
                            <p className="text-[10px] text-gray-500 font-medium uppercase">{approverRole}</p>
                        </div>
                    </div>
                )}
            </Card>
        </div>
      </div>
      )}

      {/* MODALS RETAINED AS IS */}
      {isBudgetModalOpen && <BudgetModal isOpen={isBudgetModalOpen} onClose={() => setIsBudgetModalOpen(false)} onSave={async (b) => { await saveBudget(request.id, b); }} initialData={editingBudget} requestId={request.id} condoId={request.condominio_id} condoName={request.condominio_nome} existingSuppliers={[]} />}
      {viewingBudget && <BudgetPreviewModal isOpen={!!viewingBudget} onClose={() => setViewingBudget(null)} budget={viewingBudget} canApprove={isCondo && request.status === RequestStatus.EM_ANALISE_CONDOMINIO} onApprove={(b) => initiateCondoApproval(b.numero)} />}
      
      {/* APPROVAL MODAL & DELIVERY MODAL (Same logic as before) */}
      {isApprovalFormOpen && (
          <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4 backdrop-blur-sm">
              <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl p-6 relative animate-fadeInUp">
                  <button onClick={() => setIsApprovalFormOpen(false)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"><X size={20}/></button>
                  <div className="flex flex-col items-center text-center mb-6">
                      <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center text-green-600 mb-4 border border-green-200"><UserCheck size={32} /></div>
                      <h3 className="text-xl font-extrabold text-gray-900">Confirmar Autorização</h3>
                      <p className="text-sm text-gray-500 mt-2">Você está aprovando o <b>Orçamento #{pendingBudgetToApprove}</b>.</p>
                  </div>
                  <div className="space-y-4">
                      <div>
                          <label className="block text-sm font-bold text-gray-700 mb-1">Seu Nome Completo <span className="text-red-500">*</span></label>
                          <input className="block w-full rounded-xl border-gray-300 shadow-sm focus:border-brand-500 focus:ring-brand-500 p-3 bg-white text-gray-900" placeholder="Ex: Carlos Alberto de Souza" value={approvalData.name} onChange={e => setApprovalData({...approvalData, name: e.target.value})} autoFocus disabled={isProcessingAction}/>
                      </div>
                      <div>
                          <label className="block text-sm font-bold text-gray-700 mb-1">Seu Cargo ou Função <span className="text-red-500">*</span></label>
                          <input className="block w-full rounded-xl border-gray-300 shadow-sm focus:border-brand-500 focus:ring-brand-500 p-3 bg-white text-gray-900" placeholder="Ex: Síndico, Conselheiro, Subsíndico" value={approvalData.role} onChange={e => setApprovalData({...approvalData, role: e.target.value})} disabled={isProcessingAction}/>
                      </div>
                      <div className="flex gap-3 pt-2">
                          <Button variant="outline" onClick={() => setIsApprovalFormOpen(false)} className="flex-1" disabled={isProcessingAction}>Cancelar</Button>
                          <Button onClick={handleFinalApproval} disabled={isProcessingAction || !approvalData.name.trim() || !approvalData.role.trim()} className="flex-1 bg-green-600 hover:bg-green-700 text-white">{isProcessingAction ? <Loader2 className="animate-spin" size={16}/> : 'Confirmar Aprovação'}</Button>
                      </div>
                  </div>
              </div>
          </div>
      )}

      {isDeliveryModalOpen && (
          <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4 backdrop-blur-sm">
              <div className="bg-white w-full max-w-sm rounded-2xl shadow-2xl p-6 relative animate-fadeInUp">
                  <button onClick={() => setIsDeliveryModalOpen(false)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"><X size={20}/></button>
                  <div className="text-center mb-6">
                      <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 mb-4 mx-auto border border-blue-200"><CalendarClock size={32} /></div>
                      <h3 className="text-xl font-extrabold text-gray-900">Previsão de Entrega</h3>
                      <p className="text-sm text-gray-500 mt-2">Informe a data prevista pelo fornecedor para notificar o condomínio.</p>
                  </div>
                  <div className="space-y-4">
                      <div>
                          <label className="block text-sm font-bold text-gray-700 mb-1">Data Prevista <span className="text-red-500">*</span></label>
                          <input type="date" className="block w-full rounded-xl border-gray-300 shadow-sm focus:border-brand-500 focus:ring-brand-500 p-3 bg-white text-gray-900 font-bold" value={deliveryDateInput} onChange={e => setDeliveryDateInput(e.target.value)} min={new Date().toISOString().split('T')[0]}/>
                      </div>
                      <div className="flex gap-3 pt-2">
                          <Button variant="outline" onClick={() => setIsDeliveryModalOpen(false)} className="flex-1">Cancelar</Button>
                          <Button onClick={request.estimated_delivery_date ? handleUpdateDeliveryDate : confirmDeliveryWithDate} className="flex-1 bg-brand-600">{isProcessingAction ? <Loader2 className="animate-spin"/> : 'Confirmar'}</Button>
                      </div>
                  </div>
              </div>
          </div>
      )}

      {isDeclineModalOpen && (
          <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4 backdrop-blur-sm">
              <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl p-6 relative animate-fadeInUp">
                  <button onClick={() => setIsDeclineModalOpen(false)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"><X size={20}/></button>
                  <div className="text-center mb-6">
                      <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center text-red-600 mb-4 mx-auto border border-red-200"><XCircle size={32} /></div>
                      <h3 className="text-xl font-extrabold text-gray-900">Declinar Solicitação</h3>
                      <p className="text-sm text-gray-500 mt-2">Informe o motivo da reprovação para o condomínio.</p>
                  </div>
                  <div className="space-y-4">
                      <div>
                          <label className="block text-sm font-bold text-gray-700 mb-1">Justificativa <span className="text-red-500">*</span></label>
                          <Textarea 
                              className="w-full" 
                              placeholder="Ex: Condomínio sem caixa para esta aquisição..." 
                              value={rejectReason} 
                              onChange={e => setRejectReason(e.target.value)}
                              autoFocus
                          />
                      </div>
                      <div className="flex gap-3 pt-2">
                          <Button variant="outline" onClick={() => setIsDeclineModalOpen(false)} className="flex-1" disabled={isProcessingAction}>Cancelar</Button>
                          <Button onClick={handleDeclineRequest} disabled={isProcessingAction || !rejectReason.trim()} className="flex-1 bg-red-600 hover:bg-red-700 text-white shadow-md shadow-red-500/20">{isProcessingAction ? <Loader2 className="animate-spin"/> : 'Confirmar Reprovação'}</Button>
                      </div>
                  </div>
              </div>
          </div>
      )}

      {isCloseModalOpen && (
          <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4 backdrop-blur-sm">
              <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl p-6 relative animate-fadeInUp">
                  <button onClick={() => setIsCloseModalOpen(false)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"><X size={20}/></button>
                  <div className="text-center mb-6">
                      <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center text-red-600 mb-4 mx-auto border border-red-200"><XCircle size={32} /></div>
                      <h3 className="text-xl font-extrabold text-gray-900">Encerrar Pedido</h3>
                      <p className="text-sm text-gray-500 mt-2">Informe o motivo do encerramento por falta de resposta.</p>
                  </div>
                  <div className="space-y-4">
                      <div>
                          <label className="block text-sm font-bold text-gray-700 mb-1">Justificativa <span className="text-red-500">*</span></label>
                          <Textarea 
                              className="w-full" 
                              placeholder="Ex: Pedido encerrado por falta de resposta do cliente dentro do prazo de aprovação." 
                              value={closeReason} 
                              onChange={e => setCloseReason(e.target.value)}
                              autoFocus
                          />
                      </div>
                      <div className="flex gap-3 pt-2">
                          <Button variant="outline" onClick={() => setIsCloseModalOpen(false)} className="flex-1" disabled={isProcessingAction}>Cancelar</Button>
                          <Button onClick={handleCloseRequest} disabled={isProcessingAction || !closeReason.trim()} className="flex-1 bg-red-600 hover:bg-red-700 text-white shadow-md shadow-red-500/20">{isProcessingAction ? <Loader2 className="animate-spin"/> : 'Confirmar Encerramento'}</Button>
                      </div>
                  </div>
              </div>
          </div>
      )}

      {/* EDIT REQUEST MODAL */}
      {isEditRequestModalOpen && (
          <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4 backdrop-blur-sm overflow-y-auto">
              <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl p-6 relative animate-fadeInUp my-8">
                  <button onClick={() => setIsEditRequestModalOpen(false)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"><X size={20}/></button>
                  <div className="mb-6">
                      <h3 className="text-xl font-extrabold text-gray-900">Editar Solicitação</h3>
                      <p className="text-sm text-gray-500 mt-1">Faça ajustes no pedido antes da cotação avançar.</p>
                  </div>
                  
                  <form onSubmit={handleEditRequestSubmit} className="space-y-5">
                      <div>
                          <label className="block text-sm font-bold text-gray-700 mb-2">Tipo de Pedido</label>
                          <div className="grid grid-cols-2 gap-3">
                              <button 
                                type="button"
                                onClick={() => setEditRequestData({...editRequestData, tipo: RequestType.RECORRENTE})}
                                className={`p-3 rounded-lg border text-sm font-bold transition-all ${editRequestData.tipo === RequestType.RECORRENTE ? 'bg-brand-50 border-brand-500 text-brand-700' : 'bg-white border-gray-200 text-gray-600'}`}
                              >
                                  Recorrente (Rotina)
                              </button>
                              <button 
                                type="button"
                                onClick={() => setEditRequestData({...editRequestData, tipo: RequestType.AVULSA_MELHORIA})}
                                className={`p-3 rounded-lg border text-sm font-bold transition-all ${editRequestData.tipo === RequestType.AVULSA_MELHORIA ? 'bg-brand-50 border-brand-500 text-brand-700' : 'bg-white border-gray-200 text-gray-600'}`}
                              >
                                  Avulsa / Melhoria
                              </button>
                          </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                         <div>
                            <label className="block text-sm font-bold text-gray-700 mb-1">Categoria</label>
                            <select 
                                className="block w-full rounded-xl border-gray-300 bg-white text-gray-900 focus:border-brand-500 focus:ring-brand-500 sm:text-sm p-3 border shadow-sm"
                                value={editRequestData.category_id || ''}
                                onChange={(e) => {
                                    const cat = categories.find(c => c.id === e.target.value);
                                    setEditRequestData({...editRequestData, category_id: e.target.value, categoria: cat?.name || 'Outros'})
                                }}
                                required
                            >
                                <option value="">Selecione...</option>
                                {categories.filter(c => c.active).map(c => (
                                    <option key={c.id} value={c.id}>{c.name}</option>
                                ))}
                            </select>
                         </div>
                         
                         <Select 
                            label="Prioridade"
                            options={[
                              { value: RequestLevel.N1, label: '🚨 Emergencial' },
                              { value: RequestLevel.N2, label: '⚡ Operacional' },
                              { value: RequestLevel.N3, label: '📅 Planejável' },
                            ]}
                            value={editRequestData.nivel || ''}
                            onChange={(e) => setEditRequestData({...editRequestData, nivel: e.target.value as RequestLevel})}
                         />
                      </div>
                      
                      <Input 
                        label="Título do Pedido" 
                        value={editRequestData.titulo || ''}
                        onChange={(e) => setEditRequestData({...editRequestData, titulo: e.target.value})}
                        required
                      />

                      <Textarea 
                        label="Descrição Detalhada e Itens" 
                        value={editRequestData.descricao || ''}
                        onChange={(e) => setEditRequestData({...editRequestData, descricao: e.target.value})}
                        required
                        rows={5}
                      />

                      <div className="bg-purple-50 p-4 rounded-xl border border-purple-200 flex items-center gap-3">
                          <input 
                              type="checkbox" 
                              id="edit_assembly_chk"
                              className="w-5 h-5 text-purple-600 rounded focus:ring-purple-500 border-gray-300"
                              checked={editRequestData.assembly_data?.required || false}
                              onChange={(e) => setEditRequestData({
                                  ...editRequestData, 
                                  assembly_data: { 
                                      required: e.target.checked, 
                                      status: editRequestData.assembly_data?.status || 'PENDENTE' 
                                  }
                              })}
                          />
                          <label htmlFor="edit_assembly_chk" className="text-sm text-purple-900 font-bold cursor-pointer select-none flex items-center gap-2">
                              <Users size={16}/> Incluir este orçamento na pauta da Assembleia
                          </label>
                      </div>

                      <div className="flex gap-3 pt-4 border-t border-gray-100">
                          <Button type="button" variant="outline" onClick={() => setIsEditRequestModalOpen(false)} className="flex-1">Cancelar</Button>
                          <Button type="submit" disabled={isProcessingAction} className="flex-1 bg-brand-600">{isProcessingAction ? <Loader2 className="animate-spin" size={16}/> : 'Salvar Alterações'}</Button>
                      </div>
                  </form>
              </div>
          </div>
      )}

      {/* DEDICATED SUPPLIER QUOTE REQUEST MODAL */}
      <SupplierQuoteRequestModal
        isOpen={isSupplierQuoteModalOpen}
        onClose={() => setIsSupplierQuoteModalOpen(false)}
        request={request}
      />
    </div>
  );
};
