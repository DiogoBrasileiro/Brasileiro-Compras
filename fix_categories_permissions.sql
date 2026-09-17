
-- =================================================================================
-- CORREÇÃO DE PERMISSÕES (RLS) - TABELA DE CATEGORIAS
-- Rode este script no SQL Editor do Supabase se as categorias não aparecerem no App.
-- =================================================================================

-- 1. Garante que a tabela tem RLS ativado (Segurança)
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

-- 2. Remove políticas antigas que possam estar bloqueando
DROP POLICY IF EXISTS "Allow All Categories" ON public.categories;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.categories;
DROP POLICY IF EXISTS "Enable insert for all users" ON public.categories;
DROP POLICY IF EXISTS "Enable update for all users" ON public.categories;
DROP POLICY IF EXISTS "Enable delete for all users" ON public.categories;

-- 3. Cria uma política Permissiva (Ideal para Apps Internos/MVP)
-- Isso permite que o aplicativo (usando a anon key) consiga Ler, Criar, Editar e Excluir categorias.
CREATE POLICY "Allow All Categories" 
ON public.categories 
FOR ALL 
USING (true) 
WITH CHECK (true);

-- 4. Recarrega as permissões
NOTIFY pgrst, 'reload config';
