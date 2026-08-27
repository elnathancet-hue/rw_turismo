// Google Analytics 4 (GA4). Ativa somente quando NEXT_PUBLIC_GA_ID está
// definido — sem o ID, tudo vira no-op (seguro deployar sem configurar).
// Para trocar o ID sem redeploy seria preciso guardar em site_settings; por
// ora é env (o Measurement Id costuma ser definido uma vez).
export const GA_ID = process.env.NEXT_PUBLIC_GA_ID ?? "";

const hasGtag = (): boolean =>
  Boolean(GA_ID) &&
  typeof window !== "undefined" &&
  typeof (window as unknown as { gtag?: unknown }).gtag === "function";

// Endereço da página SEM query string.
//
// A tela da reserva do convidado recebe ?t=<token de 48 caracteres>, e o GA4
// monta page_location a partir de document.location.href sozinho — mandar só
// page_path não adianta, porque page_path é campo legado do Universal
// Analytics. Sem sobrescrever page_location, o token do cliente ia parar na
// dimensão "Caminho da página e string de consulta", no BigQuery e na tela de
// quem tem acesso ao painel. Quem lesse abriria a reserva alheia.
const semQueryString = (url: string): string => {
  const caminho = url.split("?")[0]?.split("#")[0] ?? "/";
  const origem = typeof window !== "undefined" ? window.location.origin : "";
  return `${origem}${caminho}`;
};

export const pageview = (url: string) => {
  if (!hasGtag()) return;
  (window as unknown as { gtag: (...args: unknown[]) => void }).gtag(
    "config",
    GA_ID,
    {
      page_location: semQueryString(url),
      page_path: url.split("?")[0],
    }
  );
};

export const gaEvent = (
  name: string,
  params: Record<string, unknown> = {}
) => {
  if (!hasGtag()) return;
  (window as unknown as { gtag: (...args: unknown[]) => void }).gtag(
    "event",
    name,
    params
  );
};
