import Link from "next/link";
import { useRef, useState } from "react";
import AdminGuard from "../../../components/admin/AdminGuard";
import AdminLayout from "../../../components/admin/AdminLayout";
import Button from "../../../components/ui/Button";
import { Field, Input } from "../../../components/ui/form";
import { createSupabaseBrowserClient } from "../../../lib/supabase/browser";
import { lerPlanilha, type PlanilhaLida } from "../../../lib/import/csv";
import {
  adivinharMapeamentoDeClientes,
  classificarClientes,
  contarClientes,
  COLUNAS_CLIENTES,
  type ClienteConhecido,
  type LinhaDeCliente,
} from "../../../lib/import/clientes";

const LIMITE_DE_LINHAS = 500;

type Etapa = "arquivo" | "previa" | "gravando" | "resultado";

type Resultado = {
  criados: number;
  atualizados: number;
  falhas: { numeroNoArquivo: number; email: string; motivo: string }[];
};

const AdminImportarClientes = () => {
  const inputArquivo = useRef<HTMLInputElement | null>(null);
  const [etapa, setEtapa] = useState<Etapa>("arquivo");
  const [erro, setErro] = useState<string | null>(null);
  const [planilha, setPlanilha] = useState<PlanilhaLida | null>(null);
  const [linhas, setLinhas] = useState<LinhaDeCliente[]>([]);
  const [atualizarExistentes, setAtualizarExistentes] = useState(false);
  const [origem, setOrigem] = useState("");
  const [resultado, setResultado] = useState<Resultado | null>(null);

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
          `A planilha tem ${lida.linhas.length} linhas. O limite é ${LIMITE_DE_LINHAS} por vez — divida em partes.`
        );
        return;
      }

      const mapa = adivinharMapeamentoDeClientes(lida.cabecalho);
      const faltando = COLUNAS_CLIENTES.filter(
        (coluna) => coluna.obrigatoria && mapa[coluna.campo] === undefined
      );

      if (faltando.length > 0) {
        setErro(
          `Não encontrei estas colunas obrigatórias: ${faltando
            .map((c) => c.titulo)
            .join(", ")}. Confira o cabeçalho da planilha.`
        );
        return;
      }

      const { data, error } = await (createSupabaseBrowserClient() as any)
        .from("users_profiles")
        .select("id, email, name, phone, birth_date, document")
        .eq("role", "customer");

      if (error) throw error;

      setPlanilha(lida);
      setLinhas(
        classificarClientes(lida, mapa, (data ?? []) as ClienteConhecido[])
      );
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

    const aEnviar = linhas
      .filter(
        (linha) =>
          linha.classificacao === "novo" ||
          (linha.classificacao === "existente" && atualizarExistentes)
      )
      .map((linha) => ({
        numeroNoArquivo: linha.numeroNoArquivo,
        ...linha.valores!,
        idAlvo: linha.idAlvo ?? null,
        acao: linha.classificacao === "novo" ? "criar" : "atualizar",
      }));

    try {
      const resposta = await fetch("/api/admin/clients/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ linhas: aEnviar, origem: origem.trim() }),
      });

      const payload = await resposta.json();
      if (!resposta.ok) throw new Error(payload?.error ?? "Não foi possível importar.");

      setResultado(payload as Resultado);
      setEtapa("resultado");
    } catch (caught) {
      setErro(
        caught instanceof Error ? caught.message : "Não foi possível importar."
      );
      setEtapa("previa");
    }
  };

  const contagem = contarClientes(linhas);
  const comErro = linhas.filter((l) => l.classificacao === "erro");
  const comMudanca = linhas.filter(
    (l) => l.classificacao === "existente" && (l.mudancas?.length ?? 0) > 0
  );
  const vaiGravar =
    contagem.novo + (atualizarExistentes ? comMudanca.length : 0);

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
      <AdminLayout
        title="Importar clientes"
        description="Sobe uma planilha com a base de contatos. Nada é gravado antes de você conferir."
      >
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
            <h2 className="font-semibold">Como a planilha precisa estar</h2>
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
                    <th className="px-3 py-2">Observação</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  <tr>
                    <td className="px-3 py-2 font-medium">E-mail</td>
                    <td className="px-3 py-2">Não</td>
                    <td className="px-3 py-2 text-gray-600">
                      Quem tem e-mail ganha acesso ao site para acompanhar a
                      reserva. <strong>Quem não tem entra do mesmo jeito</strong>,
                      só na agenda da agência — é o caso do cliente antigo.
                    </td>
                  </tr>
                  <tr>
                    <td className="px-3 py-2 font-medium">Nome</td>
                    <td className="px-3 py-2">Sim</td>
                    <td className="px-3 py-2 text-gray-600">Nome completo</td>
                  </tr>
                  <tr>
                    <td className="px-3 py-2 font-medium">Telefone</td>
                    <td className="px-3 py-2">Não</td>
                    <td className="px-3 py-2 text-gray-600">
                      Com DDD. Pontuação é ignorada.
                    </td>
                  </tr>
                  <tr>
                    <td className="px-3 py-2 font-medium">Nascimento</td>
                    <td className="px-3 py-2">Não</td>
                    <td className="px-3 py-2 text-gray-600">
                      05/09/1990 — aparece na tela de aniversariantes. A
                      mensagem automática de parabéns NÃO é enviada para quem
                      entra por importação: essas pessoas não consentiram.
                    </td>
                  </tr>
                  <tr>
                    <td className="px-3 py-2 font-medium">Documento</td>
                    <td className="px-3 py-2">Não</td>
                    <td className="px-3 py-2 text-gray-600">
                      CPF ou RG. Para quem não tem e-mail, é o documento (ou o
                      telefone) que evita cadastrar a mesma pessoa duas vezes.
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <p className="mt-4 rounded border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
              É a mesma estrutura do CSV que a tela de Clientes já exporta, então
              dá para exportar, corrigir na planilha e trazer de volta.
            </p>
            <p className="mt-2 rounded border bg-gray-50 p-3 text-xs text-gray-600">
              <strong>Cliente não precisa de login.</strong> Sem e-mail a pessoa
              entra como contato: aparece na busca, nos aniversariantes e nas
              listas, mas não enxerga nada no site. Quando ela comprar, o e-mail
              é pedido na hora — que é quando ele passa a fazer falta de verdade,
              para o voucher chegar.
            </p>

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
              <h2 className="font-semibold">Confira antes de gravar</h2>
              <p className="mt-1 text-sm text-gray-500">
                {planilha.linhas.length} linhas lidas · codificação{" "}
                {planilha.codificacao}
              </p>

              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-green-900">
                  <p className="text-2xl font-bold">{contagem.novo}</p>
                  <p className="text-sm font-semibold">Novos</p>
                  <p className="mt-1 text-xs opacity-80">serão cadastrados</p>
                </div>
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-900">
                  <p className="text-2xl font-bold">{contagem.existente}</p>
                  <p className="text-sm font-semibold">Já são clientes</p>
                  <p className="mt-1 text-xs opacity-80">
                    {comMudanca.length} com dado diferente
                  </p>
                </div>
                <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-900">
                  <p className="text-2xl font-bold">{contagem.erro}</p>
                  <p className="text-sm font-semibold">Com erro</p>
                  <p className="mt-1 text-xs opacity-80">não entram</p>
                </div>
              </div>
            </div>

            <div className="rounded-lg border bg-white p-6 shadow-sm">
              <div className="max-w-lg">
                <Field label="De onde veio esta lista?">
                  <Input
                    onChange={(evento) => setOrigem(evento.target.value)}
                    placeholder="Ex.: cadastro na loja, feira de turismo 2026, parceiro Juju Magazine"
                    value={origem}
                  />
                </Field>
              </div>
              {/* Não existe campo de consentimento no cadastro, e a política de
                  privacidade do próprio site promete contato só com
                  consentimento. Registrar a origem é o mínimo que permite
                  responder depois por que aquele contato está na base. */}
              <p className="mt-2 text-xs text-gray-500">
                Fica registrado junto com a importação. É o que permite explicar,
                depois, por que essas pessoas estão na base — a política de
                privacidade do site promete contato só com consentimento.
              </p>
            </div>

            {comMudanca.length > 0 && (
              <div className="rounded-lg border bg-white p-6 shadow-sm">
                <h3 className="font-semibold">
                  {comMudanca.length} clientes com dado diferente
                </h3>
                <label className="mt-3 flex items-start gap-2 text-sm">
                  <input
                    checked={atualizarExistentes}
                    className="mt-1"
                    onChange={(e) => setAtualizarExistentes(e.target.checked)}
                    type="checkbox"
                  />
                  <span>
                    Atualizar o cadastro com o que veio na planilha.
                    <span className="mt-1 block text-gray-500">
                      Só entra o que a planilha traz preenchido. Célula vazia
                      nunca apaga um dado que já está no sistema.
                    </span>
                  </span>
                </label>

                <ul className="mt-4 space-y-2 text-sm">
                  {comMudanca.slice(0, 20).map((linha) => (
                    <li key={linha.numeroNoArquivo}>
                      <strong>
                        {linha.valores?.email ||
                          linha.valores?.name ||
                          "sem e-mail"}
                      </strong>
                      {linha.chave && (
                        <span className="ml-2 text-xs text-gray-500">
                          (encontrado pelo {linha.chave})
                        </span>
                      )}
                      <ul className="ml-4 text-xs text-gray-600">
                        {linha.mudancas?.map((mudanca) => (
                          <li key={mudanca.campo}>
                            {mudanca.campo}: {mudanca.de} → {mudanca.para}
                          </li>
                        ))}
                      </ul>
                    </li>
                  ))}
                </ul>
                {comMudanca.length > 20 && (
                  <p className="mt-2 text-sm text-gray-500">
                    e mais {comMudanca.length - 20}…
                  </p>
                )}
              </div>
            )}

            {comErro.length > 0 && (
              <div className="rounded-lg border border-red-200 bg-white p-6 shadow-sm">
                <h3 className="font-semibold text-red-800">
                  Linhas que não entram
                </h3>
                <ul className="mt-3 space-y-1 text-sm">
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

            <div className="flex flex-wrap gap-3">
              <Button
                disabled={vaiGravar === 0 || origem.trim().length === 0}
                onClick={() => void gravar()}
              >
                Importar {vaiGravar} cliente(s)
              </Button>
              <Button onClick={recomecar} variant="secondary">
                Escolher outra planilha
              </Button>
            </div>
            {origem.trim().length === 0 && vaiGravar > 0 && (
              <p className="text-sm text-gray-500">
                Preencha de onde veio a lista para liberar a importação.
              </p>
            )}
          </div>
        )}

        {etapa === "gravando" && (
          <div className="mt-6 rounded-lg border bg-white p-6 shadow-sm">
            <p className="font-semibold">Importando…</p>
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
                <strong>{resultado.criados}</strong> cliente(s) cadastrado(s)
                {resultado.atualizados > 0 && (
                  <>
                    {" "}
                    e <strong>{resultado.atualizados}</strong> atualizado(s)
                  </>
                )}
                .
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
                <ul className="mt-3 space-y-1 text-sm">
                  {resultado.falhas.map((falha) => (
                    <li key={`${falha.numeroNoArquivo}-${falha.email}`}>
                      <span className="font-mono text-xs text-gray-500">
                        linha {falha.numeroNoArquivo}
                      </span>{" "}
                      {falha.email} — {falha.motivo}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="flex flex-wrap gap-3">
              <Link
                className="inline-flex items-center rounded-lg bg-brand-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-600"
                href="/admin/clients"
              >
                Ver os clientes
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

export default AdminImportarClientes;
