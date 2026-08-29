import Link from "next/link";
import { useRef, useState } from "react";
import AdminGuard from "../../../components/admin/AdminGuard";
import AdminLayout from "../../../components/admin/AdminLayout";
import Button from "../../../components/ui/Button";
import {
  createAdminProductDate,
  updateAdminProductDate,
} from "../../../lib/admin/client";
import { createSupabaseBrowserClient } from "../../../lib/supabase/browser";
import { lerPlanilha, type PlanilhaLida } from "../../../lib/import/csv";
import {
  adivinharMapeamento,
  classificarLinhas,
  contarPorClassificacao,
  COLUNAS_SAIDAS,
  type CampoSaida,
  type LinhaClassificada,
  type PacoteConhecido,
  type SaidaExistente,
} from "../../../lib/import/saidas";
import { dataParaTela } from "../../../lib/import/valores";
import { formatBRL } from "../../../lib/format";

// Importação de saídas por planilha.
//
// O arquivo é lido no navegador e não sobe para lugar nenhum. A gravação usa as
// MESMAS funções que a tela de cadastro usa — createAdminProductDate e
// updateAdminProductDate —, então tudo que vale lá (RLS, validação do banco,
// trigger de updated_at) vale aqui igual.

const LIMITE_DE_LINHAS = 2000;

type Etapa = "arquivo" | "previa" | "gravando" | "resultado";

type Resultado = {
  gravadas: number;
  puladas: number;
  falhas: { numeroNoArquivo: number; motivo: string }[];
};

const Cartao = ({
  cor,
  titulo,
  quantidade,
  ajuda,
}: {
  cor: string;
  titulo: string;
  quantidade: number;
  ajuda: string;
}) => (
  <div className={`rounded-lg border p-4 ${cor}`}>
    <p className="text-2xl font-bold">{quantidade}</p>
    <p className="text-sm font-semibold">{titulo}</p>
    <p className="mt-1 text-xs opacity-80">{ajuda}</p>
  </div>
);

const AdminImportarSaidas = () => {
  const inputArquivo = useRef<HTMLInputElement | null>(null);
  const [etapa, setEtapa] = useState<Etapa>("arquivo");
  const [erro, setErro] = useState<string | null>(null);
  const [planilha, setPlanilha] = useState<PlanilhaLida | null>(null);
  const [mapa, setMapa] = useState<Partial<Record<CampoSaida, number>>>({});
  const [linhas, setLinhas] = useState<LinhaClassificada[]>([]);
  const [atualizarExistentes, setAtualizarExistentes] = useState(false);
  const [restaurarDaLixeira, setRestaurarDaLixeira] = useState(false);
  const [ativarNaImportacao, setAtivarNaImportacao] = useState(false);
  const [progresso, setProgresso] = useState("");
  const [resultado, setResultado] = useState<Resultado | null>(null);

  const supabase = () => createSupabaseBrowserClient() as any;

  const aoEscolherArquivo = async (arquivo: File | undefined) => {
    if (!arquivo) return;
    setErro(null);

    try {
      const lida = lerPlanilha(await arquivo.arrayBuffer());

      if (lida.linhas.length === 0) {
        setErro("A planilha não tem nenhuma linha de dados.");
        return;
      }
      if (lida.linhas.length > LIMITE_DE_LINHAS) {
        setErro(
          `A planilha tem ${lida.linhas.length} linhas. O limite é ${LIMITE_DE_LINHAS} por arquivo — divida em partes.`
        );
        return;
      }

      const mapeamento = adivinharMapeamento(lida.cabecalho);
      const faltando = COLUNAS_SAIDAS.filter(
        (coluna) => coluna.obrigatoria && mapeamento[coluna.campo] === undefined
      );

      if (faltando.length > 0) {
        setErro(
          `Não encontrei estas colunas obrigatórias: ${faltando
            .map((c) => c.titulo)
            .join(", ")}. Confira o cabeçalho da planilha.`
        );
        return;
      }

      // Busca SEM filtrar excluído, de propósito: o unique do banco não filtra,
      // então uma saída na lixeira ainda ocupa a combinação pacote+datas. Se a
      // prévia usasse a listagem do admin (que esconde excluídos), a linha
      // apareceria como nova e o insert estouraria no meio da importação.
      const [pacotesResposta, saidasResposta] = await Promise.all([
        supabase().from("products").select("id, title, slug, deleted_at"),
        supabase()
          .from("product_dates")
          .select("id, product_id, start_date, end_date, available_slots, deleted_at, updated_at"),
      ]);

      if (pacotesResposta.error) throw pacotesResposta.error;
      if (saidasResposta.error) throw saidasResposta.error;

      const classificadas = classificarLinhas(
        lida,
        mapeamento,
        (pacotesResposta.data ?? []) as PacoteConhecido[],
        (saidasResposta.data ?? []) as SaidaExistente[]
      );

      setPlanilha(lida);
      setMapa(mapeamento);
      setLinhas(classificadas);
      setEtapa("previa");
    } catch (caught) {
      setErro(
        caught instanceof Error ? caught.message : "Não foi possível ler a planilha."
      );
    }
  };

  const gravar = async () => {
    setEtapa("gravando");
    setErro(null);

    const falhas: Resultado["falhas"] = [];
    let gravadas = 0;
    let puladas = 0;

    const aFazer = linhas.filter(
      (linha) =>
        linha.classificacao === "novo" ||
        (linha.classificacao === "existente" && atualizarExistentes) ||
        (linha.classificacao === "lixeira" && restaurarDaLixeira)
    );

    for (let i = 0; i < aFazer.length; i += 1) {
      const linha = aFazer[i]!;
      setProgresso(`Gravando ${i + 1} de ${aFazer.length}…`);

      if (!linha.valores) {
        puladas += 1;
        continue;
      }

      try {
        if (linha.classificacao === "novo") {
          await createAdminProductDate({
            ...linha.valores,
            active: ativarNaImportacao,
          });
        } else {
          // ATUALIZAÇÃO NÃO TOCA EM VAGAS.
          //
          // available_slots é estoque vivo: as reservas descontam dele. Gravar
          // o número da planilha por cima faria uma saída que já vendeu 22
          // voltar a oferecer 46 lugares — overbooking, sem erro nenhum
          // aparecer. Só preço e horários entram.
          const mudancas: Record<string, unknown> = {};
          if (linha.valores.price_override !== null) {
            mudancas.price_override = linha.valores.price_override;
          }
          if (linha.valores.departure_time !== null) {
            mudancas.departure_time = linha.valores.departure_time;
          }
          if (linha.valores.return_time !== null) {
            mudancas.return_time = linha.valores.return_time;
          }
          if (linha.classificacao === "lixeira") mudancas.deleted_at = null;

          // Nada preenchido e nada a restaurar: não gasta uma escrita para
          // dizer que nada muda.
          if (Object.keys(mudancas).length === 0) {
            puladas += 1;
            continue;
          }

          const { data, error } = await supabase()
            .from("product_dates")
            .update(mudancas)
            .eq("id", linha.idAlvo)
            // Trava otimista: a prévia é uma foto de minutos atrás. Se alguém
            // mexeu na saída nesse meio-tempo, não gravamos por cima em
            // silêncio — a linha vai para a lista de falhas com o motivo.
            .eq("updated_at", linha.updatedAtVisto)
            .select("id");

          if (error) throw error;

          if (!data?.length) {
            falhas.push({
              numeroNoArquivo: linha.numeroNoArquivo,
              motivo: "a saída foi alterada por outra pessoa enquanto você conferia",
            });
            continue;
          }
        }

        gravadas += 1;
      } catch (caught) {
        falhas.push({
          numeroNoArquivo: linha.numeroNoArquivo,
          motivo: caught instanceof Error ? caught.message : "erro ao gravar",
        });
      }
    }

    setResultado({ gravadas, puladas, falhas });
    setProgresso("");
    setEtapa("resultado");
  };

  const contagem = contarPorClassificacao(linhas);
  const comErro = linhas.filter((l) => l.classificacao === "erro");
  const vaiGravar =
    contagem.novo +
    (atualizarExistentes ? contagem.existente : 0) +
    (restaurarDaLixeira ? contagem.lixeira : 0);

  const recomecar = () => {
    setEtapa("arquivo");
    setPlanilha(null);
    setLinhas([]);
    setResultado(null);
    setErro(null);
    if (inputArquivo.current) inputArquivo.current.value = "";
  };

  return (
    <AdminGuard>
      <AdminLayout title="Importar saídas">
        <p className="text-sm text-gray-600">
          Sobe uma planilha com as datas de viagem de pacotes que já existem no
          sistema. Nada é gravado antes de você conferir.
        </p>

        {erro && (
          <p
            className="mt-4 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700"
            role="alert"
          >
            {erro}
          </p>
        )}

        {etapa === "arquivo" && (
          <div className="mt-6 rounded-lg border bg-white p-6 shadow-sm">
            <h2 className="font-semibold">1. Escolha a planilha</h2>
            <p className="mt-2 text-sm text-gray-600">
              Arquivo <strong>.csv</strong>, até {LIMITE_DE_LINHAS} linhas. As
              colunas podem estar em qualquer ordem — o que vale é o nome.
            </p>

            <div className="mt-4 overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
                  <tr>
                    <th className="px-3 py-2">Coluna</th>
                    <th className="px-3 py-2">Obrigatória</th>
                    <th className="px-3 py-2">Como preencher</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  <tr>
                    <td className="px-3 py-2 font-medium">Pacote</td>
                    <td className="px-3 py-2">Sim</td>
                    <td className="px-3 py-2 text-gray-600">
                      O título do pacote, ou o endereço dele no site. Se dois
                      pacotes tiverem o mesmo título, use o endereço.
                    </td>
                  </tr>
                  <tr>
                    <td className="px-3 py-2 font-medium">Data de ida</td>
                    <td className="px-3 py-2">Sim</td>
                    <td className="px-3 py-2 text-gray-600">05/09/2026</td>
                  </tr>
                  <tr>
                    <td className="px-3 py-2 font-medium">Data de volta</td>
                    <td className="px-3 py-2">Sim</td>
                    <td className="px-3 py-2 text-gray-600">
                      07/09/2026 — não pode ser antes da ida
                    </td>
                  </tr>
                  <tr>
                    <td className="px-3 py-2 font-medium">Vagas</td>
                    <td className="px-3 py-2">Sim</td>
                    <td className="px-3 py-2 text-gray-600">
                      Número inteiro. <strong>Só vale para saída nova</strong> —
                      em saída que já existe, as vagas nunca são alteradas.
                    </td>
                  </tr>
                  <tr>
                    <td className="px-3 py-2 font-medium">Preço da saída</td>
                    <td className="px-3 py-2">Não</td>
                    <td className="px-3 py-2 text-gray-600">
                      1.200,00 — em branco usa o preço do pacote
                    </td>
                  </tr>
                  <tr>
                    <td className="px-3 py-2 font-medium">
                      Hora de saída / Hora de retorno
                    </td>
                    <td className="px-3 py-2">Não</td>
                    <td className="px-3 py-2 text-gray-600">22:30</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <input
              accept=".csv,text/csv"
              className="mt-5 block w-full text-sm"
              onChange={(evento) => void aoEscolherArquivo(evento.target.files?.[0])}
              ref={inputArquivo}
              type="file"
            />
          </div>
        )}

        {etapa === "previa" && planilha && (
          <div className="mt-6 space-y-5">
            <div className="rounded-lg border bg-white p-6 shadow-sm">
              <h2 className="font-semibold">2. Confira antes de gravar</h2>
              <p className="mt-1 text-sm text-gray-500">
                {planilha.linhas.length} linhas lidas · separador &ldquo;
                {planilha.separador === "\t" ? "tab" : planilha.separador}&rdquo; ·
                codificação {planilha.codificacao}
              </p>

              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Cartao
                  ajuda="serão criadas"
                  cor="border-green-200 bg-green-50 text-green-900"
                  quantidade={contagem.novo}
                  titulo="Saídas novas"
                />
                <Cartao
                  ajuda="mesmo pacote e mesmas datas"
                  cor="border-amber-200 bg-amber-50 text-amber-900"
                  quantidade={contagem.existente}
                  titulo="Já existem"
                />
                <Cartao
                  ajuda="foram excluídas antes"
                  cor="border-gray-200 bg-gray-50 text-gray-800"
                  quantidade={contagem.lixeira}
                  titulo="Na lixeira"
                />
                <Cartao
                  ajuda="não entram"
                  cor="border-red-200 bg-red-50 text-red-900"
                  quantidade={contagem.erro}
                  titulo="Com erro"
                />
              </div>

              {contagem.ignorada > 0 && (
                <p className="mt-3 text-sm text-gray-500">
                  {contagem.ignorada} linha(s) de total ou em branco foram
                  ignoradas.
                </p>
              )}
            </div>

            {contagem.existente > 0 && (
              <div className="rounded-lg border bg-white p-6 shadow-sm">
                <h3 className="font-semibold">Saídas que já existem</h3>
                <label className="mt-3 flex items-start gap-2 text-sm">
                  <input
                    checked={atualizarExistentes}
                    className="mt-1"
                    onChange={(e) => setAtualizarExistentes(e.target.checked)}
                    type="checkbox"
                  />
                  <span>
                    Atualizar preço e horários dessas saídas.
                    <span className="mt-1 block text-gray-500">
                      As <strong>vagas não são alteradas</strong> em nenhuma
                      hipótese: elas já foram descontadas pelas reservas
                      existentes, e sobrescrever faria a saída vender lugares que
                      não existem.
                    </span>
                  </span>
                </label>
              </div>
            )}

            {contagem.lixeira > 0 && (
              <div className="rounded-lg border bg-white p-6 shadow-sm">
                <h3 className="font-semibold">Saídas na lixeira</h3>
                <label className="mt-3 flex items-start gap-2 text-sm">
                  <input
                    checked={restaurarDaLixeira}
                    className="mt-1"
                    onChange={(e) => setRestaurarDaLixeira(e.target.checked)}
                    type="checkbox"
                  />
                  <span>
                    Tirar da lixeira e atualizar.
                    <span className="mt-1 block text-gray-500">
                      Essas saídas foram excluídas antes. Elas continuam
                      ocupando o lugar no sistema, então não dá para criar
                      outra igual — ou você restaura, ou a linha fica de fora.
                    </span>
                  </span>
                </label>
              </div>
            )}

            <div className="rounded-lg border bg-white p-6 shadow-sm">
              <label className="flex items-start gap-2 text-sm">
                <input
                  checked={ativarNaImportacao}
                  className="mt-1"
                  onChange={(e) => setAtivarNaImportacao(e.target.checked)}
                  type="checkbox"
                />
                <span>
                  Publicar as saídas novas no site imediatamente.
                  <span className="mt-1 block text-gray-500">
                    Desmarcado, elas entram desativadas e você revisa antes de
                    colocar à venda. É o mais seguro.
                  </span>
                </span>
              </label>
            </div>

            {comErro.length > 0 && (
              <div className="rounded-lg border border-red-200 bg-white p-6 shadow-sm">
                <h3 className="font-semibold text-red-800">
                  Linhas que não entram
                </h3>
                <ul className="mt-3 space-y-2 text-sm">
                  {comErro.slice(0, 30).map((linha) => (
                    <li key={linha.numeroNoArquivo}>
                      <span className="font-mono text-xs text-gray-500">
                        linha {linha.numeroNoArquivo}
                      </span>{" "}
                      — {linha.erros.join("; ")}
                    </li>
                  ))}
                </ul>
                {comErro.length > 30 && (
                  <p className="mt-2 text-sm text-gray-500">
                    e mais {comErro.length - 30}…
                  </p>
                )}
              </div>
            )}

            <div className="overflow-x-auto rounded-lg border bg-white shadow-sm">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
                  <tr>
                    <th className="px-3 py-2">Linha</th>
                    <th className="px-3 py-2">Situação</th>
                    <th className="px-3 py-2">Pacote</th>
                    <th className="px-3 py-2">Ida</th>
                    <th className="px-3 py-2">Volta</th>
                    <th className="px-3 py-2">Vagas</th>
                    <th className="px-3 py-2">Preço</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {linhas
                    .filter((l) => l.classificacao !== "ignorada")
                    .slice(0, 60)
                    .map((linha) => (
                      <tr key={linha.numeroNoArquivo}>
                        <td className="px-3 py-2 font-mono text-xs text-gray-500">
                          {linha.numeroNoArquivo}
                        </td>
                        <td className="px-3 py-2">
                          {linha.classificacao === "novo" && "Nova"}
                          {linha.classificacao === "existente" && "Já existe"}
                          {linha.classificacao === "lixeira" && "Na lixeira"}
                          {linha.classificacao === "erro" && (
                            <span className="text-red-700">Erro</span>
                          )}
                        </td>
                        <td className="px-3 py-2">{linha.pacoteTitulo ?? "—"}</td>
                        {/* Data JÁ CONVERTIDA, e não o texto cru da célula: é
                            assim que o operador confere que 05/09 virou
                            setembro, e não maio. */}
                        <td className="px-3 py-2">
                          {linha.valores ? dataParaTela(linha.valores.start_date) : "—"}
                        </td>
                        <td className="px-3 py-2">
                          {linha.valores ? dataParaTela(linha.valores.end_date) : "—"}
                        </td>
                        <td className="px-3 py-2">
                          {linha.classificacao === "existente" ||
                          linha.classificacao === "lixeira" ? (
                            <span className="text-gray-500">
                              {linha.vagasAtuais} (não muda)
                            </span>
                          ) : (
                            (linha.valores?.available_slots ?? "—")
                          )}
                        </td>
                        <td className="px-3 py-2">
                          {linha.valores?.price_override != null
                            ? formatBRL(linha.valores.price_override)
                            : "—"}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
              {linhas.length > 60 && (
                <p className="border-t px-3 py-2 text-sm text-gray-500">
                  Mostrando as 60 primeiras de {linhas.length}.
                </p>
              )}
            </div>

            <div className="flex flex-wrap gap-3">
              <Button disabled={vaiGravar === 0} onClick={() => void gravar()}>
                Importar {vaiGravar} saída(s)
              </Button>
              <Button onClick={recomecar} variant="secondary">
                Escolher outra planilha
              </Button>
            </div>
          </div>
        )}

        {etapa === "gravando" && (
          <div className="mt-6 rounded-lg border bg-white p-6 shadow-sm">
            <p className="font-semibold">{progresso}</p>
            <p className="mt-2 text-sm text-gray-500">
              Não feche esta aba até terminar.
            </p>
          </div>
        )}

        {etapa === "resultado" && resultado && (
          <div className="mt-6 space-y-4">
            <div className="rounded-lg border bg-white p-6 shadow-sm">
              <h2 className="font-semibold">Importação concluída</h2>
              <p className="mt-2 text-sm">
                <strong>{resultado.gravadas}</strong> saída(s) gravada(s).
                {resultado.falhas.length > 0 && (
                  <>
                    {" "}
                    <strong className="text-red-700">
                      {resultado.falhas.length}
                    </strong>{" "}
                    não entraram.
                  </>
                )}
              </p>

              {resultado.falhas.length > 0 && (
                <ul className="mt-3 space-y-2 text-sm">
                  {resultado.falhas.map((falha) => (
                    <li key={falha.numeroNoArquivo}>
                      <span className="font-mono text-xs text-gray-500">
                        linha {falha.numeroNoArquivo}
                      </span>{" "}
                      — {falha.motivo}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="flex flex-wrap gap-3">
              <Link
                className="inline-flex items-center rounded-lg bg-brand-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-600"
                href="/admin/product-dates"
              >
                Ver as datas de saída
              </Link>
              <Button onClick={recomecar} variant="secondary">
                Importar outra planilha
              </Button>
            </div>
          </div>
        )}
      </AdminLayout>
    </AdminGuard>
  );
};

export default AdminImportarSaidas;
