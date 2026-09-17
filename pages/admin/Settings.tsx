import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Card, Button } from '../../components/UI';
import { UploadCloud, Image as ImageIcon, Save, CheckCircle } from 'lucide-react';
import { LOGO_URL } from '../../constants';

export const Settings: React.FC = () => {
  const { logoUrl, updateLogo } = useApp();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
    }
  };

  const handleSave = async () => {
    if (!selectedFile) return;
    setIsUploading(true);
    await updateLogo(selectedFile);
    setIsUploading(false);
    setSelectedFile(null);
  };

  const currentLogo = logoUrl || LOGO_URL;

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Ajustes do Sistema</h1>
          <p className="text-gray-500">Personalize a identidade visual e configurações globais.</p>
        </div>
      </div>

      <Card title="Identidade Visual (Branding)">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          
          {/* Preview Section */}
          <div className="space-y-4">
             <h3 className="font-semibold text-gray-700 flex items-center gap-2">
                <ImageIcon size={18} /> Pré-visualização Atual
             </h3>
             <div className="bg-gray-100 p-8 rounded-xl border border-gray-200 flex items-center justify-center min-h-[160px]">
                <img src={currentLogo} alt="Logo Atual" className="max-h-16 object-contain" />
             </div>
             <p className="text-xs text-gray-500">Esta logo será exibida na tela de login, barra lateral e relatórios PDF.</p>
             
             {/* Dark Mode Preview (Simulation) */}
             <div className="bg-brand-700 p-8 rounded-xl border border-brand-900 flex items-center justify-center min-h-[160px]">
                {/* We use the same logo, but show how it looks on dark background */}
                 <img src={currentLogo} alt="Logo Dark Mode" className="max-h-16 object-contain" />
             </div>
             <p className="text-xs text-gray-500">Simulação em fundo escuro (Menu Lateral).</p>
          </div>

          {/* Upload Section */}
          <div className="space-y-6">
             <h3 className="font-semibold text-gray-700 flex items-center gap-2">
                <UploadCloud size={18} /> Alterar Logomarca
             </h3>
             
             <div className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center hover:border-brand-500 transition-colors relative bg-gray-50">
                <input 
                    type="file" 
                    accept="image/png, image/jpeg, image/svg+xml"
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" 
                    onChange={handleFileChange} 
                />
                <div className="flex flex-col items-center pointer-events-none">
                    <UploadCloud className="h-12 w-12 text-gray-400 mb-3" />
                    <p className="text-sm text-gray-700 font-medium">Clique para escolher o arquivo</p>
                    <p className="text-xs text-gray-500 mt-1">PNG, JPG ou SVG (Recomendado: Fundo Transparente)</p>
                </div>
             </div>

             {selectedFile && (
                 <div className="bg-blue-50 border border-blue-100 p-4 rounded-lg flex items-center gap-4 animate-fadeIn">
                     <img src={previewUrl!} alt="Preview" className="h-10 w-10 object-contain bg-white rounded-md border" />
                     <div className="flex-1 min-w-0">
                         <p className="text-sm font-bold text-gray-800 truncate">{selectedFile.name}</p>
                         <p className="text-xs text-gray-500">{(selectedFile.size / 1024).toFixed(1)} KB</p>
                     </div>
                     <CheckCircle className="text-blue-500" size={20} />
                 </div>
             )}

             <div className="pt-4 border-t border-gray-100 flex justify-end">
                 <Button 
                    onClick={handleSave} 
                    disabled={!selectedFile || isUploading}
                    className="w-full md:w-auto"
                 >
                    {isUploading ? 'Enviando...' : (
                        <span className="flex items-center gap-2"><Save size={18}/> Salvar Nova Logo</span>
                    )}
                 </Button>
             </div>
          </div>
        </div>
      </Card>
    </div>
  );
};