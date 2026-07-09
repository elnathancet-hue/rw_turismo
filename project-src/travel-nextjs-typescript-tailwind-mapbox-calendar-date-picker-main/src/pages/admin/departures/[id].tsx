import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useMemo, useState } from "react";
import AdminGuard from "../../../components/admin/AdminGuard";
import AdminLayout from "../../../components/admin/AdminLayout";
import StatusPill from "../../../components/StatusPill";
import Button from "../../../components/ui/Button";
import Card from "../../../components/ui/Card";
import { Input } from "../../../components/ui/form";
import {
  getAdminDeparture,
  listDeparturePassengers,
  setAdminPassengerCheckin,
  type AdminDeparture,
  type DeparturePassenger,
} from "../../../lib/admin/client";
import { paymentStatusBadge } from "../../../lib/bookings/status";
import { downloadCsv } from "../../../lib/csv";
import { formatDateBR, formatDateRangeBR } from "../../../lib/format";

const typeLabels: Record<string, string> = {
  adult: "Adulto",
  child: "Criança",
  infant: "Bebê",
};

const AdminDepartureDetail = () => {
  const router = useRouter();
  const id = typeof router.query.id === "string" ? router.query.id : "";
  const [departure, setDeparture] = useState<AdminDeparture | null>(null);
  const [passengers, setPassengers] = useState<DeparturePassenger[]>([]);
  const [loadStatus, setLoadStatus] = useState<"loading" | "ready" | "error">(
    "loading"
  );
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    setLoadStatus("loading");
    Promise.all([getAdminDeparture(id), listDeparturePassengers(id)])
      .then(([dep, pax]) => {
        setDeparture(dep);
        setPassengers(pax);
        setLoadStatus("ready");
      })
      .catch((caught) => {
        setError(
          caught instanceof Error
            ? caught.message
            : "Não foi possível carregar a saída."
        );
        setLoadStatus("error");
      });
  }, [id]);

  const checkedCount = passengers.filter((p) => p.checked_in_at).length;

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return passengers;
    return passengers.filter(
      (p) =>
        p.full_name.toLowerCase().includes(term) ||
        (p.document ?? "").toLowerCase().includes(term) ||
        (p.bookings?.customer_name ?? "").toLowerCase().includes(term)
    );
  }, [passengers, search]);

  const toggleCheckin = async (passenger: DeparturePassenger) => {
    const next = !passenger.checked_in_at;
    setSavingId(passenger.id);
    // Otimista: atualiza já, reverte se falhar.
    setPassengers((current) =>
      current.map((p) =>
        p.id === passenger.id
          ? { ...p, checked_in_at: next ? new Date().toISOString() : null }
          : p
      )
    );
    try {
      await setAdminPassengerCheckin(passenger.id, next);
    } catch {
      setPassengers((current) =>
        current.map((p) =>
          p.id === passenger.id
            ? { ...p, checked_in_at: passenger.checked_in_at }
            : p
        )
      );
      setError("Não foi possível salvar o check-in. Tente novamente.");
    } finally {
      setSavingId(null);
    }
  };

  const exportCsv = () => {
    downloadCsv(
      `relacao-pax-${departure?.products?.title ?? "saida"}-${departure?.start_date ?? ""}.csv`,
      [
        [
          "Nome",
          "Documento",
          "Tipo",
          "Nascimento",
          "Reserva de",
          "Telefone",
          "Pagamento",
          "Check-in",
        ],
        ...passengers.map((p) => [
          p.full_name,
          p.document,
          typeLabels[p.type] ?? p.type,
          p.birth_date ? formatDateBR(p.birth_date) : "",
          p.bookings?.customer_name,
          p.bookings?.customer_phone,
          p.bookings ? paymentStatusBadge(p.bookings.payment_status).label : "",
          p.checked_in_at ? "Sim" : "Não",
        ]),
      ]
    );
  };

  return (
    <AdminGuard>
      <AdminLayout
        title="Saída"
        description="Relação de passageiros e check-in de embarque."
      >
        <Link
          className="text-sm font-semibold text-orange-600 hover:text-orange-700 print:hidden"
          href="/admin/departures"
        >
          ← Voltar para saídas
        </Link>

        {loadStatus === "loading" && (
          <p className="mt-6 text-gray-500">Carregando saída…</p>
        )}

        {error && (
          <p
            className="mt-4 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700 print:hidden"
            role="alert"
          >
            {error}
          </p>
        )}

        {loadStatus === "ready" && departure && (
          <>
            <Card className="mt-4 p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h2 className="text-xl font-semibold">
                    {departure.products?.title}
                  </h2>
                  <p className="mt-1 text-sm text-gray-600">
                    {departure.products?.origin
                      ? `${departure.products.origin} → ${departure.products.destination}`
                      : departure.products?.destination}{" "}
                    · {formatDateRangeBR(departure.start_date, departure.end_date)}
                  </p>
                </div>
                <div className="flex gap-6 text-center">
                  <div>
                    <p className="text-2xl font-bold">{passengers.length}</p>
                    <p className="text-xs uppercase text-gray-500">Pax</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-green-700">
                      {checkedCount}
                    </p>
                    <p className="text-xs uppercase text-gray-500">
                      Embarcados
                    </p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold">
                      {departure.available_slots}
                    </p>
                    <p className="text-xs uppercase text-gray-500">
                      Vagas livres
                    </p>
                  </div>
                </div>
              </div>
            </Card>

            <div className="mt-5 flex flex-wrap items-center gap-3 print:hidden">
              <div className="w-full sm:max-w-xs">
                <Input
                  aria-label="Buscar passageiro"
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Buscar por nome, documento ou reserva…"
                  type="search"
                  value={search}
                />
              </div>
              <Button onClick={exportCsv} type="button" variant="secondary">
                Exportar CSV
              </Button>
              <Button
                onClick={() => window.print()}
                type="button"
                variant="secondary"
              >
                Imprimir relação
              </Button>
            </div>

            {passengers.length === 0 && (
              <Card className="mt-4 p-8 text-center text-gray-500">
                Nenhum passageiro cadastrado nesta saída ainda.
              </Card>
            )}

            {/* Lista interativa (tela) — alvo de toque grande pro portão de embarque */}
            <div className="mt-4 space-y-2 print:hidden">
              {filtered.map((passenger) => {
                const badge = passenger.bookings
                  ? paymentStatusBadge(passenger.bookings.payment_status)
                  : null;
                const checked = Boolean(passenger.checked_in_at);
                return (
                  <Card
                    className={`flex items-center justify-between gap-3 p-4 ${
                      checked ? "border-green-300 bg-green-50/60" : ""
                    }`}
                    key={passenger.id}
                  >
                    <div className="min-w-0">
                      <p className="truncate font-semibold">
                        {passenger.full_name}
                      </p>
                      <p className="mt-0.5 truncate text-xs text-gray-500">
                        {[
                          typeLabels[passenger.type] ?? passenger.type,
                          passenger.document,
                          passenger.bookings
                            ? `reserva de ${passenger.bookings.customer_name}`
                            : null,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                      {badge && (
                        <span className="mt-1 inline-block">
                          <StatusPill label={badge.label} tone={badge.tone} />
                        </span>
                      )}
                    </div>
                    <Button
                      className="shrink-0"
                      loading={savingId === passenger.id}
                      onClick={() => toggleCheckin(passenger)}
                      type="button"
                      variant={checked ? "primary" : "secondary"}
                    >
                      {checked ? "Embarcado ✓" : "Embarcar"}
                    </Button>
                  </Card>
                );
              })}
              {filtered.length === 0 && passengers.length > 0 && (
                <p className="p-4 text-sm text-gray-500">
                  Nenhum passageiro encontrado para a busca.
                </p>
              )}
            </div>

            {/* Relação limpa para impressão */}
            <div className="hidden print:block">
              <table className="mt-4 w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b-2 border-black text-left">
                    <th className="py-1 pr-3">#</th>
                    <th className="py-1 pr-3">Nome</th>
                    <th className="py-1 pr-3">Documento</th>
                    <th className="py-1 pr-3">Tipo</th>
                    <th className="py-1 pr-3">Reserva de</th>
                    <th className="py-1">Check-in</th>
                  </tr>
                </thead>
                <tbody>
                  {passengers.map((passenger, index) => (
                    <tr className="border-b border-gray-300" key={passenger.id}>
                      <td className="py-1 pr-3">{index + 1}</td>
                      <td className="py-1 pr-3">{passenger.full_name}</td>
                      <td className="py-1 pr-3">{passenger.document ?? ""}</td>
                      <td className="py-1 pr-3">
                        {typeLabels[passenger.type] ?? passenger.type}
                      </td>
                      <td className="py-1 pr-3">
                        {passenger.bookings?.customer_name ?? ""}
                      </td>
                      <td className="py-1">☐</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </AdminLayout>
    </AdminGuard>
  );
};

export default AdminDepartureDetail;
