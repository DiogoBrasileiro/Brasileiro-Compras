import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { LOGO_URL } from '../constants';
import { ShieldCheck, Building2, Loader2, ArrowRight } from 'lucide-react';

export const Login: React.FC = () => {
  const { login, logoUrl, users } = useApp();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isAdminMode, setIsAdminMode] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const displayLogo = logoUrl || LOGO_URL;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    await login(username, password);
    setIsLoading(false);
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-6 relative overflow-hidden bg-slate-50">
        
        {/* Subtle Background Elements (Clean) */}
        <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] bg-blue-100/40 rounded-full blur-[120px]"></div>
        <div className="absolute bottom-[-20%] right-[-10%] w-[500px] h-[500px] bg-indigo-100/40 rounded-full blur-[120px]"></div>

        <div className="w-full max-w-sm relative z-10 animate-fadeInUp">
            
            <div className="flex flex-col items-center mb-10">
                {/* Logo Floating */}
                <img 
                  src={displayLogo}
                  alt="Brasileiro Logo" 
                  className="h-16 w-auto object-contain mb-6 drop-shadow-sm hover:scale-105 transition-transform duration-500"
                />
                
                <h1 className="text-2xl font-extrabold text-slate-800 text-center tracking-tight">
                    {isAdminMode ? 'Acesso Administrativo' : 'Portal do Condomínio'}
                </h1>
                <p className="text-sm text-slate-600 font-medium mt-2 text-center max-w-[250px]">
                    {isAdminMode ? 'Área restrita para colaboradores' : 'Gerencie suas compras com agilidade'}
                </p>
            </div>

            <div className="bg-white p-8 rounded-3xl border border-gray-200 shadow-xl">
                <form onSubmit={handleLogin} className="space-y-5">
                    <div>
                        <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2 ml-1">
                            {isAdminMode ? 'Usuário Admin' : 'Login do Condomínio'}
                        </label>
                        <input
                            type="text"
                            required
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            className="block w-full rounded-xl border border-gray-300 bg-white focus:bg-white transition-all shadow-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 p-4 text-gray-900 font-semibold placeholder-gray-400"
                            placeholder="Digite seu usuário..."
                            style={{ color: '#111827' }} // Force Dark Color
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2 ml-1">
                            Senha
                        </label>
                        <input
                            type="password"
                            required
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="block w-full rounded-xl border border-gray-300 bg-white focus:bg-white transition-all shadow-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 p-4 text-gray-900 font-semibold placeholder-gray-400"
                            placeholder="••••••"
                            style={{ color: '#111827' }} // Force Dark Color
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={isLoading}
                        className="w-full flex justify-center items-center gap-2 py-4 px-6 rounded-xl shadow-lg shadow-brand-500/30 text-sm font-bold text-white bg-brand-600 hover:bg-brand-700 transform active:scale-[0.98] transition-all disabled:opacity-70 disabled:cursor-not-allowed mt-4"
                    >
                        {isLoading ? <Loader2 className="animate-spin" size={20} /> : (
                            <>Entrar <ArrowRight size={18} strokeWidth={2.5}/></>
                        )}
                    </button>
                </form>
            </div>

            <div className="mt-8 text-center">
                <button 
                    onClick={() => { setIsAdminMode(!isAdminMode); setUsername(''); setPassword(''); }}
                    className="text-xs font-bold text-brand-600 hover:text-brand-800 transition-colors flex items-center justify-center gap-2 mx-auto px-4 py-2 rounded-full bg-white/50 border border-transparent hover:border-brand-200 hover:bg-white"
                >
                    {isAdminMode ? <Building2 size={14}/> : <ShieldCheck size={14}/>}
                    {isAdminMode ? 'Sou um Cliente/Condomínio' : 'Sou da Equipe Brasileiro'}
                </button>
            </div>
            
            <p className="mt-8 text-[10px] text-center text-slate-500 font-medium">
                &copy; {new Date().getFullYear()} Brasileiro Administração de Condomínios
            </p>
        </div>
    </div>
  );
};