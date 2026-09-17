
-- =================================================================================
-- SCRIPT DE CORREÇÃO DE COLUNAS (EXECUTAR NO SQL EDITOR DO SUPABASE)
-- Este script adiciona as colunas novas que estão faltando na tabela 'solicitacoes'
-- =================================================================================

ALTER TABLE public.solicitacoes ADD COLUMN IF NOT EXISTS stock_control_enabled BOOLEAN DEFAULT false;
ALTER TABLE public.solicitacoes ADD COLUMN IF NOT EXISTS stock_generated_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.solicitacoes ADD COLUMN IF NOT EXISTS assembly_data JSONB DEFAULT '{}'::jsonb;
ALTER TABLE public.solicitacoes ADD COLUMN IF NOT EXISTS estimated_delivery_date TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.solicitacoes ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.solicitacoes ADD COLUMN IF NOT EXISTS due_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.solicitacoes ADD COLUMN IF NOT EXISTS deadline_days INTEGER;
ALTER TABLE public.solicitacoes ADD COLUMN IF NOT EXISTS autorizado_por_nome TEXT;
ALTER TABLE public.solicitacoes ADD COLUMN IF NOT EXISTS autorizado_por_cargo TEXT;
ALTER TABLE public.solicitacoes ADD COLUMN IF NOT EXISTS justificativa_condominio TEXT;
ALTER TABLE public.solicitacoes ADD COLUMN IF NOT EXISTS orcamento_escolhido INTEGER;

-- Recarregar o cache do schema do PostgREST (Necessário após alterações de estrutura)
NOTIFY pgrst, 'reload config';
