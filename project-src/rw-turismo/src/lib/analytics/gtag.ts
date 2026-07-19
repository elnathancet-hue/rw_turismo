// Google Analytics 4 (GA4). Ativa somente quando NEXT_PUBLIC_GA_ID está
// definido — sem o ID, tudo vira no-op (seguro deployar sem configurar).
// Para trocar o ID sem redeploy seria preciso guardar em site_settings; por
// ora é env (o Measurement Id costuma ser definido uma vez).
export const GA_ID = process.env.NEXT_PUBLIC_GA_ID ?? "";

const hasGtag = (): boolean =>
  Boolean(GA_ID) &&
  typeof window !== "undefined" &&
  typeof (window as unknown as { gtag?: unknown }).gtag === "function";

export const pageview = (url: string) => {
  if (!hasGtag()) return;
  (window as unknown as { gtag: (...args: unknown[]) => void }).gtag(
    "config",
    GA_ID,
    { page_path: url }
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
