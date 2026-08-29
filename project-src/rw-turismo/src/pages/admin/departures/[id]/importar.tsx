import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useRef, useState } from "react";
import AdminGuard from "../../../../components/admin/AdminGuard";
import AdminLayout from "../../../../components/admin/AdminLayout";
import DepartureTabs from "../../../../components/admin/DepartureTabs";
import Button from "../../../../components/ui/Button";
import { Field, Input } from "../../../../components/ui/form";
import { getAdminDeparture, type AdminDeparture } from "../../../../lib/admin/client";
import { passengerTypeOnDeparture } from "../../../../lib/bookings/passengerAge";
import { lerPlanilha } from "../../../../lib/import/csv";
import { lerTabelaDoDocx, navegadorLeDocx } from "../../../../lib/import/docx";
import {
  acharCabecalho,
  acharDocumentosRepetidos,
  lerPassageiros,
  type PassageiroLido,
} from "../../../../lib/import/passageiros";
import { formatDateRangeBR } from "../../../../lib/format";

// Importa a lista de passageiros que a agência já mantém no Word, para dentro
// de uma saída que existe no sistema.
//
// POR QUE UMA RESERVA SÓ, E NÃO UMA POR PESSOA: no modelo, passageiro pertence
// a uma reserva — não existe passageiro solto numa saída. E toda reserva exige
// e-mail (o banco não aceita nulo) e uma conta de cliente. A lista não tem
// e-mail de ninguém.
//
// Uma reserva por pessoa exigiria inventar 35 e-mails, criando 35 contas falsas
// que um dia recebem e-mail de marketing. Uma reserva de grupo precisa de um
// endereço técnico só. O que a operação usa — check-in, assentos, quartos e a
// relação impressa — funciona igual nos dois casos, porque tudo aquilo é por
// PASSAGEIRO.

// Domínio reservado pela RFC 2606 para nomes que nunca resolvem. Escolhido de
// propósito: se algum dia alguém disparar e-mail para esta base, a mensagem
// falha na hora em vez de ir parar na caixa de outra pessoa.
const EMAIL_TECNICO = "listas-importadas@importado.invalid";

const AdminImportarPassageiros = () => {
  const router = useRouter();
  const id = typeof router.query.id === "string" ? router.query.id : "";
  const inputArquivo = useRef<HTMLInputElement | null>(null);

  const [saida, setSaida] = useState<AdminDeparture | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [passageiros, setPassageiros] = useState<PassageiroLido[] | null>(null);
  const [nomeDaReserva, setNomeDaReserva] = useState("Lista importada");
  const [gravando, setGravando] = useState(false);
  const [pronto, setPronto] = useState<{ quantidade: number } | null>(null);

  useEffect(() => {
    if (!id) return;
    getAdminDeparture(id)
      .then(setSaida)
      .catch(() => setErro("Não foi possível carregar a saída."));
  }, [id]);

  const aoEscolherArquivo = async (arquivo: File | undefined) => {
    if (!arquivo) return;
    setErro(null);
    setPassageiros(null);

    try {
      const bytes = await arquivo.arrayBuffer();
      let linhas: string[][];

      if (arquivo.name.toLowerCase().endsWith(".docx")) {
        if (!navegadorLeDocx()) {
          setErro(
            "Este navegador não consegue abrir arquivos do Word. Use o Chrome ou o Edge, ou salve a lista como .csv."
          );
          return;
        }
        linhas = await lerTabelaDoDocx(bytes);
      } else {
        const planilha = lerPlanilha(bytes);
        linhas = [planilha.cabecalho, ...planilha.linhas];
      }

      const cabecalho = acharCabecalho(linhas);
      if (!cabecalho) {
        setErro(
          "Não encontrei a coluna com o nome do passageiro. A lista precisa ter uma tabela com a coluna “Nome do passageiro”."
        );
        return;
      }

      const lidos = lerPassageiros(linhas, cabecalho);
      if (lidos.length === 0) {
        setErro("A lista não tem nenhum passageiro preenchido.");
        return;
      }

      setPassageiros(lidos);
    } catch (caught) {
      setErro(
        caught instanceof Error ? caught.message : "Não foi possível ler o arquivo."
      );
    }
  };

  const importar = async () => {
    if (!passageiros || !saida) return;
    setGravando(true);
    setErro(null);

    try {
      const resposta = await fetch("/api/admin/bookings/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customer_name: nomeDaReserva.trim() || "Lista importada",
          customer_email: EMAIL_TECNICO,
          product_id: saida.product_id,
          product_date_id: saida.id,
          travelers_count: passageiros.length,
          status: "confirmed",
          // Zero de propósito: o dinheiro desta lista foi recebido fora do
          // sistema. Lançar o preço de tabela aqui inventaria receita que o
          // financeiro nunca viu.
          total_override: 0,
          passengers: passageiros.map((pax) => ({
            full_name: pax.nome,
            document: pax.documento,
            birth_date: pax.nascimento,
            type: pax.nascimento
              ? passengerTypeOnDeparture(pax.nascimento, saida.start_date)
              : "adult",
          })),
        }),
      });

      const payload = await resposta.json();
      if (!resposta.ok) {
        throw new Error(payload?.error ?? "Não foi possível importar.");
      }

      setPronto({ quantidade: passageiros.length });
    } catch (caught) {
      setErro(
        caught instanceof Error ? caught.message : "Não foi possível importar."
      );
    } finally {
      setGravando(false);
    }
  };

  const repetidos = passageiros ? acharDocumentosRepetidos(passageiros) : new Map();
  const comAviso = passageiros?.filter((p) => p.avisos.length > 0) ?? [];
  const comObservacao = passageiros?.filter((p) => p.observacoes.length > 0) ?? [];

  return (
    <AdminGuard>
      <AdminLayout
        title="Saída"
        description={
          saida
            ? `${saida.products?.title ?? ""} · ${formatDateRangeBR(saida.start_date, saida.end_date)}`
            : ""
        }
      >
        {id && <DepartureTabs active="importar" id={id} />}

        {erro && (
          <p
            className="mt-4 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700"
            role="alert"
          >
            {erro}
          </p>
        )}

        {pronto ? (
          <div className="mt-6 space-y-4">
            <div className="rounded-lg border bg-white p-6 shadow-sm">
              <h2 className="font-semibold">
                {pronto.quantidade} passageiros importados
              </h2>
              <p className="mt-2 text-sm text-gray-600">
                Eles já aparecem no check-in, no mapa de assentos e no rooming
                desta saída.
              </p>

              {comObservacao.length > 0 && (
                <div className="mt-4 rounded border border-amber-200 bg-amber-50 p-4">
                  <p className="text-sm font-semibold text-amber-900">
                    Anote estes pedidos — eles não foram importados
                  </p>
                  <p className="mt-1 text-xs text-amber-800">
                    O sistema ainda não tem campo de observação por passageiro,
                    então o que estava entre parênteses na lista ficou de fora.
                  </p>
                  <ul className="mt-3 space-y-1 text-sm text-amber-900">
                    {comObservacao.map((pax) => (
                      <li key={pax.numero}>
                        <strong>{pax.nome}</strong>: {pax.observacoes.join(" · ")}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            <Link
              className="inline-flex items-center rounded-lg bg-brand-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-600"
              href={`/admin/departures/${id}`}
            >
              Ver o check-in
            </Link>
          </div>
        ) : !passageiros ? (
          <div className="mt-6 rounded-lg border bg-white p-6 shadow-sm">
            <h2 className="font-semibold">Lista de passageiros</h2>
            <p className="mt-2 text-sm text-gray-600">
              Sobe o arquivo do Word (<strong>.docx</strong>) com a tabela do
              ônibus, do jeito que você já usa. Também aceita <strong>.csv</strong>.
              A tabela precisa ter a coluna <em>Nome do passageiro</em>; documento,
              local de embarque e contato entram se existirem.
            </p>
            <p className="mt-2 text-sm text-gray-500">
              Nada é gravado antes de você conferir.
            </p>

            <input
              accept=".docx,.csv,text/csv"
              className="mt-4 block w-full text-sm"
              onChange={(evento) => void aoEscolherArquivo(evento.target.files?.[0])}
              ref={inputArquivo}
              type="file"
            />
          </div>
        ) : (
          <div className="mt-6 space-y-5">
            <div className="rounded-lg border bg-white p-6 shadow-sm">
              <h2 className="font-semibold">
                {passageiros.length} passageiros encontrados
              </h2>
              <p className="mt-1 text-sm text-gray-500">
                Linhas em branco do gabarito do ônibus foram ignoradas.
              </p>

              <div className="mt-4 max-w-md">
                <Field label="Nome da reserva">
                  <Input
                    onChange={(evento) => setNomeDaReserva(evento.target.value)}
                    value={nomeDaReserva}
                  />
                </Field>
                <p className="mt-1 text-xs text-gray-500">
                  Todos entram numa reserva só, porque no sistema passageiro
                  pertence a uma reserva. É este nome que aparece na coluna
                  &ldquo;Reserva de&rdquo; do check-in — use algo que identifique
                  a lista, como o parceiro que vendeu.
                </p>
              </div>

              <p className="mt-4 rounded border bg-gray-50 p-3 text-xs text-gray-600">
                A reserva entra como <strong>confirmada</strong> e com valor{" "}
                <strong>zero</strong>: o dinheiro desta lista foi recebido fora
                do sistema, e lançar o preço de tabela inventaria receita que o
                financeiro nunca viu. As {passageiros.length} vagas saem do
                estoque da saída.
              </p>
            </div>

            {repetidos.size > 0 && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-6">
                <h3 className="font-semibold text-amber-900">
                  Documento repetido na lista
                </h3>
                <p className="mt-1 text-sm text-amber-800">
                  O mesmo número aparece em pessoas diferentes — quase sempre é
                  erro de digitação na lista. Dá para importar assim mesmo.
                </p>
                <ul className="mt-3 space-y-1 text-sm text-amber-900">
                  {Array.from(repetidos.entries()).map(([documento, nomes]) => (
                    <li key={documento}>
                      <strong>{documento}</strong>: {(nomes as string[]).join(" e ")}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {comAviso.length > 0 && (
              <div className="rounded-lg border bg-white p-6 shadow-sm">
                <h3 className="font-semibold">
                  {comAviso.length} linhas para conferir
                </h3>
                <ul className="mt-3 space-y-1 text-sm text-gray-700">
                  {comAviso.map((pax) => (
                    <li key={pax.numero}>
                      <span className="font-mono text-xs text-gray-500">
                        {pax.numero}
                      </span>{" "}
                      {pax.nome} — {pax.avisos.join("; ")}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="overflow-x-auto rounded-lg border bg-white shadow-sm">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
                  <tr>
                    <th className="px-3 py-2">Nº</th>
                    <th className="px-3 py-2">Nome</th>
                    <th className="px-3 py-2">Documento</th>
                    <th className="px-3 py-2">Nascimento</th>
                    <th className="px-3 py-2">Embarque</th>
                    <th className="px-3 py-2">Contato</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {passageiros.map((pax) => (
                    <tr key={pax.numero}>
                      <td className="px-3 py-2 font-mono text-xs text-gray-500">
                        {pax.numero}
                      </td>
                      <td className="px-3 py-2">
                        {pax.nome}
                        {pax.observacoes.length > 0 && (
                          <span className="mt-0.5 block text-xs text-amber-700">
                            {pax.observacoes.join(" · ")}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2">{pax.documento ?? "—"}</td>
                      <td className="px-3 py-2">{pax.nascimento ?? "—"}</td>
                      <td className="px-3 py-2">{pax.embarque ?? "—"}</td>
                      <td className="px-3 py-2">{pax.telefone ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex flex-wrap gap-3">
              <Button loading={gravando} onClick={() => void importar()}>
                Importar {passageiros.length} passageiros
              </Button>
              <Button
                onClick={() => {
                  setPassageiros(null);
                  if (inputArquivo.current) inputArquivo.current.value = "";
                }}
                variant="secondary"
              >
                Escolher outro arquivo
              </Button>
            </div>
          </div>
        )}
      </AdminLayout>
    </AdminGuard>
  );
};

export default AdminImportarPassageiros;
