import type { PageBlock } from "./types";

const bid = () =>
  `b_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

export type PageTemplate = {
  key: string;
  label: string;
  description: string;
  build: () => PageBlock[];
};

// Pre-built page layouts. Each returns fresh blocks (new ids) with pt-BR
// placeholder content, so the admin only swaps text and photos.
export const pageTemplates: PageTemplate[] = [
  {
    key: "blank",
    label: "Em branco",
    description: "Começar do zero, adicionando os blocos.",
    build: () => [],
  },
  {
    key: "landing",
    label: "Landing de captação",
    description: "Banner + texto + galeria + FAQ + chamada. Ideal para anúncios.",
    build: () => [
      {
        id: bid(),
        type: "banner",
        image: "",
        title: "Sua próxima viagem começa aqui",
        subtitle: "Pacotes e experiências escolhidos para você.",
        button_label: "Quero saber mais",
        button_url: "/#pacotes",
      },
      {
        id: bid(),
        type: "text",
        markdown:
          "## Por que viajar com a RW Turismo\n\nDescreva aqui os diferenciais: roteiro, hospedagem, o que está incluído e por que essa viagem é especial.",
      },
      {
        id: bid(),
        type: "gallery",
        images: [
          { url: "", alt: "" },
          { url: "", alt: "" },
          { url: "", alt: "" },
        ],
      },
      {
        id: bid(),
        type: "faq",
        items: [
          { question: "O que está incluído?", answer: "Descreva o que o pacote inclui." },
          { question: "Como faço a reserva?", answer: "Explique o passo a passo." },
        ],
      },
      {
        id: bid(),
        type: "cta",
        title: "Pronto para embarcar?",
        text: "Fale com a nossa equipe e garanta a sua vaga.",
        button_label: "Ver pacotes",
        button_url: "/#pacotes",
      },
    ],
  },
  {
    key: "package",
    label: "Página de pacote",
    description: "Hero + roteiro + fotos + depoimento + incluído + FAQ + reservar.",
    build: () => [
      {
        id: bid(),
        type: "banner",
        image: "",
        title: "Nome do destino",
        subtitle: "X dias · saída de Teresina",
        button_label: "Reservar",
        button_url: "/#pacotes",
      },
      {
        id: bid(),
        type: "text",
        markdown:
          "## O roteiro\n\n**Dia 1** — chegada e city tour.\n\n**Dia 2** — passeio principal.\n\n**Dia 3** — dia livre e retorno.",
      },
      {
        id: bid(),
        type: "gallery",
        images: [
          { url: "", alt: "" },
          { url: "", alt: "" },
          { url: "", alt: "" },
        ],
      },
      {
        id: bid(),
        type: "quote",
        text: "Melhor viagem que já fiz! Organização impecável do começo ao fim.",
        author: "Cliente satisfeito",
      },
      {
        id: bid(),
        type: "text",
        markdown:
          "## O que está incluído\n\n- Hospedagem\n- Traslados\n- Passeios guiados\n- Seguro viagem",
      },
      {
        id: bid(),
        type: "faq",
        items: [
          {
            question: "Qual a política de cancelamento?",
            answer: "Explique as regras de cancelamento e remarcação.",
          },
          { question: "Preciso de documentos?", answer: "Liste os documentos necessários." },
        ],
      },
      {
        id: bid(),
        type: "cta",
        title: "Garanta a sua vaga",
        text: "As vagas são limitadas por data de saída.",
        button_label: "Reservar agora",
        button_url: "/#pacotes",
      },
    ],
  },
  {
    key: "como-funciona",
    label: "Como funciona",
    description: "Passo a passo de como comprar + FAQ + chamada.",
    build: () => [
      {
        id: bid(),
        type: "banner",
        image: "",
        title: "Como funciona a RW Turismo",
        subtitle: "Da escolha do destino ao embarque: viajar com a gente é simples.",
        button_label: "Ver pacotes",
        button_url: "/#pacotes",
      },
      {
        id: bid(),
        type: "text",
        markdown:
          "## Sua viagem em 4 passos\n\n**1. Escolha o destino** — explore os pacotes e experiências no site e compare datas e valores.\n\n**2. Reserve online** — selecione a data de saída, informe os viajantes e finalize o pagamento com segurança.\n\n**3. Receba a confirmação** — enviamos a confirmação e todas as orientações da viagem por e-mail e WhatsApp.\n\n**4. Boa viagem!** — nossa equipe acompanha você antes e durante a viagem, do embarque ao retorno.",
      },
      {
        id: bid(),
        type: "quote",
        text: "Reservei em poucos minutos e tive atendimento pelo WhatsApp até o dia do embarque.",
        author: "Cliente RW Turismo",
      },
      {
        id: bid(),
        type: "faq",
        items: [
          {
            question: "Posso parcelar a viagem?",
            answer: "Explique aqui as formas e condições de pagamento aceitas.",
          },
          {
            question: "E se eu precisar remarcar?",
            answer:
              "Explique a política de remarcação e o prazo para solicitar. Detalhes completos ficam nos Termos e condições.",
          },
          {
            question: "Como acompanho a minha reserva?",
            answer:
              "Depois de entrar na sua conta, acesse Minhas reservas para ver status, pagamentos e documentos.",
          },
        ],
      },
      {
        id: bid(),
        type: "cta",
        title: "Pronto para escolher o destino?",
        text: "Explore os pacotes ou fale com a nossa equipe para montar a viagem ideal.",
        button_label: "Ver pacotes",
        button_url: "/#pacotes",
      },
    ],
  },
  {
    key: "contato",
    label: "Contato e atendimento",
    description: "Canais de contato + horários + FAQ + WhatsApp.",
    build: () => [
      {
        id: bid(),
        type: "banner",
        image: "",
        title: "Fale com a gente",
        subtitle: "Atendimento humano, do orçamento ao pós-viagem.",
        button_label: "",
        button_url: "",
      },
      {
        id: bid(),
        type: "text",
        markdown:
          "## Canais de atendimento\n\n**WhatsApp** — (00) 00000-0000 · resposta rápida em horário comercial.\n\n**E-mail** — contato@rwturismo.com.br\n\n**Instagram** — @rwturismo\n\n**Horário de atendimento** — segunda a sexta, das 9h às 18h. Sábado, das 9h às 12h.\n\n> Substitua os contatos acima pelos canais reais da agência.",
      },
      {
        id: bid(),
        type: "faq",
        items: [
          {
            question: "Qual o prazo de resposta?",
            answer:
              "Em horário comercial, respondemos em poucas horas. Fora dele, retornamos no próximo dia útil.",
          },
          {
            question: "Como acompanho a minha reserva?",
            answer:
              "Acesse Minhas reservas com o e-mail usado na compra para ver status e pagamentos.",
          },
          {
            question: "Vocês montam roteiros sob medida?",
            answer:
              "Conte o que você procura (destino, datas, orçamento) e a equipe monta uma proposta.",
          },
        ],
      },
      {
        id: bid(),
        type: "cta",
        title: "Prefere conversar agora?",
        text: "Chame no WhatsApp e fale direto com um consultor de viagens.",
        button_label: "Chamar no WhatsApp",
        button_url: "https://wa.me/5500000000000",
      },
    ],
  },
  {
    key: "termos",
    label: "Termos e condições",
    description: "Estrutura jurídica pronta para adaptar (reservas, cancelamento).",
    build: () => [
      {
        id: bid(),
        type: "text",
        markdown:
          "_Última atualização: [dia/mês/ano]_\n\n## 1. Sobre estes termos\n\nEstes termos regulam a compra de pacotes, hospedagens e experiências oferecidos pela [razão social da agência], CNPJ [número], com sede em [cidade/UF]. Ao concluir uma reserva, o viajante declara ter lido e aceito estas condições.\n\n## 2. Reservas e pagamentos\n\n- A reserva é confirmada após a aprovação do pagamento.\n- Os valores exibidos são por pessoa, salvo indicação em contrário.\n- Formas de pagamento aceitas: [cartão, Pix, boleto — adapte].\n\n## 3. Cancelamento e remarcação\n\n- Cancelamento pelo viajante: [regras e prazos — ex.: reembolso integral até X dias antes da saída].\n- Remarcação: [regras — ex.: sem custo até X dias antes, sujeita a disponibilidade].\n- Cancelamento pela agência (clima, força maior, grupo mínimo): reembolso integral ou remarcação sem custo.\n\n## 4. Responsabilidades do viajante\n\n- Apresentar documento de identificação válido no embarque.\n- Verificar requisitos de saúde e documentação do destino.\n- Chegar ao ponto de embarque no horário informado.\n\n## 5. Responsabilidades da agência\n\n- Prestar os serviços descritos na página do pacote.\n- Comunicar com antecedência qualquer alteração de roteiro.\n- Oferecer suporte durante toda a viagem.\n\n## 6. Contato\n\nDúvidas sobre estes termos? Fale com a gente pela [página de contato](/paginas/contato).",
      },
      {
        id: bid(),
        type: "cta",
        title: "Ficou com alguma dúvida?",
        text: "Fale com a nossa equipe antes de concluir a reserva.",
        button_label: "Falar com a equipe",
        button_url: "/paginas/contato",
      },
    ],
  },
  {
    key: "privacidade",
    label: "Política de privacidade",
    description: "Estrutura LGPD pronta para adaptar (dados, cookies, direitos).",
    build: () => [
      {
        id: bid(),
        type: "text",
        markdown:
          "_Última atualização: [dia/mês/ano]_\n\n## 1. Quais dados coletamos\n\n- **Dados de cadastro** — nome, e-mail e telefone informados ao criar conta ou reservar.\n- **Dados da reserva** — viajantes, documento, datas e pacote escolhido.\n- **Dados de navegação** — cookies e estatísticas de uso do site.\n\n## 2. Como usamos os dados\n\n- Processar reservas e pagamentos.\n- Enviar confirmações e orientações da viagem.\n- Divulgar ofertas, apenas com o seu consentimento.\n\n## 3. Com quem compartilhamos\n\nCompartilhamos dados apenas com parceiros necessários à operação da viagem (hotéis, transportadoras, meios de pagamento) e quando exigido por lei. Não vendemos dados pessoais.\n\n## 4. Seus direitos (LGPD)\n\nVocê pode solicitar a qualquer momento: acesso aos seus dados, correção, exclusão e revogação de consentimento. Basta falar com o nosso atendimento.\n\n## 5. Cookies\n\nUsamos cookies para manter a sessão e entender como o site é usado. Você pode limpá-los ou bloqueá-los no navegador.\n\n## 6. Encarregado de dados\n\nResponsável: [nome do responsável] — [e-mail de contato]. Atualize esta seção com os dados reais da agência.",
      },
      {
        id: bid(),
        type: "cta",
        title: "Dúvidas sobre seus dados?",
        text: "Fale com o nosso atendimento e responderemos o quanto antes.",
        button_label: "Falar com a equipe",
        button_url: "/paginas/contato",
      },
    ],
  },
  {
    key: "about",
    label: "Sobre nós",
    description: "Banner + história + foto + missão + chamada.",
    build: () => [
      {
        id: bid(),
        type: "banner",
        image: "",
        title: "Sobre a RW Turismo",
        subtitle: "Nossa história e o que nos move.",
        button_label: "",
        button_url: "",
      },
      {
        id: bid(),
        type: "text",
        markdown:
          "## Nossa história\n\nConte como a RW Turismo começou, o que mudou ao longo do tempo e onde vocês querem chegar.",
      },
      {
        id: bid(),
        type: "image",
        url: "",
        alt: "Equipe RW Turismo",
        caption: "Nossa equipe",
      },
      {
        id: bid(),
        type: "quote",
        text: "Nossa missão é levar você aos destinos dos seus sonhos com segurança e cuidado.",
        author: "Equipe RW Turismo",
      },
      {
        id: bid(),
        type: "cta",
        title: "Vamos viajar juntos?",
        text: "Conheça os nossos pacotes e escolha o seu próximo destino.",
        button_label: "Ver pacotes",
        button_url: "/#pacotes",
      },
    ],
  },
];
