import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import AdminGuard from "../../../components/admin/AdminGuard";
import AdminLayout from "../../../components/admin/AdminLayout";
import ConfirmButton from "../../../components/admin/ConfirmButton";
import ImageField from "../../../components/admin/ImageField";
import ListaDeTextos from "../../../components/admin/ListaDeTextos";
import PreviaDoQuiz, {
  type FocoDaPrevia,
} from "../../../components/admin/quiz/PreviaDoQuiz";
import SecaoPerguntas from "../../../components/admin/quiz/SecaoPerguntas";
import SecaoResultados from "../../../components/admin/quiz/SecaoResultados";
import { Grupo, Variaveis } from "../../../components/admin/quiz/campos";
import Button from "../../../components/ui/Button";
import { Field, Input, Select, Textarea } from "../../../components/ui/form";
import { getAdminQuiz, saveAdminQuiz } from "../../../lib/quiz/client";
import {
  eixosOrfaos,
  removerEixo as removerEixoDoQuiz,
  renomearEixo as renomearEixoDoQuiz,
} from "../../../lib/quiz/eixos";
import {
  analisarQuiz,
  avisos as soAvisos,
  erros as soErros,
  type Apontamento,
  type Secao,
} from "../../../lib/quiz/validacao";
import type {
  Quiz,
  QuizResultadoLayout,
} from "../../../lib/quiz/types";
import { slugify } from "../../../lib/admin/slugs";

// Editor de quiz.
//
// A tela era a serialização direta do jsonb: seis blocos na ordem do tipo Quiz,
// empilhados num rolar de ~900 linhas. Agora é navegação lateral + uma seção
// por vez + prévia do que está sendo editado.
//
// NENHUM CAMPO AQUI É HTML. Tudo é texto e vai para a tela pelo React, que
// escapa. É essa garantia que deixa o papel `conteudo` criar quiz — foi a falta
// dela que obrigou a travar pages.custom_html no admin.
//
// SOBRE "ALTERAÇÕES NÃO PUBLICADAS": a tabela `quizzes` tem UMA linha por quiz,
// com `status` draft|published, e saveAdminQuiz faz `update` nessa mesma linha.
// Não existe versão publicada separada da versão em edição — salvar um quiz
// publicado publica a mudança na hora. Por isso a tela NÃO mostra "alterações
// não publicadas": seria inventar um estado que o banco não tem. O que ela
// mostra, quando o quiz está publicado e há trabalho pendente, é o aviso de que
// salvar vai ao ar.

type Estado = "parado" | "salvando" | "salvo" | "erro";

const SECOES: { id: Secao; nome: string }[] = [
  { id: "geral", nome: "Informações gerais" },
  { id: "perguntas", nome: "Perguntas" },
  { id: "perfis", nome: "Perfis e pontuação" },
  { id: "resultados", nome: "Resultados" },
  { id: "aparencia", nome: "Layout do resultado" },
  { id: "contato", nome: "Contato e WhatsApp" },
];

const AdminQuizEditor = () => {
  const router = useRouter();
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [estado, setEstado] = useState<Estado>("parado");
  const [erroTexto, setErroTexto] = useState<string | null>(null);
  const [erroCarga, setErroCarga] = useState<string | null>(null);
  const [sujo, setSujo] = useState(false);

  const [secao, setSecao] = useState<Secao>("geral");
  // Guardados fora da seção: trocar de seção e voltar não pode perder o que
  // estava aberto.
  const [perguntaAtual, setPerguntaAtual] = useState(0);
  const [resultadoAtual, setResultadoAtual] = useState(0);
  const [previaAberta, setPreviaAberta] = useState(true);

  useEffect(() => {
    if (!sujo) return;
    const avisar = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", avisar);
    return () => window.removeEventListener("beforeunload", avisar);
  }, [sujo]);

  // Navegação interna do Next não passa por beforeunload — sem isto, clicar em
  // "Respostas" ou no menu lateral levava o trabalho junto, em silêncio.
  useEffect(() => {
    if (!sujo) return;
    const aoSair = () => {
      if (
        !window.confirm(
          "Você tem alterações que ainda não foram salvas. Sair mesmo assim?"
        )
      ) {
        router.events.emit("routeChangeError");
        // eslint-disable-next-line no-throw-literal
        throw "Navegação cancelada.";
      }
    };
    router.events.on("routeChangeStart", aoSair);
    return () => router.events.off("routeChangeStart", aoSair);
  }, [sujo, router.events]);

  useEffect(() => {
    if (!router.isReady) return;
    const id = router.query.id;
    if (typeof id !== "string") return;

    getAdminQuiz(id)
      .then((q) => {
        if (!q) setErroCarga("Quiz não encontrado.");
        else setQuiz(q);
      })
      .catch((e) =>
        setErroCarga(e instanceof Error ? e.message : "Falha ao abrir.")
      );
  }, [router.isReady, router.query.id]);

  if (erroCarga && !quiz) {
    return (
      <AdminGuard>
        <AdminLayout title="Quiz">
          <p className="text-red-600">{erroCarga}</p>
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

  const alterar = (proximo: Quiz) => {
    setQuiz(proximo);
    setSujo(true);
    // "Salvo" some assim que a pessoa edita: manter o verde na tela enquanto há
    // trabalho pendente é a tela mentindo sobre o estado do trabalho.
    if (estado === "salvo") setEstado("parado");
  };

  // Spread, e nunca reconstrução campo a campo: é o spread que preserva chave
  // que este formulário ainda não conhece. Salvar substitui o jsonb inteiro.
  const set = <K extends keyof Quiz>(campo: K, valor: Quiz[K]) =>
    alterar({ ...quiz, [campo]: valor });

  const layout: QuizResultadoLayout = quiz.resultado_layout ?? {};
  const setLayout = (troca: Partial<QuizResultadoLayout>) =>
    set("resultado_layout", { ...layout, ...troca });

  const renomearEixo = (i: number, nome: string) =>
    alterar(renomearEixoDoQuiz(quiz, i, nome));
  const removerEixo = (i: number) => alterar(removerEixoDoQuiz(quiz, i));
  const orfaos = eixosOrfaos(quiz);

  const apontamentos = analisarQuiz(quiz);
  const erros = soErros(apontamentos);
  const avisos = soAvisos(apontamentos);

  const salvar = async (status?: Quiz["status"]) => {
    setErroTexto(null);
    setEstado("salvando");
    try {
      const salvo = await saveAdminQuiz({
        ...quiz,
        status: status ?? quiz.status,
      });
      // "Salvo" só depois da confirmação real do banco.
      setQuiz(salvo);
      setSujo(false);
      setEstado("salvo");
    } catch (e) {
      setEstado("erro");
      setErroTexto(e instanceof Error ? e.message : "Não foi possível salvar.");
    }
  };

  const irPara = (a: Apontamento) => {
    setSecao(a.secao);
    if (a.item === undefined) return;
    if (a.secao === "perguntas") setPerguntaAtual(a.item);
    if (a.secao === "resultados") setResultadoAtual(a.item);
  };

  const foco: FocoDaPrevia =
    secao === "perguntas"
      ? { tela: "pergunta", indice: perguntaAtual }
      : secao === "resultados" || secao === "aparencia"
        ? { tela: "resultado", indice: resultadoAtual }
        : { tela: "abertura" };

  const contagem: Partial<Record<Secao, number>> = {
    perguntas: quiz.perguntas?.length,
    perfis: quiz.eixos?.length,
    resultados: quiz.resultados?.length,
  };

  const listaDeApontamentos = (
    itens: Apontamento[],
    tom: "erro" | "aviso"
  ) => (
    <details
      className={`rounded border p-2 ${
        tom === "erro"
          ? "border-red-200 bg-red-50"
          : "border-amber-200 bg-amber-50"
      }`}
    >
      <summary
        className={`cursor-pointer font-semibold ${
          tom === "erro" ? "text-red-800" : "text-amber-800"
        }`}
      >
        {itens.length}{" "}
        {tom === "erro"
          ? `erro${itens.length > 1 ? "s" : ""}`
          : `aviso${itens.length > 1 ? "s" : ""}`}
      </summary>
      <ul className="mt-1 space-y-1">
        {itens.map((a, i) => (
          <li key={i}>
            <button
              className={`text-left hover:underline ${
                tom === "erro" ? "text-red-900" : "text-amber-900"
              }`}
              onClick={() => irPara(a)}
              type="button"
            >
              {a.texto}
            </button>
          </li>
        ))}
      </ul>
    </details>
  );

  return (
    <AdminGuard>
      <AdminLayout
        action={
          <div className="flex flex-wrap items-center gap-2">
            {/* Estado por texto, e não só por cor. aria-live avisa quem usa
                leitor de tela sem precisar procurar o selo. */}
            <span
              aria-live="polite"
              className={`text-xs font-semibold ${
                estado === "erro"
                  ? "text-red-700"
                  : estado === "salvando"
                    ? "text-gray-600"
                    : estado === "salvo"
                      ? "text-green-700"
                      : sujo
                        ? "text-amber-700"
                        : "text-gray-400"
              }`}
            >
              {estado === "salvando"
                ? "Salvando…"
                : estado === "erro"
                  ? "Erro ao salvar"
                  : estado === "salvo"
                    ? "Salvo"
                    : sujo
                      ? "Não salvo"
                      : "Tudo salvo"}
            </span>

            <button
              className="rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-800 hover:bg-gray-50"
              onClick={() => void router.push("/admin/quizzes")}
              type="button"
            >
              Voltar
            </button>
            <Link
              className="rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-800 hover:bg-gray-50"
              href={`/admin/quizzes/${quiz.id}/respostas`}
            >
              Respostas
            </Link>
            {/* "Visualizar" só quando há o que visualizar: a rota pública
                mostra apenas quiz publicado, de propósito. */}
            {quiz.status === "published" && quiz.slug && (
              <a
                className="rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-800 hover:bg-gray-50"
                href={`/quiz/${quiz.slug}`}
                rel="noopener noreferrer"
                target="_blank"
              >
                Visualizar
              </a>
            )}

            <Button
              loading={estado === "salvando"}
              onClick={() => void salvar()}
              type="button"
            >
              Salvar
            </Button>

            {quiz.status === "draft" ? (
              <Button
                loading={estado === "salvando"}
                onClick={() => void salvar("published")}
                type="button"
              >
                Publicar
              </Button>
            ) : (
              // Despublicar sai do lugar da ação principal e ganha confirmação.
              <ConfirmButton
                className="rounded-lg px-3 py-2.5 text-sm font-semibold text-gray-500 hover:text-gray-900"
                confirmLabel="Despublicar"
                message="O quiz sai do ar e o link deixa de abrir. As respostas já gravadas continuam no relatório."
                onConfirm={async () => salvar("draft")}
                title="Despublicar este quiz?"
              >
                Despublicar
              </ConfirmButton>
            )}
          </div>
        }
        description="Perguntas, pontuação e resultados. Nada aqui aceita HTML."
        title={quiz.title || "Quiz"}
      >
        {erroTexto && (
          <p
            className="mb-4 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-800"
            role="alert"
          >
            {erroTexto}
          </p>
        )}

        {/* Honesto sobre o que o banco faz: não há versão de rascunho separada
            da publicada, então salvar um quiz publicado vai ao ar na hora. */}
        {quiz.status === "published" && sujo && (
          <p className="mb-4 rounded border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            Este quiz está publicado. Ao salvar, as alterações vão ao ar
            imediatamente — não existe rascunho separado da versão pública.
          </p>
        )}

        <div className="grid gap-6 lg:grid-cols-[minmax(0,204px)_minmax(0,1fr)]">
          <nav aria-label="Seções do editor">
            <ul className="flex gap-1 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible">
              {SECOES.map((s) => (
                <li key={s.id}>
                  <button
                    aria-current={secao === s.id ? "page" : undefined}
                    className={`flex w-full items-center gap-2 whitespace-nowrap rounded-lg px-3 py-2.5 text-left text-sm font-medium ${
                      secao === s.id
                        ? "bg-brand-50 text-brand-800"
                        : "text-gray-700 hover:bg-gray-100"
                    }`}
                    onClick={() => setSecao(s.id)}
                    type="button"
                  >
                    <span className="flex-1">{s.nome}</span>
                    {contagem[s.id] !== undefined && (
                      <span className="text-xs text-gray-400">
                        {contagem[s.id]}
                      </span>
                    )}
                    {apontamentos.some(
                      (a) => a.secao === s.id && a.nivel === "erro"
                    ) && (
                      <span
                        aria-label="tem erro"
                        className="text-sm font-bold text-red-600"
                      >
                        !
                      </span>
                    )}
                  </button>
                </li>
              ))}
            </ul>

            {(erros.length > 0 || avisos.length > 0) && (
              <div className="mt-4 space-y-2 text-xs">
                {erros.length > 0 && listaDeApontamentos(erros, "erro")}
                {avisos.length > 0 && listaDeApontamentos(avisos, "aviso")}
              </div>
            )}
          </nav>

          <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,460px)] 2xl:grid-cols-[minmax(0,1fr)_minmax(0,560px)]">
            {/* Teto de largura: campo de texto de 1200px e ilegivel, e o que
                sobra vai para a previa. */}
            <div className="min-w-0 max-w-[46rem] space-y-6">
              {secao === "geral" && (
                <>
                  <Grupo titulo="Informações gerais">
                    <Field label="Nome do quiz">
                      <Input
                        onChange={(e) => set("title", e.target.value)}
                        value={quiz.title}
                      />
                    </Field>
                    <Field
                      hint={`O quiz fica em /quiz/${quiz.slug || "…"}`}
                      label="Link do quiz"
                    >
                      <Input
                        onChange={(e) => set("slug", slugify(e.target.value))}
                        value={quiz.slug}
                      />
                    </Field>
                  </Grupo>

                  <Grupo
                    ajuda="A primeira coisa que quem responde vê."
                    titulo="Tela de abertura"
                  >
                    <Field label="Texto acima do título">
                      <Input
                        onChange={(e) =>
                          set("intro", {
                            ...quiz.intro,
                            subtitulo: e.target.value,
                          })
                        }
                        placeholder="Feriado de 7 de setembro"
                        value={quiz.intro?.subtitulo ?? ""}
                      />
                    </Field>
                    <Field label="Título">
                      <Textarea
                        onChange={(e) =>
                          set("intro", { ...quiz.intro, titulo: e.target.value })
                        }
                        rows={2}
                        value={quiz.intro?.titulo ?? ""}
                      />
                    </Field>
                    <Field label="Texto do botão">
                      <Input
                        onChange={(e) =>
                          set("intro", {
                            ...quiz.intro,
                            texto_botao: e.target.value,
                          })
                        }
                        placeholder="Começar"
                        value={quiz.intro?.texto_botao ?? ""}
                      />
                    </Field>
                    <Field
                      hint="Aparece entre o título e o botão. Sem imagem, a abertura fica só com o texto."
                      label="Imagem da abertura"
                    >
                      <ImageField
                        bucket="site-assets"
                        onChange={(imagem) =>
                          set("intro", { ...quiz.intro, imagem })
                        }
                        onRemove={() =>
                          set("intro", { ...quiz.intro, imagem: null })
                        }
                        value={quiz.intro?.imagem ?? ""}
                      />
                    </Field>
                  </Grupo>

                  <Grupo
                    ajuda="Aparece no Google e na prévia do link no WhatsApp. Vazio usa o nome do quiz."
                    titulo="Busca e compartilhamento"
                  >
                    <Field label="Título para busca">
                      <Input
                        onChange={(e) =>
                          set("seo_title", e.target.value || null)
                        }
                        placeholder={quiz.title}
                        value={quiz.seo_title ?? ""}
                      />
                    </Field>
                    <Field label="Descrição para busca">
                      <Textarea
                        onChange={(e) =>
                          set("seo_description", e.target.value || null)
                        }
                        rows={2}
                        value={quiz.seo_description ?? ""}
                      />
                    </Field>
                  </Grupo>

                  <Grupo titulo="Captura de contato">
                    <label className="flex items-start gap-2 text-sm text-gray-700">
                      <input
                        checked={quiz.captura_ativa}
                        className="mt-1"
                        onChange={(e) => set("captura_ativa", e.target.checked)}
                        type="checkbox"
                      />
                      <span>
                        Pedir nome e WhatsApp antes de mostrar o resultado
                        <span className="block text-xs text-gray-500">
                          Desligado, o quiz não guarda contato nenhum e não gera
                          lead.
                        </span>
                      </span>
                    </label>
                  </Grupo>
                </>
              )}

              {secao === "perguntas" && (
                <SecaoPerguntas
                  onChange={(perguntas) => set("perguntas", perguntas)}
                  onSelecionar={setPerguntaAtual}
                  quiz={quiz}
                  selecionada={perguntaAtual}
                />
              )}

              {secao === "perfis" && (
                <>
                  <Grupo
                    acao={
                      <Button
                        onClick={() =>
                          set("eixos", [
                            ...quiz.eixos,
                            `Perfil ${quiz.eixos.length + 1}`,
                          ])
                        }
                        size="sm"
                        type="button"
                        variant="ghost"
                      >
                        + Perfil
                      </Button>
                    }
                    ajuda="Os lados que o quiz separa, ex: descanso e aventura. Cada alternativa soma pontos para eles, e o perfil que ganhar a soma escolhe qual resultado aparece."
                    titulo="Perfis"
                  >
                    {quiz.eixos.map((eixo, i) => (
                      <div className="flex min-w-0 items-center gap-2" key={i}>
                        <Input
                          aria-label={`Nome do perfil ${i + 1}`}
                          className="min-w-0 flex-1"
                          onChange={(e) => renomearEixo(i, e.target.value)}
                          value={eixo}
                        />
                        <ConfirmButton
                          className="shrink-0 rounded border px-3 py-2 text-xs font-semibold text-gray-500 hover:text-red-600"
                          message={`Remover o perfil "${eixo}" apaga os pontos dele em todas as perguntas e solta o resultado que dependia dele. Continuar?`}
                          onConfirm={async () => removerEixo(i)}
                        >
                          Remover
                        </ConfirmButton>
                      </div>
                    ))}

                    {orfaos.length > 0 && (
                      <p className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-900">
                        Há pontos para perfis que não existem mais:{" "}
                        <strong>{orfaos.join(", ")}</strong>. A pontuação
                        descarta esses pontos, então o quiz tende a dar sempre a
                        mesma resposta.
                      </p>
                    )}
                  </Grupo>

                  <Grupo
                    ajuda="Diferença mínima para um perfil vencer. Abaixo dela, vale o resultado de empate."
                    titulo="Margem de empate"
                  >
                    <Field label="Margem">
                      <Input
                        min={0}
                        onChange={(e) =>
                          set("margem_empate", Number(e.target.value) || 0)
                        }
                        step="0.1"
                        type="number"
                        value={quiz.margem_empate}
                      />
                    </Field>
                  </Grupo>
                </>
              )}

              {secao === "resultados" && (
                <SecaoResultados
                  onChange={(resultados) => set("resultados", resultados)}
                  onSelecionar={setResultadoAtual}
                  quiz={quiz}
                  selecionado={resultadoAtual}
                />
              )}

              {secao === "aparencia" && (
                <Grupo
                  ajuda="Os textos iguais em TODOS os resultados. O que muda por resultado fica em Resultados."
                  titulo="Layout do resultado"
                >
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Texto acima do título">
                      <Input
                        onChange={(e) =>
                          setLayout({ olho: e.target.value || null })
                        }
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
                  <Field
                    hint="Texto pequeno de confiança, abaixo dos blocos."
                    label="Linha de confiança"
                  >
                    <Textarea
                      onChange={(e) =>
                        setLayout({ selo: e.target.value || null })
                      }
                      placeholder="Mais de 25 anos de estrada, Cadastur…"
                      rows={2}
                      value={layout.selo ?? ""}
                    />
                  </Field>
                </Grupo>
              )}

              {secao === "contato" && (
                <Grupo
                  ajuda="O botão no fim da tela de resultado."
                  titulo="Ação final"
                >
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
                      <option value="nenhum">Sem botão</option>
                      <option value="whatsapp">WhatsApp</option>
                    </Select>
                  </Field>

                  {quiz.cta?.tipo === "whatsapp" && (
                    <>
                      <Field label="Número">
                        <Input
                          onChange={(e) =>
                            set("cta", { ...quiz.cta, numero: e.target.value })
                          }
                          placeholder="5586999207088"
                          value={quiz.cta?.numero ?? ""}
                        />
                      </Field>
                      <Field label="Texto do botão">
                        <Input
                          onChange={(e) =>
                            set("cta", {
                              ...quiz.cta,
                              texto_botao: e.target.value,
                            })
                          }
                          placeholder="Falar no WhatsApp"
                          value={quiz.cta?.texto_botao ?? ""}
                        />
                      </Field>
                      <Field label="Mensagem já escrita">
                        <Textarea
                          onChange={(e) =>
                            set("cta", { ...quiz.cta, molde: e.target.value })
                          }
                          rows={3}
                          value={quiz.cta?.molde ?? ""}
                        />
                      </Field>
                      <Variaveis
                        onInserir={(v) =>
                          set("cta", {
                            ...quiz.cta,
                            molde: `${quiz.cta?.molde ?? ""}${v}`,
                          })
                        }
                        variaveis={["nome", "resultado"]}
                      />
                    </>
                  )}

                  <ListaDeTextos
                    hint="Aparecem embaixo do botão, em letra pequena."
                    itens={quiz.cta?.micro ?? []}
                    label="Linhas sob o botão"
                    onChange={(micro) => set("cta", { ...quiz.cta, micro })}
                    placeholder="Você cai direto no WhatsApp, com a mensagem já escrita."
                    textoAdicionar="+ Linha"
                  />
                </Grupo>
              )}
            </div>

            {/* A prévia é a última coluna no desktop e um botão em tela
                estreita — nunca uma terceira coluna espremida. */}
            <div className="min-w-0">
              {previaAberta ? (
                <div className="h-[70vh] overflow-hidden rounded-lg border bg-white xl:sticky xl:top-4 xl:h-[calc(100vh-9rem)]">
                  <PreviaDoQuiz
                    foco={foco}
                    onFechar={() => setPreviaAberta(false)}
                    quiz={quiz}
                  />
                </div>
              ) : (
                <Button
                  onClick={() => setPreviaAberta(true)}
                  size="sm"
                  type="button"
                  variant="secondary"
                >
                  Mostrar prévia
                </Button>
              )}
            </div>
          </div>
        </div>
      </AdminLayout>
    </AdminGuard>
  );
};

export default AdminQuizEditor;
