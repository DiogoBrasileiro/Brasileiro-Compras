
import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Card, Button, Input, Select } from '../../components/UI';
import { Package, MinusCircle, AlertCircle, CheckCircle2, Search, History, Settings2, Edit3 } from 'lucide-react';

export const CondoInventory: React.FC = () => {
  const { inventoryItems, currentUser, registerConsumption, adjustStockQuantity, inventoryMovements } = useApp();
  const [selectedItem, setSelectedItem] = useState<string | null>(null);
  const [qtyInput, setQtyInput] = useState<number>(1);
  const [reasonInput, setReasonInput] = useState('');
  const [actionType, setActionType] = useState<'CONSUME' | 'ADJUST'>('CONSUME');
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Filter items for CURRENT CONDO only
  const myItems = inventoryItems.filter(i => i.condominio_id === currentUser?.condominio_id)
    .filter(i => i.name.toLowerCase().includes(searchTerm.toLowerCase()));

  // Stats
  const lowStockCount = myItems.filter(i => i.status !== 'NORMAL').length;

  const handleOpenAction = (itemId: string, type: 'CONSUME' | 'ADJUST') => {
      setSelectedItem(itemId);
      setActionType(type);
      const item = inventoryItems.find(i => i.id === itemId);
      
      if (type === 'ADJUST') {
          setQtyInput(item?.current_qty || 0); // Start with current qty for adjustment
          setReasonInput('');
      } else {
          setQtyInput(1); // Start with 1 for consumption
          setReasonInput('');
      }
      setIsModalOpen(true);
  };

  const handleConfirm = async () => {
      if (!selectedItem) return;
      
      let success = false;
      if (actionType === 'CONSUME') {
          success = await registerConsumption(selectedItem, qtyInput, reasonInput || 'Consumo interno');
      } else {
          success = await adjustStockQuantity(selectedItem, qtyInput, reasonInput || 'Ajuste manual de inventário');
      }

      if (success) {
          setIsModalOpen(false);
          // alert handled in context or optional here
      }
  };

  const selectedItemDetails = myItems.find(i => i.id === selectedItem);

  return (
    <div className="space-y-6 pb-24">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Package className="text-brand-600" /> Meu Estoque
          </h1>
          <p className="text-sm text-gray-500">Controle de materiais e insumos.</p>
        </div>
      </div>

      {lowStockCount > 0 && (
          <div className="bg-orange-50 border border-orange-200 p-4 rounded-xl flex items-start gap-3 animate-fadeIn">
              <AlertCircle className="text-orange-600 shrink-0" size={24} />
              <div>
                  <h3 className="font-bold text-orange-900 text-sm">Atenção: Estoque Baixo</h3>
                  <p className="text-xs text-orange-800 mt-1">Você possui <b>{lowStockCount} itens</b> abaixo do nível mínimo. Verifique e solicite reposição se necessário.</p>
              </div>
          </div>
      )}

      {/* SEARCH */}
      <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18}/>
          <input 
            className="w-full pl-10 p-3 rounded-xl border border-gray-300 shadow-sm" 
            placeholder="Buscar material..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
      </div>

      {/* ITEMS LIST */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {myItems.map(item => (
              <div key={item.id} className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm flex flex-col justify-between h-full group">
                  <div>
                      <div className="flex justify-between items-start mb-2">
                          <h3 className="font-bold text-gray-900 text-lg leading-tight">{item.name}</h3>
                          {item.status === 'NORMAL' 
                            ? <CheckCircle2 size={20} className="text-green-500"/>
                            : <AlertCircle size={20} className={item.status === 'EMPTY' ? 'text-red-500' : 'text-orange-500'}/>
                          }
                      </div>
                      <div className="flex items-end gap-2 mb-4">
                          <span className={`text-3xl font-extrabold ${item.status === 'NORMAL' ? 'text-gray-900' : item.status === 'EMPTY' ? 'text-red-600' : 'text-orange-600'}`}>
                              {item.current_qty}
                          </span>
                          <span className="text-sm font-medium text-gray-500 mb-1.5">{item.unit}</span>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-2 mb-4">
                          <div 
                            className={`h-2 rounded-full ${item.status === 'NORMAL' ? 'bg-green-500' : item.status === 'EMPTY' ? 'bg-red-500' : 'bg-orange-500'}`} 
                            style={{ width: `${Math.min(100, (item.current_qty / (item.min_level * 3)) * 100)}%` }}
                          ></div>
                      </div>
                  </div>
                  
                  <div className="flex gap-2 mt-auto">
                      <Button onClick={() => handleOpenAction(item.id, 'CONSUME')} className="flex-1 text-xs py-2 bg-brand-600 hover:bg-brand-700 text-white shadow-md">
                          <MinusCircle size={16} className="mr-1.5"/> Baixa / Uso
                      </Button>
                      <Button variant="outline" onClick={() => handleOpenAction(item.id, 'ADJUST')} className="px-2 text-gray-500 hover:text-gray-700 border-gray-200" title="Ajuste Manual">
                          <Settings2 size={18}/>
                      </Button>
                  </div>
              </div>
          ))}
          {myItems.length === 0 && (
              <div className="col-span-full text-center py-12 text-gray-400 bg-gray-50 rounded-xl border-2 border-dashed">
                  <Package size={48} className="mx-auto mb-3 opacity-20"/>
                  <p>Nenhum item em estoque no momento.</p>
                  <p className="text-xs mt-1">O estoque é alimentado automaticamente quando suas compras avulsas são entregues.</p>
              </div>
          )}
      </div>

      {/* ACTION MODAL */}
      {isModalOpen && selectedItemDetails && (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm px-4">
              <div className="bg-white w-full max-w-sm rounded-2xl shadow-2xl p-6 animate-fadeInUp">
                  <h3 className="font-bold text-xl text-gray-900 mb-1">
                      {actionType === 'CONSUME' ? 'Registrar Consumo' : 'Ajuste Manual de Estoque'}
                  </h3>
                  <p className="text-sm text-gray-500 mb-6">
                      {actionType === 'CONSUME' ? 'Saída de material do almoxarifado.' : 'Correção da quantidade atual disponível.'}
                  </p>
                  
                  <div className="bg-gray-50 p-4 rounded-xl mb-4 border border-gray-100">
                      <p className="text-xs text-gray-500 font-bold uppercase mb-1">Item Selecionado</p>
                      <p className="font-bold text-gray-900">{selectedItemDetails.name}</p>
                      <p className="text-sm text-gray-600 mt-1">Atual no Sistema: <b>{selectedItemDetails.current_qty} {selectedItemDetails.unit}</b></p>
                  </div>

                  <div className="space-y-4">
                      <div>
                          <label className="block text-sm font-bold text-gray-700 mb-1">
                              {actionType === 'CONSUME' ? 'Quantidade Retirada' : 'Nova Quantidade Total'}
                          </label>
                          <input 
                            type="number" 
                            min="0" 
                            max={actionType === 'CONSUME' ? selectedItemDetails.current_qty : 9999}
                            className={`w-full p-4 rounded-xl border-2 text-2xl font-black text-center focus:ring-4 outline-none transition-all bg-white ${actionType === 'ADJUST' ? 'border-blue-200 text-blue-700 focus:ring-blue-100' : 'border-gray-200 text-gray-900 focus:ring-gray-100'}`}
                            value={qtyInput}
                            onChange={e => setQtyInput(Number(e.target.value))}
                          />
                          {actionType === 'ADJUST' && (
                              <p className="text-xs text-center text-blue-600 mt-1 font-medium">Esta ação atualizará o saldo para o valor exato acima.</p>
                          )}
                      </div>
                      <Input 
                        label="Motivo (Opcional)" 
                        placeholder={actionType === 'CONSUME' ? "Ex: Limpeza Bloco A" : "Ex: Contagem física, Perda, Ajuste"}
                        value={reasonInput}
                        onChange={e => setReasonInput(e.target.value)}
                      />
                  </div>

                  <div className="flex gap-3 mt-6">
                      <Button variant="outline" onClick={() => setIsModalOpen(false)} className="flex-1">Cancelar</Button>
                      <Button 
                        onClick={handleConfirm} 
                        className={`flex-1 ${actionType === 'ADJUST' ? 'bg-blue-600 hover:bg-blue-700' : 'bg-brand-600'}`}
                        disabled={qtyInput < 0 || (actionType === 'CONSUME' && qtyInput > selectedItemDetails.current_qty)}
                      >
                          Confirmar
                      </Button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};
