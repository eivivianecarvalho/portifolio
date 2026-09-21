-- ============================================================================
-- banco-prospeccao.sql
-- Rode este script no SQL Editor do Supabase (Project > SQL Editor > New
-- query) para criar a tabela da aba "Prospecção" do admin.
--
-- Diferente de "marcas" (que recebe contato vindo do site), esta tabela é
-- 100% privada: só você, logada, lê, cria, edita ou apaga. Sem login,
-- ninguém enxerga nada aqui, nem consegue escrever.
-- ============================================================================

create table if not exists public.prospeccao (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  site text,
  instagram text,
  seguidores integer,
  email text,
  whatsapp text,
  pessoa_contato text,
  nicho text,
  origem text,                    -- onde você encontrou essa marca
  status text not null default 'a_enviar'
    check (status in ('a_enviar', 'enviado', 'respondeu', 'proposta', 'fechado', 'sem_interesse')),
  observacao text,
  data date not null default current_date,
  created_at timestamptz not null default now()
);

create index if not exists idx_prospeccao_status on public.prospeccao (status);
create index if not exists idx_prospeccao_nicho on public.prospeccao (nicho);
create index if not exists idx_prospeccao_origem on public.prospeccao (origem);

alter table public.prospeccao enable row level security;

create policy "dono_acesso_total" on public.prospeccao
  for all
  to authenticated
  using (true)
  with check (true);

grant select, insert, update, delete
  on public.prospeccao
  to authenticated;
-- ============================================================================
