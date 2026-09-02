import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import AdminGuard from "../../../components/admin/AdminGuard";
import AdminLayout from "../../../components/admin/AdminLayout";
import Button from "../../../components/ui/Button";
import { Field, Input, Select, Textarea } from "../../../components/ui/form";
import { getAdminQuiz, saveAdminQuiz } from "../../../lib/quiz/client";
import type { Quiz, QuizPergunta, QuizResultado } from "../../../lib/quiz/types";
import { slugify } from "../../../lib/admin/slugs";

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

  const setPerguntas = (perguntas: QuizPergunta[]) => set("perguntas", perguntas);
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
          <div className="flex gap-2">
            <Link
              className="rounded border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50"
              href="/admin/quizzes"
            >
              Voltar
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

        <div className="max-w-3xl space-y-6">
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
            <Field label="Subtítulo da abertura">
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
            <Field
              hint="Separe por vírgula. Mudar um nome aqui exige acertar os pesos das opções."
              label="Nomes dos eixos"
            >
              <Input
                onChange={(e) =>
                  set(
                    "eixos",
                    e.target.value
                      .split(",")
                      .map((x) => x.trim())
                      .filter(Boolean)
                  )
                }
                value={quiz.eixos.join(", ")}
              />
            </Field>
            <Field
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
                  <div className="flex items-start gap-2">
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

            <div className="mt-4 space-y-4">
              {quiz.resultados.map((resultado, i) => (
                <div className="rounded-lg border p-4" key={i}>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <Field label="Rótulo">
                      <Input
                        onChange={(e) =>
                          setResultados(
                            quiz.resultados.map((r, j) =>
                              j === i ? { ...r, rotulo: e.target.value } : r
                            )
                          )
                        }
                        value={resultado.rotulo}
                      />
                    </Field>
                    <Field hint="Vazio = resultado de empate" label="Eixo dominante">
                      <Select
                        onChange={(e) =>
                          setResultados(
                            quiz.resultados.map((r, j) =>
                              j === i ? { ...r, eixo: e.target.value || null } : r
                            )
                          )
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
                    <Field label="Imagem (URL)">
                      <Input
                        onChange={(e) =>
                          setResultados(
                            quiz.resultados.map((r, j) =>
                              j === i ? { ...r, foto: e.target.value || null } : r
                            )
                          )
                        }
                        placeholder="https://…"
                        value={resultado.foto ?? ""}
                      />
                    </Field>
                  </div>
                  <Field label="Texto do resultado">
                    <Textarea
                      onChange={(e) =>
                        setResultados(
                          quiz.resultados.map((r, j) =>
                            j === i ? { ...r, texto: e.target.value } : r
                          )
                        )
                      }
                      value={resultado.texto ?? ""}
                    />
                  </Field>
                  <button
                    className="mt-2 text-xs font-semibold text-red-600"
                    onClick={() =>
                      setResultados(quiz.resultados.filter((_, j) => j !== i))
                    }
                    type="button"
                  >
                    Remover resultado
                  </button>
                </div>
              ))}
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
