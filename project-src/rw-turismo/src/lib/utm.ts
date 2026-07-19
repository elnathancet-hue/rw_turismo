// Captura de UTM (primeiro toque): guarda no navegador para que ações
// posteriores (lista de espera, formulários) saibam de qual campanha o
// visitante veio.
const STORAGE_KEY = "rw:utm";
const UTM_KEYS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
];

export const captureUtmFromUrl = (): void => {
  if (typeof window === "undefined") return;
  try {
    const params = new URLSearchParams(window.location.search);
    const utm: Record<string, string> = {};
    for (const key of UTM_KEYS) {
      const value = params.get(key);
      if (value) utm[key] = value;
    }
    if (Object.keys(utm).length === 0) return;
    // Primeiro toque vence: não sobrescreve a campanha original.
    if (!window.localStorage.getItem(STORAGE_KEY)) {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(utm));
    }
  } catch {
    // storage indisponível — ignora
  }
};

export const getStoredUtm = (): Record<string, string> => {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
};
