
-- =================================================================================
-- CORREÇÃO CRÍTICA DE PERSISTÊNCIA DE DATA (VERSÃO 2)
-- Rode este script no SQL Editor do Supabase se a "Previsão de Entrega" não salva.
-- =================================================================================

-- 1. Garante que a coluna existe (Idempotente)
ALTER TABLE public.solicitacoes 
ADD COLUMN IF NOT EXISTS estimated_delivery_date TIMESTAMP WITH TIME ZONE;

-- 2. Recarrega o cache do PostgREST para garantir que a API "veja" a nova coluna
NOTIFY pgrst, 'reload config';

-- 3. (Opcional) Verifica se a coluna foi criada corretamente
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'solicitacoes' AND column_name = 'estimated_delivery_date';
