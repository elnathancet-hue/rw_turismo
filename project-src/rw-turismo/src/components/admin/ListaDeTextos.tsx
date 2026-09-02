import { Input } from "../ui/form";

// Lista de linhas de texto que dá para adicionar, reordenar e remover.
//
// POR QUE EXISTE: a tela de resultado do quiz tem três listas assim — os
// motivos com check verde, os itens do destino e as linhas pequenas sob o
// botão. Sem um componente, cada uma viraria trinta linhas de JSX repetido
// dentro de um editor que já é o arquivo mais longo do painel.
//
// O reordenar é o mesmo padrão do resto do admin (PageBuilder.moveBlock): troca
// com o vizinho por botão, sem arrastar — arrastar em lista aninhada erra mais
// do que acerta.

const ListaDeTextos = ({
  label,
  hint,
  itens,
  onChange,
  placeholder,
  textoAdicionar = "+ Item",
}: {
  label: string;
  hint?: string;
  itens: string[];
  onChange: (itens: string[]) => void;
  placeholder?: string;
  textoAdicionar?: string;
}) => {
  const trocar = (i: number, dir: -1 | 1) => {
    const alvo = i + dir;
    if (alvo < 0 || alvo >= itens.length) return;
    const next = [...itens];
    [next[i], next[alvo]] = [next[alvo]!, next[i]!];
    onChange(next);
  };

  return (
    <div>
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-gray-700">{label}</span>
        <button
          className="text-sm font-semibold text-brand-600 hover:underline"
          onClick={() => onChange([...itens, ""])}
          type="button"
        >
          {textoAdicionar}
        </button>
      </div>
      {hint && <p className="mt-1 text-xs text-gray-500">{hint}</p>}

      {itens.length === 0 ? (
        <p className="mt-2 rounded-lg border border-dashed border-gray-300 p-3 text-sm text-gray-500">
          Nenhum item. Este bloco não aparece na tela de resultado.
        </p>
      ) : (
        <div className="mt-2 space-y-2">
          {itens.map((item, i) => (
            <div className="flex items-start gap-2" key={i}>
              <Input
                className="mt-0"
                onChange={(e) =>
                  onChange(itens.map((v, j) => (j === i ? e.target.value : v)))
                }
                placeholder={placeholder}
                value={item}
              />
              {/* Os botões ficam fora do Input para a linha não apertar o campo:
                  é largura de sobra para o texto e o mínimo para os controles. */}
              <div className="flex shrink-0 gap-1 pt-1">
                <button
                  aria-label="Subir"
                  className="rounded border px-2 py-1 text-xs text-gray-600 disabled:opacity-30"
                  disabled={i === 0}
                  onClick={() => trocar(i, -1)}
                  type="button"
                >
                  ↑
                </button>
                <button
                  aria-label="Descer"
                  className="rounded border px-2 py-1 text-xs text-gray-600 disabled:opacity-30"
                  disabled={i === itens.length - 1}
                  onClick={() => trocar(i, 1)}
                  type="button"
                >
                  ↓
                </button>
                <button
                  aria-label="Remover"
                  className="rounded border border-red-200 px-2 py-1 text-xs font-semibold text-red-600"
                  onClick={() => onChange(itens.filter((_, j) => j !== i))}
                  type="button"
                >
                  ✕
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ListaDeTextos;
