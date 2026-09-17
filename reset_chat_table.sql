
-- =================================================================================
-- RESET CHAT TABLE (FIX "ERROR SENDING MESSAGE")
-- =================================================================================

-- 1. Drop existing table to clear any schema mismatch
DROP TABLE IF EXISTS public.messages;

-- 2. Recreate table with correct types
CREATE TABLE public.messages (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    request_id TEXT NOT NULL,
    content TEXT NOT NULL,
    sender_id TEXT NOT NULL,
    sender_role TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    read_at TIMESTAMP WITH TIME ZONE
);

-- 3. Add Foreign Key (Ensure solicitacoes exists first)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'solicitacoes') THEN
        ALTER TABLE public.messages
        ADD CONSTRAINT messages_request_id_fkey
        FOREIGN KEY (request_id) REFERENCES public.solicitacoes(id) ON DELETE CASCADE;
    END IF;
END $$;

-- 4. Enable RLS
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- 5. Create Permissive Policies (Allow everything for now to fix the error)
DROP POLICY IF EXISTS "Enable all access" ON public.messages;
CREATE POLICY "Enable all access" ON public.messages FOR ALL USING (true) WITH CHECK (true);

-- 6. Grant Permissions
GRANT ALL ON TABLE public.messages TO anon;
GRANT ALL ON TABLE public.messages TO authenticated;
GRANT ALL ON TABLE public.messages TO service_role;

-- 7. Create Indexes
CREATE INDEX IF NOT EXISTS idx_messages_request_id ON public.messages(request_id);
CREATE INDEX IF NOT EXISTS idx_messages_read_at ON public.messages(read_at);

-- 8. Reload Schema Cache
NOTIFY pgrst, 'reload config';
