import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { useState } from "react";
import Footer from "../../components/Footer";
import { submitSurveyResponse } from "../../lib/surveys/client";

// Pesquisa pós-viagem (NPS 0–10). O link chega por WhatsApp/e-mail com o id
// da reserva; uma resposta por reserva.
const AvaliarViagem = () => {
  const router = useRouter();
  const bookingId =
    typeof router.query.bookingId === "string" ? router.query.bookingId : "";
  const [rating, setRating] = useState<number | null>(null);
  const [comment, setComment] = useState("");
  const [status, setStatus] = useState<
    "idle" | "sending" | "done" | "duplicate" | "error"
  >("idle");

  const submit = async () => {
    if (rating === null || !bookingId) return;
    setStatus("sending");
    try {
      const result = await submitSurveyResponse(bookingId, rating, comment);
      setStatus(result === "duplicate" ? "duplicate" : "done");
    } catch {
      setStatus("error");
    }
  };

  return (
    <>
      <Head>
        <title>Avalie sua viagem | RW Turismo</title>
        <meta content="noindex" name="robots" />
      </Head>
      <header className="border-b">
        <div className="mx-auto flex max-w-5xl justify-between px-6 py-5">
          <Link className="font-bold text-orange-600" href="/">
            RW Turismo
          </Link>
          <Link className="font-semibold text-orange-600" href="/#pacotes">
            Ver pacotes
          </Link>
        </div>
      </header>
      <main className="mx-auto min-h-[60vh] max-w-xl px-6 py-12">
        {status === "done" || status === "duplicate" ? (
          <div className="rounded-2xl border bg-white p-8 text-center shadow-sm">
            <p className="text-4xl">💛</p>
            <h1 className="mt-3 text-2xl font-bold">
              {status === "duplicate"
                ? "Você já avaliou esta viagem"
                : "Obrigado pela avaliação!"}
            </h1>
            <p className="mt-2 text-gray-600">
              Sua opinião ajuda a gente a criar viagens cada vez melhores.
            </p>
            <Link
              className="mt-6 inline-flex rounded-lg bg-orange-500 px-6 py-2.5 font-semibold text-white hover:bg-orange-600"
              href="/#pacotes"
            >
              Ver próximas viagens
            </Link>
          </div>
        ) : (
          <div className="rounded-2xl border bg-white p-8 shadow-sm">
            <h1 className="text-2xl font-bold">Como foi a sua viagem?</h1>
            <p className="mt-2 text-gray-600">
              De 0 a 10, o quanto você recomendaria a RW Turismo para um amigo?
            </p>

            <div className="mt-6 grid grid-cols-6 gap-2 sm:grid-cols-11">
              {Array.from({ length: 11 }).map((_, value) => (
                <button
                  className={`h-11 rounded-lg border text-sm font-bold transition ${
                    rating === value
                      ? "border-orange-500 bg-orange-500 text-white"
                      : "bg-white text-gray-700 hover:border-orange-300"
                  }`}
                  key={value}
                  onClick={() => setRating(value)}
                  type="button"
                >
                  {value}
                </button>
              ))}
            </div>
            <div className="mt-1 flex justify-between text-xs text-gray-400">
              <span>Não recomendaria</span>
              <span>Com certeza!</span>
            </div>

            <label className="mt-6 block text-sm font-medium text-gray-700">
              Conte pra gente (opcional)
              <textarea
                className="mt-1 min-h-[100px] w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-orange-500"
                onChange={(event) => setComment(event.target.value)}
                placeholder="O que foi incrível? O que podemos melhorar?"
                value={comment}
              />
            </label>

            {status === "error" && (
              <p
                className="mt-4 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700"
                role="alert"
              >
                Não foi possível enviar. Confira o link ou tente novamente.
              </p>
            )}

            <button
              className="mt-5 w-full rounded-lg bg-orange-500 px-6 py-3 font-semibold text-white transition hover:bg-orange-600 disabled:opacity-50"
              disabled={rating === null || status === "sending"}
              onClick={submit}
              type="button"
            >
              {status === "sending" ? "Enviando…" : "Enviar avaliação"}
            </button>
          </div>
        )}
      </main>
      <Footer />
    </>
  );
};

export default AvaliarViagem;
