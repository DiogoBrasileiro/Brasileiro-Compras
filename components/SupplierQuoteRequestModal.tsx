import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { Solicitacao, Supplier, CRMQuoteItem, CRMQuoteHistory } from '../types';
import { 
  X, Send, Download, Copy, Phone, FileText, CheckCircle2, AlertTriangle, 
  Building, User, Clock, Plus, Trash2, Edit3, MessageCircle, ExternalLink, RefreshCw,
  Paperclip, Image as ImageIcon, FileCheck, UploadCloud, Layers
} from 'lucide-react';
import { generateQuoteRequestPdf, QuoteRequestItem, AttachmentToInclude } from '../utils/generateQuoteRequestPdf';
import { LOGO_URL } from '../constants';

interface SupplierQuoteRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  request: Solicitacao;
  initialSupplierId?: string;
  initialMode?: 'REQUEST' | 'REMINDER';
  onSuccess?: () => void;
}

export const SupplierQuoteRequestModal: React.FC<SupplierQuoteRequestModalProps> = ({
  isOpen,
  onClose,
  request,
  initialSupplierId,
  initialMode = 'REQUEST',
  onSuccess
}) => {
  const { suppliers, currentUser, updateRequest, updateSupplier, logoUrl } = useApp();

  const [mode, setMode] = useState<'REQUEST' | 'REMINDER'>(initialMode);
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>(initialSupplierId || '');
  const [supplierWhatsapp, setSupplierWhatsapp] = useState<string>('');
  const [supplierContactName, setSupplierContactName] = useState<string>('');
  const [supplierEmail, setSupplierEmail] = useState<string>('');
  const [saveWhatsappPermanently, setSaveWhatsappPermanently] = useState<boolean>(true);

  // Attachments Management
  const [availableAttachments, setAvailableAttachments] = useState<AttachmentToInclude[]>([]);
  const [selectedAttachmentIds, setSelectedAttachmentIds] = useState<string[]>([]);
  const [includeAttachmentsInPdf, setIncludeAttachmentsInPdf] = useState<boolean>(true);
  const [itemsMode, setItemsMode] = useState<'ATTACHMENT' | 'TYPED'>('ATTACHMENT');

  // Editable Order Data
  const [title, setTitle] = useState<string>(request.titulo || '');
  const [description, setDescription] = useState<string>(request.descricao || '');
  const [observations, setObservations] = useState<string>('');
  const [deadlineDays, setDeadlineDays] = useState<number>(request.deadline_days || 3);
  const [items, setItems] = useState<QuoteRequestItem[]>([]);

  // UI state
  const [isGeneratingPdf, setIsGeneratingPdf] = useState<boolean>(false);
  const [copiedMessage, setCopiedMessage] = useState<boolean>(false);
  const [actionSuccessMessage, setActionSuccessMessage] = useState<string>('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Active Suppliers list
  const activeSuppliers = useMemo(() => {
    return suppliers.filter(s => s.active !== false);
  }, [suppliers]);

  // Selected Supplier object
  const selectedSupplier = useMemo(() => {
    return suppliers.find(s => s.id === selectedSupplierId);
  }, [suppliers, selectedSupplierId]);

  // Initialize or reset when opening modal or changing supplier
  useEffect(() => {
    if (!isOpen) return;

    setMode(initialMode);
    setTitle(request.titulo || '');
    setDescription(request.descricao || '');
    setObservations('');
    setDeadlineDays(request.deadline_days || 3);
    setCopiedMessage(false);
    setActionSuccessMessage('');

    // 1. Initialize Attachments from Request
    const initialAtts: AttachmentToInclude[] = (request.attachments || []).map((att: any) => ({
      id: att.id || `att-${Math.random()}`,
      fileName: att.fileName || att.name || 'documento_anexo',
      publicUrl: att.publicUrl || att.url || '',
      fileType: att.fileType || (att.fileName?.endsWith('.pdf') ? 'application/pdf' : 'image/jpeg')
    }));

    setAvailableAttachments(initialAtts);
    setSelectedAttachmentIds(initialAtts.map(a => a.id));

    // Se houver anexos na solicitação, o modo padrão é ATTACHMENT (conforme documento anexo, sem digitar itens)
    const hasAttachments = initialAtts.length > 0;
    setIncludeAttachmentsInPdf(hasAttachments);
    setItemsMode(hasAttachments ? 'ATTACHMENT' : 'TYPED');

    // 2. Pre-populate items if typing is chosen
    if (request.stock_replenishment_items && request.stock_replenishment_items.length > 0) {
      setItems(
        request.stock_replenishment_items.map((it: any, idx: number) => ({
          id: `item-${idx}-${Date.now()}`,
          description: it.name || it.description || `Item ${idx + 1}`,
          quantity: Number(it.qty || it.current_qty || 1),
          unit: it.unit || 'un',
          notes: it.notes || ''
        }))
      );
    } else {
      setItems([
        {
          id: `item-1-${Date.now()}`,
          description: request.titulo || '',
          quantity: 1,
          unit: 'un',
          notes: ''
        }
      ]);
    }

    // Default supplier selection
    if (initialSupplierId) {
      setSelectedSupplierId(initialSupplierId);
    } else if (activeSuppliers.length > 0 && !selectedSupplierId) {
      setSelectedSupplierId(activeSuppliers[0].id);
    }
  }, [isOpen, initialSupplierId, request]);

  // When selected supplier changes, auto-fill contact info
  useEffect(() => {
    if (selectedSupplier) {
      setSupplierWhatsapp(selectedSupplier.whatsapp || selectedSupplier.phone || '');
      setSupplierContactName(selectedSupplier.contact_name || '');
      setSupplierEmail(selectedSupplier.email || '');
    }
  }, [selectedSupplier]);

  if (!isOpen) return null;

  // Format WhatsApp number for URL
  const formatWhatsappPhone = (phoneStr: string) => {
    const digits = phoneStr.replace(/\D/g, '');
    if (!digits) return '';
    if (digits.length === 10 || digits.length === 11) {
      return `55${digits}`;
    }
    return digits;
  };

  // Build the suggested WhatsApp messages
  const supplierDisplayName = selectedSupplier?.name || 'Fornecedor';
  const whatsappRequestMessage = itemsMode === 'ATTACHMENT'
    ? `Olá, ${supplierDisplayName}. Segue solicitação de orçamento referente ao protocolo ${request.id}, do condomínio ${request.condominio_nome}. A relação dos materiais consta no documento anexo. Favor retornar com valores, prazo de entrega, condições de pagamento e validade da proposta.`
    : `Olá, ${supplierDisplayName}. Segue solicitação de orçamento referente ao protocolo ${request.id}, do condomínio ${request.condominio_nome}. Favor retornar com valores, prazo de entrega, condições de pagamento e validade da proposta.`;

  const whatsappReminderMessage = `Olá, ${supplierDisplayName}. Reforçando a solicitação de orçamento referente ao protocolo ${request.id}, do condomínio ${request.condominio_nome}. Ainda aguardamos seu retorno. Obrigado.`;

  const activeWhatsappMessage = mode === 'REQUEST' ? whatsappRequestMessage : whatsappReminderMessage;

  // Attachments Selection Toggles
  const handleToggleAttachment = (id: string) => {
    setSelectedAttachmentIds(prev =>
      prev.includes(id) ? prev.filter(attId => attId !== id) : [...prev, id]
    );
  };

  const handleSelectAllAttachments = () => {
    if (selectedAttachmentIds.length === availableAttachments.length) {
      setSelectedAttachmentIds([]);
    } else {
      setSelectedAttachmentIds(availableAttachments.map(a => a.id));
    }
  };

  // Add extra local file to attachments list
  const handleAddLocalFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const filesArray: File[] = Array.from(e.target.files);

    const newAttachments: AttachmentToInclude[] = filesArray.map((file, idx) => ({
      id: `local-att-${Date.now()}-${idx}`,
      fileName: file.name,
      fileType: file.type,
      file: file
    }));

    setAvailableAttachments(prev => [...prev, ...newAttachments]);
    setSelectedAttachmentIds(prev => [...prev, ...newAttachments.map(n => n.id)]);
    setIncludeAttachmentsInPdf(true);

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Item list actions (when typed mode is selected)
  const handleAddItem = () => {
    setItems(prev => [
      ...prev,
      {
        id: `item-${Date.now()}`,
        description: '',
        quantity: 1,
        unit: 'un',
        notes: ''
      }
    ]);
  };

  const handleUpdateItem = (id: string, field: keyof QuoteRequestItem, val: any) => {
    setItems(prev =>
      prev.map(it => (it.id === id ? { ...it, [field]: val } : it))
    );
  };

  const handleRemoveItem = (id: string) => {
    if (items.length <= 1) return;
    setItems(prev => prev.filter(it => it.id !== id));
  };

  // Selected attachments list for PDF generation
  const activeSelectedAttachments = availableAttachments.filter(a =>
    selectedAttachmentIds.includes(a.id)
  );

  // Register action in CRM & Request History
  const registerActionInCRM = async (channelUsed: 'whatsapp' | 'pdf' = 'whatsapp', isReminder: boolean = false) => {
    if (!selectedSupplier) return;

    if (saveWhatsappPermanently && supplierWhatsapp && supplierWhatsapp !== selectedSupplier.whatsapp) {
      try {
        await updateSupplier(selectedSupplier.id, {
          whatsapp: supplierWhatsapp.trim()
        });
      } catch (err) {
        console.error("Erro ao atualizar WhatsApp permanente do fornecedor:", err);
      }
    }

    const currentCRMQuotes = (request.assembly_data?.crm_quotes || []) as CRMQuoteItem[];
    const nowIso = new Date().toISOString();
    const operatorName = currentUser?.nome || 'Operador de Compras';
    const crmChannel: 'whatsapp' | 'email' | 'phone' | 'outro' = channelUsed === 'whatsapp' ? 'whatsapp' : 'outro';

    const existingQuoteIndex = currentCRMQuotes.findIndex(
      q => q.supplier_id === selectedSupplier.id || q.supplier_name.toLowerCase() === selectedSupplier.name.toLowerCase()
    );

    let updatedList: CRMQuoteItem[] = [...currentCRMQuotes];

    const historyEntry: CRMQuoteHistory = {
      id: `hist-${Date.now()}`,
      date: nowIso,
      user_name: operatorName,
      description: isReminder
        ? `Cobrança de orçamento enviada via WhatsApp para ${selectedSupplier.name}.`
        : `Solicitação de orçamento emitida via WhatsApp para ${selectedSupplier.name}. Status: Aguardando Retorno.`
    };

    if (existingQuoteIndex >= 0) {
      const existing = updatedList[existingQuoteIndex];
      updatedList[existingQuoteIndex] = {
        ...existing,
        contact_name: supplierContactName || existing.contact_name,
        whatsapp: supplierWhatsapp || existing.whatsapp,
        phone: existing.phone || supplierWhatsapp,
        email: supplierEmail || existing.email,
        requested_at: existing.requested_at || nowIso,
        sent_by_name: operatorName,
        channel: crmChannel,
        status: isReminder ? existing.status : 'AGUARDANDO_RETORNO',
        history: [...(existing.history || []), historyEntry]
      };
    } else {
      const newQuoteItem: CRMQuoteItem = {
        id: `quote-${Date.now()}`,
        supplier_id: selectedSupplier.id,
        supplier_name: selectedSupplier.name,
        contact_name: supplierContactName || selectedSupplier.contact_name,
        whatsapp: supplierWhatsapp || selectedSupplier.whatsapp,
        phone: selectedSupplier.phone || supplierWhatsapp,
        email: supplierEmail || selectedSupplier.email,
        activity_branch: selectedSupplier.activity_branch,
        requested_at: nowIso,
        channel: crmChannel,
        sent_by_name: operatorName,
        status: 'AGUARDANDO_RETORNO',
        history: [historyEntry]
      };
      updatedList.push(newQuoteItem);
    }

    const generalHist = request.historico || [];
    const newGeneralLog = {
      id: `log-${Date.now()}`,
      data: nowIso,
      usuario_nome: operatorName,
      descricao: isReminder
        ? `Cobrança de orçamento enviada ao fornecedor ${selectedSupplier.name} (WhatsApp).`
        : `Solicitação de orçamento enviada ao fornecedor ${selectedSupplier.name} (WHATSAPP) - Status CRM: Aguardando Retorno.`
    };

    await updateRequest(request.id, {
      assembly_data: {
        ...request.assembly_data,
        required: request.assembly_data?.required || false,
        status: request.assembly_data?.status || '',
        crm_quotes: updatedList
      },
      historico: [...generalHist, newGeneralLog]
    });
  };

  // ACTION 1: BAIXAR PDF (Apenas gera e baixa o documento, sem alterar status do fornecedor)
  const handleDownloadPdf = async () => {
    if (!selectedSupplier) {
      alert("Selecione um fornecedor cadastrado.");
      return;
    }

    setIsGeneratingPdf(true);
    try {
      await generateQuoteRequestPdf({
        request,
        supplier: {
          name: selectedSupplier.name,
          contact_name: supplierContactName,
          whatsapp: supplierWhatsapp,
          phone: selectedSupplier.phone,
          email: supplierEmail
        },
        items: itemsMode === 'ATTACHMENT' ? [] : items.filter(it => it.description.trim() !== ''),
        itemsMode,
        description,
        observations,
        deadlineDays,
        logoDataUrl: logoUrl || LOGO_URL,
        includeAttachments: includeAttachmentsInPdf,
        selectedAttachments: activeSelectedAttachments
      });

      setActionSuccessMessage(
        includeAttachmentsInPdf && activeSelectedAttachments.length > 0
          ? `PDF Único gerado com sucesso contendo a Capa e ${activeSelectedAttachments.length} anexo(s) incorporado(s)! O fornecedor ainda não foi acionado.`
          : 'PDF de solicitação gerado com sucesso! O fornecedor ainda não foi acionado.'
      );
    } catch (err) {
      console.error("Erro ao gerar PDF:", err);
      alert("Houve uma falha ao gerar o PDF da solicitação.");
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  // ACTION 2: ENVIAR PELO WHATSAPP (Baixa o PDF único, copia a mensagem e abre o WhatsApp)
  const handleSendWhatsapp = async () => {
    if (!selectedSupplier) {
      alert("Selecione um fornecedor cadastrado.");
      return;
    }

    const cleanPhone = formatWhatsappPhone(supplierWhatsapp);
    if (!cleanPhone || cleanPhone.length < 10) {
      const confirmManual = confirm(
        "O número de WhatsApp do fornecedor está incompleto ou não foi informado.\n\nDeseja abrir o WhatsApp mesmo assim para selecionar o contato manualmente?"
      );
      if (!confirmManual) return;
    }

    const messageToUse = activeWhatsappMessage;

    // 1. Copy message to clipboard automatically
    try {
      await navigator.clipboard.writeText(messageToUse);
      setCopiedMessage(true);
    } catch (e) {
      console.warn("Could not copy automatically", e);
    }

    // 2. Generate and download single PDF so operator can attach it
    if (mode === 'REQUEST') {
      try {
        await generateQuoteRequestPdf({
          request,
          supplier: {
            name: selectedSupplier.name,
            contact_name: supplierContactName,
            whatsapp: supplierWhatsapp,
            phone: selectedSupplier.phone,
            email: supplierEmail
          },
          items: itemsMode === 'ATTACHMENT' ? [] : items.filter(it => it.description.trim() !== ''),
          itemsMode,
          description,
          observations,
          deadlineDays,
          logoDataUrl: logoUrl || LOGO_URL,
          includeAttachments: includeAttachmentsInPdf,
          selectedAttachments: activeSelectedAttachments
        });
      } catch (err) {
        console.error("Erro ao baixar PDF ao disparar WhatsApp:", err);
      }
    }

    // 3. Register in CRM
    await registerActionInCRM('whatsapp', mode === 'REMINDER');

    // 4. Open WhatsApp
    const encodedText = encodeURIComponent(messageToUse);
    const whatsappUrl = cleanPhone
      ? `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodedText}`
      : `https://api.whatsapp.com/send?text=${encodedText}`;

    window.open(whatsappUrl, '_blank', 'noopener,noreferrer');

    setActionSuccessMessage(
      mode === 'REMINDER'
        ? 'Cobrança enviada pelo WhatsApp e registrada no histórico!'
        : 'WhatsApp aberto com a mensagem pronta, PDF único baixado para anexo e CRM atualizado para "Aguardando Retorno"!'
    );

    if (onSuccess) onSuccess();
  };

  // ACTION 3: COPIAR MENSAGEM
  const handleCopyMessage = async () => {
    try {
      await navigator.clipboard.writeText(activeWhatsappMessage);
      setCopiedMessage(true);
      setTimeout(() => setCopiedMessage(false), 3000);
    } catch (e) {
      alert("Falha ao copiar texto.");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm overflow-y-auto animate-fadeIn">
      <div className="bg-white w-full max-w-3xl rounded-2xl shadow-2xl border border-gray-200 overflow-hidden my-auto max-h-[94vh] flex flex-col">
        
        {/* HEADER */}
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-5 sm:p-6 flex items-start justify-between shrink-0">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="bg-emerald-500 text-white text-[10px] font-black uppercase px-2 py-0.5 rounded tracking-wider flex items-center gap-1">
                <MessageCircle size={11} /> CRM de Compras
              </span>
              <span className="text-slate-300 text-xs font-mono font-bold">
                {request.id}
              </span>
            </div>
            <h2 className="text-lg sm:text-xl font-black text-white flex items-center gap-2">
              <FileText className="text-emerald-400 shrink-0" size={22} />
              {mode === 'REQUEST' ? 'Solicitar Orçamento ao Fornecedor' : 'Reenviar / Cobrar Orçamento'}
            </h2>
            <p className="text-xs text-slate-300 mt-1 flex items-center gap-1">
              <Building size={13} className="text-slate-400" />
              <span>{request.condominio_nome}</span>
            </p>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-white/10 text-white/80 hover:bg-white/20 hover:text-white transition"
          >
            <X size={20} />
          </button>
        </div>

        {/* MODE TOGGLE TAB */}
        <div className="bg-slate-100 px-6 py-2 border-b border-slate-200 flex items-center justify-between text-xs shrink-0">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setMode('REQUEST')}
              className={`px-3 py-1.5 rounded-lg font-bold transition ${
                mode === 'REQUEST'
                  ? 'bg-white text-indigo-950 shadow-sm border border-slate-300'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              1. Solicitação de Orçamento
            </button>
            <button
              onClick={() => setMode('REMINDER')}
              className={`px-3 py-1.5 rounded-lg font-bold transition flex items-center gap-1 ${
                mode === 'REMINDER'
                  ? 'bg-amber-100 text-amber-900 shadow-sm border border-amber-300'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <RefreshCw size={12} /> 2. Cobrança / Reenvio
            </button>
          </div>

          <span className="hidden sm:inline text-[11px] text-slate-500 font-medium">
            Fluxo simplificado com capa institucional e anexos
          </span>
        </div>

        {/* NOTIFICATION BANNER IF SUCCESS */}
        {actionSuccessMessage && (
          <div className="bg-emerald-50 border-b border-emerald-200 p-3 px-6 text-emerald-800 text-xs font-bold flex items-center gap-2 animate-fadeIn shrink-0">
            <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
            <span>{actionSuccessMessage}</span>
          </div>
        )}

        {/* MODAL BODY (SCROLLABLE) */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-6 text-slate-800 flex-1">
          
          {/* 1. SELEÇÃO DO FORNECEDOR */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-black text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <User size={14} className="text-indigo-600" />
                Fornecedor Cadastrado *
              </label>
              <span className="text-[11px] text-indigo-700 font-bold">
                {activeSuppliers.length} fornecedores disponíveis
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <select
                  value={selectedSupplierId}
                  onChange={(e) => setSelectedSupplierId(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-300 bg-white text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">Selecione o fornecedor...</option>
                  {activeSuppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} {s.activity_branch ? `(${s.activity_branch})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-emerald-600">
                    <Phone size={14} />
                  </span>
                  <input
                    type="text"
                    placeholder="WhatsApp (ex: 11 99999-9999)"
                    value={supplierWhatsapp}
                    onChange={(e) => setSupplierWhatsapp(e.target.value)}
                    className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-300 bg-white text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>
            </div>

            {selectedSupplier && (
              <div className="pt-2 border-t border-slate-200/80 flex flex-wrap items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-3 text-slate-600 text-[11px]">
                  <span>
                    <strong>Contato:</strong> {supplierContactName || selectedSupplier.contact_name || 'Não informado'}
                  </span>
                  {selectedSupplier.email && (
                    <span>
                      <strong>E-mail:</strong> {selectedSupplier.email}
                    </span>
                  )}
                </div>

                <label className="flex items-center gap-1.5 text-[11px] font-bold text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={saveWhatsappPermanently}
                    onChange={(e) => setSaveWhatsappPermanently(e.target.checked)}
                    className="w-3.5 h-3.5 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
                  />
                  Salvar WhatsApp no cadastro
                </label>
              </div>
            )}
          </div>

          {/* 2. GESTÃO DE ANEXOS & GERADOR DE PDF ÚNICO */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <label className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                  <Paperclip size={14} className="text-indigo-600" />
                  Anexos da Solicitação (Documentos do Pedido)
                </label>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Selecione os arquivos que serão encaminhados ao fornecedor
                </p>
              </div>

              {/* Botão de seleção rápida e upload extra */}
              <div className="flex items-center gap-2">
                {availableAttachments.length > 0 && (
                  <button
                    type="button"
                    onClick={handleSelectAllAttachments}
                    className="text-[11px] text-indigo-700 font-bold hover:underline"
                  >
                    {selectedAttachmentIds.length === availableAttachments.length ? 'Desmarcar todos' : 'Marcar todos'}
                  </button>
                )}

                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept=".pdf,image/*"
                  onChange={handleAddLocalFiles}
                  className="hidden"
                />

                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="text-[11px] bg-white border border-slate-300 hover:border-indigo-400 text-slate-700 px-2.5 py-1 rounded-lg font-bold flex items-center gap-1 shadow-sm transition"
                >
                  <UploadCloud size={12} className="text-indigo-600" />
                  + Anexar outro arquivo
                </button>
              </div>
            </div>

            {/* Toggle de inclusão no PDF Único */}
            <div className="bg-white p-3 rounded-lg border border-indigo-100 flex items-center justify-between shadow-xs">
              <label className="flex items-center gap-2.5 cursor-pointer text-xs font-bold text-slate-800">
                <input
                  type="checkbox"
                  checked={includeAttachmentsInPdf}
                  onChange={(e) => setIncludeAttachmentsInPdf(e.target.checked)}
                  className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
                />
                <div className="flex items-center gap-1.5">
                  <Layers size={15} className="text-indigo-600" />
                  <span>Incluir anexos no PDF</span>
                  <span className="bg-indigo-100 text-indigo-800 text-[10px] font-black px-1.5 py-0.5 rounded uppercase">
                    Gera PDF Único
                  </span>
                </div>
              </label>

              <span className="text-[11px] text-slate-500 hidden sm:inline">
                Pág 1: Capa Brasileiro • Págs seguintes: Anexos
              </span>
            </div>

            {/* Lista de Anexos */}
            {availableAttachments.length === 0 ? (
              <div className="p-4 bg-white rounded-lg border border-dashed border-slate-300 text-center text-xs text-slate-500">
                Nenhum documento anexado a este pedido. Você pode anexar listas em PDF ou fotos clicando em "+ Anexar outro arquivo".
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {availableAttachments.map((att) => {
                  const isSelected = selectedAttachmentIds.includes(att.id);
                  const isPdf = att.fileType?.includes('pdf') || att.fileName.toLowerCase().endsWith('.pdf');

                  return (
                    <div
                      key={att.id}
                      onClick={() => handleToggleAttachment(att.id)}
                      className={`p-2.5 rounded-lg border cursor-pointer transition flex items-center justify-between gap-2 text-xs select-none ${
                        isSelected
                          ? 'bg-indigo-50/70 border-indigo-300 text-indigo-950 font-bold'
                          : 'bg-white border-slate-200 text-slate-600 opacity-80 hover:opacity-100'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => {}}
                          className="w-3.5 h-3.5 text-indigo-600 rounded border-slate-300"
                        />
                        <div className={`p-1.5 rounded ${isPdf ? 'bg-rose-100 text-rose-700' : 'bg-blue-100 text-blue-700'}`}>
                          {isPdf ? <FileText size={14} /> : <ImageIcon size={14} />}
                        </div>
                        <span className="truncate text-[11px]" title={att.fileName}>
                          {att.fileName}
                        </span>
                      </div>

                      {att.publicUrl && (
                        <a
                          href={att.publicUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="text-slate-400 hover:text-indigo-600 p-1 rounded"
                          title="Visualizar anexo original"
                        >
                          <ExternalLink size={13} />
                        </a>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* 3. MODO DE ITENS: CONFORME ANEXO OU DIGITAR MANUAL */}
          {mode === 'REQUEST' && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 pb-2">
                <div>
                  <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                    <Edit3 size={14} className="text-indigo-600" />
                    Relação de Materiais / Escopo
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Defina como a relação de itens constará na capa do documento
                  </p>
                </div>

                {/* Seletor de Modo de Itens */}
                <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-300 text-xs">
                  <button
                    type="button"
                    onClick={() => setItemsMode('ATTACHMENT')}
                    className={`px-3 py-1 rounded-md font-bold transition flex items-center gap-1 ${
                      itemsMode === 'ATTACHMENT'
                        ? 'bg-white text-indigo-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <FileCheck size={13} className="text-teal-600" />
                    Conforme Anexo
                  </button>
                  <button
                    type="button"
                    onClick={() => setItemsMode('TYPED')}
                    className={`px-3 py-1 rounded-md font-bold transition flex items-center gap-1 ${
                      itemsMode === 'TYPED'
                        ? 'bg-white text-indigo-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Edit3 size={13} className="text-indigo-600" />
                    Digitar Itens
                  </button>
                </div>
              </div>

              {/* Título da solicitação */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Título da Solicitação
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-300 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* CONTEÚDO CONDICIONAL DO MODO DE ITENS */}
              {itemsMode === 'ATTACHMENT' ? (
                /* Bloco Informativo de que itens estão em anexo */
                <div className="bg-teal-50/70 border border-teal-200 rounded-xl p-4 text-xs space-y-1.5">
                  <div className="flex items-center gap-2 text-teal-900 font-bold text-sm">
                    <FileCheck size={18} className="text-teal-600" />
                    Relação de materiais: conforme documento anexo.
                  </div>
                  <p className="text-teal-800 text-[11px] leading-relaxed">
                    Você não precisa digitar nenhum item. O fornecedor consultará a relação diretamente nos documentos anexados que compõem o PDF único.
                  </p>
                  {activeSelectedAttachments.length > 0 && (
                    <div className="pt-2 border-t border-teal-200/60 flex flex-wrap gap-1.5 items-center">
                      <span className="text-[10px] uppercase font-bold text-teal-900">Documentos que serão incorporados:</span>
                      {activeSelectedAttachments.map(a => (
                        <span key={a.id} className="bg-white text-teal-800 border border-teal-200 px-2 py-0.5 rounded text-[10px] font-mono">
                          {a.fileName}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                /* Relação de Itens / Quantidades / Unidade Digitados */
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-black text-slate-700 uppercase tracking-wider">
                      Itens Digitados para a Capa
                    </label>
                    <button
                      type="button"
                      onClick={handleAddItem}
                      className="text-[11px] bg-indigo-50 text-indigo-700 hover:bg-indigo-100 font-bold px-2.5 py-1 rounded-lg border border-indigo-200 flex items-center gap-1"
                    >
                      <Plus size={12} /> Adicionar Item
                    </button>
                  </div>

                  <div className="space-y-2">
                    {items.map((item, index) => (
                      <div
                        key={item.id}
                        className="bg-white p-2.5 rounded-lg border border-slate-200 flex flex-col sm:flex-row items-center gap-2 text-xs"
                      >
                        <span className="font-bold text-slate-400 font-mono text-[11px] w-5">
                          #{(index + 1).toString().padStart(2, '0')}
                        </span>

                        <div className="flex-1 w-full">
                          <input
                            type="text"
                            placeholder="Descrição do produto ou serviço..."
                            value={item.description}
                            onChange={(e) => handleUpdateItem(item.id, 'description', e.target.value)}
                            className="w-full p-1.5 rounded border border-slate-300 text-xs font-bold text-slate-900 focus:outline-none"
                          />
                        </div>

                        <div className="flex items-center gap-2 w-full sm:w-auto">
                          <div className="w-20">
                            <input
                              type="number"
                              min="1"
                              placeholder="Qtd"
                              value={item.quantity}
                              onChange={(e) => handleUpdateItem(item.id, 'quantity', Number(e.target.value))}
                              className="w-full p-1.5 rounded border border-slate-300 text-xs text-center font-bold text-slate-900 focus:outline-none"
                            />
                          </div>

                          <div className="w-24">
                            <select
                              value={item.unit}
                              onChange={(e) => handleUpdateItem(item.id, 'unit', e.target.value)}
                              className="w-full p-1.5 rounded border border-slate-300 text-xs bg-white text-slate-900 focus:outline-none"
                            >
                              <option value="un">un</option>
                              <option value="cx">cx</option>
                              <option value="pct">pct</option>
                              <option value="l">l</option>
                              <option value="kg">kg</option>
                              <option value="m">m</option>
                              <option value="m²">m²</option>
                              <option value="serviço">serviço</option>
                              <option value="par">par</option>
                            </select>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleRemoveItem(item.id)}
                            disabled={items.length <= 1}
                            className={`p-1.5 rounded hover:bg-rose-50 text-rose-600 transition ${
                              items.length <= 1 ? 'opacity-30 cursor-not-allowed' : ''
                            }`}
                            title="Remover Item"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Observações e Prazo de Retorno */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Observações Adicionais para o Fornecedor
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: Faturar contra condomínio, entrega única..."
                    value={observations}
                    onChange={(e) => setObservations(e.target.value)}
                    className="w-full p-2 rounded-xl border border-slate-300 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Prazo Retorno Desejado
                  </label>
                  <select
                    value={deadlineDays}
                    onChange={(e) => setDeadlineDays(Number(e.target.value))}
                    className="w-full p-2 rounded-xl border border-slate-300 text-xs font-bold text-slate-900 bg-white focus:outline-none"
                  >
                    <option value={1}>1 dia útil (Urgente)</option>
                    <option value={2}>2 dias úteis</option>
                    <option value={3}>3 dias úteis (Padrão)</option>
                    <option value={5}>5 dias úteis</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* 4. MENSAGEM DO WHATSAPP (PREVIEW PRONTA) */}
          <div className="bg-emerald-50/60 p-4 rounded-xl border border-emerald-200 space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-black text-emerald-950 uppercase tracking-wider flex items-center gap-1.5">
                <MessageCircle size={14} className="text-emerald-700" />
                Mensagem Sugerida p/ WhatsApp
              </label>
              <button
                type="button"
                onClick={handleCopyMessage}
                className="text-[11px] font-bold text-emerald-800 hover:text-emerald-950 bg-emerald-100/80 px-2 py-0.5 rounded flex items-center gap-1 transition"
              >
                {copiedMessage ? <CheckCircle2 size={12} className="text-emerald-600" /> : <Copy size={12} />}
                {copiedMessage ? 'Copiada!' : 'Copiar Texto'}
              </button>
            </div>

            <div className="p-3 bg-white rounded-lg border border-emerald-200/80 text-xs text-slate-800 font-medium leading-relaxed whitespace-pre-wrap">
              {activeWhatsappMessage}
            </div>

            <p className="text-[10px] text-emerald-800 italic">
              {mode === 'REQUEST'
                ? '* Ao clicar em "Enviar pelo WhatsApp", o PDF Único (capa + anexos) é baixado automaticamente no seu dispositivo e o WhatsApp é aberto com a mensagem preenchida.'
                : '* Mensagem de cobrança para fornecedores pendentes de resposta.'}
            </p>
          </div>
        </div>

        {/* FOOTER ACTIONS */}
        <div className="bg-slate-50 border-t border-slate-200 p-4 sm:p-5 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          <div className="text-[11px] text-slate-500 text-center sm:text-left">
            Ao emitir pelo WhatsApp, o status no CRM é atualizado para{' '}
            <span className="font-bold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded">
              Aguardando Retorno
            </span>
          </div>

          <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 text-xs font-bold text-slate-600 hover:text-slate-900 bg-white border border-slate-300 rounded-xl hover:bg-slate-100 transition"
            >
              Fechar
            </button>

            {mode === 'REQUEST' && (
              <button
                type="button"
                onClick={handleDownloadPdf}
                disabled={isGeneratingPdf || !selectedSupplierId}
                className="flex items-center justify-center gap-1.5 px-4 py-2.5 text-xs font-bold text-slate-800 bg-white border-2 border-slate-300 hover:border-slate-400 rounded-xl hover:bg-slate-100 transition shadow-sm disabled:opacity-50"
              >
                <Download size={14} className="text-slate-700" />
                {isGeneratingPdf ? 'Gerando PDF Único...' : (includeAttachmentsInPdf && activeSelectedAttachments.length > 0 ? 'Baixar PDF Único' : 'Baixar PDF')}
              </button>
            )}

            <button
              type="button"
              onClick={handleSendWhatsapp}
              disabled={!selectedSupplierId}
              className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-5 py-2.5 text-xs font-black text-white bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 rounded-xl shadow-md hover:shadow-lg transition disabled:opacity-50"
            >
              <Send size={14} />
              {mode === 'REQUEST' ? 'Enviar pelo WhatsApp' : 'Cobrar pelo WhatsApp'}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
