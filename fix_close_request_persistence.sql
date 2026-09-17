-- SQL Script to add missing columns for closing requests
-- Run this in the Supabase SQL Editor

ALTER TABLE public.solicitacoes ADD COLUMN IF NOT EXISTS justificativa_encerramento TEXT;
ALTER TABLE public.solicitacoes ADD COLUMN IF NOT EXISTS justificativa_recusa TEXT;
