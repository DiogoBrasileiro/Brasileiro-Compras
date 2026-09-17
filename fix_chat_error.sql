
-- =================================================================================
-- FIX CHAT ERROR: CREATE TABLE AND POLICIES
-- =================================================================================

-- 1. Create table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.messages (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    request_id TEXT NOT NULL,
    content TEXT NOT NULL,
    sender_id TEXT NOT NULL,
    sender_role TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    read_at TIMESTAMP WITH TIME ZONE
);

-- 2. Add Foreign Key safely
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'messages_request_id_fkey') THEN
        ALTER TABLE public.messages
        ADD CONSTRAINT messages_request_id_fkey
        FOREIGN KEY (request_id) REFERENCES public.solicitacoes(id) ON DELETE CASCADE;
    END IF;
END $$;

-- 3. Enable RLS
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- 4. Create Permissive Policies (Fixes "Error sending message")
-- Allow anyone to read messages (filtering is done in the app/query usually, but this ensures no blocks)
DROP POLICY IF EXISTS "Enable read access for all users" ON public.messages;
CREATE POLICY "Enable read access for all users" ON public.messages FOR SELECT USING (true);

-- Allow anyone to insert messages
DROP POLICY IF EXISTS "Enable insert access for all users" ON public.messages;
CREATE POLICY "Enable insert access for all users" ON public.messages FOR INSERT WITH CHECK (true);

-- Allow anyone to update messages (for read_at)
DROP POLICY IF EXISTS "Enable update access for all users" ON public.messages;
CREATE POLICY "Enable update access for all users" ON public.messages FOR UPDATE USING (true);

-- 5. Grant Permissions
GRANT ALL ON TABLE public.messages TO anon;
GRANT ALL ON TABLE public.messages TO authenticated;
GRANT ALL ON TABLE public.messages TO service_role;

-- 6. Create Indexes for performance
CREATE INDEX IF NOT EXISTS idx_messages_request_id ON public.messages(request_id);
CREATE INDEX IF NOT EXISTS idx_messages_read_at ON public.messages(read_at);

-- 7. Reload Schema
NOTIFY pgrst, 'reload config';
