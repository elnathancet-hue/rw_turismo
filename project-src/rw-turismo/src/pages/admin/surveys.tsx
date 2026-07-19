import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import AdminGuard from "../../components/admin/AdminGuard";
import AdminLayout from "../../components/admin/AdminLayout";
import AdminListState from "../../components/admin/AdminListState";
import Card from "../../components/ui/Card";
import {
  listSurveyResponses,
  updateSurveyResponse,
  type SurveyResponse,
} from "../../lib/admin/client";
import { formatDateTimeBR } from "../../lib/format";

// NPS: 9-10 promotor · 7-8 neutro · 0-6 detrator.
const classify = (rating: number) =>
  rating >= 9 ? "promoter" : rating >= 7 ? "neutral" : "detractor";

const ratingBadge = (rating: number) => {
  const kind = classify(rating);
  return kind === "promoter"
    ? "bg-green-100 text-green-800 border-green-200"
    : kind === "neutral"
      ? "bg-amber-100 text-amber-800 border-amber-200"
      : "bg-red-100 text-red-800 border-red-200";
};

const AdminSurveys = () => {
  const [responses, setResponses] = useState<SurveyResponse[]>([]);
  const [loadStatus, setLoadStatus] = useState<"loading" | "ready" | "error">(
    "loading"
  );
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [nameDrafts, setNameDrafts] = useState<Record<string, string>>({});

  const load = async () => {
    setLoadStatus("loading");
    setError(null);
    try {
      setResponses(await listSurveyResponses());
      setLoadStatus("ready");
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Não foi possível carregar as avaliações. A migration da Semana 3 já rodou?"
      );
      setLoadStatus("error");
    }
  };

  const approve = async (response: SurveyResponse, approved: boolean) => {
    setBusyId(response.id);
    setError(null);
    try {
      const display_name = approved
        ? nameDrafts[response.id] ??
          response.display_name ??
          response.bookings?.customer_name?.split(" ")[0] ??
          null
        : response.display_name;
      await updateSurveyResponse(response.id, { approved, display_name });
      await load();
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Não foi possível atualizar."
      );
    } finally {
      setBusyId(null);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const stats = useMemo(() => {
    const total = responses.length;
    if (total === 0) return null;
    const promoters = responses.filter(
      (r) => classify(r.rating) === "promoter"
    ).length;
    const neutrals = responses.filter(
      (r) => classify(r.rating) === "neutral"
    ).length;
    const detractors = total - promoters - neutrals;
    const nps = Math.round(((promoters - detractors) / total) * 100);
    const average =
      responses.reduce((sum, r) => sum + r.rating, 0) / total;
    return { total, promoters, neutrals, detractors, nps, average };
  }, [responses]);

  return (
    <AdminGuard>
      <AdminLayout
        title="Avaliações"
        description="Pesquisa de satisfação pós-viagem — o link vai automaticamente no dia seguinte ao retorno."
      >
        {stats && (
          <section className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <Card className="p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                NPS
              </p>
              <p
                className={`mt-1 text-3xl font-bold ${
                  stats.nps >= 50
                    ? "text-green-700"
                    : stats.nps >= 0
                      ? "text-amber-700"
                      : "text-red-600"
                }`}
              >
                {stats.nps}
              </p>
              <p className="mt-0.5 text-xs text-gray-500">
                % promotores − % detratores
              </p>
            </Card>
            <Card className="p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                Nota média
              </p>
              <p className="mt-1 text-3xl font-bold">
                {stats.average.toFixed(1)}
              </p>
              <p className="mt-0.5 text-xs text-gray-500">
                {stats.total} {stats.total === 1 ? "resposta" : "respostas"}
              </p>
            </Card>
            <Card className="p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                Promotores (9–10)
              </p>
              <p className="mt-1 text-3xl font-bold text-green-700">
                {stats.promoters}
              </p>
            </Card>
            <Card className="p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                Detratores (0–6)
              </p>
              <p className="mt-1 text-3xl font-bold text-red-600">
                {stats.detractors}
              </p>
            </Card>
          </section>
        )}

        <AdminListState
          emptyHint="As respostas chegam pelo link enviado no pós-viagem (WhatsApp/e-mail)."
          emptyTitle="Nenhuma avaliação ainda"
          error={error}
          isEmpty={responses.length === 0}
          onRetry={load}
          status={loadStatus}
        >
          <div className="space-y-2">
            {responses.map((response) => (
              <Card className="p-4" key={response.id}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`inline-flex h-8 w-8 items-center justify-center rounded-full border text-sm font-bold ${ratingBadge(response.rating)}`}
                      >
                        {response.rating}
                      </span>
                      <p className="font-medium">
                        {response.bookings?.customer_name ?? "Cliente"}
                      </p>
                      <p className="text-xs text-gray-500">
                        {response.bookings?.products?.title ?? ""}
                      </p>
                    </div>
                    {response.comment && (
                      <p className="mt-2 whitespace-pre-wrap text-sm text-gray-700">
                        “{response.comment}”
                      </p>
                    )}
                  </div>
                  <div className="shrink-0 text-right text-xs text-gray-400">
                    <p>{formatDateTimeBR(response.created_at)}</p>
                    <Link
                      className="mt-1 inline-block font-semibold text-orange-600 hover:text-orange-700"
                      href={`/admin/bookings/${response.booking_id}`}
                    >
                      Ver reserva →
                    </Link>
                  </div>
                </div>
                {classify(response.rating) === "promoter" &&
                  response.comment && (
                    <div className="mt-3 flex flex-wrap items-center gap-2 border-t pt-3">
                      {response.approved ? (
                        <>
                          <span className="rounded bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-700">
                            No site ✓
                          </span>
                          <span className="text-xs text-gray-500">
                            exibido como “{response.display_name ?? "—"}”
                          </span>
                          <button
                            className="text-xs font-semibold text-gray-600 underline disabled:opacity-50"
                            disabled={busyId === response.id}
                            onClick={() => approve(response, false)}
                            type="button"
                          >
                            Remover do site
                          </button>
                        </>
                      ) : (
                        <>
                          <input
                            className="rounded border px-2 py-1 text-sm"
                            onChange={(event) =>
                              setNameDrafts((drafts) => ({
                                ...drafts,
                                [response.id]: event.target.value,
                              }))
                            }
                            placeholder={
                              response.bookings?.customer_name?.split(" ")[0] ??
                              "Nome público"
                            }
                            value={
                              nameDrafts[response.id] ??
                              response.display_name ??
                              ""
                            }
                          />
                          <button
                            className="rounded bg-orange-500 px-3 py-1 text-xs font-semibold text-white hover:bg-orange-600 disabled:opacity-60"
                            disabled={busyId === response.id}
                            onClick={() => approve(response, true)}
                            type="button"
                          >
                            Aprovar para o site
                          </button>
                        </>
                      )}
                    </div>
                  )}
              </Card>
            ))}
          </div>
        </AdminListState>
      </AdminLayout>
    </AdminGuard>
  );
};

export default AdminSurveys;
