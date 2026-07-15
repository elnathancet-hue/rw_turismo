import { useEffect, useState } from "react";
import {
  defaultWhatsAppWidget,
  getWhatsAppWidget,
  type WhatsAppWidget,
} from "../lib/content/whatsapp";

// Cache de módulo: o site inteiro busca a config uma vez por sessão.
let cached: WhatsAppWidget | null = null;
let pending: Promise<WhatsAppWidget> | null = null;

const fetchOnce = (): Promise<WhatsAppWidget> => {
  if (cached) return Promise.resolve(cached);
  if (!pending) {
    pending = getWhatsAppWidget()
      .then((widget) => {
        cached = widget;
        return widget;
      })
      .catch(() => defaultWhatsAppWidget);
  }
  return pending;
};

const useWhatsAppWidget = (): WhatsAppWidget => {
  const [widget, setWidget] = useState<WhatsAppWidget>(
    cached ?? defaultWhatsAppWidget
  );

  useEffect(() => {
    let active = true;
    void fetchOnce().then((value) => {
      if (active) setWidget(value);
    });
    return () => {
      active = false;
    };
  }, []);

  return widget;
};

export default useWhatsAppWidget;
