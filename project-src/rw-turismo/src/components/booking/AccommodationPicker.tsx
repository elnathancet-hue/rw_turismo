import {
  availableAccommodations,
  describeRooms,
  type Accommodation,
} from "../../lib/products/accommodation";

type Props = {
  accommodations: Accommodation[];
  travelersCount: number;
  value: string | null;
  onChange: (code: string | null) => void;
  formatCurrency: (value: number) => string;
};

// Mostra só as combinações possíveis para a quantidade informada — a
// especificação pede isso literalmente ("Configurações de acomodação
// impossíveis não aparecem"). Oferecer um duplo para 3 pessoas deixaria alguém
// sem cama e viraria problema no balcão.
const AccommodationPicker = ({
  accommodations,
  travelersCount,
  value,
  onChange,
  formatCurrency,
}: Props) => {
  const options = availableAccommodations(accommodations, travelersCount);

  if (accommodations.length === 0) return null;

  if (options.length === 0) {
    return (
      <p className="mt-4 rounded border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
        Não temos uma combinação de quartos para {travelersCount}{" "}
        {travelersCount === 1 ? "pessoa" : "pessoas"} neste pacote. Ajuste a
        quantidade ou fale com a gente.
      </p>
    );
  }

  return (
    <fieldset className="mt-4">
      <legend className="text-sm font-medium">Acomodação</legend>
      <div className="mt-2 space-y-2">
        {options.map((option) => {
          const isSelected = option.code === value;
          return (
            <label
              className={`flex cursor-pointer items-start gap-3 rounded border p-3 transition ${
                isSelected
                  ? "border-orange-500 bg-orange-50"
                  : "hover:bg-gray-50"
              }`}
              key={option.code}
            >
              <input
                checked={isSelected}
                className="mt-1"
                name="acomodacao"
                onChange={() => onChange(option.code)}
                type="radio"
                value={option.code}
              />
              <span className="flex-1">
                <span className="block text-sm font-semibold">
                  {option.name}
                </span>
                <span className="block text-xs text-gray-500">
                  {describeRooms(option, travelersCount)}
                </span>
                {option.shared && (
                  <span className="mt-1 block text-xs text-gray-500">
                    Você compra a sua vaga; a RW acomoda com outro viajante do
                    mesmo grupo.
                  </span>
                )}
              </span>
              {/* Preço por pessoa E total, lado a lado — a especificação pede
                  os dois ao mesmo tempo, para ninguém confundir. */}
              <span className="text-right">
                <span className="block text-sm font-semibold">
                  {formatCurrency(option.price)}
                </span>
                <span className="block text-xs text-gray-500">por pessoa</span>
                {travelersCount > 1 && (
                  <span className="mt-1 block text-xs text-gray-500">
                    {formatCurrency(option.price * travelersCount)} no total
                  </span>
                )}
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
};

export default AccommodationPicker;
