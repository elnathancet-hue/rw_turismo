import type { ReactNode } from "react";

// Peças pequenas compartilhadas pelas seções do editor de quiz.

/**
 * Agrupador de campos. Substitui o cartão-dentro-de-cartão-dentro-de-cartão:
 * uma linha de título e uma borda em cima bastam para separar assunto, e
 * sobra a largura que os contornos aninhados comiam.
 */
export const Grupo = ({
  titulo,
  ajuda,
  children,
  acao,
}: {
  titulo: string;
  ajuda?: string;
  children: ReactNode;
  acao?: ReactNode;
}) => (
  <section className="border-t border-gray-200 pt-5 first:border-t-0 first:pt-0">
    <div className="flex items-baseline justify-between gap-3">
      <h3 className="text-sm font-semibold text-gray-900">{titulo}</h3>
      {acao}
    </div>
    {ajuda && <p className="mt-1 text-sm text-gray-500">{ajuda}</p>}
    <div className="mt-3 space-y-4">{children}</div>
  </section>
);

/**
 * Slider e campo numérico apontando para o mesmo valor.
 *
 * A posição na régua era só um campo de número: 0 a 100 sem referência de onde
 * aquilo cai entre os dois perfis. O slider dá a noção; o número, a precisão —
 * e os dois gravam o MESMO dado, então nenhum valor já salvo se perde.
 */
export const Regua = ({
  valor,
  onChange,
  esquerda,
  direita,
}: {
  valor: number | null | undefined;
  onChange: (v: number | null) => void;
  esquerda: string;
  direita: string;
}) => {
  const atual = typeof valor === "number" && Number.isFinite(valor) ? valor : 50;
  const definido = typeof valor === "number" && Number.isFinite(valor);

  return (
    <div>
      <div className="flex items-center gap-3">
        <input
          aria-label={`Posição entre ${esquerda} e ${direita}`}
          className="h-11 flex-1 accent-brand-500"
          max={100}
          min={0}
          onChange={(e) => onChange(Number(e.target.value))}
          step={1}
          type="range"
          value={atual}
        />
        <input
          aria-label="Posição em número"
          className="h-11 w-20 rounded-lg border border-gray-300 px-3 text-sm text-gray-900 outline-none focus:border-brand-500"
          max={100}
          min={0}
          onChange={(e) =>
            onChange(e.target.value === "" ? null : Number(e.target.value))
          }
          type="number"
          value={definido ? valor! : ""}
        />
      </div>
      <div className="mt-1 flex justify-between text-xs text-gray-500">
        <span>{esquerda}</span>
        <span>{direita}</span>
      </div>
      {!definido && (
        <p className="mt-1 text-xs text-gray-500">
          Sem posição definida, a régua não aparece na tela de resultado.
        </p>
      )}
    </div>
  );
};

/**
 * Botões que inserem {{nome}} e {{resultado}} no campo.
 *
 * As variáveis existiam e não havia como descobri-las: quem não leu o
 * placeholder nunca soube que dava para pôr o nome de quem respondeu.
 */
export const Variaveis = ({
  variaveis,
  onInserir,
}: {
  variaveis: string[];
  onInserir: (v: string) => void;
}) => (
  <div className="mt-1 flex flex-wrap items-center gap-1.5">
    <span className="text-xs text-gray-500">Inserir:</span>
    {variaveis.map((v) => (
      <button
        className="rounded border border-gray-200 px-2 py-0.5 font-mono text-xs text-gray-700 hover:border-gray-300 hover:bg-gray-50"
        key={v}
        onClick={() => onInserir(`{{${v}}}`)}
        type="button"
      >
        {`{{${v}}}`}
      </button>
    ))}
  </div>
);

/** Letra da alternativa: A, B, C… */
export const letra = (i: number) => String.fromCharCode(65 + i);
