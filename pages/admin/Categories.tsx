
import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { PurchaseCategory } from '../../types';
import { Button, Input } from '../../components/UI';
import { Tags, Plus, Edit2, Trash2, Shield, Clock, Package, RefreshCw, Loader2, ShieldAlert } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';

const COLORS = [
    { name: 'Blue', value: 'bg-blue-100 text-blue-800' },
    { name: 'Green', value: 'bg-green-100 text-green-800' },
    { name: 'Red', value: 'bg-red-100 text-red-800' },
    { name: 'Purple', value: 'bg-purple-100 text-purple-800' },
    { name: 'Yellow', value: 'bg-yellow-100 text-yellow-800' },
];

export const Categories: React.FC = () => {
  const { categories, addCategory, updateCategory, deleteCategory, refreshData, loading } = useApp();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [dbDiagnostic, setDbDiagnostic] = useState<{ status: 'ok' | 'error' | 'empty_rls', count?: number, msg?: string } | null>(null);
  
  const [formData, setFormData] = useState<Partial<PurchaseCategory>>({
      name: '', active: true, color: COLORS[0].value, default_type: 'BOTH',
      requires_three_quotes: true, deadline_day_of_month: null, requires_evidence: false, inventory_enabled: false, min_quote_business_days: 0
  });

  // Force Refresh on Mount & Diagnostic
  useEffect(() => {
      const load = async () => {
          setIsRefreshing(true);
          await refreshData();
          
          // Diagnostic: Check if table has rows but we don't see them (RLS issue)
          const { count, error } = await supabase.from('categories').select('*', { count: 'exact', head: true });
          
          if (error) {
              setDbDiagnostic({ status: 'error', msg: error.message });
          } else if (count === 0 && categories.length === 0) {
              // Probably empty or RLS hiding it
              setDbDiagnostic({ status: 'empty_rls', count: 0 });
          } else {
              setDbDiagnostic({ status: 'ok', count: count || 0 });
          }
          setIsRefreshing(false);
      };
      load();
  }, []);

  const handleEdit = (cat: PurchaseCategory) => {
      setFormData(cat);
      setEditMode(true);
      setIsModalOpen(true);
  };

  const handleNew = () => {
      setFormData({
        name: '', active: true, color: COLORS[0].value, default_type: 'BOTH',
        requires_three_quotes: true, deadline_day_of_month: null, requires_evidence: false, inventory_enabled: false, min_quote_business_days: 0
      });
      setEditMode(false);
      setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!formData.name) return;
      const slug = formData.slug || formData.name.toLowerCase().replace(/ /g, '-').replace(/[^\w-]+/g, '');
      if (editMode && formData.id) await updateCategory(formData.id, { ...formData, slug });
      else await addCategory({ ...formData, slug, icon: 'Tag' } as any);
      setIsModalOpen(false);
      refreshData();
  };

  const handleManualRefresh = async () => {
      setIsRefreshing(true);
      await refreshData();
      setIsRefreshing(false);
  };

  return (
    <div className="space-y-6 pb-24 md:pb-0">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Tags className="text-brand-700" /> Categorias
          </h1>
          <p className="text-sm text-gray-600 font-medium">Gerencie as categorias de compra do sistema (Tabela: public.categories).</p>
        </div>
        <div className="flex gap-2">
            <Button onClick={handleManualRefresh} variant="outline" className="bg-white border-gray-300" disabled={isRefreshing || loading}>
                {isRefreshing ? <Loader2 className="animate-spin mr-2" size={18}/> : <RefreshCw className="mr-2" size={18}/>}
                Atualizar
            </Button>
            <Button onClick={handleNew} className="hidden md:flex"><Plus size={18} className="mr-2"/> Nova</Button>
        </div>
      </div>

      {/* RLS WARNING - Show if categories are empty but we suspect data exists or permissions are strict */}
      {categories.length === 0 && dbDiagnostic?.status !== 'error' && (
          <div className="bg-orange-50 border-l-4 border-orange-500 p-4 rounded-r-xl shadow-sm animate-fadeIn">
              <div className="flex items-start gap-3">
                  <ShieldAlert className="text-orange-600 shrink-0 mt-1" size={24}/>
                  <div>
                      <h3 className="font-bold text-orange-900">As categorias não estão aparecendo?</h3>
                      <p className="text-sm text-orange-800 mt-1">
                          Se você já possui dados na tabela <b>public.categories</b> e eles não aparecem aqui, é provável que seja um bloqueio de permissão (RLS).
                      </p>
                      <div className="mt-3 bg-white p-3 rounded border border-orange-200">
                          <p className="text-xs font-bold text-gray-500 uppercase mb-1">Solução (SQL Editor):</p>
                          <code className="block text-xs font-mono bg-gray-900 text-green-400 p-2 rounded select-all">
                              DROP POLICY IF EXISTS "Allow All Categories" ON public.categories;<br/>
                              CREATE POLICY "Allow All Categories" ON public.categories FOR ALL USING (true) WITH CHECK (true);
                          </code>
                      </div>
                  </div>
              </div>
          </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {categories.map(cat => (
              <div key={cat.id} className={`bg-white border border-gray-200 p-5 rounded-2xl relative group transition-all shadow-sm ${cat.active ? '' : 'opacity-60 bg-gray-50'}`}>
                  <div className="flex justify-between items-start mb-4">
                      <span className={`px-2.5 py-1 rounded-md text-xs font-bold border border-current ${cat.color}`}>
                          {cat.name}
                      </span>
                      <div className="flex gap-1 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => handleEdit(cat)} className="p-1.5 hover:bg-gray-100 rounded text-gray-600"><Edit2 size={16}/></button>
                          <button onClick={() => deleteCategory(cat.id)} className="p-1.5 hover:bg-red-50 rounded text-red-600"><Trash2 size={16}/></button>
                      </div>
                  </div>

                  <div className="space-y-2.5 text-sm text-gray-600 font-medium">
                      <div className="flex items-center justify-between">
                          <span className="flex items-center gap-2"><Clock size={14} className="text-gray-400"/> Prazo</span>
                          <b className="text-gray-900">{cat.deadline_day_of_month ? `Dia ${cat.deadline_day_of_month}` : '-'}</b>
                      </div>
                      <div className="flex items-center justify-between">
                          <span className="flex items-center gap-2"><Shield size={14} className="text-gray-400"/> Evidência</span>
                          <b className={cat.requires_evidence ? 'text-brand-700' : 'text-gray-900'}>{cat.requires_evidence ? 'Sim' : 'Não'}</b>
                      </div>
                      <div className="flex items-center justify-between">
                          <span className="flex items-center gap-2"><Package size={14} className="text-gray-400"/> Estoque</span>
                          <b className="text-gray-900">{cat.inventory_enabled ? 'Sim' : 'Não'}</b>
                      </div>
                  </div>
              </div>
          ))}
          {categories.length === 0 && dbDiagnostic?.status === 'ok' && dbDiagnostic.count === 0 && (
              <div className="col-span-full p-10 text-center text-gray-400 bg-gray-50 rounded-xl border-2 border-dashed">
                  Nenhuma categoria cadastrada. Clique em "Nova" para começar.
              </div>
          )}
      </div>
      
      {/* Mobile FAB */}
      <button onClick={handleNew} className="md:hidden fixed bottom-24 right-4 h-14 w-14 rounded-full bg-brand-600 text-white shadow-lg shadow-brand-600/40 flex items-center justify-center z-40 active:scale-90 transition-transform">
          <Plus size={24}/>
      </button>

      {/* Modal - Basic Implementation reused logic */}
      {isModalOpen && (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
              <div className="bg-white w-full max-w-lg p-6 rounded-2xl shadow-2xl animate-fadeIn max-h-[90vh] overflow-y-auto border border-gray-200">
                  <h3 className="text-xl font-bold mb-4 text-gray-900">{editMode ? 'Editar' : 'Nova'} Categoria</h3>
                  <form onSubmit={handleSubmit} className="space-y-4">
                      <Input label="Nome" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} required />
                      <div className="grid grid-cols-2 gap-4">
                          <div>
                              <label className="block text-sm font-bold text-gray-700 mb-1">Cor</label>
                              <select className="w-full p-3 rounded-xl border border-gray-300 bg-white text-sm text-gray-900 font-medium" value={formData.color} onChange={e => setFormData({...formData, color: e.target.value})}>
                                  {COLORS.map(c => <option key={c.name} value={c.value}>{c.name}</option>)}
                              </select>
                          </div>
                          <div className="flex items-center mt-6 gap-2">
                             <input type="checkbox" checked={formData.active} onChange={e => setFormData({...formData, active: e.target.checked})} className="h-5 w-5 rounded text-brand-600"/>
                             <span className="text-sm font-bold text-gray-700">Ativa</span>
                          </div>
                      </div>
                      
                      <div className="bg-gray-50 p-4 rounded-xl space-y-3 border border-gray-200">
                          <p className="text-xs font-bold text-gray-500 uppercase">Regras</p>
                          <div className="grid grid-cols-2 gap-3">
                              <Input label="Dia Limite (1-31)" type="number" value={formData.deadline_day_of_month || ''} onChange={e => setFormData({...formData, deadline_day_of_month: e.target.value ? Number(e.target.value) : null})} />
                              <Input label="SLA Cotação (dias)" type="number" value={formData.min_quote_business_days} onChange={e => setFormData({...formData, min_quote_business_days: Number(e.target.value)})} />
                          </div>
                          <div className="space-y-2">
                              <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                                  <input type="checkbox" checked={formData.requires_evidence} onChange={e => setFormData({...formData, requires_evidence: e.target.checked})}/> Evidência Obrigatória
                              </label>
                              <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                                  <input type="checkbox" checked={formData.inventory_enabled} onChange={e => setFormData({...formData, inventory_enabled: e.target.checked})}/> Integrar Estoque
                              </label>
                          </div>
                      </div>

                      <div className="flex justify-end gap-2 pt-2">
                          <Button variant="ghost" type="button" onClick={() => setIsModalOpen(false)} className="text-gray-600">Cancelar</Button>
                          <Button type="submit">Salvar</Button>
                      </div>
                  </form>
              </div>
          </div>
      )}
    </div>
  );
};
