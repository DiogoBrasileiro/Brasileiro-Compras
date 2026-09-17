
-- ==========================================================
-- CORREÇÃO DEFINITIVA DE TIPO DE DADOS (UUID -> TEXT)
-- Executar no SQL Editor do Supabase se receber erro:
-- "invalid input syntax for type uuid: 'cat-...'"
-- ==========================================================

-- 1. Removemos qualquer chave estrangeira que possa estar travando a alteração
DO $$ 
BEGIN 
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'solicitacoes_category_id_fkey') THEN 
    ALTER TABLE public.solicitacoes DROP CONSTRAINT solicitacoes_category_id_fkey; 
  END IF; 
END $$;

-- 2. Alteramos a coluna category_id na tabela de solicitações para aceitar TEXTO
ALTER TABLE public.solicitacoes 
ALTER COLUMN category_id TYPE TEXT USING category_id::text;

-- 3. Garantimos que a tabela de categorias também seja TEXTO no ID
ALTER TABLE public.categories 
ALTER COLUMN id TYPE TEXT USING id::text;

NOTIFY pgrst, 'reload config';
