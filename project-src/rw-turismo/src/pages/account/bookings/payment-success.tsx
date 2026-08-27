import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useRef, useState } from "react";
import BookingSummaryCard from "../../../components/BookingSummaryCard";
import Drawer from "../../../components/Drawer";
import Footer from "../../../components/Footer";
import Header from "../../../components/Header";
import useSupabaseSession from "../../../hooks/useSupabaseSession";
import { gaEvent } from "../../../lib/analytics/gtag";
import {
  getCustomerBookingState,
  isAwaitingAsyncPayment,
  isProcessingPayment,
} from "../../../lib/bookings/status";
import { formatDateTimeBR } from "../../../lib/format";
import type { BookingSummary } from "../../../lib/bookings/types";
import {
  fetchBookingForViewer,
  withAccessToken,
} from "../../../lib/bookings/viewerAccess";

const PaymentSuccess = () => {
  const router = useRouter();
  const bookingId =
    typeof router.query.booking_id === "string" ? router.query.booking_id : "";
  // Token da compra sem cadastro. A Stripe devolve na URL de retorno o mesmo
  // token que a pessoa tinha antes de sair — é o que evita mandar quem acabou
  // de pagar para uma tela de login.
  const accessToken = typeof router.query.t === "string" ? router.query.t : "";
  const { isAuthenticated, isLoading } = useSupabaseSession();
  const [booking, setBooking] = useState<BookingSummary | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">(
    "loading"
  );
  const [isOpen, setIsOpen] = useState(false);
  const [headerSearch, setHeaderSearch] = useState("");
  const purchaseFired = useRef(false);

  const loadBooking = () => {
    if (!bookingId) {
      setStatus("error");
      return;
    }
    setStatus("loading");
    fetchBookingForViewer(bookingId, { isAuthenticated, accessToken })
      .then((data) => {
        setBooking(data?.booking ?? null);
        setStatus(data ? "ready" : "error");
      })
      .catch(() => setStatus("error"));
  };

  useEffect(() => {
    if (isLoading) return;
    // Só manda para o login quem não tem NENHUMA das duas provas de posse.
    if (!isAuthenticated && !accessToken) {
      router.push(`/signin?next=${encodeURIComponent(router.asPath)}`);
      return;
    }
    loadBooking();
  }, [accessToken, isAuthenticated, isLoading, bookingId]);

  // The payment confirmation can lag a few seconds — refresh while processing.
  useEffect(() => {
    if (!booking || !isProcessingPayment(booking)) return;
    // Pix pode levar minutos: recarrega mais devagar para não martelar o banco
    // durante uma espera longa.
    const intervalo = isAwaitingAsyncPayment(booking) ? 15000 : 5000;
    const timer = setInterval(() => {
      fetchBookingForViewer(booking.id, { isAuthenticated, accessToken })
        .then((data) => data && setBooking(data.booking))
        .catch(() => {});
    }, intervalo);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [booking]);

  // GA4: purchase — dispara uma vez, quando o pagamento consta como pago.
  useEffect(() => {
    if (!booking || booking.payment_status !== "paid" || purchaseFired.current) {
      return;
    }
    purchaseFired.current = true;
    gaEvent("purchase", {
      transaction_id: booking.id,
      currency: "BRL",
      value: Number(booking.total_amount),
      items: [
        {
          item_id: booking.product_id,
          item_name: booking.products?.title,
          quantity: booking.travelers_count,
        },
      ],
    });
  }, [booking]);

  // O título tem que sair do estado, não da rota.
  //
  // Esta é a tela de retorno da Stripe — e com Pix o cliente chega aqui SEM ter
  // pagado, só com o código na mão. Um "Recebemos seu pagamento" fixo faz a
  // pessoa fechar a página achando que terminou: ela não paga, a reserva
  // expira, a agência perde a venda e ainda ouve a reclamação de quem "já tinha
  // pago". As telas irmãs já acertam nisso.
  const titulo = !booking
    ? {
        principal: "Sua reserva",
        apoio: "Estamos carregando os detalhes.",
      }
    : booking.payment_status === "paid"
      ? {
          principal: "Recebemos seu pagamento",
          apoio: "Obrigado! Aqui estão os detalhes da sua reserva.",
        }
      : isAwaitingAsyncPayment(booking)
        ? {
            principal: "Falta só o pagamento do Pix",
            apoio: booking.expires_at
              ? `Seu código vale até ${formatDateTimeBR(
                  booking.expires_at
                )}. A vaga fica separada até lá.`
              : "Seu código Pix ainda não foi pago.",
          }
        : {
            principal: "Sua reserva",
            apoio: getCustomerBookingState(booking).description,
          };

  return (
    <div>
      <Header
        isOpen={isOpen}
        searchInput={headerSearch}
        setIsOpen={setIsOpen}
        setSearchInput={setHeaderSearch}
      />
      <main className="mx-auto min-h-[70vh] max-w-3xl px-6 py-10">
        <h1 className="text-3xl font-semibold">{titulo.principal}</h1>
        <p className="mt-2 text-gray-600">{titulo.apoio}</p>

        {status === "loading" && (
          <p className="mt-8 text-gray-500">Carregando sua reserva…</p>
        )}

        {status === "error" && (
          <div className="mt-8 rounded-lg border bg-white p-6">
            <p className="text-gray-700">
              Não conseguimos carregar os detalhes agora.
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <button
                className="rounded bg-orange-600 px-5 py-2 font-semibold text-white hover:bg-orange-700"
                onClick={loadBooking}
                type="button"
              >
                Tentar novamente
              </button>
              <Link
                className="rounded border px-5 py-2 font-semibold hover:bg-gray-50"
                href="/account/bookings"
              >
                Minhas reservas
              </Link>
            </div>
          </div>
        )}

        {status === "ready" && booking && (
          <div className="mt-8">
            <BookingSummaryCard booking={booking}>
              <div className="flex flex-wrap gap-3">
                <Link
                  className="rounded bg-orange-600 px-5 py-2 font-semibold text-white hover:bg-orange-700"
                  href={withAccessToken(
                    `/account/bookings/${booking.id}`,
                    accessToken
                  )}
                >
                  Ver reserva
                </Link>
                {/* "Minhas reservas" exige sessão. Oferecer isso a quem comprou
                    sem cadastro é oferecer um caminho para a tela de login. */}
                {isAuthenticated && (
                  <Link
                    className="rounded border px-5 py-2 font-semibold hover:bg-gray-50"
                    href="/account/bookings"
                  >
                    Minhas reservas
                  </Link>
                )}
                {isProcessingPayment(booking) && (
                  <button
                    className="rounded border px-5 py-2 font-semibold hover:bg-gray-50"
                    onClick={loadBooking}
                    type="button"
                  >
                    Atualizar status
                  </button>
                )}
              </div>
            </BookingSummaryCard>
          </div>
        )}
      </main>
      <Footer />
      <Drawer isOpen={isOpen} setIsOpen={setIsOpen}>
        <p className="drawer-item">
          <Link href="/favorites">Meus favoritos</Link>
        </p>
        <p className="drawer-current-item">Minhas reservas</p>
      </Drawer>
    </div>
  );
};

export default PaymentSuccess;
