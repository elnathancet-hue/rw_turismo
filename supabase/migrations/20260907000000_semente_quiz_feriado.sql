-- O quiz-feriado, agora como DADO. Rodar no SQL Editor. Idempotente.
--
-- POR QUE ESTA SEMENTE EXISTE: é o teste de verdade do modelo da fase 1. Um
-- quiz inventado por mim caberia em qualquer esquema; o que prova o desenho é
-- o quiz que a agência já usa entrar sem perder nada. Se algum campo não
-- coubesse, o lugar de descobrir era aqui — antes do editor existir.
--
-- O QUE ELA NÃO FAZ: não mexe em /quiz-feriado. Aquela página continua no ar,
-- com o código dela, servindo a campanha que estiver rodando. Esta semente cria
-- /quiz/feriado ao lado, alimentada pelo banco. Trocar uma pela outra é decisão
-- de quem toca a campanha, não efeito colateral de uma migration.
--
-- O QUE NÃO VEIO JUNTO, e por quê:
--   - As cenas em SVG (CenaSimulada) são arte PROVISÓRIA — o próprio arquivo
--     diz que sai quando as fotos reais chegarem. Aqui `foto` fica vazio: a
--     tela renderiza o texto e segue de pé. Quando as fotos existirem, é só
--     colar a URL pelo editor.
--   - Os blocos "Por que combina" e "A viagem" são da campanha daquele feriado,
--     não do motor de quiz. Entraram no texto do resultado.

insert into public.quizzes (
  title, slug, status, seo_title, seo_description,
  intro, eixos, margem_empate, captura_ativa, perguntas, resultados, cta
) values (
  'Que feriado combina com você?',
  'feriado',
  'draft',
  'Que feriado combina com você? | RW Turismo',
  'Responda 6 perguntas e descubra se o seu feriado pede descanso, aventura — ou os dois.',
  jsonb_build_object(
    'titulo', 'Que feriado combina com você?',
    'subtitulo', 'Seis perguntas rápidas. No fim, a gente te diz que tipo de feriado o seu corpo está pedindo.',
    'texto_botao', 'Começar'
  ),
  '["relaxar","aventura"]'::jsonb,
  0.5,
  true,
  $perguntas$[
    {
      "texto": "Que cenário vem à sua mente quando você tem vontade de \"sumir\" da rotina por alguns dias?",
      "opcoes": [
        { "texto": "Uma rede balançando, silêncio com a natureza e uma vista incrível", "pesos": { "relaxar": 1 } },
        { "texto": "Uma aventura com lugares históricos e atividades radicais", "pesos": { "aventura": 1 } },
        { "texto": "Água fria de piscina natural, bons restaurantes pra comer bem", "pesos": { "relaxar": 1 } },
        { "texto": "Trilha, atividades e uma programação para se movimentar", "pesos": { "aventura": 1 } }
      ]
    },
    {
      "texto": "No feriado, seu corpo pede:",
      "opcoes": [
        { "texto": "Descansar até o despertador perder a função", "pesos": { "relaxar": 1 } },
        { "texto": "Gastar muita energia e descansar a mente", "pesos": { "aventura": 1 } }
      ]
    },
    {
      "texto": "Se alguém te perguntasse: o que você mais precisa AGORA, o que seria?",
      "opcoes": [
        { "texto": "Silêncio", "pesos": { "relaxar": 1 } },
        { "texto": "Adrenalina, nem que seja pouca", "pesos": { "aventura": 1 } },
        { "texto": "Parar de olhar pro celular", "pesos": { "relaxar": 1 } },
        { "texto": "Sentir o coração acelerar de novo", "pesos": { "aventura": 1 } },
        { "texto": "Sinceramente, um pouco de tudo.", "pesos": { "relaxar": 0.5, "aventura": 0.5 } }
      ]
    },
    {
      "texto": "Pensa numa foto que você postaria desse feriado. Ela mostra você:",
      "opcoes": [
        { "texto": "Parada, olhando a paisagem, sem pressa de tirar o celular do bolso", "pesos": { "relaxar": 1 } },
        { "texto": "No meio do movimento: subindo, atravessando, se equilibrando", "pesos": { "aventura": 1 } },
        { "texto": "Nas duas cenas, numa sequência de stories", "pesos": { "relaxar": 0.5, "aventura": 0.5 } }
      ]
    },
    {
      "texto": "Nesse feriado eu pretendo:",
      "opcoes": [
        { "texto": "Viajar só, pra curtir um tempo comigo ou conhecer pessoas novas", "pesos": {} },
        { "texto": "Viajar com meu amor, ter nosso feriado juntos sem preocupações", "pesos": {} },
        { "texto": "Viajar com minha família, onde meus filhos possam aproveitar bastante", "pesos": {} },
        { "texto": "Ainda não decidi quem vem comigo, mas sei que desejo muito viajar", "pesos": {} }
      ]
    },
    {
      "texto": "Se o feriado inteiro tivesse só UM momento de verdade, qual seria:",
      "opcoes": [
        { "texto": "Descansar bem, aproveitar cada segundo relaxando", "pesos": { "relaxar": 1 } },
        { "texto": "Estar em lugares lindos para renovar as energias (e as fotos do Instagram)", "pesos": { "relaxar": 0.5, "aventura": 0.5 } },
        { "texto": "Muita diversão e emoção, me movimentando bastante", "pesos": { "aventura": 1 } }
      ]
    }
  ]$perguntas$::jsonb,
  $resultados$[
    {
      "chave": "relaxar-dominante",
      "eixo": "relaxar",
      "rotulo": "Mais descanso",
      "posicao": 18,
      "foto": null,
      "texto": "Você quer sair da rotina e aproveitar o feriado de verdade, mas sem voltar precisando descansar do feriado. Este é um destino que mistura natureza, descanso e experiências diferentes, com movimento na medida certa."
    },
    {
      "chave": "aventura-dominante",
      "eixo": "aventura",
      "rotulo": "Mais aventura",
      "posicao": 82,
      "foto": null,
      "texto": "Você quer sair da rotina e aproveitar o feriado de verdade, mas sem voltar precisando descansar do feriado. Este é um destino que mistura natureza, descanso e experiências diferentes, com movimento na medida certa."
    },
    {
      "chave": "equilibrio",
      "eixo": null,
      "rotulo": "Descanso e aventura, na mesma medida",
      "posicao": 50,
      "foto": null,
      "texto": "Você quer sair da rotina e aproveitar o feriado de verdade, mas sem voltar precisando descansar do feriado. Este é um destino que mistura natureza, descanso e experiências diferentes, com movimento na medida certa."
    }
  ]$resultados$::jsonb,
  jsonb_build_object(
    'tipo', 'whatsapp',
    'numero', '5586999207088',
    'texto_botao', 'Quero saber mais',
    'molde', 'Oi! Fiz o quiz do feriado e caí em: {{resultado}}'
  )
)
-- Idempotente pelo slug: rodar de novo não duplica nem sobrescreve o que a
-- equipe já tiver ajustado pelo editor.
on conflict (slug) do nothing;

-- NASCE COMO RASCUNHO de propósito. Publicar é decisão de quem toca a campanha
-- — e enquanto /quiz-feriado estiver no ar, dois quizzes publicados dizendo a
-- mesma coisa só confundiriam quem chega pelo anúncio.
