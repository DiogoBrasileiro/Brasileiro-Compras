
import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { Supplier, SupplierType, RequestStatus } from '../../types';
import { Card, Button, Input, Select, Badge } from '../../components/UI';
import { Truck, Plus, Search, Filter, Phone, Mail, FileText, Calendar, AlertTriangle, CheckCircle2, XCircle, ShoppingCart, Eye, ArrowLeft, Save, Edit2 } from 'lucide-react';

export const Suppliers: React.FC = () => {
  const { suppliers, addSupplier, updateSupplier, toggleSupplierStatus, requests, users } = useApp();
  
  const [view, setView] = useState<'list' | 'detail' | 'new'>('list');
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [branchFilter, setBranchFilter] = useState<string>('all');
  
  // --- DERIVED DATA ---
  
  // Unique branches for filter
  const branches = useMemo(() => Array.from(new Set(suppliers.map(s => s.activity_branch))), [suppliers]);

  // Filtered List
  const filteredSuppliers = useMemo(() => {
    return suppliers.filter(s => {
      const matchSearch = s.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          s.legal_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          s.activity_branch.toLowerCase().includes(searchTerm.toLowerCase());
      const matchType = typeFilter === 'all' ? true : s.supply_type === typeFilter;
      const matchBranch = branchFilter === 'all' ? true : s.activity_branch === branchFilter;
      
      return matchSearch && matchType && matchBranch;
    });
  }, [suppliers, searchTerm, typeFilter, branchFilter]);

  // Dashboard Stats
  const stats = useMemo(() => {
      const active = suppliers.filter(s => s.active).length;
      const inactive = suppliers.filter(s => !s.active).length;
      const contracts = suppliers.filter(s => s.contract?.active).length;
      
      // Expiring Contracts (Next 30 days)
      const expiring = suppliers.filter(s => {
          if (!s.contract?.active || !s.contract.end_date) return false;
          const end = new Date(s.contract.end_date);
          const now = new Date();
          const diff = (end.getTime() - now.getTime()) / (1000 * 3600 * 24);
          return diff > 0 && diff <= 30;
      }).length;

      return { active, inactive, contracts, expiring };
  }, [suppliers]);

  // --- ACTIONS ---

  const handleCreate = async (data: any) => {
      await addSupplier(data);
      setView('list');
  };

  const handleUpdate = async (id: string, data: any) => {
      await updateSupplier(id, data);
      setSelectedSupplier(prev => prev ? {...prev, ...data} : null);
      alert("Fornecedor atualizado!");
  };

  const calculateHistory = (supplierId: string, supplierName: string) => {
      // Find all approved budgets linked to this supplier
      // Note: In a real DB we use supplier_id. Here we fallback to name string matching if id missing in old records
      return requests.flatMap(req => {
          if (![RequestStatus.APROVADO, RequestStatus.EM_PEDIDO, RequestStatus.AGUARDANDO_ENTREGA, RequestStatus.CONCLUIDO].includes(req.status)) return [];
          
          const chosen = req.orcamentos.find(o => o.numero === req.orcamento_escolhido);
          if (!chosen) return [];

          const isMatch = chosen.supplier_id === supplierId || chosen.fornecedor.toLowerCase() === supplierName.toLowerCase();
          
          if (isMatch) {
              return [{
                  reqId: req.id,
                  date: req.data_solicitacao,
                  condoName: req.condominio_nome,
                  condoId: req.condominio_id,
                  value: chosen.valor,
                  category: req.categoria,
                  type: req.tipo
              }];
          }
          return [];
      }).sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  };

  if (view === 'list') {
      return (
          <div className="space-y-6">
              <div className="flex justify-between items-center">
                  <div>
                      <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                          <Truck className="text-brand-600" /> Administração de Fornecedores
                      </h1>
                      <p className="text-gray-500 text-sm">Gestão de contratos e histórico de compras.</p>
                  </div>
                  <Button onClick={() => setView('new')}><Plus size={18} className="mr-2"/> Novo Fornecedor</Button>
              </div>

              {/* DASHBOARD CARDS */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                      <p className="text-xs font-bold text-gray-500 uppercase">Ativos</p>
                      <h3 className="text-2xl font-bold text-green-600">{stats.active}</h3>
                  </div>
                  <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                      <p className="text-xs font-bold text-gray-500 uppercase">Inativos</p>
                      <h3 className="text-2xl font-bold text-gray-400">{stats.inactive}</h3>
                  </div>
                  <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                      <p className="text-xs font-bold text-gray-500 uppercase">Contratos Vigentes</p>
                      <h3 className="text-2xl font-bold text-blue-600">{stats.contracts}</h3>
                  </div>
                  <div className={`p-4 rounded-xl border shadow-sm ${stats.expiring > 0 ? 'bg-red-50 border-red-200' : 'bg-white border-gray-200'}`}>
                      <p className={`text-xs font-bold uppercase ${stats.expiring > 0 ? 'text-red-700' : 'text-gray-500'}`}>A Vencer (30 dias)</p>
                      <h3 className={`text-2xl font-bold ${stats.expiring > 0 ? 'text-red-600' : 'text-gray-900'}`}>{stats.expiring}</h3>
                  </div>
              </div>

              {/* FILTERS */}
              <div className="bg-white p-4 rounded-xl border border-gray-200 flex flex-col md:flex-row gap-4 items-center">
                  <div className="relative flex-1 w-full">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18}/>
                      <input 
                        className="w-full pl-10 p-2 rounded-lg border border-gray-300 text-sm" 
                        placeholder="Buscar por nome, razão social ou ramo..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                      />
                  </div>
                  <select 
                    className="p-2 rounded-lg border border-gray-300 text-sm bg-white"
                    value={typeFilter} onChange={e => setTypeFilter(e.target.value)}
                  >
                      <option value="all">Todos Tipos</option>
                      <option value="RECORRENTE">Recorrente</option>
                      <option value="AVULSO">Avulso</option>
                  </select>
                  <select 
                    className="p-2 rounded-lg border border-gray-300 text-sm bg-white"
                    value={branchFilter} onChange={e => setBranchFilter(e.target.value)}
                  >
                      <option value="all">Todos Ramos</option>
                      {branches.map(b => <option key={b} value={b}>{b}</option>)}
                  </select>
              </div>

              {/* LIST */}
              <div className="grid grid-cols-1 gap-4">
                  {filteredSuppliers.map(s => (
                      <div key={s.id} className="bg-white border border-gray-200 rounded-xl p-5 flex flex-col md:flex-row justify-between items-start md:items-center hover:shadow-md transition-shadow">
                          <div className="flex items-start gap-4">
                              <div className={`p-3 rounded-lg ${s.active ? 'bg-blue-50 text-blue-600' : 'bg-gray-100 text-gray-400'}`}>
                                  <Truck size={24}/>
                              </div>
                              <div>
                                  <div className="flex items-center gap-2">
                                      <h3 className="text-lg font-bold text-gray-900">{s.name}</h3>
                                      {!s.active && <span className="bg-gray-200 text-gray-600 text-[10px] px-2 py-0.5 rounded font-bold">INATIVO</span>}
                                  </div>
                                  <p className="text-sm text-gray-500">{s.activity_branch} • {s.contact_name}</p>
                                  <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-gray-600 font-medium">
                                      <span className="flex items-center gap-1"><Phone size={12}/> {s.phone}</span>
                                      {s.whatsapp && (
                                          <a 
                                            href={`https://api.whatsapp.com/send?phone=${s.whatsapp.replace(/\D/g, '').length <= 11 ? '55' + s.whatsapp.replace(/\D/g, '') : s.whatsapp.replace(/\D/g, '')}`} 
                                            target="_blank" 
                                            rel="noopener noreferrer" 
                                            className="flex items-center gap-1 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-2 py-0.5 rounded-full font-bold transition"
                                            title="Abrir WhatsApp com o Fornecedor"
                                          >
                                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                                              WhatsApp: {s.whatsapp}
                                          </a>
                                      )}
                                      {s.contract?.active && (
                                          <span className="flex items-center gap-1 text-green-700 bg-green-50 px-1.5 py-0.5 rounded"><FileText size={12}/> Contrato Ativo</span>
                                      )}
                                  </div>
                              </div>
                          </div>
                          <div className="mt-4 md:mt-0 flex gap-2">
                              <Button variant="outline" className="text-xs" onClick={() => { setSelectedSupplier(s); setView('detail'); }}>
                                  <Eye size={14} className="mr-1"/> Detalhes
                              </Button>
                          </div>
                      </div>
                  ))}
                  {filteredSuppliers.length === 0 && (
                      <div className="text-center py-10 text-gray-400">Nenhum fornecedor encontrado.</div>
                  )}
              </div>
          </div>
      );
  }

  // --- DETAIL VIEW ---
  if (view === 'detail' && selectedSupplier) {
      const history = calculateHistory(selectedSupplier.id, selectedSupplier.name);
      const totalSold = history.reduce((acc, curr) => acc + curr.value, 0);
      const uniqueCondos = new Set(history.map(h => h.condoName)).size;

      return (
          <div className="space-y-6">
              <button onClick={() => setView('list')} className="text-gray-500 hover:text-brand-600 flex items-center gap-1 text-sm font-bold">
                  <ArrowLeft size={16}/> Voltar para Lista
              </button>
              
              <div className="flex justify-between items-start">
                  <div>
                      <h1 className="text-3xl font-bold text-gray-900">{selectedSupplier.name}</h1>
                      <p className="text-gray-500 font-mono text-sm">{selectedSupplier.legal_name || selectedSupplier.name} • CNPJ: {selectedSupplier.cnpj || 'N/I'}</p>
                  </div>
                  <div className="flex gap-2">
                      <Button variant={selectedSupplier.active ? 'outline' : 'primary'} onClick={() => toggleSupplierStatus(selectedSupplier.id)}>
                          {selectedSupplier.active ? 'Inativar Fornecedor' : 'Ativar Fornecedor'}
                      </Button>
                      <Button onClick={() => setView('new')}><Edit2 size={16} className="mr-2"/> Editar</Button>
                  </div>
              </div>

              {/* STATS STRIP */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Card className="flex items-center gap-4 bg-blue-50 border-blue-200">
                      <div className="p-3 bg-white rounded-full text-blue-600"><ShoppingCart size={24}/></div>
                      <div>
                          <p className="text-xs font-bold text-blue-800 uppercase">Total Vendido</p>
                          <h3 className="text-2xl font-bold text-blue-900">R$ {totalSold.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</h3>
                      </div>
                  </Card>
                  <Card className="flex items-center gap-4">
                      <div className="p-3 bg-gray-100 rounded-full text-gray-600"><FileText size={24}/></div>
                      <div>
                          <p className="text-xs font-bold text-gray-500 uppercase">Vendas Realizadas</p>
                          <h3 className="text-2xl font-bold text-gray-900">{history.length}</h3>
                      </div>
                  </Card>
                  <Card className="flex items-center gap-4">
                      <div className="p-3 bg-gray-100 rounded-full text-gray-600"><CheckCircle2 size={24}/></div>
                      <div>
                          <p className="text-xs font-bold text-gray-500 uppercase">Condomínios Atendidos</p>
                          <h3 className="text-2xl font-bold text-gray-900">{uniqueCondos}</h3>
                      </div>
                  </Card>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* INFO SIDEBAR */}
                  <div className="space-y-6">
                      <Card title="Dados Cadastrais">
                          <div className="space-y-4 text-sm">
                              <div>
                                  <label className="block text-xs font-bold text-gray-500 uppercase">Ramo de Atividade</label>
                                  <span className="font-bold text-gray-900 bg-gray-100 px-2 py-1 rounded inline-block mt-1">{selectedSupplier.activity_branch}</span>
                              </div>
                              <div>
                                  <label className="block text-xs font-bold text-gray-500 uppercase">Tipo de Fornecimento</label>
                                  <span className="font-medium text-gray-900">{selectedSupplier.supply_type}</span>
                              </div>
                              <div>
                                  <label className="block text-xs font-bold text-gray-500 uppercase">Contato</label>
                                  <div className="mt-1 space-y-1.5">
                                      <p className="font-bold">{selectedSupplier.contact_name}</p>
                                      <p className="flex items-center gap-2"><Phone size={14} className="text-gray-400"/> {selectedSupplier.phone}</p>
                                      {selectedSupplier.whatsapp && (
                                          <p className="flex items-center gap-2">
                                              <Phone size={14} className="text-emerald-500"/>
                                              <a 
                                                href={`https://api.whatsapp.com/send?phone=${selectedSupplier.whatsapp.replace(/\D/g, '').length <= 11 ? '55' + selectedSupplier.whatsapp.replace(/\D/g, '') : selectedSupplier.whatsapp.replace(/\D/g, '')}`} 
                                                target="_blank" 
                                                rel="noopener noreferrer" 
                                                className="text-emerald-700 font-bold hover:underline"
                                              >
                                                  WhatsApp: {selectedSupplier.whatsapp}
                                              </a>
                                          </p>
                                      )}
                                      <p className="flex items-center gap-2"><Mail size={14} className="text-gray-400"/> {selectedSupplier.email || '-'}</p>
                                  </div>
                              </div>
                          </div>
                      </Card>

                      <Card title="Contrato Recorrente">
                          {selectedSupplier.contract?.has_contract ? (
                              <div className="space-y-4">
                                  <div className={`p-3 rounded-lg border ${selectedSupplier.contract.active ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-800'}`}>
                                      <div className="flex items-center gap-2 font-bold text-sm">
                                          {selectedSupplier.contract.active ? <CheckCircle2 size={16}/> : <XCircle size={16}/>}
                                          {selectedSupplier.contract.active ? 'CONTRATO ATIVO' : 'CONTRATO INATIVO'}
                                      </div>
                                  </div>
                                  <div className="grid grid-cols-2 gap-2 text-sm">
                                      <div>
                                          <p className="text-xs text-gray-500">Início</p>
                                          <p className="font-bold">{selectedSupplier.contract.start_date ? new Date(selectedSupplier.contract.start_date).toLocaleDateString() : '-'}</p>
                                      </div>
                                      <div>
                                          <p className="text-xs text-gray-500">Vencimento</p>
                                          <p className="font-bold">{selectedSupplier.contract.end_date ? new Date(selectedSupplier.contract.end_date).toLocaleDateString() : '-'}</p>
                                      </div>
                                  </div>
                              </div>
                          ) : (
                              <p className="text-sm text-gray-500 italic">Este fornecedor não possui contrato recorrente cadastrado.</p>
                          )}
                      </Card>
                  </div>

                  {/* HISTORY TABLE */}
                  <div className="lg:col-span-2">
                      <Card title="Histórico de Vendas por Condomínio">
                          <div className="overflow-x-auto">
                              <table className="min-w-full divide-y divide-gray-200">
                                  <thead className="bg-gray-50">
                                      <tr>
                                          <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase">Data</th>
                                          <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase">Condomínio</th>
                                          <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase">Solicitação</th>
                                          <th className="px-4 py-3 text-right text-xs font-bold text-gray-500 uppercase">Valor</th>
                                      </tr>
                                  </thead>
                                  <tbody className="bg-white divide-y divide-gray-200">
                                      {history.map((h, i) => (
                                          <tr key={i} className="hover:bg-gray-50">
                                              <td className="px-4 py-3 text-sm text-gray-500">{new Date(h.date).toLocaleDateString()}</td>
                                              <td className="px-4 py-3 text-sm font-bold text-gray-900">{h.condoName}</td>
                                              <td className="px-4 py-3">
                                                  <span className="text-xs font-mono bg-gray-100 px-1 rounded">{h.reqId}</span>
                                                  <span className="text-xs text-gray-500 block">{h.category}</span>
                                              </td>
                                              <td className="px-4 py-3 text-sm font-bold text-green-700 text-right">R$ {h.value.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</td>
                                          </tr>
                                      ))}
                                      {history.length === 0 && (
                                          <tr><td colSpan={4} className="p-6 text-center text-gray-400">Nenhuma venda registrada no sistema.</td></tr>
                                      )}
                                  </tbody>
                              </table>
                          </div>
                      </Card>
                  </div>
              </div>
          </div>
      );
  }

  // --- CREATE/EDIT FORM ---
  return (
      <SupplierForm 
        initialData={view === 'new' && selectedSupplier ? selectedSupplier : undefined} // If switching from detail to edit
        onSave={selectedSupplier && view !== 'new' ? (d) => handleUpdate(selectedSupplier.id, d) : handleCreate}
        onCancel={() => { setSelectedSupplier(null); setView('list'); }}
      />
  );
};

// --- SUB-COMPONENT: FORM ---
const SupplierForm: React.FC<{ initialData?: Supplier, onSave: (data: any) => Promise<void>, onCancel: () => void }> = ({ initialData, onSave, onCancel }) => {
    const [formData, setFormData] = useState<Partial<Supplier>>(initialData || {
        name: '', active: true, activity_branch: 'Outros', supply_type: SupplierType.AVULSO,
        contract: { has_contract: false, active: false }
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        await onSave(formData);
    };

    return (
        <div className="max-w-3xl mx-auto space-y-6">
            <button onClick={onCancel} className="text-gray-500 hover:text-brand-600 flex items-center gap-1 text-sm font-bold">
                  <ArrowLeft size={16}/> Cancelar
            </button>
            <h1 className="text-2xl font-bold text-gray-900">{initialData ? 'Editar Fornecedor' : 'Novo Fornecedor'}</h1>
            
            <form onSubmit={handleSubmit}>
                <Card className="space-y-4">
                    <h3 className="font-bold text-gray-900 border-b pb-2 mb-4">Dados Básicos</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Input label="Nome Fantasia" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} required />
                        <Input label="Razão Social" value={formData.legal_name || ''} onChange={e => setFormData({...formData, legal_name: e.target.value})} />
                        <Input label="CNPJ" value={formData.cnpj || ''} onChange={e => setFormData({...formData, cnpj: e.target.value})} placeholder="00.000.000/0000-00" />
                        <div>
                             <label className="block text-sm font-bold text-gray-700 mb-1">Ramo de Atividade</label>
                             <select className="w-full p-3 rounded-xl border border-gray-300 bg-white" value={formData.activity_branch} onChange={e => setFormData({...formData, activity_branch: e.target.value})}>
                                 {['Limpeza', 'Piscina', 'Manutenção', 'Jardinagem', 'Elétrica', 'Hidráulica', 'Obras', 'Segurança', 'Outros'].map(o => (
                                     <option key={o} value={o}>{o}</option>
                                 ))}
                             </select>
                        </div>
                    </div>

                    <h3 className="font-bold text-gray-900 border-b pb-2 mb-4 mt-6">Contato</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Input label="Nome Contato" value={formData.contact_name || ''} onChange={e => setFormData({...formData, contact_name: e.target.value})} required />
                        <Input label="Telefone" value={formData.phone || ''} onChange={e => setFormData({...formData, phone: e.target.value})} required />
                        <Input label="WhatsApp" value={formData.whatsapp || ''} onChange={e => setFormData({...formData, whatsapp: e.target.value})} />
                        <Input label="E-mail" value={formData.email || ''} onChange={e => setFormData({...formData, email: e.target.value})} />
                    </div>

                    <h3 className="font-bold text-gray-900 border-b pb-2 mb-4 mt-6">Classificação e Contrato</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                             <label className="block text-sm font-bold text-gray-700 mb-1">Tipo de Fornecimento</label>
                             <select className="w-full p-3 rounded-xl border border-gray-300 bg-white" value={formData.supply_type} onChange={e => setFormData({...formData, supply_type: e.target.value as any})}>
                                 <option value="AVULSO">Avulso</option>
                                 <option value="RECORRENTE">Recorrente</option>
                                 <option value="AMBOS">Ambos</option>
                             </select>
                        </div>
                    </div>

                    {/* Contract Section Logic */}
                    <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 mt-4">
                        <label className="flex items-center gap-2 font-bold text-gray-700 mb-4 cursor-pointer">
                            <input 
                                type="checkbox" 
                                className="w-5 h-5"
                                checked={formData.contract?.has_contract} 
                                onChange={e => setFormData({...formData, contract: { ...formData.contract!, has_contract: e.target.checked }})}
                            />
                            Possui Contrato Recorrente?
                        </label>

                        {formData.contract?.has_contract && (
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 animate-fadeIn">
                                <div>
                                     <label className="block text-xs font-bold text-gray-500 mb-1">Início</label>
                                     <input type="date" className="w-full p-2 rounded border" value={formData.contract.start_date || ''} onChange={e => setFormData({...formData, contract: { ...formData.contract!, start_date: e.target.value }})} />
                                </div>
                                <div>
                                     <label className="block text-xs font-bold text-gray-500 mb-1">Vencimento</label>
                                     <input type="date" className="w-full p-2 rounded border" value={formData.contract.end_date || ''} onChange={e => setFormData({...formData, contract: { ...formData.contract!, end_date: e.target.value }})} />
                                </div>
                                <div className="flex items-center pt-5">
                                    <label className="flex items-center gap-2 font-bold text-sm text-green-700">
                                        <input type="checkbox" checked={formData.contract.active} onChange={e => setFormData({...formData, contract: { ...formData.contract!, active: e.target.checked }})} />
                                        Contrato Ativo
                                    </label>
                                </div>
                                <div className="col-span-3 text-xs text-gray-500">
                                    * Alertas automáticos serão gerados 30, 15 e 7 dias antes do vencimento.
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="pt-4 flex justify-end gap-3">
                        <Button variant="ghost" type="button" onClick={onCancel}>Cancelar</Button>
                        <Button type="submit"><Save size={18} className="mr-2"/> Salvar Fornecedor</Button>
                    </div>
                </Card>
            </form>
        </div>
    );
}
