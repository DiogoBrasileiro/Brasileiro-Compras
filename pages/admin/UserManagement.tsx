import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { UserRole, User } from '../../types';
import { Card, Button, Input, Select } from '../../components/UI';
import { Trash2, UserPlus, Edit2, X, Save, Lock, Unlock, AlertTriangle, KeyRound, RefreshCw, Loader2, Database, ShieldAlert } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';

export const UserManagement: React.FC = () => {
  const { users, addUser, removeUser, updateUser, migrateUser, refreshData, loading } = useApp();
  const [isEditing, setIsEditing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingOldId, setEditingOldId] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [dbDiagnostic, setDbDiagnostic] = useState<{ status: 'ok' | 'error' | 'empty_rls', count?: number, msg?: string } | null>(null);
  
  const [formData, setFormData] = useState({
    nome: '',
    username: '',
    password: '',
    role: UserRole.CONDOMINIO,
    condominio_id: 'new_condo',
    sindico_nome: '',
    sindico_cpf: '',
    condominio_cnpj: '',
    observacoes: ''
  });

  // Force Refresh on Mount and Run Diagnostic
  useEffect(() => {
      const load = async () => {
          setIsRefreshing(true);
          await refreshData();
          
          // Diagnostic Check: Check if table exists and permissions are ok
          const { count, error } = await supabase.from('usuarios').select('*', { count: 'exact', head: true });
          
          if (error) {
              setDbDiagnostic({ status: 'error', msg: error.message });
          } else if (count === 0 || count === null) {
              // If count is 0, it might be RLS hiding rows, or genuinely empty
              setDbDiagnostic({ status: 'empty_rls', count: 0 });
          } else {
              setDbDiagnostic({ status: 'ok', count: count || 0 });
          }

          setIsRefreshing(false);
      };
      load();
  }, []);

  const handleEdit = (user: User) => {
    setEditingOldId(user.id);
    setFormData({
        nome: user.nome,
        username: user.id, 
        password: '', 
        role: user.role,
        condominio_id: user.condominio_id || `c-${Date.now()}`,
        sindico_nome: user.sindico_nome || '',
        sindico_cpf: user.sindico_cpf || '',
        condominio_cnpj: user.condominio_cnpj || '',
        observacoes: user.observacoes || ''
    });
    setIsEditing(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCancelEdit = () => {
    setFormData({ nome: '', username: '', password: '', role: UserRole.CONDOMINIO, condominio_id: 'new_condo', sindico_nome: '', sindico_cpf: '', condominio_cnpj: '', observacoes: '' });
    setIsEditing(false);
    setEditingOldId(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if(!formData.username || !formData.nome) return;

    setIsSubmitting(true);
    const cleanId = formData.username.trim().toLowerCase();

    try {
        if (isEditing && editingOldId) {
            if (cleanId !== editingOldId) {
                // Migration (Rename)
                if (users.find(u => u.id === cleanId)) {
                    alert("Este Login/ID já existe. Escolha outro.");
                    setIsSubmitting(false); return;
                }
                const updates: any = { 
                    nome: formData.nome, 
                    role: formData.role, 
                    condominio_id: formData.role === UserRole.CONDOMINIO ? formData.condominio_id : undefined,
                    sindico_nome: formData.role === UserRole.CONDOMINIO ? formData.sindico_nome : undefined,
                    sindico_cpf: formData.role === UserRole.CONDOMINIO ? formData.sindico_cpf : undefined,
                    condominio_cnpj: formData.role === UserRole.CONDOMINIO ? formData.condominio_cnpj : undefined,
                    observacoes: formData.role === UserRole.CONDOMINIO ? formData.observacoes : undefined
                };
                if (formData.password) updates.password = formData.password;
                
                await migrateUser(editingOldId, cleanId, updates);
                handleCancelEdit();
            } else {
                // Update
                const updates: Partial<User & { password?: string }> = { 
                    nome: formData.nome, 
                    role: formData.role, 
                    condominio_id: formData.role === UserRole.CONDOMINIO ? formData.condominio_id : undefined,
                    sindico_nome: formData.role === UserRole.CONDOMINIO ? formData.sindico_nome : undefined,
                    sindico_cpf: formData.role === UserRole.CONDOMINIO ? formData.sindico_cpf : undefined,
                    condominio_cnpj: formData.role === UserRole.CONDOMINIO ? formData.condominio_cnpj : undefined,
                    observacoes: formData.role === UserRole.CONDOMINIO ? formData.observacoes : undefined
                };
                if (formData.password) updates.password = formData.password;
                await updateUser(cleanId, updates);
                alert("Dados do condomínio atualizados com sucesso!");
                handleCancelEdit();
            }
        } else {
            // Create
            if (!formData.password) { alert("Senha é obrigatória."); setIsSubmitting(false); return; }
            if (users.find(u => u.id === cleanId)) { alert(`O Login "${cleanId}" já está sendo usado.`); setIsSubmitting(false); return; }

            const success = await addUser({
                id: cleanId,
                nome: formData.nome,
                role: formData.role,
                condominio_id: formData.role === UserRole.CONDOMINIO ? `c-${Date.now()}` : undefined,
                password: formData.password,
                sindico_nome: formData.role === UserRole.CONDOMINIO ? formData.sindico_nome : undefined,
                sindico_cpf: formData.role === UserRole.CONDOMINIO ? formData.sindico_cpf : undefined,
                condominio_cnpj: formData.role === UserRole.CONDOMINIO ? formData.condominio_cnpj : undefined,
                observacoes: formData.role === UserRole.CONDOMINIO ? formData.observacoes : undefined
            });
            if (success) {
                setFormData({ nome: '', username: '', password: '', role: UserRole.CONDOMINIO, condominio_id: 'new_condo' });
                alert("Usuário criado!");
            }
        }
    } catch (error) {
        console.error(error);
        alert("Erro ao salvar.");
    } finally {
        setIsSubmitting(false);
        refreshData(); // Ensure UI sync
    }
  };

  const handleDelete = async (userId: string) => {
      if (confirm(`Tem certeza que deseja excluir o usuário '${userId}'?`)) {
          await removeUser(userId);
      }
  };

  // Filter out duplicate masters if any
  const uniqueUsers = Array.from(new Map(users.map(item => [item.id, item])).values()) as User[];

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">Gestão de Acessos (Usuários)</h1>
          <p className="text-sm text-gray-500">Administre usuários e redefina senhas.</p>
        </div>
        <div className="flex gap-2">
            {dbDiagnostic?.status === 'ok' && (
                <span className="hidden md:flex items-center gap-1 text-xs font-bold text-green-700 bg-green-50 px-3 py-1 rounded-full border border-green-200">
                    <Database size={12}/> DB Conectado ({dbDiagnostic.count} regs)
                </span>
            )}
            <Button onClick={refreshData} variant="outline" className="bg-white border-gray-300" disabled={isRefreshing || loading}>
                {isRefreshing || loading ? <Loader2 className="animate-spin mr-2" size={18}/> : <RefreshCw className="mr-2" size={18}/>}
                {isRefreshing || loading ? 'Atualizando...' : 'Recarregar Dados'}
            </Button>
        </div>
      </div>

      {/* RLS WARNING - CRITICAL FOR USER */}
      {dbDiagnostic && uniqueUsers.length <= 1 && (
          <div className="bg-orange-50 border-l-4 border-orange-500 p-4 rounded-r-xl shadow-sm animate-fadeIn">
              <div className="flex items-start gap-3">
                  <ShieldAlert className="text-orange-600 shrink-0 mt-1" size={24}/>
                  <div>
                      <h3 className="font-bold text-orange-900">Atenção: Os usuários do banco não estão aparecendo?</h3>
                      <p className="text-sm text-orange-800 mt-1">
                          Isso geralmente acontece quando as <b>Permissões de Segurança (RLS)</b> do Supabase estão bloqueando a leitura.
                          O banco protege os dados por padrão.
                      </p>
                      <div className="mt-3 bg-white p-3 rounded border border-orange-200">
                          <p className="text-xs font-bold text-gray-500 uppercase mb-1">Solução: Rode este comando no SQL Editor do Supabase</p>
                          <code className="block text-xs font-mono bg-gray-900 text-green-400 p-2 rounded select-all">
                              DROP POLICY IF EXISTS "Allow All Users" ON public.usuarios;<br/>
                              CREATE POLICY "Allow All Users" ON public.usuarios FOR ALL USING (true) WITH CHECK (true);
                          </code>
                      </div>
                  </div>
              </div>
          </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1">
             <Card title={isEditing ? "Editar Acesso" : "Adicionar Novo Acesso"}>
                 <form onSubmit={handleSubmit} className="space-y-4">
                     <Input label="Nome" placeholder="Ex: Condomínio Solar" value={formData.nome} onChange={e => setFormData({...formData, nome: e.target.value})} required disabled={isSubmitting} />
                     <Input label="Login (ID)" value={formData.username} onChange={e => setFormData({...formData, username: e.target.value})} required disabled={isSubmitting} className={isEditing ? 'bg-yellow-50' : ''} placeholder="Ex: solar" />
                     
                     {formData.role === UserRole.CONDOMINIO && (
                        <>
                            <Input label="Nome do Síndico" value={formData.sindico_nome} onChange={e => setFormData({...formData, sindico_nome: e.target.value})} disabled={isSubmitting} />
                            <Input label="CPF do Síndico" value={formData.sindico_cpf} onChange={e => setFormData({...formData, sindico_cpf: e.target.value})} disabled={isSubmitting} />
                            <Input label="CNPJ do Condomínio" value={formData.condominio_cnpj} onChange={e => setFormData({...formData, condominio_cnpj: e.target.value})} disabled={isSubmitting} />
                            <Input label="Observações" value={formData.observacoes} onChange={e => setFormData({...formData, observacoes: e.target.value})} disabled={isSubmitting} />
                        </>
                     )}
                     
                     <div className="relative">
                        <Input label={isEditing ? "Nova Senha (Opcional)" : "Senha"} type="text" placeholder={isEditing ? "Manter atual" : "Senha..."} value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} required={!isEditing} disabled={isSubmitting} />
                        <div className="absolute right-3 top-9 text-gray-400 pointer-events-none"><KeyRound size={16}/></div>
                     </div>
                     <Select label="Função" options={[{ value: UserRole.CONDOMINIO, label: 'Condomínio' }, { value: UserRole.ADMIN, label: 'Administrador' }]} value={formData.role} onChange={e => setFormData({...formData, role: e.target.value as UserRole})} disabled={isSubmitting} />
                     
                     <div className="flex gap-2 pt-2">
                        {isEditing && <Button type="button" variant="outline" onClick={handleCancelEdit} className="flex-1"><X size={18}/> Cancelar</Button>}
                        <Button type="submit" className={`flex-1 ${isEditing ? 'bg-orange-600' : 'bg-brand-600'}`} disabled={isSubmitting}>
                            {isSubmitting ? 'Salvando...' : (isEditing ? 'Atualizar' : 'Criar Acesso')}
                        </Button>
                     </div>
                 </form>
             </Card>
          </div>

          <div className="lg:col-span-2">
              <Card title={`Usuários (${uniqueUsers.length})`}>
                  <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                          <thead className="bg-gray-50">
                              <tr>
                                  <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase">Segurança</th>
                                  <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase">Nome</th>
                                  <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase">Login</th>
                                  <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase">Função</th>
                                  <th className="px-4 py-3 text-right text-xs font-bold text-gray-500 uppercase">Ações</th>
                              </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-200">
                              {uniqueUsers.map(u => (
                                <tr key={u.id} className="hover:bg-gray-50 group">
                                    <td className="px-4 py-3 text-center">{(u.password && u.password.length > 0) ? <Lock size={16} className="text-green-500"/> : <Unlock size={16} className="text-red-500 animate-pulse"/>}</td>
                                    <td className="px-4 py-3 text-sm text-gray-900 font-bold">{u.nome}</td>
                                    <td className="px-4 py-3 text-sm text-gray-600 font-mono bg-gray-50 rounded px-2 w-fit">{u.id}</td>
                                    <td className="px-4 py-3 text-sm"><span className={`px-2 py-1 rounded-md text-xs font-bold border ${u.role === UserRole.ADMIN ? 'bg-purple-50 text-purple-700 border-purple-200' : 'bg-blue-50 text-blue-700 border-blue-200'}`}>{u.role}</span></td>
                                    <td className="px-4 py-3 text-right flex justify-end gap-2">
                                        <Button variant="secondary" onClick={() => handleEdit(u)} className="px-2 py-1 h-auto text-xs"><Edit2 size={14}/></Button>
                                        {u.id !== 'brasileiroadm' && <Button variant="danger" onClick={() => handleDelete(u.id)} className="px-2 py-1 h-auto text-xs"><Trash2 size={14}/></Button>}
                                    </td>
                                </tr>
                              ))}
                              {uniqueUsers.length === 0 && <tr><td colSpan={5} className="p-8 text-center text-gray-500">Nenhum usuário encontrado.</td></tr>}
                          </tbody>
                      </table>
                  </div>
              </Card>
          </div>
      </div>
    </div>
  );
};