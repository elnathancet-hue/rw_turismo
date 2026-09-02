-- responder_quiz passa a desconfiar do que vem do navegador.
-- Rodar no SQL Editor. Idempotente. Substitui a função da 20260906.
--
-- A REVISÃO DO SISTEMA DE QUIZ ACHOU QUATRO BURACOS, todos na mesma origem: a
-- função confiava no formato de `p_respostas`. O resultado nunca veio do
-- cliente — isso continua verdade — mas o CAMINHO até ele vinha, e caminho
-- controlado é resultado controlado.
--
--   1. REPETIR A MESMA PERGUNTA SOMAVA N VEZES. Mandando a mesma escolha seis
--      vezes, a pessoa forçava o desfecho que quisesse. E o relatório de "onde
--      as pessoas caem" — que é a razão de existir da tela de respostas —
--      passava a contar uma pontuação que ninguém respondeu.
--   2. {"pergunta":"abc"} DERRUBAVA A RESPOSTA COM ERRO. O comentário da função
--      prometia que índice fora da faixa é ignorado "e não derruba o resto",
--      mas o `::int` estourava antes de qualquer checagem. A promessa valia só
--      para índice numérico.
--   3. ÍNDICE NEGATIVO PONTUAVA. Em jsonb, `-1` conta do fim do array — então
--      -1 escolhia a última opção, que não é o que ninguém quis dizer.
--   4. captura_ativa ERA TRAVA SÓ DO REACT. A função gravava nome e telefone
--      mesmo num quiz configurado para não pedir contato: bastava mandar no
--      corpo. Guardar dado pessoal que a configuração diz não guardar é o tipo
--      de coisa que ninguém descobre até virar problema.

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
  i_pergunta integer;
  i_opcao integer;
  vistas integer[] := '{}';
  total_perguntas integer;
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

  total_perguntas := jsonb_array_length(q.perguntas);

  for eixo in select jsonb_array_elements_text(q.eixos) loop
    pontos := jsonb_set(pontos, array[eixo], to_jsonb(0::numeric));
  end loop;

  for item in select * from jsonb_array_elements(p_respostas) loop
    -- safe_integer devolve NULL em vez de estourar: "abc" vira NULL e a linha
    -- e ignorada, que e o que o comentario sempre prometeu.
    i_pergunta := public.safe_integer(item ->> 'pergunta');
    i_opcao := public.safe_integer(item ->> 'opcao');

    -- Negativo conta do FIM do array em jsonb — `-1` pegaria a ultima opcao.
    -- Fora da faixa de perguntas tambem sai aqui.
    if i_pergunta is null or i_opcao is null
       or i_pergunta < 0 or i_opcao < 0
       or i_pergunta >= total_perguntas
    then
      continue;
    end if;

    -- UMA RESPOSTA POR PERGUNTA. Sem isto, repetir a mesma escolha somava de
    -- novo e o visitante escolhia o proprio desfecho. Vale a PRIMEIRA: e a
    -- que a tela envia na ordem em que a pessoa respondeu.
    if i_pergunta = any(vistas) then
      continue;
    end if;
    vistas := vistas || i_pergunta;

    pesos := q.perguntas -> i_pergunta -> 'opcoes' -> i_opcao -> 'pesos';

    if pesos is null or jsonb_typeof(pesos) is distinct from 'object' then
      continue;
    end if;

    for eixo, valor in
      select chave_peso, (v #>> '{}')::numeric
        from jsonb_each(pesos) as e(chave_peso, v)
    loop
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
    -- QUIZ SEM CAPTURA NAO GUARDA CONTATO, venha o que vier no corpo. A
    -- configuracao manda; o cliente nao decide o que a agencia armazena.
    case when q.captura_ativa then nullif(btrim(coalesce(p_nome, '')), '') end,
    case when q.captura_ativa then nullif(btrim(coalesce(p_telefone, '')), '') end,
    case when q.captura_ativa then nullif(lower(btrim(coalesce(p_email, ''))), '') end,
    -- Array tambem e 'object' para o typeof do JavaScript, mas nao para o
    -- jsonb: so objeto entra, senao vira {}.
    case when jsonb_typeof(coalesce(p_utm, '{}'::jsonb)) = 'object'
         then p_utm else '{}'::jsonb end
  );

  select r into resultado_json
    from jsonb_array_elements(q.resultados) r
   where r ->> 'chave' = chave
   limit 1;

  return jsonb_build_object(
    'resultado', chave,
    'pontuacao', pontos,
    'conteudo', resultado_json,
    -- A tela precisa saber se o contato foi guardado, para nao prometer a
    -- quem respondeu algo que nao aconteceu.
    'capturou', q.captura_ativa
  );
end;
$$;

revoke all on function public.responder_quiz(text, jsonb, text, text, text, jsonb) from public;
grant execute on function public.responder_quiz(text, jsonb, text, text, text, jsonb) to service_role;

comment on function public.responder_quiz(text, jsonb, text, text, text, jsonb) is
  'Recebe o que a pessoa escolheu, calcula o resultado NO BANCO, grava e devolve. Desconfia do formato: indice nao numerico ou negativo e ignorado, pergunta repetida so conta uma vez, e contato so e gravado se o quiz pedir. Concedida so a service_role — quem chama e a rota de API, que aplica limite por IP antes.';
