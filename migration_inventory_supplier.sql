
-- =================================================================================
-- MIGRATION: ADICIONAR FORNECEDOR AO ITEM DE ESTOQUE
-- Execute este script no SQL Editor do Supabase.
-- =================================================================================

-- 1. Adicionar coluna de texto para o nome do fornecedor
ALTER TABLE public.inventory_items 
ADD COLUMN IF NOT EXISTS last_supplier TEXT;

-- 2. Atualizar permissões (RLS) para garantir leitura e escrita
GRANT SELECT, INSERT, UPDATE, DELETE ON public.inventory_items TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.inventory_items TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.inventory_items TO anon;

-- 3. Recarregar cache do PostgREST
NOTIFY pgrst, 'reload config';
