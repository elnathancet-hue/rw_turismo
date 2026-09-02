import { useState } from "react";
import type { Pesos } from "../../../lib/quiz/types";

// Quais perfis a alternativa favorece, e quanto.
//
// O PROBLEMA QUE RESOLVE: antes eram N campos numéricos lado a lado, um por
// perfil, sem dizer o que o número significa. Quem monta o quiz na agência via
// uma grade de caixinhas e não sabia se deixar em branco era o mesmo que zero.
//
// Agora: um selo por perfil favorecido, legível de relance, e os números atrás
// de "Ajustar pontos" para quem quiser precisão.
//
// REGRAS QUE NÃO PODEM SER QUEBRADAS:
// - Peso ausente ≠ peso zero. A pontuação no banco só soma chave presente, e
//   "não pontua" é a ausência da chave. Gravar 0 encheria o jsonb de ruído e
//   apagaria a distinção.
// - Nada é arredondado, normalizado nem substituído em silêncio. Um peso 0,7
//   escrito à mão continua 0,7, e o atalho só entra quando a pessoa clica.

/** Atalhos. Cada um DIZ o peso que aplica — nada acontece sem estar escrito. */
const atalho = (eixos: string[]) => [
  {
    id: "nenhum",
    rotulo: "Não pontua",
    descricao: "nenhum ponto",
    pesos: () => ({}) as Pesos,
  },
  {
    id: "todos",
    rotulo: "Todos igualmente",
    descricao: eixos.map((e) => `${e} 0,5`).join(" · "),
    pesos: () =>
      Object.fromEntries(eixos.map((e) => [e, 0.5])) as Pesos,
  },
];

const formatar = (n: number) =>
  Number.isInteger(n) ? String(n) : String(n).replace(".", ",");

const PesosDaOpcao = ({
  eixos,
  pesos,
  onChange,
}: {
  eixos: string[];
  pesos: Pesos;
  onChange: (pesos: Pesos) => void;
}) => {
  const [abertoNumerico, setAbertoNumerico] = useState(false);
  const favorecidos = eixos.filter((e) => (pesos?.[e] ?? 0) !== 0);

  const alternar = (eixo: string) => {
    const proximo = { ...(pesos ?? {}) };
    if (eixo in proximo) {
      // Remove a chave em vez de gravar 0: é a ausência que significa
      // "não pontua" para o motor no banco.
      delete proximo[eixo];
    } else {
      proximo[eixo] = 1;
    }
    onChange(proximo);
  };

  const definir = (eixo: string, bruto: string) => {
    const proximo = { ...(pesos ?? {}) };
    if (bruto.trim() === "") {
      delete proximo[eixo];
    } else {
      const n = Number(bruto.replace(",", "."));
      if (Number.isNaN(n)) return;
      proximo[eixo] = n;
    }
    onChange(proximo);
  };

  return (
    <div>
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-xs font-medium text-gray-500">Favorece:</span>

        {eixos.length === 0 && (
          <span className="text-xs text-gray-400">
            Nenhum perfil criado ainda.
          </span>
        )}

        {eixos.map((eixo) => {
          const peso = pesos?.[eixo];
          const ativo = peso !== undefined && peso !== 0;
          return (
            <button
              // Sem rotulo explicito o nome acessivel sai grudado — "descanso1"
              // —, porque o espaco entre o nome e o valor e so margem no CSS.
              aria-label={
                ativo
                  ? `${eixo}, ${formatar(peso!)} ponto(s)`
                  : `${eixo}, não pontua`
              }
              aria-pressed={ativo}
              className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${
                ativo
                  ? "border-brand-300 bg-brand-50 text-brand-800"
                  : "border-gray-200 bg-white text-gray-500 hover:border-gray-300"
              }`}
              key={eixo}
              onClick={() => alternar(eixo)}
              type="button"
            >
              {/* O valor vai no rótulo: assim o estado não depende só da cor, e
                  a pessoa vê que "ativo" pode ser 1, 0,5 ou 2. */}
              {eixo}
              {ativo && (
                <span className="ml-1 font-normal">{formatar(peso!)}</span>
              )}
            </button>
          );
        })}

        {favorecidos.length === 0 && eixos.length > 0 && (
          <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs text-gray-600">
            não pontua
          </span>
        )}
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-2">
        {atalho(eixos).map((a) => (
          <button
            className="rounded border border-gray-200 px-2 py-1 text-xs text-gray-600 hover:border-gray-300 hover:text-gray-900"
            key={a.id}
            onClick={() => onChange(a.pesos())}
            title={a.descricao}
            type="button"
          >
            {a.rotulo}{" "}
            <span className="text-gray-400">({a.descricao})</span>
          </button>
        ))}
        <button
          className="text-xs font-semibold text-brand-600 hover:underline"
          onClick={() => setAbertoNumerico((v) => !v)}
          type="button"
        >
          {abertoNumerico ? "Fechar pontos" : "Ajustar pontos"}
        </button>
      </div>

      {abertoNumerico && (
        <div className="mt-2 flex flex-wrap gap-3 rounded border bg-white p-3">
          {eixos.map((eixo) => (
            <label className="text-xs font-medium text-gray-600" key={eixo}>
              {eixo}
              <input
                className="mt-1 block w-24 rounded-lg border border-gray-300 px-2 py-1.5 text-sm text-gray-900 outline-none focus:border-brand-500"
                inputMode="decimal"
                onChange={(e) => definir(eixo, e.target.value)}
                placeholder="—"
                value={pesos?.[eixo] ?? ""}
              />
            </label>
          ))}
          <p className="w-full text-xs text-gray-500">
            Em branco quer dizer que a alternativa não pontua para aquele perfil
            — não é o mesmo que zero.
          </p>
        </div>
      )}
    </div>
  );
};

export default PesosDaOpcao;
