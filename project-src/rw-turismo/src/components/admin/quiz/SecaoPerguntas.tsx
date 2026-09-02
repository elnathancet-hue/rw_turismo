import { useState } from "react";
import ConfirmButton from "../ConfirmButton";
import { Field, Input, Textarea } from "../../ui/form";
import Button from "../../ui/Button";
import PesosDaOpcao from "./PesosDaOpcao";
import { Grupo, letra } from "./campos";
import type { Quiz, QuizPergunta } from "../../../lib/quiz/types";

// Perguntas: lista à esquerda, uma pergunta aberta por vez.
//
// Antes todas as perguntas ficavam abertas ao mesmo tempo, e um quiz de 8
// perguntas × 4 alternativas × 2 perfis punha 32 blocos quase idênticos entre a
// pessoa e a próxima seção. A lista resolve o "onde eu estou": ela mostra o
// enunciado, quantas alternativas tem e se a pergunta pontua.

const resumo = (texto: string) =>
  texto.trim() ? texto.trim() : "Pergunta sem enunciado";

const pontua = (p: QuizPergunta) =>
  (p.opcoes ?? []).some((o) => Object.keys(o.pesos ?? {}).length > 0);

const SecaoPerguntas = ({
  quiz,
  selecionada,
  onSelecionar,
  onChange,
}: {
  quiz: Quiz;
  selecionada: number;
  onSelecionar: (i: number) => void;
  onChange: (perguntas: QuizPergunta[]) => void;
}) => {
  // Índice sendo arrastado. `null` quando ninguém arrasta.
  const [arrastando, setArrastando] = useState<number | null>(null);
  const perguntas = quiz.perguntas ?? [];
  const atual = perguntas[selecionada];

  const mover = (de: number, para: number) => {
    if (para < 0 || para >= perguntas.length || de === para) return;
    const next = [...perguntas];
    const [item] = next.splice(de, 1);
    next.splice(para, 0, item!);
    onChange(next);
    onSelecionar(para);
  };

  const trocaAtual = (troca: Partial<QuizPergunta>) =>
    onChange(
      perguntas.map((p, i) => (i === selecionada ? { ...p, ...troca } : p))
    );

  const adicionar = () => {
    onChange([
      ...perguntas,
      { texto: "", opcoes: [{ texto: "", pesos: {} }, { texto: "", pesos: {} }] },
    ]);
    onSelecionar(perguntas.length);
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,260px)_minmax(0,1fr)]">
      <div>
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-900">
            Perguntas ({perguntas.length})
          </h2>
          <Button onClick={adicionar} size="sm" variant="ghost" type="button">
            + Pergunta
          </Button>
        </div>

        <ul className="mt-3 space-y-1.5">
          {perguntas.map((p, i) => (
            <li
              draggable
              key={i}
              onDragEnd={() => setArrastando(null)}
              onDragOver={(e) => e.preventDefault()}
              onDragStart={() => setArrastando(i)}
              onDrop={() => {
                if (arrastando !== null) mover(arrastando, i);
                setArrastando(null);
              }}
            >
              <button
                aria-current={i === selecionada}
                className={`w-full rounded-lg border px-3 py-2.5 text-left ${
                  i === selecionada
                    ? "border-brand-300 bg-brand-50"
                    : "border-gray-200 bg-white hover:border-gray-300"
                }`}
                onClick={() => onSelecionar(i)}
                type="button"
              >
                <span className="flex items-baseline gap-2">
                  <span className="text-xs font-semibold text-gray-400">
                    {i + 1}
                  </span>
                  <span className="line-clamp-2 flex-1 text-sm text-gray-900">
                    {resumo(p.texto)}
                  </span>
                </span>
                <span className="mt-1 flex flex-wrap gap-2 text-xs text-gray-500">
                  <span>{(p.opcoes ?? []).length} alternativas</span>
                  {/* Estado por texto, não por cor. */}
                  {p.informativa ? (
                    <span className="text-gray-500">· informativa</span>
                  ) : pontua(p) ? (
                    <span className="text-green-700">· pontua</span>
                  ) : (
                    <span className="text-amber-700">· sem pontos</span>
                  )}
                </span>
              </button>

              {/* Teclado: arrastar não é acessível sozinho, então as setas
                  ficam sempre disponíveis e fazem o mesmo movimento. */}
              <span className="mt-1 flex gap-1">
                <button
                  aria-label={`Mover pergunta ${i + 1} para cima`}
                  className="rounded border px-2 py-0.5 text-xs text-gray-600 disabled:opacity-30"
                  disabled={i === 0}
                  onClick={() => mover(i, i - 1)}
                  type="button"
                >
                  ↑
                </button>
                <button
                  aria-label={`Mover pergunta ${i + 1} para baixo`}
                  className="rounded border px-2 py-0.5 text-xs text-gray-600 disabled:opacity-30"
                  disabled={i === perguntas.length - 1}
                  onClick={() => mover(i, i + 1)}
                  type="button"
                >
                  ↓
                </button>
                <button
                  aria-label={`Duplicar pergunta ${i + 1}`}
                  className="rounded border px-2 py-0.5 text-xs text-gray-600"
                  onClick={() => {
                    const next = [...perguntas];
                    next.splice(i + 1, 0, JSON.parse(JSON.stringify(p)));
                    onChange(next);
                    onSelecionar(i + 1);
                  }}
                  type="button"
                >
                  Duplicar
                </button>
              </span>
            </li>
          ))}
        </ul>

        {perguntas.length === 0 && (
          <p className="mt-3 rounded-lg border border-dashed p-4 text-sm text-gray-500">
            Nenhuma pergunta ainda.
          </p>
        )}
      </div>

      {atual ? (
        <div className="space-y-5">
          <Grupo titulo={`Pergunta ${selecionada + 1}`}>
            <Field label="Enunciado">
              <Textarea
                onChange={(e) => trocaAtual({ texto: e.target.value })}
                rows={3}
                value={atual.texto}
              />
            </Field>

            {/* Declarar a intenção, em vez de inventar pesos só para calar o
                aviso — inventar mudaria o resultado de quem responde. */}
            <label className="flex items-start gap-2 text-sm text-gray-700">
              <input
                checked={Boolean(atual.informativa)}
                className="mt-1"
                onChange={(e) => trocaAtual({ informativa: e.target.checked })}
                type="checkbox"
              />
              <span>
                Pergunta informativa
                <span className="block text-xs text-gray-500">
                  Colhe informação e não decide o resultado. Marcada, ela deixa
                  de aparecer como pendência — e continua sem somar pontos.
                </span>
              </span>
            </label>
          </Grupo>

          <Grupo
            acao={
              <Button
                onClick={() =>
                  trocaAtual({
                    opcoes: [...(atual.opcoes ?? []), { texto: "", pesos: {} }],
                  })
                }
                size="sm"
                type="button"
                variant="ghost"
              >
                + Alternativa
              </Button>
            }
            ajuda={
              atual.informativa
                ? "Esta pergunta é informativa: as alternativas não pontuam."
                : "Cada alternativa favorece um ou mais perfis. Quem responde não vê esses pontos."
            }
            titulo="Alternativas"
          >
            {(atual.opcoes ?? []).map((opcao, io) => (
              <div className="rounded-lg border border-gray-200 p-4" key={io}>
                <div className="flex items-start gap-3">
                  <span className="mt-2.5 w-5 shrink-0 text-sm font-semibold text-gray-400">
                    {letra(io)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <Textarea
                      aria-label={`Texto da alternativa ${letra(io)}`}
                      onChange={(e) =>
                        trocaAtual({
                          opcoes: atual.opcoes.map((o, j) =>
                            j === io ? { ...o, texto: e.target.value } : o
                          ),
                        })
                      }
                      rows={2}
                      value={opcao.texto}
                    />
                  </div>
                  {/* Um "Excluir" discreto por alternativa, com confirmação —
                      antes eram cinco botões vermelhos por tela. */}
                  <ConfirmButton
                    className="mt-2 shrink-0 text-xs font-semibold text-gray-400 hover:text-red-600"
                    message={`Remover a alternativa ${letra(io)}?`}
                    onConfirm={async () =>
                      trocaAtual({
                        opcoes: atual.opcoes.filter((_, j) => j !== io),
                      })
                    }
                  >
                    Excluir
                  </ConfirmButton>
                </div>

                {!atual.informativa && (
                  <div className="mt-3 pl-8">
                    <PesosDaOpcao
                      eixos={quiz.eixos ?? []}
                      onChange={(pesos) =>
                        trocaAtual({
                          opcoes: atual.opcoes.map((o, j) =>
                            j === io ? { ...o, pesos } : o
                          ),
                        })
                      }
                      pesos={opcao.pesos ?? {}}
                    />
                  </div>
                )}
              </div>
            ))}
          </Grupo>

          <ConfirmButton
            className="text-sm font-semibold text-red-600"
            message={`Excluir a pergunta ${selecionada + 1}? Isso não pode ser desfeito.`}
            onConfirm={async () => {
              onChange(perguntas.filter((_, j) => j !== selecionada));
              onSelecionar(Math.max(0, selecionada - 1));
            }}
          >
            Excluir pergunta
          </ConfirmButton>
        </div>
      ) : (
        <p className="text-sm text-gray-500">
          Selecione uma pergunta na lista, ou crie a primeira.
        </p>
      )}
    </div>
  );
};

export default SecaoPerguntas;
