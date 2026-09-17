
-- =================================================================================
-- SCRIPT DE MIGRAÇÃO: ADICIONAR JUSTIFICATIVA DE RECUSA
-- =================================================================================

ALTER TABLE public.solicitacoes ADD COLUMN IF NOT EXISTS justificativa_recusa TEXT;

-- Recarregar o cache do schema do PostgREST
NOTIFY pgrst, 'reload config';
