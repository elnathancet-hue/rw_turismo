import { passengerTypeOnDeparture } from "../../lib/bookings/passengerAge";
import { passengerTypeLabel } from "../../lib/bookings/status";
import type { BookingPassengerInput } from "../../lib/bookings/types";

type Props = {
  travelersCount: number;
  // Data da saída (YYYY-MM-DD). O tipo do passageiro é calculado contra ela,
  // não contra hoje: quem faz 12 anos entre a compra e a viagem embarca adulto.
  departureDate: string | null;
  passengers: BookingPassengerInput[];
  onChange: (passengers: BookingPassengerInput[]) => void;
};

const emptyPassenger = (): BookingPassengerInput => ({
  full_name: "",
  birth_date: "",
});

// Ajusta a lista ao número de viajantes sem apagar o que já foi digitado.
export const resizePassengers = (
  passengers: BookingPassengerInput[],
  travelersCount: number
): BookingPassengerInput[] => {
  if (passengers.length === travelersCount) return passengers;
  if (passengers.length > travelersCount) {
    return passengers.slice(0, travelersCount);
  }
  return [
    ...passengers,
    ...Array.from({ length: travelersCount - passengers.length }, emptyPassenger),
  ];
};

const PassengerFields = ({
  travelersCount,
  departureDate,
  passengers,
  onChange,
}: Props) => {
  const rows = resizePassengers(passengers, travelersCount);

  const update = (index: number, patch: Partial<BookingPassengerInput>) =>
    onChange(rows.map((row, i) => (i === index ? { ...row, ...patch } : row)));

  return (
    <fieldset className="mt-4">
      <legend className="text-sm font-medium">Quem vai viajar</legend>
      <p className="mt-1 text-xs text-gray-500">
        Precisamos do nome e da data de nascimento de cada pessoa para emitir a
        reserva e montar os quartos.
      </p>

      <div className="mt-3 space-y-3">
        {rows.map((row, index) => {
          // Mostra a faixa assim que a data é preenchida: deixa claro que quem
          // define adulto/criança é a idade, não uma escolha do comprador.
          const tipo =
            row.birth_date && departureDate
              ? passengerTypeLabel(
                  passengerTypeOnDeparture(row.birth_date, departureDate)
                )
              : null;

          return (
            <div className="rounded border p-3" key={index}>
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                {index + 1}º viajante
                {tipo && (
                  <span className="ml-2 rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium normal-case text-gray-600">
                    {tipo}
                  </span>
                )}
              </p>

              <label className="mt-2 block text-sm">
                Nome completo
                <input
                  className="mt-1 w-full rounded border px-3 py-2"
                  onChange={(event) =>
                    update(index, { full_name: event.target.value })
                  }
                  placeholder="Como está no documento"
                  required
                  value={row.full_name}
                />
              </label>

              <label className="mt-2 block text-sm">
                Data de nascimento
                <input
                  className="mt-1 w-full rounded border px-3 py-2"
                  // max = data da saída: nascer depois da viagem é impossível,
                  // e o servidor recusa de qualquer forma.
                  max={departureDate ?? undefined}
                  onChange={(event) =>
                    update(index, { birth_date: event.target.value })
                  }
                  required
                  type="date"
                  value={row.birth_date}
                />
              </label>
            </div>
          );
        })}
      </div>
    </fieldset>
  );
};

export default PassengerFields;
