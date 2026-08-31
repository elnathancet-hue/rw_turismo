// Escape de HTML para texto que o cliente escreveu.
//
// O React já escapa tudo que renderiza, então isto NÃO é para a tela. É para os
// lugares onde o próprio servidor monta HTML por concatenação — hoje, o corpo do
// e-mail transacional em lib/server/notifications.ts.
//
// Por que importa: o nome do comprador entra nesse HTML e vem do corpo de
// /api/bookings/create-pending, que é rota pública sem autenticação. Um nome
// como `Ana<a href="https://site-falso">Clique para pagar</a>` saía como link
// clicável num e-mail com o domínio e a marca da agência, assinado por SPF/DKIM
// válidos. Phishing entregue por infraestrutura confiável.

const MAPA: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

/** Escapa `& < > " '` para uso dentro de texto ou atributo HTML. */
export const escaparHtml = (valor: string | null | undefined): string =>
  String(valor ?? "").replace(/[&<>"']/g, (c) => MAPA[c] ?? c);
