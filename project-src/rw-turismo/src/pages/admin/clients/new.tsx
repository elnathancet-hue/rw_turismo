import Link from "next/link";
import { useRouter } from "next/router";
import { FormEvent, useState } from "react";
import AdminGuard from "../../../components/admin/AdminGuard";
import AdminLayout from "../../../components/admin/AdminLayout";
import Button from "../../../components/ui/Button";
import { Field, Input } from "../../../components/ui/form";
import {
  createAdminClient,
  searchAdminClients,
  type AdminClient,
} from "../../../lib/admin/client";
import {
  juntarParecidos,
  termosParaProcurar,
} from "../../../lib/admin/clientesParecidos";

// Cadastro de UMA pessoa na agenda.
//
// Até aqui só havia planilha ou reserva: quem só queria guardar o contato
// precisava inventar uma venda ou montar um CSV de uma linha.
//
// A tela faz uma coisa que a reserva não fazia: PROCURA ANTES DE CRIAR. É o
// mesmo problema que gerava ficha duplicada — quem atende não acha a pessoa,
// conclui que ela não está cadastrada, e cadastra de novo. Aqui a busca é
// automática, com o que já foi digitado, e o operador vê os parecidos antes de
// decidir.

const AdminNewClient = () => {
  const router = useRouter();

  const [form, setForm] = useState({
    name: "",
    phone: "",
    email: "",
    document: "",
    birth_date: "",
    contact_origin: "",
  });
  const [parecidos, setParecidos] = useState<AdminClient[] | null>(null);
  const [falhouConferencia, setFalhouConferencia] = useState(false);
  // Ficha que ja usa o e-mail digitado. A rota devolve 409 com ela em vez de
  // gravar por cima; o operador decide se atualiza.
  const [jaExiste, setJaExiste] = useState<{ id: string; name: string | null } | null>(
    null
  );
  const [procurando, setProcurando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const set = (campo: keyof typeof form, valor: string) =>
    setForm((atual) => ({ ...atual, [campo]: valor }));

  // Procura por telefone, CPF e e-mail — os três identificadores que a busca
  // passou a entender. O nome fica de fora de propósito: homônimo é comum e
  // encheria a tela de falso alarme.
  const procurarParecidos = async () => {
    const termos = termosParaProcurar(form);

    if (termos.length === 0) {
      setParecidos([]);
      return;
    }

    setFalhouConferencia(false);
    setProcurando(true);
    try {
      const listas = await Promise.all(
        termos.map((termo) => searchAdminClients({ search: termo, limit: 5 }))
      );
      setParecidos(juntarParecidos(listas.map(({ clients }) => clients)));
    } catch {
      // Falha na conferência não trava o cadastro, mas também não pode virar
      // luz verde: `[]` faz a tela dizer "Ninguém parecido na base. Pode
      // cadastrar", que é exatamente o que ela NÃO sabe. Marca a falha e deixa
      // seguir, avisando que a conferência não aconteceu.
      setParecidos([]);
      setFalhouConferencia(true);
    } finally {
      setProcurando(false);
    }
  };

  const salvar = async (event: FormEvent) => {
    event.preventDefault();
    setErro(null);

    // Primeiro clique procura; o segundo grava. Assim quem atende vê os
    // parecidos antes de criar, sem precisar lembrar de clicar em "buscar".
    if (parecidos === null) {
      await procurarParecidos();
      return;
    }

    await gravar(false);
  };

  /**
   * `atualizarExistente` so vem `true` pelo botao do aviso de e-mail repetido.
   * E o que separa "cadastrar" de "escrever na ficha de outra pessoa": sem ele
   * a rota devolve 409 em vez de gravar por cima.
   */
  const gravar = async (atualizarExistente: boolean) => {
    setErro(null);
    setSalvando(true);
    try {
      const { client } = await createAdminClient({
        name: form.name,
        email: form.email || null,
        phone: form.phone || null,
        document: form.document || null,
        birth_date: form.birth_date || null,
        contact_origin: form.contact_origin || null,
        atualizar_existente: atualizarExistente,
      });
      setJaExiste(null);
      await router.push(`/admin/clients/${client.id}`);
    } catch (e) {
      const existente = (e as { existente?: { id: string; name: string | null } })
        .existente;
      if (existente) setJaExiste(existente);
      else setErro(e instanceof Error ? e.message : "Falha ao cadastrar.");
      setSalvando(false);
    }
  };

  const podeSalvar = form.name.trim().length > 0;

  return (
    <AdminGuard>
      <AdminLayout
        title="Novo cliente"
        description="Cadastra a pessoa na agenda. A viagem você vincula depois, pela ficha dela."
        action={
          <Link
            className="rounded border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50"
            href="/admin/clients"
          >
            Voltar
          </Link>
        }
      >
        <form className="max-w-2xl space-y-6" onSubmit={salvar}>
          <section className="rounded-lg border bg-white p-5 shadow-sm">
            <h2 className="font-semibold">Dados do cliente</h2>

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <Field label="Nome *">
                <Input
                  onChange={(e) => {
                    set("name", e.target.value);
                    setParecidos(null);
                  }}
                  placeholder="Nome completo"
                  value={form.name}
                />
              </Field>

              <Field
                hint="É por aqui que a equipe encontra a pessoa depois."
                label="Telefone (WhatsApp)"
              >
                <Input
                  onChange={(e) => {
                    set("phone", e.target.value);
                    setParecidos(null);
                  }}
                  placeholder="(86) 99999-8888"
                  value={form.phone}
                />
              </Field>

              <Field label="CPF">
                <Input
                  onChange={(e) => {
                    set("document", e.target.value);
                    setParecidos(null);
                  }}
                  placeholder="000.000.000-00"
                  value={form.document}
                />
              </Field>

              <Field label="Nascimento">
                <Input
                  onChange={(e) => set("birth_date", e.target.value)}
                  type="date"
                  value={form.birth_date}
                />
              </Field>

              <Field
                hint="Sem e-mail, entra só na agenda: sem conta e sem login. Com e-mail, a conta de acesso é criada."
                label="E-mail (opcional)"
              >
                <Input
                  onChange={(e) => {
                    set("email", e.target.value);
                    setParecidos(null);
                  }}
                  placeholder="cliente@email.com"
                  type="email"
                  value={form.email}
                />
              </Field>

              <Field
                hint="De onde veio este contato — indicação, balcão, WhatsApp."
                label="Origem"
              >
                <Input
                  onChange={(e) => set("contact_origin", e.target.value)}
                  placeholder="cadastro manual"
                  value={form.contact_origin}
                />
              </Field>
            </div>
          </section>

          {parecidos !== null && parecidos.length > 0 && (
            <section className="rounded-lg border border-amber-300 bg-amber-50 p-5">
              <h2 className="font-semibold text-amber-900">
                Já existe alguém parecido
              </h2>
              <p className="mt-1 text-sm text-amber-800">
                O telefone, o CPF ou o e-mail bate com {parecidos.length} ficha
                {parecidos.length > 1 ? "s" : ""} que já está na base. Abra a
                ficha em vez de criar outra — duas fichas da mesma pessoa
                separam o histórico dela.
              </p>
              <ul className="mt-3 space-y-2">
                {parecidos.map((c) => (
                  <li
                    className="flex items-center justify-between rounded border border-amber-200 bg-white px-3 py-2 text-sm"
                    key={c.id}
                  >
                    <span>
                      <strong>{c.name ?? "(sem nome)"}</strong>
                      <span className="text-gray-500">
                        {c.phone ? ` · ${c.phone}` : ""}
                        {c.email ? ` · ${c.email}` : ""}
                        {c.document ? ` · ${c.document}` : ""}
                      </span>
                    </span>
                    <Link
                      className="font-semibold text-brand-600 hover:underline"
                      href={`/admin/clients/${c.id}`}
                    >
                      Abrir ficha
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {parecidos !== null &&
            parecidos.length === 0 &&
            (falhouConferencia ? (
              <p className="rounded border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                Não foi possível conferir se esta pessoa já está na base. Dá para
                cadastrar assim mesmo, mas vale procurar em Clientes antes.
              </p>
            ) : (
              <p className="text-sm text-gray-500">
                Ninguém parecido na base. Pode cadastrar.
              </p>
            ))}

          {/* A rota recusa gravar por cima de ficha existente e devolve QUEM é.
              Atualizar passa a ser escolha do operador, como já era na
              importação — antes o CPF da pessoa antiga era substituído em
              silêncio. */}
          {jaExiste && (
            <section className="rounded-lg border border-amber-300 bg-amber-50 p-4">
              {/* Frase inteira num no so: quebrada em pedacos, o leitor de
                  tela anuncia o nome solto e a frase solta. */}
              <p className="text-sm font-semibold text-amber-900" role="alert">
                {`${jaExiste.name || "Alguém"} já está cadastrado com este e-mail.`}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Link
                  className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50"
                  href={`/admin/clients/${jaExiste.id}`}
                >
                  Abrir a ficha
                </Link>
                <Button
                  loading={salvando}
                  onClick={() => void gravar(true)}
                  type="button"
                  variant="secondary"
                >
                  Atualizar a ficha com o que preenchi
                </Button>
              </div>
            </section>
          )}

          {erro && <p className="text-sm text-red-600">{erro}</p>}

          {/* type="submit" EXPLICITO. O <Button> do projeto tem type="button"
              por padrao (components/ui/Button.tsx), o oposto do <button> cru do
              HTML. Sem isto o onSubmit do <form> nunca dispara e a tela inteira
              nao faz nada — nem procura parecidos, nem cadastra. */}
          <Button
            disabled={!podeSalvar}
            loading={procurando || salvando}
            type="submit"
          >
            {parecidos === null ? "Conferir e continuar" : "Cadastrar cliente"}
          </Button>
        </form>
      </AdminLayout>
    </AdminGuard>
  );
};

export default AdminNewClient;
