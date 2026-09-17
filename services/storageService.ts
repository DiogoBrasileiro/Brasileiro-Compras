import { supabase } from '../lib/supabaseClient';
import { BudgetAttachment } from '../types';

const BUCKET = 'budgets';

// Helper to sanitize path segments
const sanitize = (str: string) => {
    return str.replace(/[^a-zA-Z0-9_-]/g, '_');
};

export const uploadBudgetFile = async (
  file: File,
  condoId: string,
  requestId: string,
  budgetId: string
): Promise<BudgetAttachment | null> => {
  try {
    const timestamp = Date.now();
    const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    
    // Ensure we have valid path segments
    const sCondoId = sanitize(condoId || 'unknown_condo');
    const sRequestId = sanitize(requestId || 'unknown_req');
    const sBudgetId = sanitize(budgetId || 'unknown_budget');

    const path = `${sCondoId}/${sRequestId}/${sBudgetId}/${timestamp}_${sanitizedName}`;

    const { data, error } = await supabase.storage
      .from(BUCKET)
      .upload(path, file, {
        cacheControl: '3600',
        upsert: true
      });

    if (error) {
        console.error("Supabase Storage Error:", error);
        throw error;
    }

    const { data: publicData } = supabase.storage.from(BUCKET).getPublicUrl(path);

    return {
      id: `att-${timestamp}`,
      path: path,
      publicUrl: publicData.publicUrl,
      fileName: file.name,
      fileType: file.type,
      fileSize: file.size,
      uploadedAt: new Date().toISOString()
    };
  } catch (error: any) {
    console.error("Error uploading budget file:", error);
    
    let msg = "Erro ao fazer upload do arquivo.";
    if (error.message && error.message.includes("The resource was not found")) {
        msg += " O bucket de armazenamento 'budgets' não foi encontrado no Supabase.";
    } else if (error.message && error.message.includes("row-level security policy")) {
        msg += " Permissão negada. Verifique as políticas de segurança do Storage.";
    } else {
        msg += " Verifique sua conexão ou contate o suporte.";
    }
    
    alert(msg);
    return null;
  }
};

export const deleteBudgetFiles = async (attachments: BudgetAttachment[]) => {
  if (!attachments || attachments.length === 0) return;

  const paths = attachments.map(a => a.path);
  try {
    const { error } = await supabase.storage
      .from(BUCKET)
      .remove(paths);

    if (error) throw error;
    console.log("Files deleted successfully:", paths);
  } catch (error) {
    console.error("Error deleting budget files:", error);
    // Continue execution even if storage delete fails to allow DB cleanup
  }
};