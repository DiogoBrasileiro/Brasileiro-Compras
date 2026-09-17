
-- =================================================================================
-- ATUALIZAÇÃO DE SCHEMA: ESTOQUE AVANÇADO & CORREÇÃO DE EXCLUSÃO
-- Execute este script no SQL Editor do Supabase.
-- =================================================================================

-- 1. Adiciona campos de Nível Ideal e Máximo (Caso ainda não existam)
ALTER TABLE public.inventory_items 
ADD COLUMN IF NOT EXISTS ideal_level NUMERIC DEFAULT 10;

ALTER TABLE public.inventory_items 
ADD COLUMN IF NOT EXISTS max_level NUMERIC DEFAULT 20;

-- 2. Atualiza permissões para garantir que o admin possa editar esses campos
GRANT UPDATE (ideal_level, max_level) ON public.inventory_items TO authenticated;
GRANT UPDATE (ideal_level, max_level) ON public.inventory_items TO service_role;
GRANT UPDATE (ideal_level, max_level) ON public.inventory_items TO anon;

-- =================================================================================
-- CORREÇÃO CRÍTICA: PERMITIR EXCLUSÃO DE ITEM COM HISTÓRICO
-- =================================================================================

-- Remove a restrição antiga que bloqueia a exclusão
ALTER TABLE public.inventory_movements
DROP CONSTRAINT IF EXISTS inventory_movements_item_id_fkey;

-- Adiciona a nova restrição com CASCADE (Se apagar o item, apaga o histórico dele junto)
ALTER TABLE public.inventory_movements
ADD CONSTRAINT inventory_movements_item_id_fkey
FOREIGN KEY (item_id)
REFERENCES public.inventory_items(id)
ON DELETE CASCADE;

-- 3. Recarrega o cache da API
NOTIFY pgrst, 'reload config';

-- 4. Verificação
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'inventory_items' AND column_name IN ('ideal_level', 'max_level');
