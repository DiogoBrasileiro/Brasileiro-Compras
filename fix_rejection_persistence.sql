
-- Ensure the column exists
ALTER TABLE public.solicitacoes ADD COLUMN IF NOT EXISTS justificativa_recusa TEXT;

-- If status is an enum, we might need to add the value, but usually it's text in this app.
-- Just in case there's a check constraint:
ALTER TABLE public.solicitacoes DROP CONSTRAINT IF EXISTS solicitacoes_status_check;

-- Re-add check constraint with new value if you want to enforce it, or just leave it as text.
-- For now, we'll just ensure the column is there.

NOTIFY pgrst, 'reload config';
