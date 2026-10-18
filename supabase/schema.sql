-- =====================================================================
-- Inclua Santos — banco de dados no Supabase
--
-- Como usar: abra o SQL Editor do Supabase, cole este arquivo inteiro
-- e clique em Run. Pode rodar de novo depois: o que já foi criado por
-- este arquivo é mantido, com os dados.
--
-- Na primeira vez, as tabelas antigas com os mesmos nomes (perfis,
-- mensagens, denuncias, moderadores...) são tratadas assim:
--   * vazia  -> é apagada e criada de novo no formato do app;
--   * com dados -> é movida, com os dados, para um esquema de cópia
--     chamado antigo_AAAAMMDD_HHMMSS (nada se perde).
--
-- Este arquivo não usa nem precisa da chave secret/service_role.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 0. Tabelas antigas
-- ---------------------------------------------------------------------
do $$
declare
  t text;
  n bigint;
  marca constant text := 'inclua-santos:v1';
  copia constant text := 'antigo_' || to_char(now(), 'YYYYMMDD_HH24MISS');
begin
  foreach t in array array['perfis', 'mensagens', 'denuncias', 'moderadores',
                           'bloqueios', 'bloqueios_pessoais', 'voluntarios'] loop
    if to_regclass('public.' || t) is null then
      continue;
    end if;
    if obj_description(to_regclass('public.' || t), 'pg_class') = marca then
      continue;
    end if;
    execute format('select count(*) from public.%I', t) into n;
    if n = 0 then
      execute format('drop table public.%I cascade', t);
      raise notice 'Tabela "%" estava vazia e foi recriada.', t;
    else
      execute format('create schema if not exists %I', copia);
      execute format('alter table public.%I set schema %I', t, copia);
      raise notice 'Tabela "%" tinha % linha(s) e foi guardada em %.%', t, n, copia, t;
    end if;
  end loop;
end $$;


-- ---------------------------------------------------------------------
-- 1. Tabelas
-- ---------------------------------------------------------------------

-- Quem pode moderar e cuidar das inscrições de voluntariado.
create table if not exists public.moderadores (
  user_id   uuid primary key references auth.users (id) on delete cascade,
  criado_em timestamptz not null default now()
);

-- Perfil de cada conta. Só a própria pessoa (e a moderação) lê.
-- O cartão de Namoro sai daqui, pela função pessoas_visiveis().
create table if not exists public.perfis (
  id                    uuid primary key references auth.users (id) on delete cascade,
  nome                  text not null default '' check (char_length(nome) <= 40),
  sobre                 text not null default '' check (char_length(sobre) <= 160),
  aparecer              boolean not null default false,
  maior_de_idade_em     timestamptz,
  privacidade_aceita_em timestamptz,
  favoritos             jsonb not null default '{}'::jsonb
                        check (jsonb_typeof(favoritos) = 'object' and pg_column_size(favoritos) < 60000),
  sessoes               integer not null default 0 check (sessoes >= 0),
  desde                 timestamptz not null default now(),
  cartao_em             timestamptz not null default now(),
  atualizado_em         timestamptz not null default now(),
  oculto_em             timestamptz
);

-- Mensagens da Comunidade.
create table if not exists public.mensagens (
  id         bigint generated always as identity primary key,
  autor      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  autor_nome text not null default '' check (char_length(autor_nome) <= 40),
  texto      text not null check (char_length(btrim(texto)) between 1 and 600),
  criada_em  timestamptz not null default now(),
  oculta_em  timestamptz
);
create index if not exists mensagens_criada_em_idx on public.mensagens (criada_em desc);
create index if not exists mensagens_autor_idx on public.mensagens (autor);

-- Denúncias. A chave diz o que foi denunciado:
--   m:<id da mensagem>  ou  p:<id da conta> (perfil em Namoro).
create table if not exists public.denuncias (
  id           bigint generated always as identity primary key,
  denunciante  uuid default auth.uid() references auth.users (id) on delete set null,
  chave        text not null check (chave ~ '^(m:[0-9]{1,18}|p:[0-9a-f-]{36})$'),
  tipo         text not null check (tipo in ('mensagem', 'perfil')),
  alvo         uuid not null references auth.users (id) on delete cascade,
  motivo       text not null check (motivo in ('assedio', 'ofensa', 'golpe', 'dados', 'falso', 'outro')),
  criada_em    timestamptz not null default now(),
  resolvida_em timestamptz,
  decisao      text check (decisao in ('mantido', 'escondido', 'bloqueado'))
);
create unique index if not exists denuncias_uma_por_pessoa
  on public.denuncias (denunciante, chave) where resolvida_em is null;
create index if not exists denuncias_pendentes_idx
  on public.denuncias (criada_em) where resolvida_em is null;
create index if not exists denuncias_alvo_idx on public.denuncias (alvo);

-- Contas bloqueadas pela moderação.
create table if not exists public.bloqueios (
  usuario   uuid primary key references auth.users (id) on delete cascade,
  nome      text not null default '',
  por       uuid references auth.users (id) on delete set null,
  criado_em timestamptz not null default now()
);

-- Pessoas que cada conta escolheu não ver mais (bloqueio pessoal).
create table if not exists public.bloqueios_pessoais (
  quem      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  bloqueado uuid not null references auth.users (id) on delete cascade,
  nome      text not null default '' check (char_length(nome) <= 40),
  criado_em timestamptz not null default now(),
  primary key (quem, bloqueado),
  check (quem <> bloqueado)
);

-- Inscrições de voluntariado (uma por instituição por conta).
create table if not exists public.voluntarios (
  id             bigint generated always as identity primary key,
  usuario        uuid not null default auth.uid() references auth.users (id) on delete cascade,
  ong            text not null check (ong in ('tamtam', 'autismo', 'lmc', 'apae')),
  nome           text not null check (char_length(btrim(nome)) between 1 and 60),
  contato        text not null check (char_length(btrim(contato)) between 3 and 80),
  quando         text[] not null
                 check (cardinality(quando) between 1 and 4
                        and quando <@ array['semana-manha', 'semana-tarde', 'semana-noite', 'fim-de-semana']),
  como           text[] not null
                 check (cardinality(como) between 1 and 5
                        and como <@ array['atividades', 'eventos', 'divulgacao', 'administrativo', 'outra']),
  acessibilidade text not null default '' check (char_length(acessibilidade) <= 160),
  mensagem       text not null default '' check (char_length(mensagem) <= 400),
  criada_em      timestamptz not null default now(),
  encaminhada_em timestamptz,
  unique (usuario, ong)
);

-- Marca as tabelas como do app, para a etapa 0 não mexer nelas de novo.
comment on table public.moderadores        is 'inclua-santos:v1';
comment on table public.perfis             is 'inclua-santos:v1';
comment on table public.mensagens          is 'inclua-santos:v1';
comment on table public.denuncias          is 'inclua-santos:v1';
comment on table public.bloqueios          is 'inclua-santos:v1';
comment on table public.bloqueios_pessoais is 'inclua-santos:v1';
comment on table public.voluntarios        is 'inclua-santos:v1';


-- ---------------------------------------------------------------------
-- 2. Funções de apoio (usadas nas regras de acesso)
-- ---------------------------------------------------------------------
create or replace function public.eh_moderador()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.moderadores where user_id = (select auth.uid()));
$$;

create or replace function public.esta_bloqueado(u uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.bloqueios where usuario = u);
$$;

create or replace function public.aceitou_politica()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.perfis
    where id = (select auth.uid()) and privacidade_aceita_em is not null
  );
$$;


-- ---------------------------------------------------------------------
-- 3. Gatilhos: o banco preenche sozinho o que o app não deve escolher
-- ---------------------------------------------------------------------

-- Perfil: datas automáticas e espaços nas pontas removidos.
create or replace function public.perfis_antes_de_gravar()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  new.nome := btrim(new.nome);
  new.sobre := btrim(new.sobre);
  new.atualizado_em := now();
  if tg_op = 'INSERT' then
    new.cartao_em := now();
  elsif (new.nome, new.sobre, new.aparecer) is distinct from (old.nome, old.sobre, old.aparecer) then
    new.cartao_em := now();
  end if;
  return new;
end;
$$;
drop trigger if exists perfis_antes_de_gravar on public.perfis;
create trigger perfis_antes_de_gravar
  before insert or update on public.perfis
  for each row execute function public.perfis_antes_de_gravar();

-- Mensagem: autor, nome e hora vêm da conta; limite contra enxurrada.
create or replace function public.mensagens_antes_de_inserir()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_nome text;
begin
  new.autor := auth.uid();
  new.criada_em := now();
  new.oculta_em := null;
  new.texto := btrim(new.texto);
  select nullif(btrim(p.nome), '') into v_nome from public.perfis p where p.id = new.autor;
  new.autor_nome := coalesce(v_nome, 'Anônimo');
  if (select count(*) from public.mensagens m
      where m.autor = new.autor and m.criada_em > now() - interval '1 minute') >= 6 then
    raise exception 'Muitas mensagens em pouco tempo. Espere um minuto.'
      using errcode = 'P0001', hint = 'enxurrada';
  end if;
  return new;
end;
$$;
drop trigger if exists mensagens_antes_de_inserir on public.mensagens;
create trigger mensagens_antes_de_inserir
  before insert on public.mensagens
  for each row execute function public.mensagens_antes_de_inserir();

-- Denúncia: quem denunciou, o tipo e a conta denunciada vêm do banco,
-- nunca do app (assim ninguém aponta a denúncia para a pessoa errada).
create or replace function public.denuncias_antes_de_inserir()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  new.denunciante := auth.uid();
  new.criada_em := now();
  new.resolvida_em := null;
  new.decisao := null;
  new.alvo := null;
  if new.chave ~ '^m:[0-9]{1,18}$' then
    new.tipo := 'mensagem';
    select m.autor into new.alvo from public.mensagens m
    where m.id = substring(new.chave from 3)::bigint;
  elsif new.chave ~ '^p:[0-9a-f-]{36}$' then
    new.tipo := 'perfil';
    select p.id into new.alvo from public.perfis p
    where p.id = substring(new.chave from 3)::uuid;
  end if;
  if new.alvo is null then
    raise exception 'O conteúdo denunciado não foi encontrado.' using errcode = 'P0002';
  end if;
  return new;
end;
$$;
drop trigger if exists denuncias_antes_de_inserir on public.denuncias;
create trigger denuncias_antes_de_inserir
  before insert on public.denuncias
  for each row execute function public.denuncias_antes_de_inserir();

-- Inscrição: dono e datas vêm do banco. Se a pessoa mudar a inscrição,
-- ela volta para "aguardando encaminhamento".
create or replace function public.voluntarios_antes_de_gravar()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.usuario := auth.uid();
    new.criada_em := now();
    new.encaminhada_em := null;
  else
    new.usuario := old.usuario;
    if (new.ong, new.nome, new.contato, new.quando, new.como, new.acessibilidade, new.mensagem)
       is distinct from
       (old.ong, old.nome, old.contato, old.quando, old.como, old.acessibilidade, old.mensagem) then
      new.criada_em := now();
      new.encaminhada_em := null;
    end if;
  end if;
  new.nome := btrim(new.nome);
  new.contato := btrim(new.contato);
  return new;
end;
$$;
drop trigger if exists voluntarios_antes_de_gravar on public.voluntarios;
create trigger voluntarios_antes_de_gravar
  before insert or update on public.voluntarios
  for each row execute function public.voluntarios_antes_de_gravar();


-- ---------------------------------------------------------------------
-- 4. Funções que o app chama
-- ---------------------------------------------------------------------

-- Lista de Namoro e conexões: só para quem entrou na conta, só de quem
-- ligou "Aparecer", aceitou a política e confirmou ter 18 anos ou mais.
create or replace function public.pessoas_visiveis()
returns table (id uuid, nome text, sobre text, cartao_em timestamptz, oculto boolean)
language sql stable security definer set search_path = ''
as $$
  select p.id, p.nome, p.sobre, p.cartao_em, (p.oculto_em is not null) as oculto
  from public.perfis p
  where (select auth.uid()) is not null
    and p.aparecer
    and p.nome <> ''
    and p.privacidade_aceita_em is not null
    and p.maior_de_idade_em is not null
    and not exists (select 1 from public.bloqueios b where b.usuario = p.id)
    and (
      p.id = (select auth.uid())
      or (
        p.oculto_em is null
        and not exists (
          select 1 from public.bloqueios_pessoais bp
          where bp.quem = (select auth.uid()) and bp.bloqueado = p.id
        )
      )
    )
  order by p.cartao_em desc
  limit 30;
$$;

-- Decisões da moderação.
--   p_acao: 'manter', 'mostrar', 'esconder', 'bloquear' (com p_chave)
--           'desbloquear' (com p_alvo)
create or replace function public.moderar(p_acao text, p_chave text default null, p_alvo uuid default null)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_tipo text;
  v_msg  bigint;
  v_alvo uuid;
  v_nome text;
begin
  if not public.eh_moderador() then
    raise exception 'Só a moderação pode fazer isso.' using errcode = '42501';
  end if;

  if p_chave is not null then
    if p_chave ~ '^m:[0-9]{1,18}$' then
      v_tipo := 'mensagem';
      v_msg := substring(p_chave from 3)::bigint;
      select m.autor, m.autor_nome into v_alvo, v_nome from public.mensagens m where m.id = v_msg;
    elsif p_chave ~ '^p:[0-9a-f-]{36}$' then
      v_tipo := 'perfil';
      v_alvo := substring(p_chave from 3)::uuid;
      select p.nome into v_nome from public.perfis p where p.id = v_alvo;
    else
      raise exception 'Chave inválida.' using errcode = '22023';
    end if;
  end if;

  if p_acao in ('manter', 'mostrar') then
    if v_tipo is null then raise exception 'Falta a chave.' using errcode = '22023'; end if;
    if v_tipo = 'mensagem' then
      update public.mensagens set oculta_em = null where id = v_msg;
    else
      update public.perfis set oculto_em = null where id = v_alvo;
    end if;
    update public.denuncias set resolvida_em = now(), decisao = 'mantido'
    where chave = p_chave and resolvida_em is null;

  elsif p_acao = 'esconder' then
    if v_tipo is null then raise exception 'Falta a chave.' using errcode = '22023'; end if;
    if v_tipo = 'mensagem' then
      update public.mensagens set oculta_em = now() where id = v_msg;
    else
      update public.perfis set oculto_em = now() where id = v_alvo;
    end if;
    update public.denuncias set resolvida_em = now(), decisao = 'escondido'
    where chave = p_chave and resolvida_em is null;

  elsif p_acao = 'bloquear' then
    if v_alvo is null then raise exception 'Conta não encontrada.' using errcode = 'P0002'; end if;
    if v_alvo = auth.uid() then
      raise exception 'Você não pode bloquear a própria conta.' using errcode = '22023';
    end if;
    insert into public.bloqueios (usuario, nome, por)
    values (v_alvo, coalesce(v_nome, ''), auth.uid())
    on conflict (usuario) do nothing;
    if v_tipo = 'mensagem' then
      update public.mensagens set oculta_em = coalesce(oculta_em, now()) where id = v_msg;
    elsif v_tipo = 'perfil' then
      update public.perfis set oculto_em = coalesce(oculto_em, now()) where id = v_alvo;
    end if;
    update public.perfis set aparecer = false where id = v_alvo;
    update public.denuncias set resolvida_em = now(), decisao = 'bloqueado'
    where alvo = v_alvo and resolvida_em is null;

  elsif p_acao = 'desbloquear' then
    delete from public.bloqueios where usuario = p_alvo;

  else
    raise exception 'Ação desconhecida.' using errcode = '22023';
  end if;
end;
$$;

-- A equipe marca uma inscrição como enviada para a instituição.
create or replace function public.marcar_encaminhada(p_id bigint)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if not public.eh_moderador() then
    raise exception 'Só a equipe do app pode fazer isso.' using errcode = '42501';
  end if;
  update public.voluntarios set encaminhada_em = now() where id = p_id;
end;
$$;

-- "Apagar meus dados": apaga mensagens, inscrições e bloqueios pessoais,
-- e zera o perfil (nome, frase, favoritos, estatísticas e o aceite).
create or replace function public.apagar_meus_dados()
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  eu uuid := auth.uid();
begin
  if eu is null then
    raise exception 'Entre na sua conta primeiro.' using errcode = '42501';
  end if;
  delete from public.mensagens where autor = eu;
  delete from public.voluntarios where usuario = eu;
  delete from public.bloqueios_pessoais where quem = eu;
  update public.perfis
  set nome = '', sobre = '', aparecer = false, maior_de_idade_em = null,
      privacidade_aceita_em = null, favoritos = '{}'::jsonb, sessoes = 0, desde = now()
  where id = eu;
end;
$$;

-- "Apagar minha conta": apaga a conta de login e, junto, tudo o que é
-- dela (perfil, mensagens, inscrições, bloqueios). As denúncias que a
-- pessoa fez continuam com a moderação, sem o nome de quem denunciou.
create or replace function public.apagar_minha_conta()
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  eu uuid := auth.uid();
begin
  if eu is null then
    raise exception 'Entre na sua conta primeiro.' using errcode = '42501';
  end if;
  delete from auth.users where id = eu;
end;
$$;


-- ---------------------------------------------------------------------
-- 5. Regras de acesso (RLS)
-- ---------------------------------------------------------------------
alter table public.moderadores        enable row level security;
alter table public.perfis             enable row level security;
alter table public.mensagens          enable row level security;
alter table public.denuncias          enable row level security;
alter table public.bloqueios          enable row level security;
alter table public.bloqueios_pessoais enable row level security;
alter table public.voluntarios        enable row level security;

-- Apaga as regras deste arquivo antes de criar de novo (para poder rodar
-- o arquivo mais de uma vez). Tabelas antigas saíram na etapa 0.
drop policy if exists "ver a si mesmo"          on public.moderadores;
drop policy if exists "ler o proprio perfil"    on public.perfis;
drop policy if exists "criar o proprio perfil"  on public.perfis;
drop policy if exists "mudar o proprio perfil"  on public.perfis;
drop policy if exists "apagar o proprio perfil" on public.perfis;
drop policy if exists "ler mensagens"           on public.mensagens;
drop policy if exists "escrever mensagem"       on public.mensagens;
drop policy if exists "apagar mensagem"         on public.mensagens;
drop policy if exists "ler denuncias"           on public.denuncias;
drop policy if exists "denunciar"               on public.denuncias;
drop policy if exists "ler bloqueios"           on public.bloqueios;
drop policy if exists "ler meus bloqueios"      on public.bloqueios_pessoais;
drop policy if exists "bloquear pessoa"         on public.bloqueios_pessoais;
drop policy if exists "desbloquear pessoa"      on public.bloqueios_pessoais;
drop policy if exists "ler inscricoes"          on public.voluntarios;
drop policy if exists "fazer inscricao"         on public.voluntarios;
drop policy if exists "mudar inscricao"         on public.voluntarios;
drop policy if exists "apagar inscricao"        on public.voluntarios;

-- moderadores: cada conta só descobre se ela mesma modera.
create policy "ver a si mesmo" on public.moderadores
  for select to authenticated
  using (user_id = (select auth.uid()));

-- perfis: só a dona da conta; a moderação lê para analisar denúncias.
create policy "ler o proprio perfil" on public.perfis
  for select to authenticated
  using (id = (select auth.uid()) or public.eh_moderador());
create policy "criar o proprio perfil" on public.perfis
  for insert to authenticated
  with check (id = (select auth.uid()));
create policy "mudar o proprio perfil" on public.perfis
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));
create policy "apagar o proprio perfil" on public.perfis
  for delete to authenticated
  using (id = (select auth.uid()));

-- mensagens: qualquer pessoa lê as visíveis; quem escreveu sempre vê as
-- suas; a moderação vê tudo. Para escrever: conta, aceite e sem bloqueio.
create policy "ler mensagens" on public.mensagens
  for select to anon, authenticated
  using (
    (oculta_em is null and not public.esta_bloqueado(autor))
    or autor = (select auth.uid())
    or public.eh_moderador()
  );
create policy "escrever mensagem" on public.mensagens
  for insert to authenticated
  with check (
    autor = (select auth.uid())
    and public.aceitou_politica()
    and not public.esta_bloqueado((select auth.uid()))
  );
create policy "apagar mensagem" on public.mensagens
  for delete to authenticated
  using (autor = (select auth.uid()) or public.eh_moderador());

-- denuncias: cada conta vê só as próprias; a moderação vê todas.
create policy "ler denuncias" on public.denuncias
  for select to authenticated
  using (denunciante = (select auth.uid()) or public.eh_moderador());
create policy "denunciar" on public.denuncias
  for insert to authenticated
  with check (denunciante = (select auth.uid()));

-- bloqueios: a moderação vê todos; a conta bloqueada sabe que foi.
create policy "ler bloqueios" on public.bloqueios
  for select to authenticated
  using (usuario = (select auth.uid()) or public.eh_moderador());

-- bloqueios pessoais: só a própria conta.
create policy "ler meus bloqueios" on public.bloqueios_pessoais
  for select to authenticated
  using (quem = (select auth.uid()));
create policy "bloquear pessoa" on public.bloqueios_pessoais
  for insert to authenticated
  with check (quem = (select auth.uid()));
create policy "desbloquear pessoa" on public.bloqueios_pessoais
  for delete to authenticated
  using (quem = (select auth.uid()));

-- voluntarios: a pessoa vê e muda as suas; a equipe (moderadores) vê todas.
create policy "ler inscricoes" on public.voluntarios
  for select to authenticated
  using (usuario = (select auth.uid()) or public.eh_moderador());
create policy "fazer inscricao" on public.voluntarios
  for insert to authenticated
  with check (usuario = (select auth.uid()) and public.aceitou_politica());
create policy "mudar inscricao" on public.voluntarios
  for update to authenticated
  using (usuario = (select auth.uid()))
  with check (usuario = (select auth.uid()) and public.aceitou_politica());
create policy "apagar inscricao" on public.voluntarios
  for delete to authenticated
  using (usuario = (select auth.uid()));


-- ---------------------------------------------------------------------
-- 6. Permissões por coluna (o app só grava o que deve)
-- ---------------------------------------------------------------------
revoke all on public.moderadores, public.perfis, public.mensagens, public.denuncias,
              public.bloqueios, public.bloqueios_pessoais, public.voluntarios
  from anon, authenticated;

grant select on public.moderadores to authenticated;

grant select, delete on public.perfis to authenticated;
grant insert (id, nome, sobre, aparecer, maior_de_idade_em, privacidade_aceita_em, favoritos, sessoes, desde),
      update (id, nome, sobre, aparecer, maior_de_idade_em, privacidade_aceita_em, favoritos, sessoes, desde)
  on public.perfis to authenticated;

grant select on public.mensagens to anon, authenticated;
grant insert (texto), delete on public.mensagens to authenticated;

grant select on public.denuncias to authenticated;
grant insert (chave, motivo) on public.denuncias to authenticated;

grant select on public.bloqueios to authenticated;

grant select, delete on public.bloqueios_pessoais to authenticated;
grant insert (bloqueado, nome) on public.bloqueios_pessoais to authenticated;

grant select, delete on public.voluntarios to authenticated;
grant insert (ong, nome, contato, quando, como, acessibilidade, mensagem),
      update (ong, nome, contato, quando, como, acessibilidade, mensagem)
  on public.voluntarios to authenticated;

-- Funções: as de escrita só para quem entrou na conta.
revoke execute on function public.pessoas_visiveis()               from public, anon;
revoke execute on function public.moderar(text, text, uuid)        from public, anon;
revoke execute on function public.marcar_encaminhada(bigint)       from public, anon;
revoke execute on function public.apagar_meus_dados()              from public, anon;
revoke execute on function public.apagar_minha_conta()             from public, anon;
grant  execute on function public.pessoas_visiveis()               to authenticated;
grant  execute on function public.moderar(text, text, uuid)        to authenticated;
grant  execute on function public.marcar_encaminhada(bigint)       to authenticated;
grant  execute on function public.apagar_meus_dados()              to authenticated;
grant  execute on function public.apagar_minha_conta()             to authenticated;


-- ---------------------------------------------------------------------
-- 7. Comunidade ao vivo (Realtime)
-- ---------------------------------------------------------------------
do $$
begin
  alter publication supabase_realtime add table public.mensagens;
exception
  when duplicate_object then null;  -- já estava ligada
  when undefined_object then null;  -- projeto sem Realtime: o app recarrega sozinho
end $$;


-- ---------------------------------------------------------------------
-- 8. Assistente de IA: limite de perguntas por pessoa por dia
-- (a função "assistente", em supabase/functions, chama usar_assistente
-- antes de cada resposta)
-- ---------------------------------------------------------------------
create table if not exists public.uso_assistente (
  usuario   uuid not null references auth.users (id) on delete cascade,
  dia       date not null,
  perguntas integer not null default 0 check (perguntas >= 0),
  primary key (usuario, dia)
);
comment on table public.uso_assistente is 'inclua-santos:v1';
alter table public.uso_assistente enable row level security;
-- sem regras de acesso: só a função abaixo lê e grava
revoke all on public.uso_assistente from anon, authenticated;

-- Conta uma pergunta e devolve quantas ainda restam hoje (-1: acabou).
create or replace function public.usar_assistente()
returns integer
language plpgsql security definer set search_path = ''
as $$
declare
  eu uuid := auth.uid();
  hoje date := (now() at time zone 'America/Sao_Paulo')::date;
  limite constant integer := 30;
  usadas integer;
begin
  if eu is null then
    raise exception 'Entre na sua conta primeiro.' using errcode = '42501';
  end if;
  insert into public.uso_assistente as u (usuario, dia, perguntas)
  values (eu, hoje, 1)
  on conflict (usuario, dia) do update set perguntas = u.perguntas + 1
  where u.perguntas < limite
  returning perguntas into usadas;
  if usadas is null then
    return -1;
  end if;
  delete from public.uso_assistente where usuario = eu and dia < hoje - 7;
  return limite - usadas;
end;
$$;
revoke execute on function public.usar_assistente() from public, anon;
grant  execute on function public.usar_assistente() to authenticated;


-- ---------------------------------------------------------------------
-- 9. Moderadores
-- Depois de entrar no app uma vez com o seu e-mail, tire os dois traços
-- do começo das 3 linhas abaixo, troque o e-mail e rode só elas.
-- ---------------------------------------------------------------------
-- insert into public.moderadores (user_id)
-- select id from auth.users where email = 'SEU-EMAIL@exemplo.com'
-- on conflict do nothing;
