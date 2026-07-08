export type FooterLink = { label: string; url: string };
export type FooterColumn = { title: string; links: FooterLink[] };
export type FooterSettings = {
  columns: FooterColumn[];
  copyright?: string;
  cnpj?: string;
};

// Current footer content — used as the fallback when the `footer` site setting
// is empty, and as the starting point in the admin editor. Every link points
// to a page that exists (the CMS pages come from supabase/seed.sql).
export const defaultFooter: FooterSettings = {
  columns: [
    {
      title: "RW Turismo",
      links: [
        { label: "Como funciona", url: "/paginas/como-funciona" },
        { label: "Quem somos", url: "/paginas/quem-somos" },
      ],
    },
    {
      title: "Sua viagem",
      links: [
        { label: "Ver pacotes", url: "/search" },
        { label: "Dicas para viajantes", url: "/blog" },
        { label: "Minhas reservas", url: "/account/bookings" },
      ],
    },
    {
      title: "Suporte",
      links: [
        { label: "Contato e atendimento", url: "/paginas/contato" },
        { label: "Termos e condições", url: "/paginas/termos" },
        { label: "Política de privacidade", url: "/paginas/privacidade" },
      ],
    },
  ],
  copyright: "© RW Turismo. Todos os direitos reservados.",
};
