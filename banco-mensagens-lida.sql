-- ============================================================================
-- banco-mensagens-lida.sql
-- Rode este script no SQL Editor do Supabase pra adicionar a coluna que
-- guarda se você já leu ou não cada mensagem na aba "Mensagens" do admin
-- (a tabela "marcas" já existe, por isso é um "alter table").
-- ============================================================================

alter table public.marcas
  add column if not exists lida boolean not null default false;
-- ============================================================================
