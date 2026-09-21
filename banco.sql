-- ============================================================================
-- banco.sql
-- Cole este arquivo inteiro no SQL Editor do Supabase (Project > SQL Editor >
-- New query) e clique em Run. Ele cria as 6 tabelas do admin, liga a trava
-- de segurança (RLS) em todas elas, e já deixa alguns dados prontos.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- BLOCO 1: tabela "videos"
-- Os vídeos do seu portfólio. O site público vai ler esta tabela pra montar
-- a galeria (em vez de usar a lista fixa que tinha antes no HTML).
-- ----------------------------------------------------------------------------
create table if not exists public.videos (
  id uuid primary key default gen_random_uuid(),
  titulo text not null,
  link text not null,              -- o id do vídeo no YouTube (o que vem depois de youtu.be/)
  nicho text,                      -- categoria, ex: "Beleza", "Fitness"
  formato text,                    -- ex: "Vídeo", "Reels"
  marca text,                      -- marca do produto, se tiver
  destaque text,                   -- selo opcional, ex: "2,4M views"
  ordem integer not null default 0,     -- controla a ordem de exibição no site
  visivel boolean not null default true, -- se falso, some do site mas continua no admin
  created_at timestamptz not null default now()
);

create index if not exists idx_videos_ordem on public.videos (ordem);

-- Já entra com os 30 vídeos que já estavam no seu site, na mesma ordem,
-- pra o site não perder nenhum quando passar a ler do banco.
insert into public.videos (titulo, link, nicho, formato, ordem, visivel) values
  ('Batom DaBelle 3 em 1', 'BccMqhv4I1w', 'Beleza', 'Vídeo', 0, true),
  ('Max Lashes Rímel', 'hV1v46bz4ts', 'Beleza', 'Vídeo', 1, true),
  ('Pó Sace Lady', 'sBPv3lbSqak', 'Beleza', 'Vídeo', 2, true),
  ('Resenha do Whey Mais Mu', '72wtptvLtNE', 'Fitness', 'Vídeo', 3, true),
  ('Resenha do Whey Growth', 'MKvik03UfHk', 'Fitness', 'Vídeo', 4, true),
  ('Creatina Mais Mu', 'IH0MsQISTIM', 'Fitness', 'Vídeo', 5, true),
  ('Club Social', 'NdzRO3kwSnA', 'Dupla', 'Vídeo', 6, true),
  ('App do Serasa, em dupla', 'FXngtgjzc8E', 'Dupla', 'Vídeo', 7, true),
  ('Site do Serasa, em dupla', 'uVoMlojBU4o', 'Dupla', 'Vídeo', 8, true),
  ('Creatina Mais Mu, em dupla', 'Elush87N4Vc', 'Dupla', 'Vídeo', 9, true),
  ('Open English', '_5mIk1wavvo', 'Tecnologia', 'Vídeo', 10, true),
  ('Spotify', 'TFh0h0D_Fn0', 'Tecnologia', 'Vídeo', 11, true),
  ('App do PicPay', '_qTXYLaLAUw', 'Tecnologia', 'Vídeo', 12, true),
  ('Cartão Livelo', 'm_YbxnTvY4M', 'Tecnologia', 'Vídeo', 13, true),
  ('Konta IA', 'zzusVuLjE-0', 'Tecnologia', 'Vídeo', 14, true),
  ('Curso de UGC', 'p3UYpupyQR4', 'Tecnologia', 'Vídeo', 15, true),
  ('Retinal Celimax', '18HMP3Be2sw', 'Skincare', 'Vídeo', 16, true),
  ('Protetor Solar Principia', 'Ub4IsW5i5nI', 'Skincare', 'Vídeo', 17, true),
  ('Acne Defense 5D', 'cVBBErkYRLc', 'Skincare', 'Vídeo', 18, true),
  ('Peeling The Ordinary', '67gefR0jKv4', 'Skincare', 'Vídeo', 19, true),
  ('Creme de rosto Principia', 'Uf7GanZV_jw', 'Skincare', 'Vídeo', 20, true),
  ('Creme para Mãos', 'X2xmwDS_Keo', 'Bodycare', 'Vídeo', 21, true),
  ('Gillette Venus', '0Q7Pd2jw-J4', 'Bodycare', 'Vídeo', 22, true),
  ('Esfoliante Dove', 'Dr71NwCwNFk', 'Bodycare', 'Vídeo', 23, true),
  ('Creme clareador', 'k5Nn2hnWfAQ', 'Bodycare', 'Vídeo', 24, true),
  ('Muriel Liso dos Sonhos', 'KkT0_EQs6OU', 'Haircare', 'Vídeo', 25, true),
  ('Elseve', 'L6w_RMtONC8', 'Haircare', 'Vídeo', 26, true),
  ('Elseve Bond Repair', 'EAC-nZesHHU', 'Haircare', 'Vídeo', 27, true),
  ('Retinol Celimax', 'UkrpZuP68xo', 'TikTok Shop', 'Vídeo', 28, true),
  ('Kit Copa do Mundo', 'Ti7ISYefmfM', 'TikTok Shop', 'Vídeo', 29, true)
on conflict do nothing;


-- ----------------------------------------------------------------------------
-- BLOCO 2: tabela "marcas"
-- Sua base de contatos de empresa (CRM). O formulário de contato do site
-- grava aqui automaticamente, como "lead".
-- ----------------------------------------------------------------------------
create table if not exists public.marcas (
  id uuid primary key default gen_random_uuid(),
  nome text,
  instagram text,
  email text,
  telefone text,
  situacao text not null default 'lead' check (situacao in ('lead', 'conversando', 'cliente', 'parada')),
  obs text,
  ultimo_contato date,
  created_at timestamptz not null default now()
);

-- Uma linha de exemplo só, pra você ver o formato. Pode apagar quando quiser.
insert into public.marcas (nome, instagram, email, telefone, situacao, obs, ultimo_contato) values
  ('Exemplo, apague depois de entender', '@marca_exemplo', 'contato@marcaexemplo.com', '11999999999', 'lead', 'Isto é só um exemplo do formato da tabela. Pode apagar esta linha.', current_date)
on conflict do nothing;


-- ----------------------------------------------------------------------------
-- BLOCO 3: tabela "calendario"
-- A agenda de produção: o que precisa gravar, editar ou postar, e quando.
-- ----------------------------------------------------------------------------
create table if not exists public.calendario (
  id uuid primary key default gen_random_uuid(),
  titulo text not null,
  marca text,
  tipo text check (tipo in ('gravar', 'editar', 'postar')),
  data date not null,
  status text not null default 'a_fazer' check (status in ('a_fazer', 'feito')),
  created_at timestamptz not null default now()
);

create index if not exists idx_calendario_data on public.calendario (data);

insert into public.calendario (titulo, marca, tipo, data, status) values
  ('Exemplo, apague depois de entender', 'Marca Exemplo', 'gravar', current_date, 'a_fazer')
on conflict do nothing;


-- ----------------------------------------------------------------------------
-- BLOCO 4: tabela "campanhas"
-- Os contratos com marcas: valores, prazos e status de pagamento.
-- ----------------------------------------------------------------------------
create table if not exists public.campanhas (
  id uuid primary key default gen_random_uuid(),
  campanha text not null,
  cliente text,
  tipo text check (tipo in ('Conteúdo', 'Publicidade')),
  status text not null default 'Briefing'
    check (status in ('Briefing', 'Roteiro', 'Aprovação Roteiro', 'Gravação', 'Edição', 'Aprovado', 'Entregue')),
  qtd integer not null default 1,
  valor numeric(12, 2) not null default 0,
  prazo date,
  pagamento text not null default 'pendente' check (pagamento in ('pendente', 'pago')),
  ativa boolean not null default true,
  favorita boolean not null default false,
  created_at timestamptz not null default now()
);

insert into public.campanhas (campanha, cliente, tipo, status, qtd, valor, prazo, pagamento, ativa, favorita) values
  ('Exemplo, apague depois de entender', 'Cliente Exemplo', 'Conteúdo', 'Briefing', 1, 0, current_date + interval '7 days', 'pendente', true, false)
on conflict do nothing;


-- ----------------------------------------------------------------------------
-- BLOCO 5: tabela "marcados"
-- Guarda o que você já marcou no checklist do portfólio. Cada item do
-- checklist vira uma "chave" (um texto que identifica ele) nesta tabela.
-- ----------------------------------------------------------------------------
create table if not exists public.marcados (
  chave text primary key,
  marcado boolean not null default true,
  created_at timestamptz not null default now()
);


-- ----------------------------------------------------------------------------
-- BLOCO 6: tabela "visitas"
-- Um registro simples de cada visita ao seu portfólio, pras métricas.
-- ----------------------------------------------------------------------------
create table if not exists public.visitas (
  id uuid primary key default gen_random_uuid(),
  pagina text,
  origem text,
  created_at timestamptz not null default now()
);

create index if not exists idx_visitas_created on public.visitas (created_at desc);


-- ============================================================================
-- BLOCO 7: a trava de segurança (RLS)
--
-- Regra geral: liga a trava em TODAS as tabelas. Isso bloqueia tudo por
-- padrão. Depois, uma política dá acesso total a você (quando estiver
-- logada), e mais três políticas abrem só as três portinhas que o site
-- público precisa:
--
--   1) Qualquer pessoa pode LER os vídeos marcados como visíveis (senão
--      ninguém veria seu portfólio, já que ele vai ler direto do banco).
--   2) Qualquer pessoa pode INSERIR uma marca vinda do formulário de
--      contato do site (mas só como "lead", nunca como cliente).
--   3) Qualquer pessoa pode INSERIR uma visita.
--
-- Fora essas três portinhas, ninguém deslogado lê ou escreve nada.
-- ============================================================================
alter table public.videos     enable row level security;
alter table public.marcas     enable row level security;
alter table public.calendario enable row level security;
alter table public.campanhas  enable row level security;
alter table public.marcados   enable row level security;
alter table public.visitas    enable row level security;

-- Você (logada) tem acesso total a todas as tabelas.
create policy "dono_acesso_total" on public.videos     for all to authenticated using (true) with check (true);
create policy "dono_acesso_total" on public.marcas     for all to authenticated using (true) with check (true);
create policy "dono_acesso_total" on public.calendario for all to authenticated using (true) with check (true);
create policy "dono_acesso_total" on public.campanhas  for all to authenticated using (true) with check (true);
create policy "dono_acesso_total" on public.marcados   for all to authenticated using (true) with check (true);
create policy "dono_acesso_total" on public.visitas    for all to authenticated using (true) with check (true);

-- Portinha 1: leitura pública dos vídeos visíveis (pro site mostrar a galeria).
create policy "publico_le_videos_visiveis" on public.videos
  for select to anon
  using (visivel = true);

-- Portinha 2: o formulário do site grava uma marca nova, sempre como "lead".
create policy "publico_insere_marca_lead" on public.marcas
  for insert to anon
  with check (situacao = 'lead');

-- Portinha 3: o site registra uma visita.
create policy "publico_insere_visita" on public.visitas
  for insert to anon
  with check (true);

-- As permissões de base (sem isso, nem a política é avaliada).
grant select, insert, update, delete
  on public.videos, public.marcas, public.calendario, public.campanhas, public.marcados, public.visitas
  to authenticated;

grant select on public.videos to anon;
grant insert on public.marcas to anon;
grant insert on public.visitas to anon;
-- ============================================================================
