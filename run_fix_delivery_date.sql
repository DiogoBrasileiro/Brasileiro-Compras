
-- =================================================================================
-- CORREÇÃO DEFINITIVA: CRIAR COLUNA DE DATA DE ENTREGA
-- Rode este script no SQL Editor do Supabase para corrigir o erro de persistência.
-- =================================================================================

-- 1. Cria a coluna se ela não existir
ALTER TABLE public.solicitacoes 
ADD COLUMN IF NOT EXISTS estimated_delivery_date TIMESTAMP WITH TIME ZONE;

-- 2. Atualiza permissões (caso o RLS esteja bloqueando a escrita)
-- Isso garante que o app possa escrever nessa nova coluna
GRANT UPDATE (estimated_delivery_date) ON public.solicitacoes TO authenticated;
GRANT UPDATE (estimated_delivery_date) ON public.solicitacoes TO service_role;
GRANT UPDATE (estimated_delivery_date) ON public.solicitacoes TO anon;

-- 3. Recarrega o cache da API do Supabase (Essencial para a API "ver" a nova coluna)
NOTIFY pgrst, 'reload config';

-- 4. Confirmação visual (Vai mostrar a coluna se tudo der certo)
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'solicitacoes' AND column_name = 'estimated_delivery_date';
