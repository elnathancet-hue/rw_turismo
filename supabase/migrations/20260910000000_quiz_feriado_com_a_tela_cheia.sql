-- O quiz do feriado ganha a tela de resultado inteira.
-- Rodar no SQL Editor. Idempotente.
--
-- POR QUE: a semente (20260907) gravou perguntas, pesos e resultados, mas cada
-- resultado tinha so `chave`, `eixo`, `rotulo` e `texto`. Renderizado, isso
-- virava "uma frase" — enquanto a pagina feita a mao (/quiz-feriado) mostra
-- olho, titulo com o nome, paragrafo, regua, lista com check, duas fotos
-- legendadas, bloco de destino, selo e microcopy.
--
-- Aqui os campos novos entram como DADO. E o que prova que o modelo consegue
-- expressar a pagina de referencia: se algum elemento nao coubesse, apareceria
-- agora, e nao depois que alguem tentasse montar o proprio quiz.
--
-- POR QUE UPDATE E NAO ALTERAR A SEMENTE: a 20260907 termina em
-- `on conflict (slug) do nothing`. Em banco que ja rodou aquela migration,
-- mexer nela nao tem efeito nenhum — a linha ja existe e o insert e ignorado.
-- Editar a semente so mudaria o resultado de um banco montado do zero, o que
-- deixaria producao e ambiente novo com conteudo diferente.
--
-- O update e por CHAVE, com jsonb_set item a item: substituir o array inteiro
-- apagaria qualquer ajuste que a agencia tenha feito pelo painel desde entao.

do $$
declare
  q_id uuid;
  i integer;
  item jsonb;
  novos jsonb := '[]'::jsonb;
  extras jsonb;
  -- O conteudo por chave de resultado. As chaves saem da semente 20260907.
  conteudo jsonb := jsonb_build_object(
    'relaxar-dominante', jsonb_build_object(
      'posicao', 18,
      'regua_rotulo', 'Mais descanso'
    ),
    'equilibrio', jsonb_build_object(
      'posicao', 50,
      'regua_rotulo', 'Descanso e aventura, na mesma medida'
    ),
    'aventura-dominante', jsonb_build_object(
      'posicao', 82,
      'regua_rotulo', 'Mais aventura'
    )
  );
  -- Iguais nos tres desfechos: a viagem e a mesma, o que muda e a leitura.
  comuns jsonb := jsonb_build_object(
    'titulo',
      '{{nome}}, suas respostas mostram que a Serra da Ibiapaba combina com o feriado que voce quer viver.',
    'motivos', jsonb_build_array(
      'Paisagens, serra e experiencias ao ar livre para realmente mudar de cenario.',
      'Aventura na medida: teleferico, mirantes e passeios que deixam o feriado interessante.',
      'Tempo para desacelerar: sao 2 dias e 1 noite para sair da rotina sem precisar tirar varios dias de folga.',
      'Pouca preocupacao com organizacao: transporte, hospedagem e acompanhamento ja fazem parte da viagem.'
    ),
    'destino', jsonb_build_object(
      'nome', 'Serra da Ibiapaba',
      'subtitulo', 'Sitio do Bosco + Lapa + Ubajara',
      'itens', jsonb_build_array(
        'Saida sabado, 5 de setembro',
        'Retorno segunda, 7 de setembro',
        'Transporte em onibus categoria turistica, com ar e WC',
        'Hospedagem e transporte inclusos no pacote',
        'Guia exclusivo acompanhando o grupo'
      )
    )
  );
begin
  select id into q_id from public.quizzes where slug = 'feriado';
  if q_id is null then
    raise notice 'quiz feriado nao existe neste banco; nada a fazer';
    return;
  end if;

  -- A MOLDURA: os rotulos iguais em todos os desfechos.
  update public.quizzes
     set resultado_layout = jsonb_build_object(
           'olho', 'Sua leitura',
           'titulo_motivos', 'Por que essa viagem combina com voce?',
           'titulo_destino', 'Seu destino',
           'selo', 'Mais de 25 anos de estrada, Cadastur, loja fisica em Teresina, guia acompanhando o grupo do comeco ao fim.',
           'assinatura', '@rwturismo.pi'
         ),
         cta = coalesce(cta, '{}'::jsonb) || jsonb_build_object(
           'texto_botao', 'QUERO conhecer a viagem',
           'micro', jsonb_build_array(
             'Voce cai direto no WhatsApp, com a mensagem ja escrita. E so conferir e mandar.',
             'Ou chama direto no 86 99920-7088. Viajar e preciso.'
           )
         )
   where id = q_id;

  -- OS RESULTADOS, item a item. `||` mescla e as chaves ja existentes ganham o
  -- valor novo; o que o painel tiver acrescentado e que nao esta aqui sobrevive.
  for i in 0 .. jsonb_array_length((select resultados from public.quizzes where id = q_id)) - 1 loop
    item := (select resultados from public.quizzes where id = q_id) -> i;
    extras := coalesce(conteudo -> (item ->> 'chave'), '{}'::jsonb);
    novos := novos || jsonb_build_array(item || comuns || extras);
  end loop;

  update public.quizzes set resultados = novos where id = q_id;
end;
$$;
