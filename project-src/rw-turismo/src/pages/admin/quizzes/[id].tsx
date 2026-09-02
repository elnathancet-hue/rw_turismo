import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import AdminGuard from "../../../components/admin/AdminGuard";
import AdminLayout from "../../../components/admin/AdminLayout";
import Button from "../../../components/ui/Button";
import ListaDeTextos from "../../../components/admin/ListaDeTextos";
import { Field, Input, Select, Textarea } from "../../../components/ui/form";
import { getAdminQuiz, saveAdminQuiz } from "../../../lib/quiz/client";
import type {
  Quiz,
  QuizFoto,
  QuizPergunta,
  QuizResultado,
  QuizResultadoLayout,
} from "../../../lib/quiz/types";
import {
  eixosOrfaos,
  removerEixo as removerEixoDoQuiz,
  renomearEixo as renomearEixoDoQuiz,
} from "../../../lib/quiz/eixos";
import { slugify } from "../../../lib/admin/slugs";
import { hrefSeguro } from "../../../lib/security/url";

// Editor de quiz.
//
// A parte trabalhosa é a lista aninhada: perguntas contêm opções, e cada opção
// distribui pesos entre os eixos. O padrão de mover/remover é o mesmo do
// construtor de páginas (PageBuilder.moveBlock): troca com o vizinho, sem
// arrastar, porque arrastar em lista aninhada erra mais do que acerta.
//
// NENHUM CAMPO AQUI É HTML. Tudo é texto e vai para a tela pelo React, que
// escapa. É essa garantia que deixa o papel `conteudo` criar quiz — foi a falta
// dela que obrigou a travar pages.custom_html no admin.

const trocar = <T,>(lista: T[], i: number, dir: -1 | 1): T[] => {
  const alvo = i + dir;
  if (alvo < 0 || alvo >= lista.length) return lista;
  const next = [...lista];
  [next[i], next[alvo]] = [next[alvo], next[i]];
  return next;
};

const AdminQuizEditor = () => {
  const router = useRouter();
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  useEffect(() => {
    if (!router.isReady) return;
    const id = router.query.id;
    if (typeof id !== "string") return;

    getAdminQuiz(id)
      .then((q) => {
        if (!q) setErro("Quiz não encontrado.");
        else setQuiz(q);
      })
      .catch((e) => setErro(e instanceof Error ? e.message : "Falha ao abrir."));
  }, [router.isReady, router.query.id]);

  if (erro && !quiz) {
    return (
      <AdminGuard>
        <AdminLayout title="Quiz">
          <p className="text-red-600">{erro}</p>
        </AdminLayout>
      </AdminGuard>
    );
  }
  if (!quiz) {
    return (
      <AdminGuard>
        <AdminLayout title="Quiz">
          <p className="text-gray-500">Carregando…</p>
        </AdminLayout>
      </AdminGuard>
    );
  }

  const set = <K extends keyof Quiz>(campo: K, valor: Quiz[K]) =>
    setQuiz({ ...quiz, [campo]: valor });

  // Renomear/remover eixo migra pesos e resultados junto — ver lib/quiz/eixos.ts.
  const renomearEixo = (i: number, nome: string) =>
    setQuiz(renomearEixoDoQuiz(quiz, i, nome));
  const removerEixo = (i: number) => setQuiz(removerEixoDoQuiz(quiz, i));
  const orfaos = eixosOrfaos(quiz);

  const setPerguntas = (perguntas: QuizPergunta[]) => set("perguntas", perguntas);
  // Spread, e nunca reconstrucao campo a campo: e o spread que preserva chave
  // que este formulario ainda nao conhece. Salvar substitui o jsonb inteiro.
  const layout: QuizResultadoLayout = quiz.resultado_layout ?? {};
  const setLayout = (troca: Partial<QuizResultadoLayout>) =>
    set("resultado_layout", { ...(quiz.resultado_layout ?? {}), ...troca });

  const setResultados = (resultados: QuizResultado[]) =>
    set("resultados", resultados);

  const salvar = async (status?: Quiz["status"]) => {
    setErro(null);
    setAviso(null);
    setSalvando(true);
    try {
      const salvo = await saveAdminQuiz({ ...quiz, status: status ?? quiz.status });
      setQuiz(salvo);
      setAviso(status === "published" ? "Publicado." : "Salvo.");
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha ao salvar.");
    } finally {
      setSalvando(false);
    }
  };

  // Um resultado por eixo, mais um de empate: é o que a pontuação espera.
  // Sem cobrir todos, quem cair no eixo faltante recebe o primeiro resultado.
  const eixosSemResultado = quiz.eixos.filter(
    (eixo) => !quiz.resultados.some((r) => r.eixo === eixo)
  );
  const temEmpate = quiz.resultados.some((r) => !r.eixo);

  return (
    <AdminGuard>
      <AdminLayout
        title={quiz.title || "Quiz"}
        description="Perguntas, pesos e resultados. Nada aqui aceita HTML."
        action={
          <div className="flex flex-wrap gap-2">
            <Link
              className="rounded border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50"
              href="/admin/quizzes"
            >
              Voltar
            </Link>
            <Link
              className="rounded border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50"
              href={`/admin/quizzes/${quiz.id}/respostas`}
            >
              Respostas
            </Link>
            <Button loading={salvando} onClick={() => void salvar()} type="button">
              Salvar
            </Button>
            {quiz.status === "draft" ? (
              <Button
                loading={salvando}
                onClick={() => void salvar("published")}
                type="button"
              >
                Publicar
              </Button>
            ) : (
              <Button
                loading={salvando}
                onClick={() => void salvar("draft")}
                type="button"
              >
                Despublicar
              </Button>
            )}
          </div>
        }
      >
        {erro && <p className="mb-4 text-sm text-red-600">{erro}</p>}
        {aviso && <p className="mb-4 text-sm text-green-700">{aviso}</p>}

        <div className="max-w-5xl space-y-6">
          {/* ---------------------------------------------------- básico */}
          <section className="rounded-lg border bg-white p-5 shadow-sm">
            <h2 className="font-semibold">O quiz</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <Field label="Título">
                <Input
                  onChange={(e) => set("title", e.target.value)}
                  value={quiz.title}
                />
              </Field>
              <Field hint={`Fica em /quiz/${quiz.slug || "..."}`} label="Endereço">
                <Input
                  onChange={(e) => set("slug", slugify(e.target.value))}
                  value={quiz.slug}
                />
              </Field>
              <Field label="Título da abertura">
                <Input
                  onChange={(e) =>
                    set("intro", { ...quiz.intro, titulo: e.target.value })
                  }
                  value={quiz.intro?.titulo ?? ""}
                />
              </Field>
              <Field label="Texto do botão">
                <Input
                  onChange={(e) =>
                    set("intro", { ...quiz.intro, texto_botao: e.target.value })
                  }
                  placeholder="Começar"
                  value={quiz.intro?.texto_botao ?? ""}
                />
              </Field>
            </div>
            <Field className="mt-4" label="Subtítulo da abertura">
              <Textarea
                onChange={(e) =>
                  set("intro", { ...quiz.intro, subtitulo: e.target.value })
                }
                value={quiz.intro?.subtitulo ?? ""}
              />
            </Field>
            <label className="mt-4 flex items-center gap-2 text-sm">
              <input
                checked={quiz.captura_ativa}
                onChange={(e) => set("captura_ativa", e.target.checked)}
                type="checkbox"
              />
              Pedir nome e WhatsApp antes de mostrar o resultado
            </label>
          </section>

          {/* ----------------------------------------------------- eixos */}
          <section className="rounded-lg border bg-white p-5 shadow-sm">
            <h2 className="font-semibold">Eixos</h2>
            <p className="mt-1 text-sm text-gray-500">
              Os lados que o quiz mede — por exemplo <em>relaxar</em> e{" "}
              <em>aventura</em>. Cada opção de resposta soma pontos para eles.
            </p>
            {/* UM CAMPO POR EIXO, e não um texto separado por vírgula.
                O texto solto refazia a lista a cada tecla: apagar "relaxar"
                para digitar "descanso" passava por "relaxa", "relax", "rela"…
                e a cada estado os pesos — que são gravados POR NOME dentro de
                cada opção — ficavam órfãos. A pontuação ia a zero e todo mundo
                caía no empate, sem erro em lugar nenhum. */}
            <div className="mt-4 space-y-2">
              {quiz.eixos.map((eixo, i) => (
                <div className="flex min-w-0 items-center gap-2" key={i}>
                  <Input
                    className="min-w-0 flex-1"
                    onChange={(e) => renomearEixo(i, e.target.value)}
                    value={eixo}
                  />
                  <button
                    className="shrink-0 rounded border px-3 py-2 text-xs font-semibold text-red-600 disabled:opacity-40"
                    disabled={quiz.eixos.length <= 1}
                    onClick={() => removerEixo(i)}
                    type="button"
                  >
                    Remover
                  </button>
                </div>
              ))}
              <button
                className="text-sm font-semibold text-brand-600 hover:underline"
                onClick={() => set("eixos", [...quiz.eixos, ""])}
                type="button"
              >
                + Eixo
              </button>
            </div>
            <Field
              className="mt-4"
              hint="Diferença mínima para um eixo vencer. Abaixo dela, vale o resultado de empate."
              label="Margem de empate"
            >
              <Input
                onChange={(e) =>
                  set("margem_empate", Number(e.target.value) || 0)
                }
                step="0.5"
                type="number"
                value={quiz.margem_empate}
              />
            </Field>
          </section>

          {/* ------------------------------------------------- perguntas */}
          <section className="rounded-lg border bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">
                Perguntas ({quiz.perguntas.length})
              </h2>
              <button
                className="text-sm font-semibold text-brand-600 hover:underline"
                onClick={() =>
                  setPerguntas([
                    ...quiz.perguntas,
                    { texto: "", opcoes: [{ texto: "", pesos: {} }] },
                  ])
                }
                type="button"
              >
                + Pergunta
              </button>
            </div>

            <div className="mt-4 space-y-5">
              {quiz.perguntas.map((pergunta, iP) => (
                <div className="rounded-lg border p-4" key={iP}>
                  <div className="flex min-w-0 items-start gap-2 [&>label]:min-w-0 [&>label]:flex-1">
                    <Field label={`Pergunta ${iP + 1}`}>
                      <Textarea
                        onChange={(e) =>
                          setPerguntas(
                            quiz.perguntas.map((p, j) =>
                              j === iP ? { ...p, texto: e.target.value } : p
                            )
                          )
                        }
                        value={pergunta.texto}
                      />
                    </Field>
                    <div className="mt-6 flex shrink-0 gap-1 text-xs">
                      <button
                        className="rounded border px-2 py-1"
                        onClick={() => setPerguntas(trocar(quiz.perguntas, iP, -1))}
                        type="button"
                      >
                        ↑
                      </button>
                      <button
                        className="rounded border px-2 py-1"
                        onClick={() => setPerguntas(trocar(quiz.perguntas, iP, 1))}
                        type="button"
                      >
                        ↓
                      </button>
                      <button
                        className="rounded border px-2 py-1 text-red-600"
                        onClick={() =>
                          setPerguntas(quiz.perguntas.filter((_, j) => j !== iP))
                        }
                        type="button"
                      >
                        Remover
                      </button>
                    </div>
                  </div>

                  <p className="mt-3 text-sm font-medium text-gray-700">Opções</p>
                  <div className="mt-2 space-y-2">
                    {pergunta.opcoes.map((opcao, iO) => (
                      <div className="rounded border bg-gray-50 p-3" key={iO}>
                        <Input
                          onChange={(e) =>
                            setPerguntas(
                              quiz.perguntas.map((p, j) =>
                                j === iP
                                  ? {
                                      ...p,
                                      opcoes: p.opcoes.map((o, k) =>
                                        k === iO
                                          ? { ...o, texto: e.target.value }
                                          : o
                                      ),
                                    }
                                  : p
                              )
                            )
                          }
                          placeholder="Texto da opção"
                          value={opcao.texto}
                        />
                        <div className="mt-2 flex flex-wrap items-end gap-3">
                          {quiz.eixos.map((eixo) => (
                            <label className="text-xs text-gray-600" key={eixo}>
                              {eixo}
                              <input
                                className="mt-1 block w-24 rounded border px-2 py-1"
                                onChange={(e) => {
                                  const v = e.target.value;
                                  setPerguntas(
                                    quiz.perguntas.map((p, j) =>
                                      j === iP
                                        ? {
                                            ...p,
                                            opcoes: p.opcoes.map((o, k) => {
                                              if (k !== iO) return o;
                                              const pesos = { ...o.pesos };
                                              // Campo vazio REMOVE o eixo, em
                                              // vez de gravar zero: opção
                                              // neutra é a que não tem peso.
                                              if (v === "") delete pesos[eixo];
                                              else pesos[eixo] = Number(v) || 0;
                                              return { ...o, pesos };
                                            }),
                                          }
                                        : p
                                    )
                                  );
                                }}
                                placeholder="—"
                                step="0.5"
                                type="number"
                                value={opcao.pesos?.[eixo] ?? ""}
                              />
                            </label>
                          ))}
                          <button
                            className="ml-auto text-xs font-semibold text-red-600"
                            onClick={() =>
                              setPerguntas(
                                quiz.perguntas.map((p, j) =>
                                  j === iP
                                    ? {
                                        ...p,
                                        opcoes: p.opcoes.filter((_, k) => k !== iO),
                                      }
                                    : p
                                )
                              )
                            }
                            type="button"
                          >
                            Remover opção
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  <button
                    className="mt-2 text-sm font-semibold text-brand-600 hover:underline"
                    onClick={() =>
                      setPerguntas(
                        quiz.perguntas.map((p, j) =>
                          j === iP
                            ? { ...p, opcoes: [...p.opcoes, { texto: "", pesos: {} }] }
                            : p
                        )
                      )
                    }
                    type="button"
                  >
                    + Opção
                  </button>
                </div>
              ))}
            </div>
          </section>

          {/* ------------------------------------- moldura do resultado */}
          <section className="rounded-lg border bg-white p-5 shadow-sm">
            <h2 className="font-semibold">Moldura da tela de resultado</h2>
            <p className="mt-1 text-sm text-gray-500">
              Os rótulos que são iguais em todos os desfechos. O que muda por
              desfecho fica em cada resultado, abaixo. Campo vazio não aparece na
              tela.
            </p>

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <Field
                hint="A linha pequena acima do título."
                label="Olho"
              >
                <Input
                  onChange={(e) => setLayout({ olho: e.target.value || null })}
                  placeholder="Sua leitura"
                  value={layout.olho ?? ""}
                />
              </Field>
              <Field label="Assinatura do rodapé">
                <Input
                  onChange={(e) =>
                    setLayout({ assinatura: e.target.value || null })
                  }
                  placeholder="@rwturismo.pi"
                  value={layout.assinatura ?? ""}
                />
              </Field>
              <Field label="Título da lista de motivos">
                <Input
                  onChange={(e) =>
                    setLayout({ titulo_motivos: e.target.value || null })
                  }
                  placeholder="Por que essa viagem combina com você?"
                  value={layout.titulo_motivos ?? ""}
                />
              </Field>
              <Field label="Título do bloco de destino">
                <Input
                  onChange={(e) =>
                    setLayout({ titulo_destino: e.target.value || null })
                  }
                  placeholder="Seu destino"
                  value={layout.titulo_destino ?? ""}
                />
              </Field>
            </div>

            <div className="mt-4">
              <Field
                hint="Texto pequeno de confiança, abaixo dos blocos."
                label="Selo"
              >
                <Textarea
                  onChange={(e) => setLayout({ selo: e.target.value || null })}
                  placeholder="Mais de 25 anos de estrada, Cadastur, loja física em Teresina…"
                  rows={2}
                  value={layout.selo ?? ""}
                />
              </Field>
            </div>

            <div className="mt-4 border-t pt-4">
              <ListaDeTextos
                hint="Aparecem embaixo do botão, em letra pequena."
                itens={quiz.cta?.micro ?? []}
                label="Linhas sob o botão"
                onChange={(micro) => set("cta", { ...quiz.cta, micro })}
                placeholder="Você cai direto no WhatsApp, com a mensagem já escrita."
                textoAdicionar="+ Linha"
              />
            </div>
          </section>

          {/* ------------------------------------------------ resultados */}
          <section className="rounded-lg border bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">
                Resultados ({quiz.resultados.length})
              </h2>
              <button
                className="text-sm font-semibold text-brand-600 hover:underline"
                onClick={() =>
                  setResultados([
                    ...quiz.resultados,
                    { chave: `r${quiz.resultados.length + 1}`, eixo: null, rotulo: "" },
                  ])
                }
                type="button"
              >
                + Resultado
              </button>
            </div>

            {orfaos.length > 0 && (
              <p className="mt-3 rounded border border-red-300 bg-red-50 p-3 text-sm text-red-900">
                Há pesos apontando para eixo que não existe mais:{" "}
                <strong>{orfaos.join(", ")}</strong>. A pontuação descarta esses
                pesos, então o quiz vai dar quase sempre o mesmo resultado.
              </p>
            )}

            {(eixosSemResultado.length > 0 || !temEmpate) && (
              <p className="mt-3 rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
                {eixosSemResultado.length > 0 && (
                  <>
                    Sem resultado para: <strong>{eixosSemResultado.join(", ")}</strong>.{" "}
                  </>
                )}
                {!temEmpate && <>Falta o resultado de empate. </>}
                Quem cair aí recebe o primeiro resultado da lista.
              </p>
            )}

            <div className="mt-4 space-y-5">
              {quiz.resultados.map((resultado, i) => {
                const trocaResultado = (troca: Partial<QuizResultado>) =>
                  setResultados(
                    quiz.resultados.map((r, j) => (j === i ? { ...r, ...troca } : r))
                  );
                const fotos = resultado.fotos ?? [];
                const destino = resultado.destino ?? {};

                return (
                  <div className="rounded-lg border p-5" key={i}>
                    {/* Duas colunas, não três: com três, cada campo ficava com
                        um terço da largura e a URL da imagem não cabia — foi a
                        reclamação de "blocos apertados", e de "não vi a opção de
                        colocar imagem", que estava espremida na terceira. */}
                    <div className="grid gap-4 sm:grid-cols-[2fr_1fr]">
                      <Field label="Rótulo">
                        <Input
                          onChange={(e) => trocaResultado({ rotulo: e.target.value })}
                          placeholder="Serra da Ibiapaba"
                          value={resultado.rotulo}
                        />
                      </Field>
                      <Field hint="Vazio = resultado de empate" label="Eixo dominante">
                        <Select
                          onChange={(e) =>
                            trocaResultado({ eixo: e.target.value || null })
                          }
                          value={resultado.eixo ?? ""}
                        >
                          <option value="">— empate —</option>
                          {quiz.eixos.map((eixo) => (
                            <option key={eixo} value={eixo}>
                              {eixo}
                            </option>
                          ))}
                        </Select>
                      </Field>
                    </div>

                    <div className="mt-4">
                      <Field
                        hint="Aceita {{nome}} e {{rotulo}}. Vazio usa o rótulo acima."
                        label="Título da tela de resultado"
                      >
                        <Input
                          onChange={(e) =>
                            trocaResultado({ titulo: e.target.value || null })
                          }
                          placeholder="{{nome}}, suas respostas mostram que…"
                          value={resultado.titulo ?? ""}
                        />
                      </Field>
                    </div>

                    <div className="mt-4">
                      <Field label="Texto do resultado">
                        <Textarea
                          onChange={(e) => trocaResultado({ texto: e.target.value })}
                          rows={4}
                          value={resultado.texto ?? ""}
                        />
                      </Field>
                    </div>

                    {/* A RÉGUA só existe em quiz de dois eixos. Com três ou
                        mais, uma barra de uma dimensão colocaria o resultado num
                        ponto que não corresponde a nada. */}
                    {quiz.eixos.length === 2 && (
                      <div className="mt-4 rounded-lg bg-gray-50 p-4">
                        <p className="text-sm font-semibold text-gray-700">
                          Régua entre {quiz.eixos[0]} e {quiz.eixos[1]}
                        </p>
                        <div className="mt-3 grid gap-4 sm:grid-cols-2">
                          <Field
                            hint="0 = todo à esquerda, 100 = todo à direita"
                            label="Posição (0 a 100)"
                          >
                            <Input
                              max={100}
                              min={0}
                              onChange={(e) =>
                                trocaResultado({
                                  posicao:
                                    e.target.value === ""
                                      ? null
                                      : Number(e.target.value),
                                })
                              }
                              placeholder="50"
                              type="number"
                              value={resultado.posicao ?? ""}
                            />
                          </Field>
                          <Field label="Frase sob a régua">
                            <Input
                              onChange={(e) =>
                                trocaResultado({
                                  regua_rotulo: e.target.value || null,
                                })
                              }
                              placeholder="Mais aventura"
                              value={resultado.regua_rotulo ?? ""}
                            />
                          </Field>
                        </div>
                      </div>
                    )}

                    <div className="mt-4">
                      <ListaDeTextos
                        hint="Lista com check verde, abaixo da régua."
                        itens={resultado.motivos ?? []}
                        label="Motivos"
                        onChange={(motivos) => trocaResultado({ motivos })}
                        placeholder="Paisagens, serra e experiências ao ar livre."
                        textoAdicionar="+ Motivo"
                      />
                    </div>

                    {/* AS IMAGENS, agora em bloco próprio e com largura inteira.
                        Duas ficam lado a lado na tela pública; uma sozinha ocupa
                        a largura toda. */}
                    <div className="mt-5 border-t pt-4">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-gray-700">
                          Imagens ({fotos.length})
                        </span>
                        <button
                          className="text-sm font-semibold text-brand-600 hover:underline"
                          onClick={() =>
                            trocaResultado({ fotos: [...fotos, { url: "" }] })
                          }
                          type="button"
                        >
                          + Imagem
                        </button>
                      </div>
                      <p className="mt-1 text-xs text-gray-500">
                        Duas imagens aparecem lado a lado. Sem imagem, o bloco não
                        aparece.
                      </p>

                      {fotos.length === 0 ? (
                        <p className="mt-2 rounded-lg border border-dashed border-gray-300 p-3 text-sm text-gray-500">
                          Nenhuma imagem.
                        </p>
                      ) : (
                        <div className="mt-3 space-y-4">
                          {fotos.map((foto, f) => {
                            const trocaFoto = (troca: Partial<QuizFoto>) =>
                              trocaResultado({
                                fotos: fotos.map((x, k) =>
                                  k === f ? { ...x, ...troca } : x
                                ),
                              });
                            return (
                              <div className="rounded-lg border bg-gray-50 p-4" key={f}>
                                <Field label={`Imagem ${f + 1} — endereço (URL)`}>
                                  <Input
                                    onChange={(e) => trocaFoto({ url: e.target.value })}
                                    placeholder="https://…/foto.jpg"
                                    value={foto.url}
                                  />
                                </Field>
                                {foto.url && hrefSeguro(foto.url) && (
                                  <img
                                    alt=""
                                    className="mt-2 h-32 w-full rounded border object-cover"
                                    src={hrefSeguro(foto.url) as string}
                                  />
                                )}
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
                                    label="Selo"
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
                                <button
                                  className="mt-3 text-xs font-semibold text-red-600"
                                  onClick={() =>
                                    trocaResultado({
                                      fotos: fotos.filter((_, k) => k !== f),
                                    })
                                  }
                                  type="button"
                                >
                                  Remover imagem
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    <div className="mt-5 border-t pt-4">
                      <p className="text-sm font-semibold text-gray-700">Destino</p>
                      <div className="mt-3 grid gap-4 sm:grid-cols-2">
                        <Field label="Nome do destino">
                          <Input
                            onChange={(e) =>
                              trocaResultado({
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
                              trocaResultado({
                                destino: {
                                  ...destino,
                                  subtitulo: e.target.value || null,
                                },
                              })
                            }
                            placeholder="Sítio do Bosco + Lapa + Ubajara"
                            value={destino.subtitulo ?? ""}
                          />
                        </Field>
                      </div>
                      <div className="mt-4">
                        <ListaDeTextos
                          itens={destino.itens ?? []}
                          label="O que a viagem inclui"
                          onChange={(itens) =>
                            trocaResultado({ destino: { ...destino, itens } })
                          }
                          placeholder="Saída sábado, 5 de setembro"
                          textoAdicionar="+ Item"
                        />
                      </div>
                    </div>

                    <button
                      className="mt-5 text-xs font-semibold text-red-600"
                      onClick={() =>
                        setResultados(quiz.resultados.filter((_, j) => j !== i))
                      }
                      type="button"
                    >
                      Remover resultado
                    </button>
                  </div>
                );
              })}
            </div>
          </section>

          {/* ------------------------------------------------------- cta */}
          <section className="rounded-lg border bg-white p-5 shadow-sm">
            <h2 className="font-semibold">Botão no fim</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <Field label="Tipo">
                <Select
                  onChange={(e) =>
                    set("cta", {
                      ...quiz.cta,
                      tipo: e.target.value as "whatsapp" | "nenhum",
                    })
                  }
                  value={quiz.cta?.tipo ?? "nenhum"}
                >
                  <option value="nenhum">Nenhum</option>
                  <option value="whatsapp">WhatsApp</option>
                </Select>
              </Field>
              <Field hint="Só números, com DDI" label="Número">
                <Input
                  onChange={(e) => set("cta", { ...quiz.cta, numero: e.target.value })}
                  placeholder="5586999999999"
                  value={quiz.cta?.numero ?? ""}
                />
              </Field>
            </div>
            <Field
              hint="{{resultado}} e {{nome}} são trocados na hora do envio."
              label="Mensagem pronta"
            >
              <Textarea
                onChange={(e) => set("cta", { ...quiz.cta, molde: e.target.value })}
                value={quiz.cta?.molde ?? ""}
              />
            </Field>
          </section>
        </div>
      </AdminLayout>
    </AdminGuard>
  );
};

export default AdminQuizEditor;
