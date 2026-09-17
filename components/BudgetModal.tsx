
import React, { useState, useEffect, useMemo } from 'react';
import { Orcamento, BudgetItem, BudgetAttachment, SupplierType } from '../types';
import { Button, Input, Select, Textarea } from './UI';
import { X, UploadCloud, FileText, Trash2, Plus, AlertCircle, Calculator, Eye, ShieldCheck, Trophy, BadgeCheck, Image as ImageIcon, Truck, Search } from 'lucide-react';
import { uploadBudgetFile } from '../services/storageService';
import { useApp } from '../context/AppContext'; // Access Supplier Context
import { formatCurrency } from '../utils/formatters';

interface BudgetModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (budget: Orcamento) => Promise<void>;
  initialData?: Orcamento;
  requestId: string;
  condoId: string;
  condoName?: string; 
  existingSuppliers: string[]; // Deprecated but kept for compatibility
}

export const BudgetModal: React.FC<BudgetModalProps> = ({ 
  isOpen, onClose, onSave, initialData, requestId, condoId, condoName 
}) => {
  const { suppliers, addSupplier, purchaseHistory, currentUser } = useApp(); // Get Context
  const isAdmin = currentUser?.role === 'ADMIN';

  if (!isOpen) return null;

  // --- STATE ---
  const [activeTab, setActiveTab] = useState<'general' | 'items' | 'attachments' | 'admin'>('general');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isQuickAddSupplier, setIsQuickAddSupplier] = useState(false);
  
  // Quick Add State
  const [newSupplierName, setNewSupplierName] = useState('');

  // Form Data
  const [formData, setFormData] = useState<Orcamento>(() => {
    const defaultData: Orcamento = {
      id: `b-${Date.now()}`,
      protocolo_orcamento: `ORC-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
      numero: 0,
      fornecedor: '',
      supplier_id: undefined, // Link to supplier
      email_fornecedor: '',
      valor: 0,
      prazo_entrega: '',
      condicoes_pagamento: '',
      validade: '',
      data_orcamento: new Date().toISOString().split('T')[0],
      observacoes: '',
      items: [],
      attachments: [],
      recomendado: false,
      is_melhor_proposta: false,
      status_orcamento: 'ENVIADO',
      version: 1,
      audit_logs: []
    };

    if (initialData) {
      return {
        ...defaultData,
        ...initialData,
        items: initialData.items || [],
        attachments: initialData.attachments || []
      };
    }
    
    return defaultData;
  });

  // Intelligence: Last Purchase from this supplier for this condo
  const lastPurchase = useMemo(() => {
      if (!formData.supplier_id && !formData.fornecedor) return null;
      
      const supplierName = formData.fornecedor.toLowerCase();
      // Find latest record in history for this condo matching supplier name (simple matching)
      // Ideally we would match by ID, but history is mock/flat.
      const found = purchaseHistory
        .filter(h => h.condominio_id === condoId)
        // Fuzzy match supplier name in history items (limited since history structure doesn't store supplier name directly in this mock, assuming it might be in item_key or we skip this for now if data missing)
        // Fallback: This is a placeholder for the "Intelligence" logic requested. 
        // Real implementation requires history to have supplier_id.
        return null; 
  }, [formData.fornecedor, purchaseHistory, condoId]);

  // Calculate Total from Items
  const itemsTotal = useMemo(() => {
    return (formData.items || []).reduce((acc, item) => acc + item.total, 0);
  }, [formData.items]);

  // Sync Total if Items exist
  useEffect(() => {
    if (formData.items && formData.items.length > 0) {
      setFormData(prev => ({ ...prev, valor: itemsTotal }));
    }
  }, [itemsTotal]);

  // --- HANDLERS ---

  const handleGeneralChange = (field: keyof Orcamento, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSupplierSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
      const supId = e.target.value;
      if (!supId) {
          setFormData(prev => ({ ...prev, supplier_id: undefined, fornecedor: '' }));
          return;
      }
      const sup = suppliers.find(s => s.id === supId);
      if (sup) {
          setFormData(prev => ({ ...prev, supplier_id: sup.id, fornecedor: sup.name }));
      }
  };

  const handleQuickAddSupplier = async () => {
      if (!newSupplierName.trim()) return;
      const newId = await addSupplier({
          name: newSupplierName,
          active: true,
          contact_name: 'Pendente',
          phone: '-',
          activity_branch: 'Outros',
          supply_type: SupplierType.AVULSO
      });
      setFormData(prev => ({ ...prev, supplier_id: newId, fornecedor: newSupplierName }));
      setIsQuickAddSupplier(false);
  };

  // Item Handlers
  const addItem = () => {
    const newItem: BudgetItem = {
      id: `i-${Date.now()}`,
      description: '',
      unit: 'un',
      quantity: 1,
      unitPrice: 0,
      total: 0
    };
    setFormData(prev => ({ ...prev, items: [...(prev.items || []), newItem] }));
  };

  const updateItem = (id: string, field: keyof BudgetItem, value: any) => {
    setFormData(prev => ({
      ...prev,
      items: (prev.items || []).map(item => {
        if (item.id !== id) return item;
        const updated = { ...item, [field]: value };
        // Auto-calc total
        if (field === 'quantity' || field === 'unitPrice') {
          updated.total = updated.quantity * updated.unitPrice;
        }
        return updated;
      })
    }));
  };

  const removeItem = (id: string) => {
    setFormData(prev => ({ ...prev, items: (prev.items || []).filter(i => i.id !== id) }));
  };

  // Attachment Handlers
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    
    const files = Array.from(e.target.files) as File[];
    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'];
    const invalidFiles = files.filter(f => !allowedTypes.includes(f.type));

    if (invalidFiles.length > 0) {
        alert("⚠️ Formato inválido: Apenas arquivos PDF, JPG ou PNG são permitidos.");
        e.target.value = '';
        return;
    }
    
    setIsSubmitting(true);
    const newAttachments: BudgetAttachment[] = [];
    const safeCondoId = condoId || 'geral';

    for (const file of files) {
      try {
        const result = await uploadBudgetFile(file, safeCondoId, requestId, formData.id);
        if (result) newAttachments.push(result);
      } catch (err) {
        console.error("Failed to upload file", file.name, err);
      }
    }

    if (newAttachments.length > 0) {
        setFormData(prev => ({ ...prev, attachments: [...(prev.attachments || []), ...newAttachments] }));
    }
    
    setIsSubmitting(false);
    e.target.value = '';
  };

  const removeAttachment = (id: string) => {
    setFormData(prev => ({ ...prev, attachments: (prev.attachments || []).filter(a => a.id !== id) }));
  };

  // Final Save
  const handleSubmit = async () => {
    if (!formData.fornecedor) return alert("Fornecedor é obrigatório.");
    if (formData.valor <= 0) return alert("O valor total deve ser maior que zero.");
    
    setIsSubmitting(true);
    await onSave(formData);
    setIsSubmitting(false);
    onClose();
  };

  // --- RENDER ---
  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-white w-full max-w-4xl h-[90vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-fadeIn">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
          <div>
             <div className="flex items-center gap-2">
                 <h2 className="text-xl font-bold text-gray-900">{initialData ? 'Editar Orçamento' : 'Novo Orçamento'}</h2>
                 <span className="bg-gray-800 text-white text-xs px-2 py-0.5 rounded font-mono">{formData.protocolo_orcamento}</span>
             </div>
             <p className="text-sm text-gray-500 mt-1">
                Solicitação: {requestId} {condoName && <>• <span className="font-bold text-brand-600">{condoName}</span></>}
             </p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full transition"><X size={20}/></button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 overflow-x-auto">
           <button onClick={() => setActiveTab('general')} className={`flex-1 py-3 px-4 text-sm font-bold border-b-2 transition whitespace-nowrap ${activeTab === 'general' ? 'border-brand-600 text-brand-700 bg-brand-50' : 'border-transparent text-gray-500 hover:bg-gray-50'}`}>1. Dados Gerais</button>
           <button onClick={() => setActiveTab('items')} className={`flex-1 py-3 px-4 text-sm font-bold border-b-2 transition whitespace-nowrap ${activeTab === 'items' ? 'border-brand-600 text-brand-700 bg-brand-50' : 'border-transparent text-gray-500 hover:bg-gray-50'}`}>2. Itens ({formData.items?.length || 0})</button>
           <button onClick={() => setActiveTab('attachments')} className={`flex-1 py-3 px-4 text-sm font-bold border-b-2 transition whitespace-nowrap ${activeTab === 'attachments' ? 'border-brand-600 text-brand-700 bg-brand-50' : 'border-transparent text-gray-500 hover:bg-gray-50'}`}>3. Comprovantes ({formData.attachments?.length || 0})</button>
           {isAdmin && <button onClick={() => setActiveTab('admin')} className={`flex-1 py-3 px-4 text-sm font-bold border-b-2 transition whitespace-nowrap ${activeTab === 'admin' ? 'border-brand-600 text-brand-700 bg-brand-50' : 'border-transparent text-gray-500 hover:bg-gray-50'}`}>4. Avaliação (Admin)</button>}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 bg-slate-50">
          
          {/* TAB 1: GENERAL */}
          {activeTab === 'general' && (
            <div className="space-y-5 max-w-2xl mx-auto">
               
               {/* SUPPLIER SELECTION CARD */}
               <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm space-y-4">
                  <div className="flex justify-between items-center">
                      <label className="text-sm font-bold text-gray-700 flex items-center gap-2">
                          <Truck size={16}/> Fornecedor
                      </label>
                      <button 
                        onClick={() => setIsQuickAddSupplier(!isQuickAddSupplier)} 
                        className="text-xs font-bold text-brand-600 hover:text-brand-800 underline flex items-center gap-1"
                      >
                        {isQuickAddSupplier ? 'Voltar para Lista' : <><Plus size={12}/> Novo Fornecedor</>}
                      </button>
                  </div>
                  
                  {isQuickAddSupplier ? (
                     <div className="flex gap-2">
                         <Input 
                            placeholder="Nome do Novo Fornecedor" 
                            value={newSupplierName} 
                            onChange={e => setNewSupplierName(e.target.value)}
                            autoFocus
                            className="mb-0 flex-1"
                         />
                         <Button onClick={handleQuickAddSupplier} className="py-2 h-auto" disabled={!newSupplierName}>
                             Cadastrar
                         </Button>
                     </div>
                  ) : (
                     <div className="space-y-2">
                        <select 
                            className="w-full p-3 rounded-xl border border-gray-300 bg-white font-medium text-gray-900"
                            value={formData.supplier_id || ''}
                            onChange={handleSupplierSelect}
                        >
                            <option value="">Selecione um fornecedor...</option>
                            {suppliers.filter(s => s.active).map(s => (
                                <option key={s.id} value={s.id}>{s.name} - {s.activity_branch}</option>
                            ))}
                        </select>
                        {/* Fallback Display if manual string name exists but ID doesn't */}
                        {!formData.supplier_id && formData.fornecedor && (
                            <p className="text-xs text-orange-600 font-bold">Selecionado manualmente: {formData.fornecedor}</p>
                        )}
                        
                        {/* INTELLIGENCE HINT (Admin Support) */}
                        {formData.supplier_id && (
                             <div className="bg-blue-50 p-2 rounded border border-blue-100 flex items-start gap-2 text-xs text-blue-800">
                                 <Search size={14} className="mt-0.5"/>
                                 <div>
                                     <b>Inteligência de Compra:</b><br/>
                                     Fornecedor homologado. {lastPurchase ? `Última compra para este condomínio em ...` : 'Sem histórico recente para este condomínio.'}
                                 </div>
                             </div>
                        )}
                     </div>
                  )}
               </div>

               <div className="grid grid-cols-2 gap-4">
                  <Input label="Data Orçamento" type="date" value={formData.data_orcamento} onChange={e => handleGeneralChange('data_orcamento', e.target.value)} />
                  <Input label="Validade" type="date" value={formData.validade || ''} onChange={e => handleGeneralChange('validade', e.target.value)} />
               </div>

               <div className="grid grid-cols-2 gap-4">
                  <Input label="Prazo Entrega" placeholder="Ex: 5 dias úteis" value={formData.prazo_entrega || ''} onChange={e => handleGeneralChange('prazo_entrega', e.target.value)} />
                  <Input label="Condições Pagto" placeholder="Ex: 28 dias boleto" value={formData.condicoes_pagamento || ''} onChange={e => handleGeneralChange('condicoes_pagamento', e.target.value)} />
               </div>

               <Input 
                  label="Valor Total (R$)" 
                  type="number" 
                  step="0.01"
                  value={formData.valor} 
                  onChange={e => handleGeneralChange('valor', parseFloat(e.target.value) || 0)} 
                  className={formData.items && formData.items.length > 0 ? 'bg-gray-100' : 'bg-white font-bold text-lg'}
                  disabled={formData.items && formData.items.length > 0} // Disable if items drive the total
               />
               
               <Textarea label="Observações Internas" value={formData.observacoes || ''} onChange={e => handleGeneralChange('observacoes', e.target.value)} />
            </div>
          )}

          {/* TAB 2: ITEMS */}
          {activeTab === 'items' && (
             <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="p-4 bg-gray-50 border-b border-gray-200 flex justify-between items-center">
                    <h3 className="font-bold text-gray-700 flex items-center gap-2"><Calculator size={16}/> Detalhamento de Custos</h3>
                    <Button variant="secondary" onClick={addItem} className="py-2 px-3 text-xs"><Plus size={14} className="mr-1"/> Adicionar Item</Button>
                </div>
                
                {(!formData.items || formData.items.length === 0) ? (
                    <div className="p-10 text-center text-gray-400">
                        <p>Nenhum item adicionado.</p>
                        <p className="text-xs">Você pode inserir o valor total na aba "Dados Gerais" ou detalhar aqui.</p>
                    </div>
                ) : (
                    <table className="w-full text-sm text-left">
                        <thead className="bg-gray-100 text-gray-600 uppercase text-xs font-bold">
                            <tr>
                                <th className="p-3 w-1/2">Descrição</th>
                                <th className="p-3">Unid.</th>
                                <th className="p-3">Qtd.</th>
                                <th className="p-3">Valor Unit.</th>
                                <th className="p-3">Total</th>
                                <th className="p-3 w-10"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {formData.items.map((item, idx) => (
                                <tr key={item.id} className="hover:bg-gray-50">
                                    <td className="p-2">
                                        <input className="w-full border border-gray-200 rounded p-1.5 bg-white text-gray-900" value={item.description} onChange={e => updateItem(item.id, 'description', e.target.value)} placeholder="Produto/Serviço" />
                                    </td>
                                    <td className="p-2">
                                        <input className="w-16 border border-gray-200 rounded p-1.5 text-center bg-white text-gray-900" value={item.unit} onChange={e => updateItem(item.id, 'unit', e.target.value)} />
                                    </td>
                                    <td className="p-2">
                                        <input type="number" className="w-20 border border-gray-200 rounded p-1.5 text-center bg-white text-gray-900" value={item.quantity} onChange={e => updateItem(item.id, 'quantity', parseFloat(e.target.value))} />
                                    </td>
                                    <td className="p-2">
                                        <input type="number" className="w-24 border border-gray-200 rounded p-1.5 text-right bg-white text-gray-900" value={item.unitPrice} onChange={e => updateItem(item.id, 'unitPrice', parseFloat(e.target.value))} />
                                    </td>
                                    <td className="p-2 font-bold text-gray-900 text-right">
                                        {formatCurrency(item.total)}
                                    </td>
                                    <td className="p-2 text-center">
                                        <button onClick={() => removeItem(item.id)} className="text-red-400 hover:text-red-600"><Trash2 size={16}/></button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                        <tfoot className="bg-gray-50 font-bold">
                            <tr>
                                <td colSpan={4} className="p-3 text-right text-gray-600">Total Geral:</td>
                                <td className="p-3 text-right text-brand-700 text-lg">{formatCurrency(itemsTotal)}</td>
                                <td></td>
                            </tr>
                        </tfoot>
                    </table>
                )}
             </div>
          )}

          {/* TAB 3: ATTACHMENTS */}
          {activeTab === 'attachments' && (
             <div className="space-y-4">
                 <div className="bg-blue-50 border border-blue-200 p-4 rounded-xl text-blue-800 text-sm flex gap-3">
                     <ShieldCheck className="shrink-0" size={20}/>
                     <div>
                         <p className="font-bold">Arquivos Permitidos</p>
                         <ul className="list-disc pl-4 mt-1 space-y-1">
                             <li>Arquivos <b>PDF</b> (Orçamentos formais).</li>
                             <li>Imagens <b>JPG/PNG</b> (Fotos de notas ou prints).</li>
                         </ul>
                     </div>
                 </div>

                 <div className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center hover:border-brand-500 transition-colors relative bg-white group cursor-pointer">
                    <input 
                        type="file" 
                        multiple
                        accept=".pdf, .jpg, .jpeg, .png" 
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" 
                        onChange={handleFileUpload}
                    />
                    <div className="flex flex-col items-center pointer-events-none">
                        <UploadCloud className="h-12 w-12 text-gray-400 mb-3 group-hover:text-brand-500 transition-colors" />
                        <p className="text-sm text-gray-700 font-medium">Clique para selecionar arquivos</p>
                        <p className="text-xs text-gray-500 mt-1">PDF, JPG ou PNG</p>
                    </div>
                 </div>

                 <div className="grid grid-cols-1 gap-3">
                    {formData.attachments?.map(att => (
                        <div key={att.id} className="bg-white p-3 rounded-lg border border-gray-200 flex items-center justify-between shadow-sm">
                            <div className="flex items-center gap-3 overflow-hidden">
                                <div className={`p-2 rounded ${att.fileType.includes('image') ? 'bg-purple-50 text-purple-600' : 'bg-red-50 text-red-600'}`}>
                                    {att.fileType.includes('image') ? <ImageIcon size={20}/> : <FileText size={20}/>}
                                </div>
                                <div className="min-w-0">
                                    <p className="text-sm font-bold text-gray-800 truncate">{att.fileName}</p>
                                    <p className="text-xs text-gray-500">{(att.fileSize / 1024).toFixed(1)} KB • {new Date(att.uploadedAt).toLocaleDateString()}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <a href={att.publicUrl} target="_blank" rel="noreferrer" className="p-2 text-gray-500 hover:text-brand-600 hover:bg-gray-100 rounded-lg">
                                    <Eye size={18}/>
                                </a>
                                <button onClick={() => removeAttachment(att.id)} className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg">
                                    <Trash2 size={18}/>
                                </button>
                            </div>
                        </div>
                    ))}
                 </div>
             </div>
          )}

          {/* TAB 4: ADMIN EVALUATION */}
          {activeTab === 'admin' && (
              <div className="max-w-2xl mx-auto space-y-6">
                  <div className={`p-5 rounded-xl border-2 cursor-pointer transition-all ${formData.is_melhor_proposta ? 'bg-green-50 border-green-500 shadow-md' : 'bg-white border-gray-200 hover:border-brand-300'}`}
                       onClick={() => handleGeneralChange('is_melhor_proposta', !formData.is_melhor_proposta)}
                  >
                      <div className="flex items-center gap-3">
                          <div className={`h-6 w-6 rounded-full border-2 flex items-center justify-center ${formData.is_melhor_proposta ? 'border-green-600 bg-green-600 text-white' : 'border-gray-300'}`}>
                              {formData.is_melhor_proposta && <BadgeCheck size={16}/>}
                          </div>
                          <div>
                              <h3 className="font-bold text-gray-900 text-lg">Marcar como "Melhor Proposta"</h3>
                              <p className="text-sm text-gray-500">Indica que esta é a opção recomendada pela Administradora.</p>
                          </div>
                      </div>
                  </div>

                  {formData.is_melhor_proposta && (
                      <div className="space-y-4 animate-fadeIn">
                          <div>
                              <label className="block text-sm font-bold text-gray-700 mb-1">Critério Principal</label>
                              <select 
                                className="w-full p-3 rounded-xl border border-gray-300 bg-white"
                                value={formData.criterio_escolha}
                                onChange={e => handleGeneralChange('criterio_escolha', e.target.value)}
                              >
                                  <option value="">Selecione...</option>
                                  <option value="MENOR_PRECO">Menor Preço</option>
                                  <option value="PRAZO">Melhor Prazo</option>
                                  <option value="QUALIDADE">Qualidade Superior</option>
                                  <option value="CONFIANCA">Fornecedor de Confiança</option>
                              </select>
                          </div>
                          
                          <Textarea 
                            label="Justificativa Técnica (Visível ao Cliente)"
                            placeholder="Explique por que esta opção venceu as demais..."
                            value={formData.justificativa_melhor_proposta || ''}
                            onChange={e => handleGeneralChange('justificativa_melhor_proposta', e.target.value)}
                            rows={3}
                          />

                          <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200 text-sm text-yellow-800 flex gap-2">
                              <Trophy size={18} className="shrink-0"/>
                              <p>Ao salvar, este orçamento receberá um destaque especial na visualização do cliente.</p>
                          </div>
                      </div>
                  )}
              </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200 bg-white flex justify-end gap-3">
           <Button variant="outline" onClick={onClose} disabled={isSubmitting}>Cancelar</Button>
           <Button onClick={handleSubmit} disabled={isSubmitting}>
               {isSubmitting ? 'Validando e Salvando...' : 'Salvar Orçamento'}
           </Button>
        </div>
      </div>
    </div>
  );
};
