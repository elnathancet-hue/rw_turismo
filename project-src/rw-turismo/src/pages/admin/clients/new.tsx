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

    setProcurando(true);
    try {
      const listas = await Promise.all(
        termos.map((termo) => searchAdminClients({ search: termo, limit: 5 }))
      );
      setParecidos(juntarParecidos(listas.map(({ clients }) => clients)));
    } catch {
      // Falha na conferência não pode travar o cadastro: seguir sem o aviso é
      // pior que nada, mas melhor que impedir a equipe de trabalhar.
      setParecidos([]);
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

    setSalvando(true);
    try {
      const { client } = await createAdminClient({
        name: form.name,
        email: form.email || null,
        phone: form.phone || null,
        document: form.document || null,
        birth_date: form.birth_date || null,
        contact_origin: form.contact_origin || null,
      });
      await router.push(`/admin/clients/${client.id}`);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha ao cadastrar.");
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

          {parecidos !== null && parecidos.length === 0 && (
            <p className="text-sm text-gray-500">
              Ninguém parecido na base. Pode cadastrar.
            </p>
          )}

          {erro && <p className="text-sm text-red-600">{erro}</p>}

          <Button disabled={!podeSalvar} loading={procurando || salvando}>
            {parecidos === null ? "Conferir e continuar" : "Cadastrar cliente"}
          </Button>
        </form>
      </AdminLayout>
    </AdminGuard>
  );
};

export default AdminNewClient;
