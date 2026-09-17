
import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { UserRole, RequestStatus, CondoContact } from '../../types';
import { Card, Button, Badge, Input, Select } from '../../components/UI';
import { Building, ArrowLeft, BarChart3, ShoppingCart, List, CheckCircle2, AlertTriangle, FileText, Phone, Trash2, Edit2, Plus, Bell, Download } from 'lucide-react';
import { formatCurrency } from '../../utils/formatters';

interface CondoHubProps {
  condoId?: string; // If present, show Detail Hub. If not, show List.
  onBack?: () => void;
  onViewRequest: (id: string) => void;
}

export const CondoHub: React.FC<CondoHubProps> = ({ condoId, onBack, onViewRequest }) => {
  const { users, requests, purchaseHistory, selectedCondoId, setSelectedCondoId, condoContacts, addContact, deleteContact, updateContact } = useApp();
  
  // --- DETAIL HUB VIEW HOOKS ---
  const [activeTab, setActiveTab] = useState<'overview' | 'requests' | 'budgets' | 'purchases' | 'contacts'>('overview');

  // New Contact State
  const [newContact, setNewContact] = useState({ name: '', phone: '', role: 'SINDICO' as any });
  const [isAddingContact, setIsAddingContact] = useState(false);

  // If we are in "List Mode" (no condoId passed via props), check if Global Filter is active
  const activeCondoId = condoId || (selectedCondoId !== 'all' ? selectedCondoId : null);

  // Purchased Items Aggregation
  const purchasedItems = useMemo(() => {
      if (!activeCondoId) return [];
      const condoHistory = purchaseHistory.filter(h => h.condominio_id === activeCondoId);
      const agg: Record<string, any> = {};
      condoHistory.forEach(h => {
          if (!agg[h.item_key]) {
              agg[h.item_key] = { name: h.item_nome_original, qty: 0, count: 0, lastDate: h.data_compra };
          }
          agg[h.item_key].qty += h.quantidade;
          agg[h.item_key].count += 1;
          if (new Date(h.data_compra) > new Date(agg[h.item_key].lastDate)) {
              agg[h.item_key].lastDate = h.data_compra;
          }
      });
      return Object.values(agg).sort((a,b) => b.count - a.count);
  }, [purchaseHistory, activeCondoId]);

  // --- LIST VIEW (Select a Condo) ---
  if (!activeCondoId) {
      const condos = users.filter(u => u.role === UserRole.CONDOMINIO && u.condominio_id);
      const getStats = (cid: string) => {
          const reqs = requests.filter(r => r.condominio_id === cid);
          return {
              total: reqs.length,
              pending: reqs.filter(r => r.status === RequestStatus.AGUARDANDO_ACAO_CONDOMINIO || r.status === RequestStatus.EM_ANALISE_CONDOMINIO).length,
              emergency: reqs.filter(r => r.nivel === 'N1').length
          };
      };

      return (
          <div className="space-y-6">
              <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                  <Building className="text-brand-600"/> Hub de Condomínios
              </h1>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {condos.map(c => {
                      const stats = getStats(c.condominio_id!);
                      return (
                          <div 
                            key={c.id} 
                            onClick={() => setSelectedCondoId(c.condominio_id!)}
                            className="bg-white border border-gray-200 hover:border-brand-500 hover:shadow-md cursor-pointer rounded-xl p-5 transition-all"
                          >
                              <div className="flex justify-between items-start mb-4">
                                  <div className="bg-brand-100 p-2 rounded-lg text-brand-700"><Building size={20}/></div>
                                  <span className="text-xs font-mono text-gray-500 font-medium">{c.condominio_id}</span>
                              </div>
                              <h3 className="font-bold text-gray-900 text-lg mb-2">{c.nome}</h3>
                              <div className="text-xs text-gray-600 mb-1">Síndico: {c.sindico_nome || 'Não informado'}</div>
                              <div className="text-xs text-gray-500 font-mono mb-3">CNPJ: {c.condominio_cnpj || 'Não informado'}</div>
                              <div className="flex gap-2 text-xs font-medium">
                                  <span className="bg-gray-100 px-2 py-1 rounded text-gray-700 border border-gray-200">{stats.total} Solicitações</span>
                                  {stats.pending > 0 && <span className="bg-yellow-100 px-2 py-1 rounded text-yellow-800 border border-yellow-200">{stats.pending} Pendentes</span>}
                                  {stats.emergency > 0 && <span className="bg-red-100 px-2 py-1 rounded text-red-800 border border-red-200">{stats.emergency} N1</span>}
                              </div>
                          </div>
                      );
                  })}
              </div>
          </div>
      );
  }

  // --- DETAIL HUB VIEW ---
  const condoUser = users.find(u => u.condominio_id === activeCondoId);
  const condoName = condoUser ? condoUser.nome : activeCondoId;
  const condoRequests = requests.filter(r => r.condominio_id === activeCondoId);
  const condoHistory = purchaseHistory.filter(h => h.condominio_id === activeCondoId);
  const myContacts = condoContacts.filter(c => c.condominio_id === activeCondoId);

  // AI Analysis removed to save costs. Substituted by JSON export.
  const handleExportJSON = () => {
    const data = { condoUser, condoRequests, condoHistory, myContacts };
    const dataStr = JSON.stringify(data, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `dados_${condoName}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleAddContact = async () => {
      if (!newContact.name || !newContact.phone) return;
      await addContact({ ...newContact, condominio_id: activeCondoId, active: true });
      setIsAddingContact(false);
      setNewContact({ name: '', phone: '', role: 'SINDICO' });
  };

  // Stats
  const stats = {
      total: condoRequests.length,
      approved: condoRequests.filter(r => r.status === RequestStatus.APROVADO).length,
      rejected: condoRequests.filter(r => r.status === RequestStatus.RECUSADO).length,
      n1: condoRequests.filter(r => r.nivel === 'N1').length,
      late: condoRequests.filter(r => r.fora_do_prazo).length,
  };

  return (
    <div className="space-y-6">
        <div className="flex items-center gap-4 border-b border-gray-200 pb-4">
            {onBack && <button onClick={onBack} className="p-2 hover:bg-gray-100 rounded-full"><ArrowLeft/></button>}
            <div>
                <h1 className="text-2xl font-bold text-gray-900">{condoName}</h1>
                <p className="text-gray-600 font-medium text-sm">Visão 360º do Condomínio</p>
                <div className="text-sm text-gray-700 mt-2 space-y-1">
                    <p><span className="font-bold">Síndico:</span> {condoUser?.sindico_nome || 'Não informado'} <span className="text-gray-500">(CPF: {condoUser?.sindico_cpf || 'Não informado'})</span></p>
                    <p><span className="font-bold">CNPJ:</span> {condoUser?.condominio_cnpj || 'Não informado'}</p>
                    <p><span className="font-bold">Observações:</span> {condoUser?.observacoes || 'Nenhuma'}</p>
                </div>
            </div>
            <div className="ml-auto">
                 <Button onClick={handleExportJSON} className="bg-purple-600 hover:bg-purple-700 text-white">
                    <Download size={16} className="mr-2" /> 
                    Baixar Dados (JSON)
                 </Button>
            </div>
        </div>

        <div className="flex gap-2 overflow-x-auto pb-2">
            <TabButton active={activeTab==='overview'} onClick={()=>setActiveTab('overview')} icon={<BarChart3 size={16}/>} label="Resumo"/>
            <TabButton active={activeTab==='requests'} onClick={()=>setActiveTab('requests')} icon={<List size={16}/>} label="Solicitações"/>
            <TabButton active={activeTab==='budgets'} onClick={()=>setActiveTab('budgets')} icon={<FileText size={16}/>} label="Orçamentos"/>
            <TabButton active={activeTab==='purchases'} onClick={()=>setActiveTab('purchases')} icon={<ShoppingCart size={16}/>} label="Histórico de Compras"/>
            <TabButton active={activeTab==='contacts'} onClick={()=>setActiveTab('contacts')} icon={<Phone size={16}/>} label="Contatos & Alertas"/>
        </div>

        {activeTab === 'overview' && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card className="text-center">
                    <h3 className="text-3xl font-extrabold text-gray-900">{stats.total}</h3>
                    <p className="text-xs text-gray-600 font-bold uppercase">Solicitações Totais</p>
                </Card>
                <Card className="text-center bg-green-50 border-green-200">
                    <h3 className="text-3xl font-extrabold text-green-800">{stats.approved}</h3>
                    <p className="text-xs text-green-700 font-bold uppercase">Aprovadas</p>
                </Card>
                <Card className="text-center bg-red-50 border-red-200">
                    <h3 className="text-3xl font-extrabold text-red-800">{stats.n1}</h3>
                    <p className="text-xs text-red-700 font-bold uppercase">Emergenciais (N1)</p>
                </Card>
                <Card className="text-center bg-orange-50 border-orange-200">
                    <h3 className="text-3xl font-extrabold text-orange-800">{stats.late}</h3>
                    <p className="text-xs text-orange-700 font-bold uppercase">Fora do Prazo</p>
                </Card>
            </div>
        )}

        {activeTab === 'contacts' && (
            <div className="space-y-6">
                <div className="flex justify-between items-center">
                    <div>
                        <h3 className="text-lg font-bold text-gray-900">Contatos para Notificação</h3>
                        <p className="text-sm text-gray-500">Estes contatos receberão alertas via WhatsApp sobre prazos e aprovações.</p>
                    </div>
                    <Button onClick={() => setIsAddingContact(true)}><Plus size={16} className="mr-1"/> Adicionar</Button>
                </div>

                {isAddingContact && (
                    <Card className="animate-fadeIn">
                        <h4 className="font-bold mb-3">Novo Contato</h4>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <Input label="Nome" value={newContact.name} onChange={e => setNewContact({...newContact, name: e.target.value})} />
                            <Input label="WhatsApp (Ex: +557199999999)" value={newContact.phone} onChange={e => setNewContact({...newContact, phone: e.target.value})} placeholder="+55..." />
                            <Select label="Cargo" value={newContact.role} onChange={e => setNewContact({...newContact, role: e.target.value as any})} options={[{value:'SINDICO', label:'Síndico'}, {value:'FISCAL', label:'Conselho/Fiscal'}, {value:'OUTRO', label:'Outro'}]} />
                        </div>
                        <div className="flex justify-end gap-2 mt-4">
                            <Button variant="ghost" onClick={() => setIsAddingContact(false)}>Cancelar</Button>
                            <Button onClick={handleAddContact}>Salvar Contato</Button>
                        </div>
                    </Card>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {myContacts.map(contact => (
                        <div key={contact.id} className="bg-white border border-gray-200 p-4 rounded-xl flex justify-between items-center shadow-sm">
                            <div className="flex items-center gap-3">
                                <div className="bg-green-100 p-2.5 rounded-full text-green-700">
                                    <Phone size={18} />
                                </div>
                                <div>
                                    <p className="font-bold text-gray-900">{contact.name}</p>
                                    <p className="text-sm text-gray-500 font-mono">{contact.phone}</p>
                                    <span className="text-xs font-bold bg-gray-100 px-2 py-0.5 rounded uppercase">{contact.role}</span>
                                </div>
                            </div>
                            <div className="flex gap-2">
                                <button 
                                    onClick={() => updateContact(contact.id, { active: !contact.active })}
                                    className={`p-2 rounded transition-colors ${contact.active ? 'text-green-600 bg-green-50 hover:bg-green-100' : 'text-gray-400 bg-gray-50'}`}
                                    title={contact.active ? 'Desativar notificações' : 'Ativar notificações'}
                                >
                                    <Bell size={18} className={!contact.active ? 'line-through' : ''}/>
                                </button>
                                <button onClick={() => deleteContact(contact.id)} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"><Trash2 size={18}/></button>
                            </div>
                        </div>
                    ))}
                    {myContacts.length === 0 && !isAddingContact && (
                        <div className="col-span-2 text-center py-8 text-gray-400 border-2 border-dashed border-gray-100 rounded-xl">
                            Nenhum contato cadastrado. Adicione para ativar os alertas automáticos.
                        </div>
                    )}
                </div>
            </div>
        )}

        {activeTab === 'requests' && (
            <Card title="Solicitações do Condomínio">
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-4 py-2 text-left text-xs font-bold text-gray-600 uppercase">ID</th>
                                <th className="px-4 py-2 text-left text-xs font-bold text-gray-600 uppercase">Título</th>
                                <th className="px-4 py-2 text-left text-xs font-bold text-gray-600 uppercase">Status</th>
                                <th className="px-4 py-2 text-right text-xs font-bold text-gray-600 uppercase">Ação</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white">
                            {condoRequests.map(r => (
                                <tr key={r.id} className="hover:bg-gray-50 border-b border-gray-100 last:border-0">
                                    <td className="px-4 py-3 text-sm text-gray-900 font-bold">{r.id}</td>
                                    <td className="px-4 py-3 text-sm font-medium text-gray-700">{r.titulo}</td>
                                    <td className="px-4 py-3"><Badge status={r.status}/></td>
                                    <td className="px-4 py-3 text-right"><Button variant="outline" className="py-1 text-xs border-gray-300 text-gray-700" onClick={()=>onViewRequest(r.id)}>Ver</Button></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </Card>
        )}

        {activeTab === 'budgets' && (
            <Card title="Orçamentos Enviados">
                <p className="text-sm text-gray-600 font-medium mb-4">Lista de todos orçamentos vinculados às solicitações deste condomínio.</p>
                <div className="space-y-2">
                    {condoRequests.flatMap(r => r.orcamentos.map(o => ({...o, reqId: r.id, reqTitle: r.titulo}))).map(budget => (
                         <div key={budget.id} className={`flex justify-between items-center p-3 border border-gray-200 rounded-lg ${budget.status_orcamento === 'CANCELADO' ? 'bg-gray-100 opacity-60' : 'bg-white'}`}>
                             <div>
                                 <p className="font-bold text-sm text-gray-900">{budget.fornecedor} - {formatCurrency(budget.valor)}</p>
                                 <p className="text-xs text-gray-500 font-medium">Ref: {budget.reqTitle}</p>
                                 {budget.status_orcamento === 'CANCELADO' && <span className="text-xs text-red-600 font-bold">CANCELADO</span>}
                             </div>
                             <Button variant="outline" className="text-xs py-1" onClick={()=>onViewRequest(budget.reqId)}>Ver Solicitação</Button>
                         </div>
                    ))}
                </div>
            </Card>
        )}

        {activeTab === 'purchases' && (
            <div className="space-y-6">
                {/* Summary Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Card className="text-center">
                        <h3 className="text-2xl font-extrabold text-gray-900">{condoRequests.filter(r => r.status === RequestStatus.CONCLUIDO).length}</h3>
                        <p className="text-xs text-gray-600 font-bold uppercase">Compras Concluídas</p>
                    </Card>
                    <Card className="text-center">
                        <h3 className="text-2xl font-extrabold text-gray-900">
                            {formatCurrency(condoRequests.filter(r => r.status === RequestStatus.CONCLUIDO).reduce((sum, r) => sum + (r.orcamentos.find(o => o.numero === r.orcamento_escolhido)?.valor || 0), 0))}
                        </h3>
                        <p className="text-xs text-gray-600 font-bold uppercase">Valor Total Comprado</p>
                    </Card>
                    <Card className="text-center">
                        <h3 className="text-2xl font-extrabold text-gray-900">
                            {formatCurrency((condoRequests.filter(r => r.status === RequestStatus.CONCLUIDO).reduce((sum, r) => sum + (r.orcamentos.find(o => o.numero === r.orcamento_escolhido)?.valor || 0), 0)) / (condoRequests.filter(r => r.status === RequestStatus.CONCLUIDO).length || 1))}
                        </h3>
                        <p className="text-xs text-gray-600 font-bold uppercase">Ticket Médio</p>
                    </Card>
                </div>

                {/* Table */}
                <Card title="Histórico de Compras Concluídas">
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-600 uppercase">Protocolo</th>
                                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-600 uppercase">Título</th>
                                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-600 uppercase">Fornecedor</th>
                                    <th className="px-4 py-3 text-right text-xs font-bold text-gray-600 uppercase">Valor</th>
                                    <th className="px-4 py-3 text-center text-xs font-bold text-gray-600 uppercase">Data Conclusão</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {condoRequests.filter(r => r.status === RequestStatus.CONCLUIDO).map(r => {
                                    const budget = r.orcamentos.find(o => o.numero === r.orcamento_escolhido);
                                    return (
                                        <tr key={r.id} className="hover:bg-gray-50">
                                            <td className="px-4 py-3 text-sm font-bold text-gray-900">{r.id}</td>
                                            <td className="px-4 py-3 text-sm text-gray-700">{r.titulo}</td>
                                            <td className="px-4 py-3 text-sm text-gray-700">{budget?.fornecedor || '-'}</td>
                                            <td className="px-4 py-3 text-sm text-right font-bold text-gray-900">{formatCurrency(budget?.valor || 0)}</td>
                                            <td className="px-4 py-3 text-sm text-center text-gray-500">{r.delivered_at ? new Date(r.delivered_at).toLocaleDateString() : '-'}</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </Card>
            </div>
        )}
    </div>
  );
};

const TabButton = ({ active, onClick, icon, label }: any) => (
    <button 
        onClick={onClick}
        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-colors whitespace-nowrap ${active ? 'bg-brand-600 text-white shadow-md' : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-300'}`}
    >
        {icon} {label}
    </button>
);
