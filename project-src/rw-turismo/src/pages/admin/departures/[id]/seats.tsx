import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useMemo, useState } from "react";
import AdminGuard from "../../../../components/admin/AdminGuard";
import AdminLayout from "../../../../components/admin/AdminLayout";
import DepartureTabs from "../../../../components/admin/DepartureTabs";
import Button from "../../../../components/ui/Button";
import Card from "../../../../components/ui/Card";
import { Input } from "../../../../components/ui/form";
import {
  getAdminDeparture,
  listDeparturePassengers,
  setPassengerSeat,
  updateDepartureTotalSeats,
  type AdminDeparture,
  type DeparturePassenger,
} from "../../../../lib/admin/client";
import { formatDateRangeBR } from "../../../../lib/format";

// Fileiras de 4 (2 + corredor + 2), numeração sequencial — padrão de ônibus.
const buildRows = (total: number): number[][] => {
  const rows: number[][] = [];
  for (let seat = 1; seat <= total; seat += 4) {
    rows.push(
      [seat, seat + 1, seat + 2, seat + 3].filter((n) => n <= total)
    );
  }
  return rows;
};

const AdminDepartureSeats = () => {
  const router = useRouter();
  const id = typeof router.query.id === "string" ? router.query.id : "";
  const [departure, setDeparture] = useState<AdminDeparture | null>(null);
  const [passengers, setPassengers] = useState<DeparturePassenger[]>([]);
  const [totalSeatsInput, setTotalSeatsInput] = useState("");
  const [selectedPaxId, setSelectedPaxId] = useState<string | null>(null);
  const [loadStatus, setLoadStatus] = useState<"loading" | "ready" | "error">(
    "loading"
  );
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [isSavingSeats, setIsSavingSeats] = useState(false);

  useEffect(() => {
    if (!id) return;
    setLoadStatus("loading");
    Promise.all([getAdminDeparture(id), listDeparturePassengers(id)])
      .then(([dep, pax]) => {
        setDeparture(dep);
        setPassengers(pax);
        setTotalSeatsInput(dep?.total_seats ? String(dep.total_seats) : "");
        setLoadStatus("ready");
      })
      .catch((caught) => {
        setError(
          caught instanceof Error
            ? caught.message
            : "Não foi possível carregar a saída. A migration da Fase 2 já rodou?"
        );
        setLoadStatus("error");
      });
  }, [id]);

  const totalSeats = departure?.total_seats ?? 0;
  const rows = useMemo(() => buildRows(totalSeats), [totalSeats]);

  const occupants = useMemo(() => {
    const map = new Map<string, DeparturePassenger>();
    for (const passenger of passengers) {
      if (passenger.seat_number) map.set(passenger.seat_number, passenger);
    }
    return map;
  }, [passengers]);

  const selectedPax =
    passengers.find((p) => p.id === selectedPaxId) ?? null;

  const saveTotalSeats = async () => {
    if (!departure) return;
    const parsed = Number(totalSeatsInput);
    const value =
      Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : null;
    setIsSavingSeats(true);
    setError(null);
    try {
      await updateDepartureTotalSeats(departure.id, value);
      setDeparture((current) =>
        current ? { ...current, total_seats: value } : current
      );
      setNotice("Veículo salvo.");
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Não foi possível salvar. A migration da Fase 2 já rodou?"
      );
    } finally {
      setIsSavingSeats(false);
    }
  };

  const assignSeat = async (
    passenger: DeparturePassenger,
    seat: string | null
  ) => {
    const previous = passenger.seat_number ?? null;
    setPassengers((current) =>
      current.map((p) =>
        p.id === passenger.id ? { ...p, seat_number: seat } : p
      )
    );
    try {
      await setPassengerSeat(passenger.id, seat);
    } catch {
      setPassengers((current) =>
        current.map((p) =>
          p.id === passenger.id ? { ...p, seat_number: previous } : p
        )
      );
      setError("Não foi possível salvar o assento. Tente novamente.");
    }
  };

  const onSeatClick = async (seatNumber: number) => {
    setNotice(null);
    setError(null);
    const seat = String(seatNumber);
    const occupant = occupants.get(seat);

    if (selectedPax) {
      if (occupant && occupant.id !== selectedPax.id) {
        setError(
          `Assento ${seat} já está com ${occupant.full_name}. Toque nele sem ninguém selecionado para liberar.`
        );
        return;
      }
      await assignSeat(selectedPax, seat);
      setSelectedPaxId(null);
      return;
    }

    if (occupant) {
      await assignSeat(occupant, null);
      setNotice(`Assento ${seat} liberado.`);
    }
  };

  return (
    <AdminGuard>
      <AdminLayout
        title="Assentos"
        description="Selecione um passageiro e toque no assento para marcar."
      >
        <Link
          className="text-sm font-semibold text-orange-600 hover:text-orange-700 print:hidden"
          href="/admin/departures"
        >
          ← Voltar para saídas
        </Link>
        {id && <DepartureTabs active="seats" id={id} />}

        {loadStatus === "loading" && (
          <p className="mt-6 text-gray-500">Carregando…</p>
        )}
        {error && (
          <p
            className="mt-4 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700 print:hidden"
            role="alert"
          >
            {error}
          </p>
        )}
        {notice && (
          <p
            className="mt-4 rounded border border-green-200 bg-green-50 p-3 text-sm text-green-800 print:hidden"
            role="status"
          >
            {notice}
          </p>
        )}

        {loadStatus === "ready" && departure && (
          <>
            <Card className="mt-4 p-5 print:hidden">
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                  <h2 className="font-semibold">{departure.products?.title}</h2>
                  <p className="text-sm text-gray-500">
                    {formatDateRangeBR(departure.start_date, departure.end_date)}
                  </p>
                </div>
                <div className="flex items-end gap-2">
                  <label className="block text-sm font-medium text-gray-700">
                    Assentos do veículo
                    <Input
                      className="mt-1 w-28"
                      min={1}
                      onChange={(event) =>
                        setTotalSeatsInput(event.target.value)
                      }
                      placeholder="Ex.: 46"
                      type="number"
                      value={totalSeatsInput}
                    />
                  </label>
                  <Button
                    loading={isSavingSeats}
                    onClick={saveTotalSeats}
                    type="button"
                    variant="secondary"
                  >
                    Salvar
                  </Button>
                  {totalSeats > 0 && (
                    <Button
                      onClick={() => window.print()}
                      type="button"
                      variant="secondary"
                    >
                      Imprimir mapa
                    </Button>
                  )}
                </div>
              </div>
            </Card>

            {totalSeats === 0 ? (
              <Card className="mt-4 p-8 text-center text-gray-500 print:hidden">
                Informe o número de assentos do veículo para montar o mapa.
              </Card>
            ) : (
              <div className="mt-5 grid gap-6 lg:grid-cols-[320px_1fr] print:hidden">
                {/* Passageiros */}
                <div>
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
                    Passageiros ({passengers.length})
                  </h3>
                  <p className="mt-1 text-xs text-gray-500">
                    Toque no passageiro e depois no assento.
                  </p>
                  <div className="mt-2 space-y-1.5">
                    {passengers.map((passenger) => {
                      const selected = passenger.id === selectedPaxId;
                      return (
                        <button
                          className={`w-full rounded-lg border px-3 py-2 text-left text-sm transition ${
                            selected
                              ? "border-orange-500 bg-orange-50"
                              : "bg-white hover:bg-gray-50"
                          }`}
                          key={passenger.id}
                          onClick={() =>
                            setSelectedPaxId(selected ? null : passenger.id)
                          }
                          type="button"
                        >
                          <span className="flex items-center justify-between gap-2">
                            <span className="truncate font-medium">
                              {passenger.full_name}
                            </span>
                            {passenger.seat_number ? (
                              <span className="shrink-0 rounded bg-gray-800 px-2 py-0.5 text-xs font-bold text-white">
                                {passenger.seat_number}
                              </span>
                            ) : (
                              <span className="shrink-0 text-xs text-amber-700">
                                sem assento
                              </span>
                            )}
                          </span>
                        </button>
                      );
                    })}
                    {passengers.length === 0 && (
                      <p className="rounded border border-dashed p-4 text-sm text-gray-500">
                        Nenhum passageiro nesta saída ainda.
                      </p>
                    )}
                  </div>
                </div>

                {/* Mapa do ônibus */}
                <div>
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
                    Veículo · {totalSeats} lugares
                  </h3>
                  <Card className="mt-2 w-fit p-5">
                    <p className="mb-3 rounded bg-gray-100 px-3 py-1 text-center text-xs font-semibold uppercase text-gray-500">
                      Frente / Motorista
                    </p>
                    <div className="space-y-2">
                      {rows.map((row, rowIndex) => (
                        <div className="flex items-center gap-2" key={rowIndex}>
                          {row.map((seatNumber, seatIndex) => {
                            const seat = String(seatNumber);
                            const occupant = occupants.get(seat);
                            const isSelectedTarget = Boolean(selectedPax);
                            return (
                              <div
                                className="flex items-center gap-2"
                                key={seatNumber}
                              >
                                {seatIndex === 2 && <div className="w-6" />}
                                <button
                                  className={`h-14 w-14 rounded-lg border text-xs font-semibold transition ${
                                    occupant
                                      ? "border-gray-800 bg-gray-800 text-white"
                                      : isSelectedTarget
                                        ? "border-orange-400 bg-orange-50 text-orange-700 hover:bg-orange-100"
                                        : "bg-white text-gray-600 hover:bg-gray-50"
                                  }`}
                                  onClick={() => onSeatClick(seatNumber)}
                                  title={
                                    occupant
                                      ? `${seat} · ${occupant.full_name}`
                                      : `Assento ${seat}`
                                  }
                                  type="button"
                                >
                                  <span className="block">{seat}</span>
                                  {occupant && (
                                    <span className="block max-w-[3.2rem] truncate px-0.5 text-[9px] font-normal leading-tight">
                                      {occupant.full_name.split(" ")[0]}
                                    </span>
                                  )}
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      ))}
                    </div>
                  </Card>
                </div>
              </div>
            )}

            {/* Mapa de assentos para impressão */}
            {totalSeats > 0 && (
              <div className="hidden print:block">
                <h2 className="text-lg font-bold">
                  Mapa de assentos — {departure.products?.title}
                </h2>
                <p className="text-sm">
                  {formatDateRangeBR(departure.start_date, departure.end_date)}
                </p>
                <p className="mt-3 text-xs font-semibold uppercase">
                  Frente / Motorista
                </p>
                <div className="mt-1 space-y-1">
                  {rows.map((row, rowIndex) => (
                    <div className="flex gap-1" key={rowIndex}>
                      {row.map((seatNumber, seatIndex) => {
                        const occupant = occupants.get(String(seatNumber));
                        return (
                          <div className="flex gap-1" key={seatNumber}>
                            {seatIndex === 2 && <div className="w-5" />}
                            <div className="h-12 w-24 rounded border border-black p-1">
                              <p className="text-[10px] font-bold">
                                {seatNumber}
                              </p>
                              <p className="truncate text-[10px]">
                                {occupant?.full_name ?? ""}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </AdminLayout>
    </AdminGuard>
  );
};

export default AdminDepartureSeats;
