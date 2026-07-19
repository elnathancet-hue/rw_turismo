import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useMemo, useState } from "react";
import AdminGuard from "../../../../components/admin/AdminGuard";
import AdminLayout from "../../../../components/admin/AdminLayout";
import DepartureTabs from "../../../../components/admin/DepartureTabs";
import Button from "../../../../components/ui/Button";
import Card from "../../../../components/ui/Card";
import {
  getAdminDeparture,
  listDeparturePassengers,
  setPassengerRoom,
  type AdminDeparture,
  type DeparturePassenger,
} from "../../../../lib/admin/client";
import { formatDateRangeBR } from "../../../../lib/format";

const AdminDepartureRooms = () => {
  const router = useRouter();
  const id = typeof router.query.id === "string" ? router.query.id : "";
  const [departure, setDeparture] = useState<AdminDeparture | null>(null);
  const [passengers, setPassengers] = useState<DeparturePassenger[]>([]);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [loadStatus, setLoadStatus] = useState<"loading" | "ready" | "error">(
    "loading"
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    setLoadStatus("loading");
    Promise.all([getAdminDeparture(id), listDeparturePassengers(id)])
      .then(([dep, pax]) => {
        setDeparture(dep);
        setPassengers(pax);
        const initial: Record<string, string> = {};
        for (const p of pax) initial[p.id] = p.room_label ?? "";
        setDrafts(initial);
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

  const saveRoom = async (passenger: DeparturePassenger) => {
    const label = (drafts[passenger.id] ?? "").trim() || null;
    if ((passenger.room_label ?? null) === label) return;
    const previous = passenger.room_label ?? null;
    setPassengers((current) =>
      current.map((p) =>
        p.id === passenger.id ? { ...p, room_label: label } : p
      )
    );
    try {
      await setPassengerRoom(passenger.id, label);
    } catch {
      setPassengers((current) =>
        current.map((p) =>
          p.id === passenger.id ? { ...p, room_label: previous } : p
        )
      );
      setDrafts((current) => ({
        ...current,
        [passenger.id]: previous ?? "",
      }));
      setError("Não foi possível salvar o quarto. Tente novamente.");
    }
  };

  const roomLabels = useMemo(
    () =>
      Array.from(
        new Set(
          passengers
            .map((p) => p.room_label)
            .filter((label): label is string => Boolean(label))
        )
      ).sort((a, b) => a.localeCompare(b, "pt-BR")),
    [passengers]
  );

  const grouped = useMemo(() => {
    const groups = new Map<string, DeparturePassenger[]>();
    for (const passenger of passengers) {
      const key = passenger.room_label ?? "";
      groups.set(key, [...(groups.get(key) ?? []), passenger]);
    }
    const labeled = Array.from(groups.entries())
      .filter(([label]) => label)
      .sort(([a], [b]) => a.localeCompare(b, "pt-BR"));
    const unassigned = groups.get("") ?? [];
    return { labeled, unassigned };
  }, [passengers]);

  return (
    <AdminGuard>
      <AdminLayout
        title="Quartos"
        description="Monte a rooming list: digite o quarto de cada passageiro (ex.: 101 — Duplo)."
      >
        <Link
          className="text-sm font-semibold text-orange-600 hover:text-orange-700 print:hidden"
          href="/admin/departures"
        >
          ← Voltar para saídas
        </Link>
        {id && <DepartureTabs active="rooms" id={id} />}

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

        {loadStatus === "ready" && departure && (
          <>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 print:hidden">
              <div>
                <h2 className="font-semibold">{departure.products?.title}</h2>
                <p className="text-sm text-gray-500">
                  {formatDateRangeBR(departure.start_date, departure.end_date)}
                </p>
              </div>
              <Button
                onClick={() => window.print()}
                type="button"
                variant="secondary"
              >
                Imprimir rooming list
              </Button>
            </div>

            <datalist id="room-suggestions">
              {roomLabels.map((label) => (
                <option key={label} value={label} />
              ))}
            </datalist>

            <div className="mt-5 grid gap-6 lg:grid-cols-2 print:hidden">
              {/* Atribuição por passageiro */}
              <div className="space-y-2">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
                  Passageiros ({passengers.length})
                </h3>
                {passengers.map((passenger) => (
                  <Card
                    className="flex items-center justify-between gap-3 p-3"
                    key={passenger.id}
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {passenger.full_name}
                      </p>
                      <p className="truncate text-xs text-gray-500">
                        {passenger.bookings
                          ? `reserva de ${passenger.bookings.customer_name}`
                          : ""}
                      </p>
                    </div>
                    <input
                      aria-label={`Quarto de ${passenger.full_name}`}
                      className="w-36 rounded-lg border border-gray-300 px-2 py-1.5 text-sm outline-none focus:border-orange-500"
                      list="room-suggestions"
                      onBlur={() => saveRoom(passenger)}
                      onChange={(event) =>
                        setDrafts((current) => ({
                          ...current,
                          [passenger.id]: event.target.value,
                        }))
                      }
                      placeholder="Quarto…"
                      value={drafts[passenger.id] ?? ""}
                    />
                  </Card>
                ))}
                {passengers.length === 0 && (
                  <p className="rounded border border-dashed p-4 text-sm text-gray-500">
                    Nenhum passageiro nesta saída ainda.
                  </p>
                )}
              </div>

              {/* Prévia agrupada */}
              <div>
                <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
                  Rooming list ({grouped.labeled.length}{" "}
                  {grouped.labeled.length === 1 ? "quarto" : "quartos"})
                </h3>
                <div className="mt-2 space-y-2">
                  {grouped.labeled.map(([label, occupants]) => (
                    <Card className="p-4" key={label}>
                      <p className="font-semibold">
                        {label}{" "}
                        <span className="text-xs font-normal text-gray-500">
                          · {occupants.length}{" "}
                          {occupants.length === 1 ? "hóspede" : "hóspedes"}
                        </span>
                      </p>
                      <ul className="mt-1 list-inside list-disc text-sm text-gray-700">
                        {occupants.map((p) => (
                          <li key={p.id}>{p.full_name}</li>
                        ))}
                      </ul>
                    </Card>
                  ))}
                  {grouped.unassigned.length > 0 && (
                    <Card className="border-amber-200 bg-amber-50/60 p-4">
                      <p className="font-semibold text-amber-800">
                        Sem quarto · {grouped.unassigned.length}
                      </p>
                      <ul className="mt-1 list-inside list-disc text-sm text-amber-800">
                        {grouped.unassigned.map((p) => (
                          <li key={p.id}>{p.full_name}</li>
                        ))}
                      </ul>
                    </Card>
                  )}
                  {grouped.labeled.length === 0 &&
                    grouped.unassigned.length === 0 && (
                      <p className="rounded border border-dashed p-4 text-sm text-gray-500">
                        A rooming list aparece aqui conforme você atribui os
                        quartos.
                      </p>
                    )}
                </div>
              </div>
            </div>

            {/* Rooming list para impressão (hotel) */}
            <div className="hidden print:block">
              <h2 className="text-lg font-bold">
                Rooming list — {departure.products?.title}
              </h2>
              <p className="text-sm">
                {formatDateRangeBR(departure.start_date, departure.end_date)}
              </p>
              <table className="mt-4 w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b-2 border-black text-left">
                    <th className="py-1 pr-3">Quarto</th>
                    <th className="py-1">Hóspedes</th>
                  </tr>
                </thead>
                <tbody>
                  {grouped.labeled.map(([label, occupants]) => (
                    <tr className="border-b border-gray-300" key={label}>
                      <td className="py-1 pr-3 align-top font-semibold">
                        {label}
                      </td>
                      <td className="py-1">
                        {occupants.map((p) => p.full_name).join(", ")}
                      </td>
                    </tr>
                  ))}
                  {grouped.unassigned.length > 0 && (
                    <tr>
                      <td className="py-1 pr-3 align-top font-semibold">
                        Sem quarto
                      </td>
                      <td className="py-1">
                        {grouped.unassigned
                          .map((p) => p.full_name)
                          .join(", ")}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </AdminLayout>
    </AdminGuard>
  );
};

export default AdminDepartureRooms;
