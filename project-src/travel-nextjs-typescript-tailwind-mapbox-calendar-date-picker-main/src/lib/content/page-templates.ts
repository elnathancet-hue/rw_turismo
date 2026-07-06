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
