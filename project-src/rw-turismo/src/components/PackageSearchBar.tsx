import { useRouter } from "next/router";
import { FormEvent, useEffect, useState } from "react";
import { getProductOrigins } from "../lib/products/client";

type Props = {
  initialOrigem?: string;
  initialDestino?: string;
  initialIda?: string;
  initialVolta?: string;
  className?: string;
};

// Local YYYY-MM-DD (no UTC shift) for the date inputs' minimum.
const todayISO = () => new Date().toLocaleDateString("en-CA");

const fieldClass =
  "mt-1 rounded-lg border border-gray-200 px-3 py-2 text-base font-normal normal-case text-gray-900 outline-none focus:border-orange-500";
const labelClass =
  "flex flex-col text-xs font-semibold uppercase tracking-wide text-gray-500";

const PackageSearchBar = ({
  initialOrigem = "",
  initialDestino = "",
  initialIda = "",
  initialVolta = "",
  className = "",
}: Props) => {
  const router = useRouter();
  const [origins, setOrigins] = useState<string[]>([]);
  const [origem, setOrigem] = useState(initialOrigem);
  const [destino, setDestino] = useState(initialDestino);
  const [ida, setIda] = useState(initialIda);
  const [volta, setVolta] = useState(initialVolta);

  useEffect(() => {
    let active = true;
    getProductOrigins()
      .then((data) => {
        if (active) setOrigins(data);
      })
      .catch(() => {
        if (active) setOrigins([]);
      });
    return () => {
      active = false;
    };
  }, []);

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    const query: Record<string, string> = {};
    if (origem) query.origem = origem;
    if (destino.trim()) query.destino = destino.trim();
    if (ida) query.ida = ida;
    if (volta) query.volta = volta;
    router.push({ pathname: "/search", query });
  };

  // Keep the current value selectable even before the list finishes loading.
  const origemOptions =
    origem && !origins.includes(origem) ? [origem, ...origins] : origins;

  return (
    <form
      className={`grid grid-cols-1 gap-3 rounded-2xl border border-gray-200 bg-white p-4 shadow-lg sm:grid-cols-2 lg:grid-cols-[1.1fr_1.4fr_1fr_1fr_auto] lg:items-end ${className}`}
      data-test="package-search"
      onSubmit={handleSubmit}
      role="search"
    >
      <label className={labelClass}>
        Origem
        <select
          className={fieldClass}
          onChange={(event) => setOrigem(event.target.value)}
          value={origem}
        >
          <option value="">Todas as saídas</option>
          {origemOptions.map((city) => (
            <option key={city} value={city}>
              {city}
            </option>
          ))}
        </select>
      </label>

      <label className={labelClass}>
        Destino
        <input
          className={`${fieldClass} placeholder:text-gray-400`}
          onChange={(event) => setDestino(event.target.value)}
          placeholder="Para onde vai?"
          type="text"
          value={destino}
        />
      </label>

      <label className={labelClass}>
        Ida
        <input
          className={fieldClass}
          min={todayISO()}
          onChange={(event) => setIda(event.target.value)}
          type="date"
          value={ida}
        />
      </label>

      <label className={labelClass}>
        Volta
        <input
          className={fieldClass}
          min={ida || todayISO()}
          onChange={(event) => setVolta(event.target.value)}
          type="date"
          value={volta}
        />
      </label>

      <button
        className="mt-1 rounded-lg bg-orange-500 px-6 py-2.5 font-semibold text-white transition hover:bg-orange-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-600 active:scale-95 lg:mt-0"
        type="submit"
      >
        Buscar
      </button>
    </form>
  );
};

export default PackageSearchBar;
