// Esquema de URL vindo do banco.
//
// Menu, banner, botão de bloco e vídeo têm a URL gravada por quem edita o site
// (papel `conteudo`). Esse valor chega inteiro no `href` de um `<a>` ou no `src`
// de um `<iframe>` — e o React 18 NÃO bloqueia `javascript:` em href: ele emite
// um aviso no console e renderiza assim mesmo.
//
// O teste que existia espalhado pelos componentes era `url.startsWith("/")`:
// interno vira <Link>, o resto vira <a href={url}>. Quer dizer que tudo que não
// começasse com barra passava — inclusive `javascript:`.
//
// Aqui a regra é lista branca de esquema, num lugar só, para não haver um
// sétimo componente que lembre de metade.

const ESQUEMAS_PERMITIDOS = /^(https?:|mailto:|tel:)/i;

// Tira espaço, tab, quebra de linha e qualquer caractere de controle antes de
// olhar o esquema. Não é preciosismo: o navegador executa uma URL com tab no
// meio de "javascript:", e ela escaparia de uma comparação ingênua com o começo
// da string. Comparar por código evita escrever a faixa de controle no fonte.
const semControle = (url: string): string =>
  Array.from(url)
    .filter((caractere) => caractere.charCodeAt(0) > 0x20)
    .join("");

// Relativo ao site: caminho, âncora ou query. Nunca "//outro-dominio.com", que
// o navegador trata como protocolo-relativo e sai do site.
const eInterno = (url: string): boolean =>
  (url.startsWith("/") && !url.startsWith("//")) ||
  url.startsWith("#") ||
  url.startsWith("?");

/**
 * URL segura para `href`/`src`. Devolve `null` quando o esquema não é aceito —
 * quem chama decide se some com o link ou o troca por um texto sem ação.
 */
export const hrefSeguro = (url: string | null | undefined): string | null => {
  if (!url) return null;

  const limpa = semControle(url);
  if (!limpa) return null;

  if (eInterno(limpa) || ESQUEMAS_PERMITIDOS.test(limpa)) {
    return url.trim();
  }

  return null;
};

/** `true` quando o link aponta para dentro do site (usa <Link> do Next). */
export const eLinkInterno = (url: string | null | undefined): boolean => {
  if (!url) return false;
  return eInterno(semControle(url));
};
