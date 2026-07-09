import Link from "next/link";
import { useEffect, useState } from "react";
import AdminGuard from "../../../components/admin/AdminGuard";
import AdminLayout from "../../../components/admin/AdminLayout";
import AdminListState from "../../../components/admin/AdminListState";
import {
  getDepartureBookingTotals,
  listAdminDepartures,
  type AdminDeparture,
} from "../../../lib/admin/client";
import { formatDateRangeBR } from "../../../lib/format";

const AdminDepartures = () => {
  const [departures, setDepartures] = useState<AdminDeparture[]>([]);
  const [totals, setTotals] = useState<Record<string, number>>({});
  const [includePast, setIncludePast] = useState(false);
  const [loadStatus, setLoadStatus] = useState<"loading" | "ready" | "error">(
    "loading"
  );
  const [error, setError] = useState<string | null>(null);

  const load = async (showPast: boolean) => {
    setLoadStatus("loading");
    setError(null);
    try {
      const [dates, bookingTotals] = await Promise.all([
        listAdminDepartures(showPast),
        getDepartureBookingTotals(),
      ]);
      setDepartures(dates);
      setTotals(bookingTotals);
      setLoadStatus("ready");
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Não foi possível carregar as saídas."
      );
      setLoadStatus("error");
    }
  };

  useEffect(() => {
    void load(includePast);
  }, [includePast]);

  return (
    <AdminGuard>
      <AdminLayout
        title="Saídas"
        description="O dia da viagem: check-in, assentos, quartos e transfers de cada turma. (Para criar turmas, use Catálogo → Datas de saída.)"
      >
        <label className="mb-4 flex w-fit items-center gap-2 text-sm text-gray-600">
          <input
            checked={includePast}
            onChange={(event) => setIncludePast(event.target.checked)}
            type="checkbox"
          />
          Mostrar saídas passadas
        </label>

        <AdminListState
          emptyHint="Cadastre datas de saída em Catálogo → Datas."
          emptyTitle="Nenhuma saída encontrada"
          error={error}
          isEmpty={departures.length === 0}
          onRetry={() => load(includePast)}
          status={loadStatus}
        >
          <div className="overflow-x-auto rounded-lg border bg-white shadow-sm">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                <tr>
                  <th className="px-4 py-3">Viagem</th>
                  <th className="px-4 py-3">Período</th>
                  <th className="px-4 py-3">Pax reservados</th>
                  <th className="px-4 py-3">Vagas restantes</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {departures.map((departure) => (
                  <tr className="hover:bg-gray-50" key={departure.id}>
                    <td className="px-4 py-3">
                      <p className="font-medium">
                        {departure.products?.title ?? departure.product_id}
                      </p>
                      <p className="text-xs text-gray-500">
                        {departure.products?.origin
                          ? `${departure.products.origin} → ${departure.products.destination}`
                          : departure.products?.destination}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      {formatDateRangeBR(
                        departure.start_date,
                        departure.end_date
                      )}
                    </td>
                    <td className="px-4 py-3 font-semibold">
                      {totals[departure.id] ?? 0}
                    </td>
                    <td className="px-4 py-3">{departure.available_slots}</td>
                    <td className="px-4 py-3">
                      {departure.active ? "Ativa" : "Inativa"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        className="font-semibold text-orange-600 hover:text-orange-700"
                        href={`/admin/departures/${departure.id}`}
                      >
                        Abrir →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </AdminListState>
      </AdminLayout>
    </AdminGuard>
  );
};

export default AdminDepartures;
