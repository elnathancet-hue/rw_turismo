-- Quiz como entidade própria: criar e editar pelo painel, sem programador.
-- Rodar no SQL Editor. Idempotente. Aditiva. FASE 1 de 4 — só banco, sem tela.
--
-- HOJE existe UM quiz, inteiramente fixo no código (src/lib/quiz/feriado.ts:
-- 231 linhas de dados + 362 de tela). Cada quiz novo é um deploy.
--
-- O MODELO segue `pages`: título, slug único, status draft/published, seo_*,
-- e o conteúdo em jsonb. É a mesma forma que o construtor de páginas já usa e
-- que o site já sabe renderizar.
--
-- A PONTUAÇÃO generaliza o que o quiz atual faz, sem inventar. Hoje ele soma
-- dois contadores (relaxar/aventura) e a diferença de 0,5 decide o perfil.
-- Aqui os eixos passam a ser NOMEADOS PELO QUIZ — um quiz "praia vs montanha"
-- usa o mesmo motor — e a regra vira: ganha o eixo de maior pontuação; se a
-- distância para o segundo for menor que a margem, vale o resultado de empate.
-- Isso cobre o quiz atual exatamente e estende para N eixos de graça.

create table if not exists public.quizzes (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text not null unique,
  status text not null default 'draft',
  seo_title text,
  seo_description text,

  -- Abertura: o que a pessoa vê antes de começar.
  intro jsonb not null default '{}'::jsonb,

  -- Os eixos de pontuação, nomeados por quem cria: ["relaxar","aventura"].
  eixos jsonb not null default '[]'::jsonb,

  -- [{ texto, opcoes: [{ texto, pesos: { "<eixo>": number } }] }]
  -- `pesos` vazio é a opção neutra, que não pontua para lado nenhum.
  perguntas jsonb not null default '[]'::jsonb,

  -- [{ chave, eixo, rotulo, texto, foto, posicao }]
  -- `eixo` nulo marca o resultado de EMPATE — o "equilíbrio" do quiz atual.
  resultados jsonb not null default '[]'::jsonb,

  -- Distância mínima para um eixo ser considerado dominante. Abaixo dela, o
  -- resultado é o de empate. 0.5 é o valor que o quiz atual usa.
  margem_empate numeric not null default 0.5,

  -- O que acontece no fim: WhatsApp, formulário, ou nada.
  cta jsonb not null default '{}'::jsonb,

  -- Quiz sem captura serve como conteúdo puro. Por isso é opcional, e falso
  -- por padrão: pedir dado pessoal tem que ser decisão explícita de quem cria.
  captura_ativa boolean not null default false,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint quizzes_status_check check (status in ('draft', 'published'))
);

create index if not exists quizzes_slug_idx on public.quizzes(slug);
create index if not exists quizzes_status_idx on public.quizzes(status);

drop trigger if exists set_quizzes_updated_at on public.quizzes;
create trigger set_quizzes_updated_at
before update on public.quizzes
for each row execute function public.set_updated_at();

comment on table public.quizzes is
  'Quiz de captacao, criado e editado pelo painel. O conteudo fica em jsonb pelo mesmo motivo que pages.blocks: a forma muda com o produto, e uma coluna por campo viraria migration a cada ideia nova.';
comment on column public.quizzes.eixos is
  'Nomes dos eixos de pontuacao deste quiz, ex: ["relaxar","aventura"]. Sao do quiz, e nao do sistema — assim um quiz "praia vs montanha" usa o mesmo motor.';
comment on column public.quizzes.resultados is
  'Um por desfecho. `eixo` diz qual eixo dominante leva a ele; `eixo` NULO marca o resultado de empate.';


-- =====================================================================
-- As respostas
-- =====================================================================
-- Guardar a resposta é o que permite dizer depois "60% caíram em aventura" e
-- por que aquele lead é quente.
create table if not exists public.quiz_responses (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid not null references public.quizzes(id) on delete cascade,

  -- A chave do resultado. CALCULADA NO BANCO — ver responder_quiz() abaixo.
  resultado text not null,
  -- Quanto cada eixo somou, para o relatório não precisar recalcular.
  pontuacao jsonb not null default '{}'::jsonb,
  -- O que a pessoa escolheu: [{ pergunta: 0, opcao: 2 }]
  respostas jsonb not null default '[]'::jsonb,

  -- Só quando o quiz pede, e só o que a pessoa digitou.
  name text,
  phone text,
  email text,

  utm jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists quiz_responses_quiz_idx
  on public.quiz_responses(quiz_id, created_at desc);
create index if not exists quiz_responses_resultado_idx
  on public.quiz_responses(quiz_id, resultado);


-- =====================================================================
-- RLS
-- =====================================================================
alter table public.quizzes enable row level security;
alter table public.quiz_responses enable row level security;

-- Leitura pública só do que está publicado — igual a `pages`.
drop policy if exists "quizzes_public_read" on public.quizzes;
create policy "quizzes_public_read" on public.quizzes
for select to anon, authenticated
using (status = 'published');

-- Quem cria quiz é `conteudo`, como paginas e blog. Pode porque NENHUM campo
-- do quiz vira HTML: tudo e texto, renderizado pelo React e portanto escapado.
-- Foi exatamente a falta disso que obrigou a travar pages.custom_html no admin.
drop policy if exists "quizzes_conteudo_all" on public.quizzes;
create policy "quizzes_conteudo_all" on public.quizzes
for all to authenticated
using (public.has_staff_role(array['conteudo']))
with check (public.has_staff_role(array['conteudo']));

drop policy if exists "quizzes_admin_all" on public.quizzes;
create policy "quizzes_admin_all" on public.quizzes
for all to authenticated
using (public.is_admin()) with check (public.is_admin());

-- RESPOSTA NAO TEM POLICY DE INSERT. De proposito.
--
-- Quem grava e a funcao abaixo, que roda como service_role. Se houvesse insert
-- publico, a pessoa mandaria o PROPRIO resultado — e o relatorio viraria
-- ficcao. E o mesmo erro que a auditoria encontrou em survey_responses, onde o
-- anonimo podia gravar `approved = true` e publicar o proprio depoimento.
drop policy if exists "quiz_responses_staff_read" on public.quiz_responses;
create policy "quiz_responses_staff_read" on public.quiz_responses
for select to authenticated
using (public.has_staff_role(array['admin', 'operacoes', 'conteudo']));


-- =====================================================================
-- responder_quiz() — o resultado é decidido AQUI, nunca no navegador
-- =====================================================================
-- Recebe só o que a pessoa escolheu. Soma os eixos, decide o desfecho, grava e
-- devolve. O cliente não tem como dizer em que resultado quer cair.
--
-- Concedida SOMENTE a service_role: quem chama é a rota de API, que aplica
-- limite por IP antes. Assim o quiz não vira mais uma escrita pública sem
-- limite — o projeto já tem quatro delas, e a auditoria registrou isso.
create or replace function public.responder_quiz(
  p_slug text,
  p_respostas jsonb,
  p_nome text default null,
  p_telefone text default null,
  p_email text default null,
  p_utm jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  q public.quizzes;
  pontos jsonb := '{}'::jsonb;
  item jsonb;
  pesos jsonb;
  eixo text;
  valor numeric;
  melhor_eixo text;
  melhor numeric;
  segundo numeric;
  chave text;
  resultado_json jsonb;
begin
  select * into q
    from public.quizzes
   where slug = p_slug and status = 'published';

  if not found then
    raise exception 'quiz nao encontrado ou nao publicado';
  end if;

  if jsonb_typeof(p_respostas) is distinct from 'array' then
    raise exception 'respostas invalidas';
  end if;

  -- Todo eixo começa em zero, para o resultado não depender de quem pontuou.
  for eixo in select jsonb_array_elements_text(q.eixos) loop
    pontos := jsonb_set(pontos, array[eixo], to_jsonb(0::numeric));
  end loop;

  for item in select * from jsonb_array_elements(p_respostas) loop
    -- Índice fora da faixa é IGNORADO, e não derruba a resposta inteira: o
    -- quiz pode ter sido editado enquanto a pessoa respondia.
    pesos := q.perguntas
             -> (item ->> 'pergunta')::int
             -> 'opcoes'
             -> (item ->> 'opcao')::int
             -> 'pesos';

    if pesos is null or jsonb_typeof(pesos) is distinct from 'object' then
      continue;
    end if;

    for eixo, valor in
      select chave_peso, (v #>> '{}')::numeric
        from jsonb_each(pesos) as e(chave_peso, v)
    loop
      -- Peso para eixo que o quiz não declarou é descartado.
      if pontos ? eixo then
        pontos := jsonb_set(
          pontos,
          array[eixo],
          to_jsonb(((pontos ->> eixo)::numeric) + coalesce(valor, 0))
        );
      end if;
    end loop;
  end loop;

  select e.chave_peso, (e.v #>> '{}')::numeric
    into melhor_eixo, melhor
    from jsonb_each(pontos) as e(chave_peso, v)
   order by (e.v #>> '{}')::numeric desc, e.chave_peso
   limit 1;

  select (e.v #>> '{}')::numeric
    into segundo
    from jsonb_each(pontos) as e(chave_peso, v)
   order by (e.v #>> '{}')::numeric desc, e.chave_peso
   offset 1 limit 1;

  -- Um eixo só, ou distância suficiente: vence o dominante. Senão, empate.
  if segundo is null or (melhor - segundo) >= q.margem_empate then
    select r ->> 'chave' into chave
      from jsonb_array_elements(q.resultados) r
     where r ->> 'eixo' = melhor_eixo
     limit 1;
  else
    select r ->> 'chave' into chave
      from jsonb_array_elements(q.resultados) r
     where r ->> 'eixo' is null
     limit 1;
  end if;

  -- Quiz mal configurado (sem resultado para o eixo vencedor, ou sem empate
  -- declarado) não pode deixar a pessoa sem resposta na tela.
  if chave is null then
    select r ->> 'chave' into chave
      from jsonb_array_elements(q.resultados) r
     limit 1;
  end if;

  if chave is null then
    raise exception 'quiz sem resultados configurados';
  end if;

  insert into public.quiz_responses (
    quiz_id, resultado, pontuacao, respostas, name, phone, email, utm
  ) values (
    q.id, chave, pontos, p_respostas,
    nullif(btrim(coalesce(p_nome, '')), ''),
    nullif(btrim(coalesce(p_telefone, '')), ''),
    nullif(lower(btrim(coalesce(p_email, ''))), ''),
    coalesce(p_utm, '{}'::jsonb)
  );

  select r into resultado_json
    from jsonb_array_elements(q.resultados) r
   where r ->> 'chave' = chave
   limit 1;

  return jsonb_build_object(
    'resultado', chave,
    'pontuacao', pontos,
    'conteudo', resultado_json
  );
end;
$$;

revoke all on function public.responder_quiz(text, jsonb, text, text, text, jsonb) from public;
grant execute on function public.responder_quiz(text, jsonb, text, text, text, jsonb) to service_role;

comment on function public.responder_quiz(text, jsonb, text, text, text, jsonb) is
  'Recebe o que a pessoa escolheu, calcula o resultado NO BANCO, grava e devolve. O resultado nunca vem do navegador: se viesse, a pessoa escreveria o proprio desfecho e o relatorio viraria ficcao — o mesmo erro que a auditoria achou em survey_responses.approved. Concedida so a service_role porque quem chama e a rota de API, que aplica limite por IP antes.';
