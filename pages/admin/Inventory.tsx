
import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { InventoryItem } from '../../types';
import { Card, Button, Input, Select, Badge } from '../../components/UI';
import { Package, AlertTriangle, RefreshCw, Plus, Edit2, Trash2, Zap, BrainCircuit, BarChart2, Search, Filter, AlertCircle, CheckCircle2, History, Building2, TrendingDown, Save, X, ShoppingCart, Truck, Eye, DollarSign, Archive } from 'lucide-react';
import { formatCurrency } from '../../utils/formatters';

export const Inventory: React.FC = () => {
  const { inventoryItems, inventoryMovements, users, refreshData, updateInventoryItem, deleteInventoryItem, createStockReplenishmentRequest } = useApp();
  
  const [filterCondo, setFilterCondo] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [showCriticalOnly, setShowCriticalOnly] = useState(false);

  // Modal State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Partial<InventoryItem> | null>(null);
  
  // Last Purchase Modal State
  const [viewingPurchaseItem, setViewingPurchaseItem] = useState<InventoryItem | null>(null);

  // Replenishment Logic State
  const [replenishmentSelection, setReplenishmentSelection] = useState<Record<string, number>>({}); // ItemID -> Qty
  const [isReplenishmentModalOpen, setIsReplenishmentModalOpen] = useState(false);

  // Get unique condos
  const condos = useMemo(() => {
      const ids = Array.from(new Set(inventoryItems.map(i => i.condominio_id)));
      return ids.map(id => {
          const user = users.find(u => u.condominio_id === id);
          return { id, name: user ? user.nome : id };
      });
  }, [inventoryItems, users]);

  // Processed Items with Filters
  const filteredItems = useMemo(() => {
      return inventoryItems.filter(item => {
          const matchCondo = filterCondo === 'all' ? true : item.condominio_id === filterCondo;
          
          let matchStatus = true;
          if (showCriticalOnly) {
              matchStatus = item.status === 'LOW' || item.status === 'EMPTY' || item.current_qty <= item.min_level;
          } else {
              matchStatus = filterStatus === 'all' ? true : item.status === filterStatus;
          }

          const matchSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                              (item.last_supplier || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                              (users.find(u => u.condominio_id === item.condominio_id)?.nome || '').toLowerCase().includes(searchTerm.toLowerCase());
          
          return matchCondo && matchStatus && matchSearch;
      }).sort((a,b) => {
          if (a.status === 'EMPTY' && b.status !== 'EMPTY') return -1;
          if (a.status === 'LOW' && b.status === 'NORMAL') return -1;
          return 0;
      });
  }, [inventoryItems, filterCondo, filterStatus, searchTerm, showCriticalOnly, users]);

  // Low stock items for current condo selection
  const lowStockItems = useMemo(() => {
      if (filterCondo === 'all') return [];
      return filteredItems.filter(i => i.status === 'LOW' || i.status === 'EMPTY' || i.current_qty <= i.min_level);
  }, [filteredItems, filterCondo]);

  // Stats Global
  const stats = {
      totalItems: inventoryItems.length,
      criticalCount: inventoryItems.filter(i => i.status === 'LOW' || i.status === 'EMPTY').length,
      emptyCount: inventoryItems.filter(i => i.status === 'EMPTY').length,
  };

  const getCondoName = (id: string) => condos.find(c => c.id === id)?.name || id;

  const handleEditClick = (item: InventoryItem) => {
      setEditingItem(item);
      setIsEditModalOpen(true);
  };

  const handleDeleteClick = async (item: InventoryItem) => {
      if (confirm(`Tem certeza que deseja remover "${item.name}" do estoque de ${getCondoName(item.condominio_id)}?`)) {
          await deleteInventoryItem(item.id);
      }
  };

  const handleSaveEdit = async () => {
      if (!editingItem || !editingItem.id) return;
      
      const success = await updateInventoryItem(editingItem.id, {
          name: editingItem.name,
          unit: editingItem.unit,
          current_qty: Number(editingItem.current_qty),
          min_level: Number(editingItem.min_level),
          ideal_level: Number(editingItem.ideal_level || 0),
          max_level: Number(editingItem.max_level || 0),
          last_supplier: editingItem.last_supplier
      });

      if (success) {
          setIsEditModalOpen(false);
          setEditingItem(null);
      }
  };

  // --- REPLENISHMENT HANDLERS ---
  
  const handleToggleReplenish = (item: InventoryItem) => {
      setReplenishmentSelection(prev => {
          const next = { ...prev };
          if (next[item.id]) {
              delete next[item.id];
          } else {
              // Calculate suggestion: Aim for Ideal Level or (Min * 2), ensure at least 1
              const target = item.ideal_level || (item.min_level * 2);
              const suggest = Math.max(1, target - item.current_qty);
              next[item.id] = suggest;
          }
          return next;
      });
  };

  const handleQtyChange = (itemId: string, val: number) => {
      setReplenishmentSelection(prev => ({
          ...prev,
          [itemId]: val
      }));
  };

  const handleCreateReplenishmentRequest = async () => {
      if (filterCondo === 'all') return;
      
      // Build Payload
      const itemsPayload = lowStockItems
        .filter(i => replenishmentSelection[i.id])
        .map(i => ({
            inventory_item_id: i.id,
            name: i.name,
            unit: i.unit,
            current_qty: i.current_qty,
            min_level: i.min_level,
            suggested_qty: replenishmentSelection[i.id]
        }));

      if (itemsPayload.length === 0) return;

      const reqId = await createStockReplenishmentRequest(filterCondo, itemsPayload);
      
      if (reqId) {
          alert("✅ Solicitação de Reposição criada com sucesso! O condomínio foi notificado para aprovação.");
          setReplenishmentSelection({});
          setIsReplenishmentModalOpen(false);
      }
  };

  return (
    <div className="space-y-6 pb-24 md:pb-0">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Package className="text-brand-700" /> Estoque Global (Almoxarifado)
          </h1>
          <p className="text-sm text-gray-600 font-medium">Monitoramento e gestão avançada de insumos.</p>
        </div>
        <div className="flex gap-2">
            <Button 
                onClick={() => setShowCriticalOnly(!showCriticalOnly)} 
                className={`${showCriticalOnly ? 'bg-red-600 text-white hover:bg-red-700 border-red-600' : 'bg-white text-red-600 border-red-200 hover:bg-red-50'} border shadow-sm`}
            >
                {showCriticalOnly ? 'Ver Tudo' : '⚠️ Resumo Estoque Crítico'}
            </Button>
            <Button onClick={refreshData} variant="outline" className="bg-white"><RefreshCw size={18} className="mr-2"/> Atualizar</Button>
        </div>
      </div>

      {/* DASHBOARD CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex items-center justify-between">
              <div>
                  <p className="text-xs font-bold text-gray-500 uppercase">Itens Monitorados</p>
                  <h3 className="text-3xl font-extrabold text-gray-900">{stats.totalItems}</h3>
              </div>
              <div className="p-3 bg-blue-50 text-blue-600 rounded-full"><Package size={24}/></div>
          </div>
          <div className={`p-5 rounded-xl border shadow-sm flex items-center justify-between ${stats.criticalCount > 0 ? 'bg-orange-50 border-orange-200' : 'bg-white border-gray-200'}`}>
              <div>
                  <p className={`text-xs font-bold uppercase ${stats.criticalCount > 0 ? 'text-orange-700' : 'text-gray-500'}`}>Abaixo do Mínimo</p>
                  <h3 className={`text-3xl font-extrabold ${stats.criticalCount > 0 ? 'text-orange-800' : 'text-gray-900'}`}>{stats.criticalCount}</h3>
              </div>
              <div className={`p-3 rounded-full ${stats.criticalCount > 0 ? 'bg-orange-100 text-orange-600' : 'bg-gray-100 text-gray-400'}`}><TrendingDown size={24}/></div>
          </div>
          <div className={`p-5 rounded-xl border shadow-sm flex items-center justify-between ${stats.emptyCount > 0 ? 'bg-red-50 border-red-200' : 'bg-white border-gray-200'}`}>
              <div>
                  <p className={`text-xs font-bold uppercase ${stats.emptyCount > 0 ? 'text-red-700' : 'text-gray-500'}`}>Zerados (Urgente)</p>
                  <h3 className={`text-3xl font-extrabold ${stats.emptyCount > 0 ? 'text-red-800' : 'text-gray-900'}`}>{stats.emptyCount}</h3>
              </div>
              <div className={`p-3 rounded-full ${stats.emptyCount > 0 ? 'bg-red-100 text-red-600' : 'bg-gray-100 text-gray-400'}`}><AlertTriangle size={24}/></div>
          </div>
      </div>

      {/* FILTERS & LIST */}
      <div className="bg-white p-4 rounded-xl border border-gray-200 flex flex-col md:flex-row gap-4 items-center">
          <div className="relative flex-1 w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18}/>
              <input 
                className="w-full pl-10 p-2.5 rounded-lg border border-gray-300 text-sm bg-white text-gray-900" 
                placeholder="Buscar item, fornecedor ou condomínio..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
          </div>
          
          {!showCriticalOnly && (
            <>
                <select className="p-2.5 rounded-lg border border-gray-300 text-sm bg-white text-gray-900 min-w-[200px]" value={filterCondo} onChange={e => setFilterCondo(e.target.value)}>
                    <option value="all">🏢 Todos Condomínios</option>
                    {condos.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <select className="p-2.5 rounded-lg border border-gray-300 text-sm bg-white text-gray-900" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
                    <option value="all">Todos Status</option>
                    <option value="NORMAL">✅ Normal</option>
                    <option value="LOW">⚠️ Baixo</option>
                    <option value="EMPTY">🚨 Zerado</option>
                </select>
            </>
          )}
          
          {showCriticalOnly && (
              <div className="bg-red-50 px-4 py-2 rounded-lg border border-red-100 text-red-700 text-sm font-bold flex items-center gap-2">
                  <Filter size={14}/> Filtrando apenas itens críticos
              </div>
          )}
      </div>

      {/* --- SECTION: SUGGESTED REPLENISHMENT --- */}
      {filterCondo !== 'all' && lowStockItems.length > 0 && (
          <div className="bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-200 rounded-xl p-5 shadow-sm animate-fadeIn">
              <div className="flex justify-between items-start md:items-center mb-4">
                  <div>
                      <h3 className="text-lg font-bold text-purple-900 flex items-center gap-2">
                          <BrainCircuit className="text-purple-600"/> Reposição Sugerida
                      </h3>
                      <p className="text-sm text-purple-800 font-medium">
                          Identificamos {lowStockItems.length} itens com estoque crítico para <b>{getCondoName(filterCondo)}</b>.
                      </p>
                  </div>
                  <Button 
                    onClick={() => setIsReplenishmentModalOpen(true)}
                    className="bg-purple-600 hover:bg-purple-700 text-white shadow-lg shadow-purple-500/30"
                    disabled={Object.keys(replenishmentSelection).length === 0}
                  >
                      <ShoppingCart size={18} className="mr-2"/> Gerar Cotação ({Object.keys(replenishmentSelection).length})
                  </Button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-64 overflow-y-auto pr-2 custom-scrollbar">
                  {lowStockItems.map(item => {
                      const isSelected = !!replenishmentSelection[item.id];
                      return (
                          <div key={item.id} className={`flex items-center gap-3 p-3 rounded-lg border transition-all cursor-pointer ${isSelected ? 'bg-white border-purple-400 shadow-md' : 'bg-white/50 border-purple-100 hover:border-purple-300'}`}>
                              <input 
                                type="checkbox" 
                                className="w-5 h-5 rounded text-purple-600 focus:ring-purple-500"
                                checked={isSelected}
                                onChange={() => handleToggleReplenish(item)}
                              />
                              <div className="flex-1">
                                  <p className="font-bold text-gray-900 text-sm">{item.name}</p>
                                  <div className="flex gap-2 text-xs text-gray-500">
                                      <span className="text-red-600 font-bold">Atual: {item.current_qty}</span>
                                      <span>Mín: {item.min_level}</span>
                                  </div>
                              </div>
                              {isSelected && (
                                  <div className="flex items-center gap-1 bg-purple-50 px-2 py-1 rounded border border-purple-200">
                                      <span className="text-[10px] font-bold text-purple-700 uppercase">Comprar:</span>
                                      <input 
                                        type="number" 
                                        className="w-12 text-center text-sm font-bold bg-white border border-purple-300 rounded focus:border-purple-500 outline-none"
                                        value={replenishmentSelection[item.id]}
                                        onClick={(e) => e.stopPropagation()}
                                        onChange={(e) => handleQtyChange(item.id, Number(e.target.value))}
                                        min={1}
                                      />
                                      <span className="text-xs text-purple-700 font-medium">{item.unit}</span>
                                  </div>
                              )}
                          </div>
                      );
                  })}
              </div>
          </div>
      )}

      {/* REGULAR LIST */}
      <div className="grid grid-cols-1 gap-4">
          {filteredItems.map(item => {
              const condoName = getCondoName(item.condominio_id);
              const percentage = Math.min(100, (item.current_qty / (item.min_level * 3)) * 100);
              const isCritical = item.status !== 'NORMAL';

              return (
                <div key={item.id} className={`bg-white border rounded-xl p-5 flex flex-col md:flex-row justify-between items-center shadow-sm transition-all group ${isCritical ? 'border-l-4 border-l-red-500 border-y-gray-200 border-r-gray-200' : 'border-gray-200'}`}>
                    {/* Left: Info */}
                    <div className="flex items-start gap-4 w-full md:w-1/2">
                        <div className={`p-3 rounded-xl shrink-0 ${item.status === 'NORMAL' ? 'bg-blue-50 text-blue-600' : (item.status === 'LOW' ? 'bg-orange-50 text-orange-600' : 'bg-red-50 text-red-600')}`}>
                            <Package size={24}/>
                        </div>
                        <div className="min-w-0 flex-1">
                            <div className="flex flex-col">
                                <span className="text-[10px] font-bold text-gray-500 uppercase flex items-center gap-1 mb-0.5">
                                    <Building2 size={10}/> {condoName}
                                </span>
                                <h3 className="font-bold text-gray-900 text-lg leading-tight truncate">{item.name}</h3>
                                {item.last_supplier && (
                                    <div className="mt-1 flex gap-2">
                                        <button 
                                            onClick={(e) => { e.stopPropagation(); setViewingPurchaseItem(item); }}
                                            className="text-[10px] bg-gray-100 text-gray-600 px-2 py-1 rounded border border-gray-200 hover:bg-brand-50 hover:text-brand-700 hover:border-brand-200 transition-colors flex items-center gap-1 font-bold"
                                        >
                                            <Eye size={10}/> Ver Dados da Compra
                                        </button>
                                    </div>
                                )}
                            </div>
                            
                            <div className="flex items-center gap-2 mt-2">
                                {item.status === 'EMPTY' && <span className="bg-red-100 text-red-700 text-[10px] font-bold px-2 py-0.5 rounded border border-red-200 flex items-center gap-1"><AlertTriangle size={10}/> ZERADO</span>}
                                {item.status === 'LOW' && <span className="bg-orange-100 text-orange-700 text-[10px] font-bold px-2 py-0.5 rounded border border-orange-200 flex items-center gap-1"><TrendingDown size={10}/> BAIXO</span>}
                                {item.status === 'NORMAL' && <span className="bg-green-100 text-green-700 text-[10px] font-bold px-2 py-0.5 rounded border border-green-200 flex items-center gap-1"><CheckCircle2 size={10}/> NORMAL</span>}
                                
                                <span className="text-xs text-gray-400">• Atualizado: {new Date(item.last_updated).toLocaleDateString()}</span>
                            </div>
                        </div>
                    </div>
                    
                    {/* Right: Stats & Actions */}
                    <div className="flex items-center gap-6 mt-4 md:mt-0 w-full md:w-1/2 justify-between md:justify-end">
                        <div className="w-32 hidden md:block">
                            <div className="flex justify-between text-[10px] font-bold text-gray-400 mb-1">
                                <span>Nível</span>
                                <span>{percentage.toFixed(0)}%</span>
                            </div>
                            <div className="w-full bg-gray-100 rounded-full h-2">
                                <div 
                                    className={`h-2 rounded-full transition-all duration-500 ${item.status === 'NORMAL' ? 'bg-green-500' : item.status === 'EMPTY' ? 'bg-red-500' : 'bg-orange-500'}`} 
                                    style={{ width: `${percentage}%` }}
                                ></div>
                            </div>
                        </div>

                        <div className="flex gap-6 border-l border-gray-100 pl-6">
                            <div className="text-center">
                                <p className="text-[10px] text-gray-400 uppercase font-bold">Mínimo</p>
                                <p className="font-medium text-gray-600">{item.min_level} <span className="text-[10px]">{item.unit}</span></p>
                            </div>
                            <div className="text-center">
                                <p className="text-[10px] text-gray-400 uppercase font-bold">Atual</p>
                                <p className={`text-xl font-extrabold ${item.status === 'NORMAL' ? 'text-green-600' : 'text-red-600'}`}>
                                    {item.current_qty} <span className="text-sm font-medium text-gray-500">{item.unit}</span>
                                </p>
                            </div>
                        </div>

                        {/* Actions */}
                        <div className="flex flex-col gap-2 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity border-l pl-4 border-gray-100">
                            <button 
                                onClick={() => handleEditClick(item)} 
                                className="p-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors"
                                title="Editar Item e Níveis"
                            >
                                <Edit2 size={16}/>
                            </button>
                            <button 
                                onClick={() => handleDeleteClick(item)} 
                                className="p-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors"
                                title="Excluir Item"
                            >
                                <Trash2 size={16}/>
                            </button>
                        </div>
                    </div>
                </div>
              );
          })}
      </div>

      {/* EDIT MODAL */}
      {isEditModalOpen && editingItem && (
          <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4 backdrop-blur-sm">
              <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-fadeInUp">
                  <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
                      <div>
                          <h2 className="text-lg font-bold text-gray-900">Editar Item de Estoque</h2>
                          <p className="text-xs text-gray-500 uppercase font-bold">{getCondoName(editingItem.condominio_id || '')}</p>
                      </div>
                      <button onClick={() => setIsEditModalOpen(false)} className="p-2 hover:bg-gray-200 rounded-full"><X size={20}/></button>
                  </div>
                  
                  <div className="p-6 space-y-5">
                      {/* Name & Unit */}
                      <div className="grid grid-cols-3 gap-4">
                          <div className="col-span-2">
                              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Nome do Item</label>
                              <input 
                                className="w-full p-2.5 rounded-lg border border-gray-300 bg-white text-gray-900 font-medium"
                                value={editingItem.name}
                                onChange={e => setEditingItem({...editingItem, name: e.target.value})}
                              />
                          </div>
                          <div>
                              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Unidade</label>
                              <input 
                                className="w-full p-2.5 rounded-lg border border-gray-300 bg-white text-gray-900 font-medium"
                                value={editingItem.unit}
                                onChange={e => setEditingItem({...editingItem, unit: e.target.value})}
                              />
                          </div>
                      </div>

                      {/* Supplier Field (NEW) */}
                      <div>
                          <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Fornecedor Padrão (Última Compra)</label>
                          <div className="relative">
                              <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                                  <Truck size={16}/>
                              </div>
                              <input 
                                className="w-full pl-9 p-2.5 rounded-lg border border-gray-300 bg-white text-gray-900 font-medium"
                                placeholder="Ex: Kalunga, Leroy Merlin..."
                                value={editingItem.last_supplier || ''}
                                onChange={e => setEditingItem({...editingItem, last_supplier: e.target.value})}
                              />
                          </div>
                      </div>

                      {/* Levels Control */}
                      <div className="bg-brand-50 border border-brand-100 p-4 rounded-xl">
                          <h3 className="text-sm font-bold text-brand-800 mb-3 flex items-center gap-2">
                              <BarChart2 size={16}/> Definição de Níveis
                          </h3>
                          <div className="grid grid-cols-3 gap-4">
                              <div>
                                  <label className="block text-[10px] font-bold text-red-600 uppercase mb-1">Mínimo (Alerta)</label>
                                  <input 
                                    type="number"
                                    className="w-full p-2 rounded-lg border border-red-200 bg-white text-red-900 font-bold text-center"
                                    value={editingItem.min_level}
                                    onChange={e => setEditingItem({...editingItem, min_level: Number(e.target.value)})}
                                  />
                              </div>
                              <div>
                                  <label className="block text-[10px] font-bold text-green-600 uppercase mb-1">Ideal (Meta)</label>
                                  <input 
                                    type="number"
                                    className="w-full p-2 rounded-lg border border-green-200 bg-white text-green-900 font-bold text-center"
                                    value={editingItem.ideal_level || 0}
                                    onChange={e => setEditingItem({...editingItem, ideal_level: Number(e.target.value)})}
                                  />
                              </div>
                              <div>
                                  <label className="block text-[10px] font-bold text-orange-600 uppercase mb-1">Máximo (Excesso)</label>
                                  <input 
                                    type="number"
                                    className="w-full p-2 rounded-lg border border-orange-200 bg-white text-orange-900 font-bold text-center"
                                    value={editingItem.max_level || 0}
                                    onChange={e => setEditingItem({...editingItem, max_level: Number(e.target.value)})}
                                  />
                              </div>
                          </div>
                      </div>

                      {/* Current Quantity Override */}
                      <div>
                          <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Quantidade Atual (Ajuste Manual)</label>
                          <div className="flex items-center gap-3">
                              <input 
                                type="number"
                                className="flex-1 p-3 rounded-xl border border-gray-300 bg-white text-gray-900 font-black text-xl"
                                value={editingItem.current_qty}
                                onChange={e => setEditingItem({...editingItem, current_qty: Number(e.target.value)})}
                              />
                              <div className="text-xs text-gray-400 w-1/2 leading-tight">
                                  Alterar este valor manualmente gera um ajuste de inventário no sistema.
                              </div>
                          </div>
                      </div>
                  </div>

                  <div className="p-4 bg-gray-50 border-t border-gray-200 flex justify-end gap-3">
                      <Button variant="outline" onClick={() => setIsEditModalOpen(false)}>Cancelar</Button>
                      <Button onClick={handleSaveEdit} className="bg-brand-600 text-white"><Save size={16} className="mr-2"/> Salvar Alterações</Button>
                  </div>
              </div>
          </div>
      )}

      {/* VIEW PURCHASE DATA MODAL (NEW) */}
      {viewingPurchaseItem && (
          <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4 backdrop-blur-sm">
              <div className="bg-white w-full max-w-sm rounded-2xl shadow-2xl p-6 animate-fadeInUp relative">
                  <button onClick={() => setViewingPurchaseItem(null)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"><X size={20}/></button>
                  
                  <div className="flex flex-col items-center text-center mb-6">
                      <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 mb-3 border border-blue-200">
                          <ShoppingCart size={32} />
                      </div>
                      <h3 className="text-xl font-extrabold text-gray-900">Detalhes da Última Compra</h3>
                      <p className="text-sm text-gray-500 font-medium mt-1">{viewingPurchaseItem.name}</p>
                  </div>

                  <div className="space-y-4">
                      <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 flex items-center gap-3">
                          <Truck className="text-gray-400 shrink-0" size={20}/>
                          <div className="overflow-hidden">
                              <p className="text-[10px] font-bold text-gray-500 uppercase">Fornecedor</p>
                              <p className="font-bold text-gray-900 truncate">{viewingPurchaseItem.last_supplier || 'Não informado'}</p>
                          </div>
                      </div>

                      <div className="flex gap-4">
                          <div className="flex-1 bg-green-50 p-4 rounded-xl border border-green-100 flex flex-col items-center">
                              <p className="text-[10px] font-bold text-green-700 uppercase mb-1">Preço Unitário</p>
                              <p className="text-xl font-black text-green-800">
                                  {viewingPurchaseItem.last_unit_price 
                                    ? formatCurrency(viewingPurchaseItem.last_unit_price) 
                                    : '-'}
                              </p>
                          </div>
                          <div className="flex-1 bg-blue-50 p-4 rounded-xl border border-blue-100 flex flex-col items-center">
                              <p className="text-[10px] font-bold text-blue-700 uppercase mb-1">Qtd Comprada</p>
                              <p className="text-xl font-black text-blue-800">
                                  {viewingPurchaseItem.last_buy_qty || '-'} <span className="text-xs font-medium">{viewingPurchaseItem.unit}</span>
                              </p>
                          </div>
                      </div>
                      
                      <div className="text-center">
                          <p className="text-xs text-gray-400">Atualizado em: {new Date(viewingPurchaseItem.last_updated).toLocaleDateString()}</p>
                      </div>
                  </div>

                  <div className="mt-6">
                      <Button onClick={() => setViewingPurchaseItem(null)} className="w-full bg-brand-600 hover:bg-brand-700">Fechar</Button>
                  </div>
              </div>
          </div>
      )}

      {/* CONFIRMATION MODAL (REPLENISHMENT) */}
      {isReplenishmentModalOpen && (
          <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4 backdrop-blur-sm">
              <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl p-6 animate-fadeInUp">
                  <h3 className="text-xl font-bold text-gray-900 mb-2">Confirmar Reposição</h3>
                  <p className="text-sm text-gray-600 mb-4">
                      Isso criará uma solicitação de compra para o condomínio <b>{getCondoName(filterCondo)}</b> com os seguintes itens:
                  </p>
                  
                  <div className="bg-purple-50 rounded-xl border border-purple-100 p-4 max-h-48 overflow-y-auto mb-6">
                      <ul className="space-y-2 text-sm">
                          {lowStockItems.filter(i => replenishmentSelection[i.id]).map(i => (
                              <li key={i.id} className="flex justify-between items-center text-gray-800">
                                  <span>{i.name}</span>
                                  <span className="font-bold">{replenishmentSelection[i.id]} {i.unit}</span>
                              </li>
                          ))}
                      </ul>
                  </div>

                  <div className="flex gap-3">
                      <Button variant="outline" onClick={() => setIsReplenishmentModalOpen(false)} className="flex-1">Cancelar</Button>
                      <Button onClick={handleCreateReplenishmentRequest} className="flex-1 bg-purple-600 hover:bg-purple-700 text-white">Criar Solicitação</Button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};
