import { useEffect, useRef, useState } from "react";
import type { QuoteBookingResult } from "../lib/bookings/quoteBooking";

// Busca o total oficial no servidor enquanto a pessoa escolhe data, quantidade
// e cupom. Antes disso a página multiplicava preço × viajantes no navegador e
// ignorava o cupom, então o cliente só descobria o desconto depois de criar a
// reserva.
//
// Debounce de 400ms para não disparar uma requisição por tecla digitada no
// cupom, e cada busca cancela a anterior — sem isso, uma resposta lenta de uma
// consulta antiga podia sobrescrever o total já correto na tela.

type Params = {
  productId: string;
  productDateId: string;
  travelersCount: number;
  couponCode: string;
};

type State = {
  quote: QuoteBookingResult | null;
  error: string | null;
  isLoading: boolean;
};

const DEBOUNCE_MS = 400;

export const useBookingQuote = ({
  productId,
  productDateId,
  travelersCount,
  couponCode,
}: Params): State => {
  const [state, setState] = useState<State>({
    quote: null,
    error: null,
    isLoading: false,
  });
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!productId || !productDateId || travelersCount <= 0) {
      setState({ quote: null, error: null, isLoading: false });
      return;
    }

    setState((current) => ({ ...current, isLoading: true }));

    const timer = setTimeout(async () => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const response = await fetch("/api/bookings/quote", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            product_id: productId,
            product_date_id: productDateId,
            travelers_count: travelersCount,
            coupon_code: couponCode.trim() || null,
          }),
          signal: controller.signal,
        });
        const data = await response.json();

        if (!response.ok) {
          setState({
            quote: null,
            // 4xx é problema do que a pessoa escolheu (cupom inválido, vagas
            // de menos) e precisa aparecer. 5xx é problema nosso: fica calado e
            // a página segue com o cálculo local — assim o site não exibe
            // alerta vermelho caso o app suba antes da migration da cotação.
            error:
              response.status < 500
                ? data?.error ?? "Não foi possível calcular o valor."
                : null,
            isLoading: false,
          });
          return;
        }

        setState({ quote: data as QuoteBookingResult, error: null, isLoading: false });
      } catch (caught) {
        // Cancelamento é fluxo normal (o usuário continuou digitando), não erro.
        if (caught instanceof DOMException && caught.name === "AbortError") return;
        setState({
          quote: null,
          error: "Não foi possível calcular o valor agora.",
          isLoading: false,
        });
      }
    }, DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [productId, productDateId, travelersCount, couponCode]);

  useEffect(() => () => abortRef.current?.abort(), []);

  return state;
};

export default useBookingQuote;
