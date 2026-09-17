
import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { RequestType, RequestLevel } from '../../types';
import { Card, Button, Input, Select, Textarea } from '../../components/UI';
import { UploadCloud, File, X, Info, Users, CheckSquare } from 'lucide-react';

export const NewRequest: React.FC<{ onSuccess: () => void }> = ({ onSuccess }) => {
  const { currentUser, addRequest, categories } = useApp();
  
  const [formData, setFormData] = useState({
    titulo: '',
    descricao: '',
    tipo: RequestType.RECORRENTE,
    category_id: '',
    nivel: RequestLevel.N2,
    assembly_required: false // NEW CHECKBOX
  });

  const [files, setFiles] = useState<File[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Filter Active Categories
  const activeCategories = useMemo(() => categories.filter(c => c.active), [categories]);
  
  const selectedCategory = useMemo(() => 
    categories.find(c => c.id === formData.category_id), 
  [formData.category_id, categories]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
        const newFiles = Array.from(e.target.files);
        setFiles(prev => [...prev, ...newFiles]);
    }
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.category_id) {
        alert("Selecione uma categoria.");
        return;
    }

    if (!currentUser || !currentUser.condominio_id) {
        alert("Erro de identificação do condomínio. Faça login novamente.");
        return;
    }
    
    setIsSubmitting(true);

    try {
        await addRequest({
          condominio_id: currentUser.condominio_id,
          condominio_nome: currentUser.nome,
          responsavel_nome: currentUser.nome,
          data_solicitacao: new Date().toISOString(),
          titulo: formData.titulo,
          descricao: formData.descricao,
          tipo: formData.tipo,
          categoria: selectedCategory ? selectedCategory.name : 'Outros',
          category_id: selectedCategory?.id,
          nivel: formData.nivel,
          fora_do_prazo: false,
          assembly_data: { 
             required: formData.assembly_required,
             status: 'PENDENTE'
          }
        }, files); 
        
        // Note: Success alert is handled inside AppContext if it succeeds
        // We close the modal only if no exception was thrown (but addRequest catches exceptions, so we assume success if no alert there)
        onSuccess();
    } catch (err) {
        // This catch block might not be reached if addRequest handles it, but good safety
        console.error(err);
    } finally {
        setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Nova Solicitação de Compra</h1>
        <p className="text-gray-500">Preencha os dados de forma simples e direta.</p>
      </div>

      <form onSubmit={handleSubmit}>
        <Card className="space-y-5">
          
          {/* 1. Recorrente ou Avulso */}
          <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">Tipo de Pedido</label>
              <div className="grid grid-cols-2 gap-3">
                  <button 
                    type="button"
                    onClick={() => setFormData({...formData, tipo: RequestType.RECORRENTE})}
                    className={`p-3 rounded-lg border text-sm font-bold transition-all ${formData.tipo === RequestType.RECORRENTE ? 'bg-brand-50 border-brand-500 text-brand-700' : 'bg-white border-gray-200 text-gray-600'}`}
                  >
                      Recorrente (Rotina)
                  </button>
                  <button 
                    type="button"
                    onClick={() => setFormData({...formData, tipo: RequestType.AVULSA_MELHORIA})}
                    className={`p-3 rounded-lg border text-sm font-bold transition-all ${formData.tipo === RequestType.AVULSA_MELHORIA ? 'bg-brand-50 border-brand-500 text-brand-700' : 'bg-white border-gray-200 text-gray-600'}`}
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
                    value={formData.category_id}
                    onChange={(e) => setFormData({...formData, category_id: e.target.value})}
                    required
                >
                    <option value="">Selecione...</option>
                    {activeCategories.map(c => (
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
                value={formData.nivel}
                onChange={(e) => setFormData({...formData, nivel: e.target.value as RequestLevel})}
             />
          </div>
          
          <Input 
            label="Título do Pedido" 
            placeholder="Ex: Compra de Material de Limpeza" 
            value={formData.titulo}
            onChange={(e) => setFormData({...formData, titulo: e.target.value})}
            required
          />

          <Textarea 
            label="Descrição Detalhada e Itens" 
            placeholder="Liste os itens, quantidades e detalhes importantes..." 
            value={formData.descricao}
            onChange={(e) => setFormData({...formData, descricao: e.target.value})}
            required
            rows={5}
          />

          {/* Anexos */}
          <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">Anexar Foto ou Documento</label>
              <div className={`border-2 border-dashed rounded-xl p-6 text-center hover:border-brand-500 transition-colors cursor-pointer relative bg-gray-50 border-gray-300`}>
                <input 
                    type="file" 
                    multiple 
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" 
                    onChange={handleFileChange} 
                />
                <div className="flex flex-col items-center pointer-events-none">
                    <UploadCloud className="h-8 w-8 text-gray-400 mb-2" />
                    <p className="text-sm text-gray-600 font-medium">Clique para adicionar anexos</p>
                </div>
              </div>
          </div>

          {/* Lista de Arquivos */}
          {files.length > 0 && (
              <div className="space-y-2">
                  {files.map((file, idx) => (
                      <div key={idx} className="flex items-center justify-between bg-white border p-3 rounded-lg shadow-sm">
                          <div className="flex items-center gap-2 overflow-hidden">
                              <File size={16} className="text-brand-500 flex-shrink-0" />
                              <span className="text-sm text-gray-700 font-medium truncate">{file.name}</span>
                          </div>
                          <button type="button" onClick={() => removeFile(idx)} className="text-gray-400 hover:text-red-500">
                              <X size={18} />
                          </button>
                      </div>
                  ))}
              </div>
          )}

          {/* Assembleia Checkbox */}
          <div className="bg-purple-50 p-4 rounded-xl border border-purple-200 flex items-center gap-3">
              <input 
                  type="checkbox" 
                  id="assembly_chk"
                  className="w-5 h-5 text-purple-600 rounded focus:ring-purple-500 border-gray-300"
                  checked={formData.assembly_required}
                  onChange={(e) => setFormData({...formData, assembly_required: e.target.checked})}
              />
              <label htmlFor="assembly_chk" className="text-sm text-purple-900 font-bold cursor-pointer select-none flex items-center gap-2">
                  <Users size={16}/> Incluir este orçamento na pauta da Assembleia
              </label>
          </div>

          <div className="pt-4">
            <Button type="submit" className="w-full text-lg py-4 shadow-lg shadow-brand-500/20" disabled={isSubmitting}>
                {isSubmitting ? 'Registrando...' : 'Registrar Solicitação'}
            </Button>
          </div>
        </Card>
      </form>
    </div>
  );
};
