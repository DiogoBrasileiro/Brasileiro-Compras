
-- =================================================================================
-- MIGRATION: FLUXO DE REPOSIÇÃO DE ESTOQUE (AUTOMÁTICO)
-- Execute este script no SQL Editor do Supabase.
-- =================================================================================

-- 1. Adicionar colunas de controle na tabela de solicitações
ALTER TABLE public.solicitacoes 
ADD COLUMN IF NOT EXISTS generated_from_stock BOOLEAN DEFAULT false;

ALTER TABLE public.solicitacoes 
ADD COLUMN IF NOT EXISTS stock_replenishment_items JSONB DEFAULT '[]'::jsonb;

-- 2. Relaxar a obrigatoriedade da categoria (category_id)
-- Isso corrige o erro de UUID inválido ao enviar NULL ou strings em fluxos automáticos.
ALTER TABLE public.solicitacoes 
ALTER COLUMN category_id DROP NOT NULL;

-- 3. Garantir permissões nas novas colunas (RLS)
GRANT UPDATE (generated_from_stock, stock_replenishment_items) ON public.solicitacoes TO authenticated;
GRANT UPDATE (generated_from_stock, stock_replenishment_items) ON public.solicitacoes TO service_role;
GRANT UPDATE (generated_from_stock, stock_replenishment_items) ON public.solicitacoes TO anon;

-- 4. Recarregar cache do PostgREST
NOTIFY pgrst, 'reload config';
