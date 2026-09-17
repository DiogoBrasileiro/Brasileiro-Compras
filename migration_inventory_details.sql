
-- =================================================================================
-- MIGRATION: ADICIONAR DETALHES DA ÚLTIMA COMPRA AO ESTOQUE
-- Execute este script no SQL Editor do Supabase.
-- =================================================================================

-- 1. Adicionar colunas para armazenar o snapshot da última compra
ALTER TABLE public.inventory_items 
ADD COLUMN IF NOT EXISTS last_unit_price NUMERIC,
ADD COLUMN IF NOT EXISTS last_buy_qty NUMERIC;

-- 2. Atualizar permissões (RLS)
GRANT UPDATE (last_unit_price, last_buy_qty) ON public.inventory_items TO authenticated;
GRANT UPDATE (last_unit_price, last_buy_qty) ON public.inventory_items TO service_role;
GRANT UPDATE (last_unit_price, last_buy_qty) ON public.inventory_items TO anon;

-- 3. Recarregar cache do PostgREST
NOTIFY pgrst, 'reload config';
