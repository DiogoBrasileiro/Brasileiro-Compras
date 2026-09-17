
-- =================================================================================
-- CORREÇÃO DE PERMISSÕES (RLS) - TABELA DE USUÁRIOS
-- Rode este script no SQL Editor do Supabase se os usuários não aparecerem no App.
-- =================================================================================

-- 1. Garante que a tabela tem RLS ativado (Segurança)
ALTER TABLE public.usuarios ENABLE ROW LEVEL SECURITY;

-- 2. Remove políticas antigas que possam estar bloqueando ou conflitando
DROP POLICY IF EXISTS "Allow All Users" ON public.usuarios;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.usuarios;
DROP POLICY IF EXISTS "Enable insert for all users" ON public.usuarios;
DROP POLICY IF EXISTS "Enable update for all users" ON public.usuarios;
DROP POLICY IF EXISTS "Enable delete for all users" ON public.usuarios;

-- 3. Cria uma política Permissiva (Ideal para Apps Internos/MVP)
-- Isso permite que o aplicativo (usando a anon key) consiga Ler, Criar, Editar e Excluir usuários.
CREATE POLICY "Allow All Users" 
ON public.usuarios 
FOR ALL 
USING (true) 
WITH CHECK (true);

-- 4. Recarrega as permissões
NOTIFY pgrst, 'reload config';
