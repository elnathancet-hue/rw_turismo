import ConfirmButton from "../ConfirmButton";
import ImageField from "../ImageField";
import ListaDeTextos from "../ListaDeTextos";
import Button from "../../ui/Button";
import { Field, Input, Select, Textarea } from "../../ui/form";
import { Grupo, Regua, Variaveis } from "./campos";
import type {
  Quiz,
  QuizFoto,
  QuizResultado,
} from "../../../lib/quiz/types";

// Resultados: lista à esquerda, um resultado aberto por vez, campos agrupados.
//
// Antes cada resultado era um cartão de mais de uma tela de altura, sem
// cabeçalho: ao chegar em "Imagens", o rótulo que identificava o desfecho já
// tinha saído de vista, e dava para trocar a foto no resultado errado.

/** A chave identifica o resultado nas respostas já gravadas. Não pode colidir. */
export const proximaChave = (resultados: { chave: string }[]): string => {
  let n = resultados.length + 1;
  while (resultados.some((r) => r.chave === `r${n}`)) n += 1;
  return `r${n}`;
};

const SecaoResultados = ({
  quiz,
  selecionado,
  onSelecionar,
  onChange,
}: {
  quiz: Quiz;
  selecionado: number;
  onSelecionar: (i: number) => void;
  onChange: (resultados: QuizResultado[]) => void;
}) => {
  const resultados = quiz.resultados ?? [];
  const atual = resultados[selecionado];
  const eixos = quiz.eixos ?? [];

  const semResultado = eixos.filter(
    (e) => e.trim() && !resultados.some((r) => r.eixo === e)
  );

  const troca = (t: Partial<QuizResultado>) =>
    onChange(resultados.map((r, i) => (i === selecionado ? { ...r, ...t } : r)));

  const fotos = atual?.fotos ?? [];
  const destino = atual?.destino ?? {};

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,240px)_minmax(0,1fr)]">
      <div>
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-900">
            Resultados ({resultados.length})
          </h2>
          <Button
            onClick={() => {
              onChange([
                ...resultados,
                {
                  chave: proximaChave(resultados),
                  // Nasce no primeiro perfil sem resultado: antes nascia sempre
                  // como empate, e o clique não resolvia o que o aviso pedia.
                  eixo: semResultado[0] ?? null,
                  rotulo: "",
                },
              ]);
              onSelecionar(resultados.length);
            }}
            size="sm"
            type="button"
            variant="ghost"
          >
            + Resultado
          </Button>
        </div>

        <ul className="mt-3 space-y-1.5">
          {resultados.map((r, i) => (
            <li key={r.chave || i}>
              <button
                aria-current={i === selecionado}
                className={`w-full rounded-lg border px-3 py-2.5 text-left ${
                  i === selecionado
                    ? "border-brand-300 bg-brand-50"
                    : "border-gray-200 bg-white hover:border-gray-300"
                }`}
                onClick={() => onSelecionar(i)}
                type="button"
              >
                <span className="block text-sm text-gray-900">
                  {r.rotulo || (
                    <span className="italic text-gray-400">sem rótulo</span>
                  )}
                </span>
                <span className="mt-0.5 block text-xs text-gray-500">
                  {r.eixo ? `perfil: ${r.eixo}` : "empate"}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>

      {atual ? (
        <div className="space-y-5">
          <Grupo
            ajuda="Qual perfil leva a este resultado, e como ele aparece na lista."
            titulo="Identificação e regra"
          >
            <Field label="Rótulo">
              <Input
                onChange={(e) => troca({ rotulo: e.target.value })}
                placeholder="Serra da Ibiapaba"
                value={atual.rotulo}
              />
            </Field>
            <Field label="Aparece quando vence o perfil">
              <Select
                onChange={(e) => troca({ eixo: e.target.value || null })}
                value={atual.eixo ?? ""}
              >
                {/* O empate deixa de ser "campo vazio sem explicação". */}
                <option value="">
                  Empate — nenhum perfil vence por margem
                </option>
                {eixos.map((eixo) => (
                  <option key={eixo} value={eixo}>
                    {eixo}
                  </option>
                ))}
              </Select>
            </Field>
            {!atual.eixo && (
              <p className="rounded border border-gray-200 bg-gray-50 p-3 text-sm text-gray-600">
                Este é o resultado de empate. Ele aparece quando a diferença
                entre o primeiro e o segundo perfil for menor que a margem
                definida em Perfis e pontuação (hoje: {quiz.margem_empate}).
              </p>
            )}
          </Grupo>

          <Grupo titulo="Título e descrição">
            <Field
              hint="Vazio usa o rótulo acima."
              label="Título da tela de resultado"
            >
              <Input
                id={`titulo-${selecionado}`}
                onChange={(e) => troca({ titulo: e.target.value || null })}
                placeholder="{{nome}}, suas respostas mostram que…"
                value={atual.titulo ?? ""}
              />
            </Field>
            <Variaveis
              onInserir={(v) => troca({ titulo: `${atual.titulo ?? ""}${v}` })}
              variaveis={["nome", "rotulo"]}
            />
            <Field label="Descrição">
              <Textarea
                onChange={(e) => troca({ texto: e.target.value })}
                rows={5}
                value={atual.texto ?? ""}
              />
            </Field>
          </Grupo>

          <Grupo
            ajuda={
              eixos.length === 2
                ? "Onde este resultado cai entre os dois perfis."
                : undefined
            }
            titulo="Indicador entre perfis"
          >
            {eixos.length === 2 ? (
              <>
                <Regua
                  direita={eixos[1]!}
                  esquerda={eixos[0]!}
                  onChange={(posicao) => troca({ posicao })}
                  valor={atual.posicao}
                />
                <Field label="Frase sob o indicador">
                  <Input
                    onChange={(e) =>
                      troca({ regua_rotulo: e.target.value || null })
                    }
                    placeholder="Mais aventura"
                    value={atual.regua_rotulo ?? ""}
                  />
                </Field>
              </>
            ) : (
              <p className="text-sm text-gray-500">
                O indicador só existe em quiz de dois perfis — este tem{" "}
                {eixos.length}. O que já foi escrito continua guardado e volta a
                valer se o quiz voltar a ter dois.
              </p>
            )}
          </Grupo>

          <Grupo titulo="Motivos">
            <ListaDeTextos
              hint="Lista com check, abaixo do indicador."
              itens={atual.motivos ?? []}
              label="Motivos"
              onChange={(motivos) => troca({ motivos })}
              placeholder="Paisagens, serra e experiências ao ar livre."
              textoAdicionar="+ Motivo"
            />
          </Grupo>

          <Grupo
            acao={
              <Button
                onClick={() => troca({ fotos: [...fotos, { url: "" }] })}
                size="sm"
                type="button"
                variant="ghost"
              >
                + Imagem
              </Button>
            }
            ajuda="Duas imagens aparecem lado a lado. Sem imagem, o bloco não aparece."
            titulo={`Imagens (${fotos.length})`}
          >
            {/* Estado vazio COM o campo de envio dentro, e nao um aviso
                dizendo que nao ha nada: o botao "+ Imagem" no canto do
                cabecalho era discreto demais e a pessoa nao achava por onde
                subir a foto. */}
            {fotos.length === 0 && (
              <div className="rounded-lg border border-dashed border-gray-300 p-4">
                <Field
                  hint="Cole um link ou envie do computador. Você pode adicionar mais depois."
                  label="Primeira imagem"
                >
                  <ImageField
                    bucket="site-assets"
                    onChange={(url) => troca({ fotos: [{ url }] })}
                    value=""
                  />
                </Field>
              </div>
            )}

            {fotos.map((foto, f) => {
              const trocaFoto = (t: Partial<QuizFoto>) =>
                troca({
                  fotos: fotos.map((x, k) => (k === f ? { ...x, ...t } : x)),
                });
              return (
                <div className="rounded-lg border border-gray-200 p-4" key={f}>
                  <Field label={`Imagem ${f + 1}`}>
                    <ImageField
                      bucket="site-assets"
                      onChange={(url) => trocaFoto({ url })}
                      value={foto.url}
                    />
                  </Field>
                  <div className="mt-3 grid gap-4 sm:grid-cols-2">
                    <Field label="Legenda">
                      <Input
                        onChange={(e) =>
                          trocaFoto({ legenda: e.target.value || null })
                        }
                        placeholder="Teleférico sobre a mata"
                        value={foto.legenda ?? ""}
                      />
                    </Field>
                    <Field
                      hint="Canto da imagem. Vazio não desenha."
                      label="Carimbo"
                    >
                      <Input
                        onChange={(e) =>
                          trocaFoto({ selo: e.target.value || null })
                        }
                        placeholder="Simulação"
                        value={foto.selo ?? ""}
                      />
                    </Field>
                  </div>
                  <ConfirmButton
                    className="mt-3 text-xs font-semibold text-gray-400 hover:text-red-600"
                    message={`Remover a imagem ${f + 1}?`}
                    onConfirm={async () =>
                      troca({ fotos: fotos.filter((_, k) => k !== f) })
                    }
                  >
                    Remover imagem
                  </ConfirmButton>
                </div>
              );
            })}
          </Grupo>

          <Grupo titulo="Destino">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Nome do destino">
                <Input
                  onChange={(e) =>
                    troca({
                      destino: { ...destino, nome: e.target.value || null },
                    })
                  }
                  placeholder="Serra da Ibiapaba"
                  value={destino.nome ?? ""}
                />
              </Field>
              <Field label="Subtítulo">
                <Input
                  onChange={(e) =>
                    troca({
                      destino: { ...destino, subtitulo: e.target.value || null },
                    })
                  }
                  placeholder="Sítio do Bosco + Lapa + Ubajara"
                  value={destino.subtitulo ?? ""}
                />
              </Field>
            </div>
            <ListaDeTextos
              itens={destino.itens ?? []}
              label="O que a viagem inclui"
              onChange={(itens) => troca({ destino: { ...destino, itens } })}
              placeholder="Saída sábado, 5 de setembro"
              textoAdicionar="+ Item"
            />
          </Grupo>

          <ConfirmButton
            className="text-sm font-semibold text-red-600"
            message={`Excluir o resultado "${atual.rotulo || atual.chave}"? As respostas já gravadas nele deixam de ter rótulo no relatório.`}
            onConfirm={async () => {
              onChange(resultados.filter((_, j) => j !== selecionado));
              onSelecionar(Math.max(0, selecionado - 1));
            }}
          >
            Excluir resultado
          </ConfirmButton>
        </div>
      ) : (
        <p className="text-sm text-gray-500">
          Selecione um resultado, ou crie o primeiro.
        </p>
      )}
    </div>
  );
};

export default SecaoResultados;
