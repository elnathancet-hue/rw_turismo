export type FooterLink = { label: string; url: string };
export type FooterColumn = { title: string; links: FooterLink[] };
export type FooterSettings = {
  columns: FooterColumn[];
  copyright?: string;
  cnpj?: string;
};

// Current footer content — used as the fallback when the `footer` site setting
// is empty, and as the starting point in the admin editor.
export const defaultFooter: FooterSettings = {
  columns: [
    {
      title: "RW Turismo",
      links: [
        { label: "Como funciona", url: "/" },
        { label: "Quem somos", url: "/" },
      ],
    },
    {
      title: "Institucional",
      links: [
        { label: "Imprensa e mídia", url: "/" },
        { label: "Parcerias", url: "/" },
        { label: "Relacionamento", url: "/" },
        { label: "Contato", url: "/" },
      ],
    },
    {
      title: "Sua viagem",
      links: [
        { label: "Dicas para viajantes", url: "/blog" },
        { label: "Minhas reservas", url: "/account/bookings" },
      ],
    },
    {
      title: "Suporte",
      links: [
        { label: "Termos e condições", url: "/" },
        { label: "Política de privacidade", url: "/" },
        { label: "Atendimento", url: "/" },
      ],
    },
  ],
  copyright: "© RW Turismo. Todos os direitos reservados.",
};
