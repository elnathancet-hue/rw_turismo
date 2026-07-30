import { FormEvent, useEffect, useState } from "react";
import AdminGuard from "../../components/admin/AdminGuard";
import AdminLayout from "../../components/admin/AdminLayout";
import AdminListState from "../../components/admin/AdminListState";
import ConfirmButton from "../../components/admin/ConfirmButton";
import Button from "../../components/ui/Button";
import Card from "../../components/ui/Card";
import { Field, Input, Select } from "../../components/ui/form";
import useSupabaseSession from "../../hooks/useSupabaseSession";
import {
  ROLE_DESCRIPTIONS,
  ROLE_LABELS,
  STAFF_ROLES,
  type StaffRole,
} from "../../lib/auth/roles";

type StaffUser = {
  id: string;
  user_id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  role: StaffRole;
  active: boolean;
  created_at: string;
};

type FormValues = {
  name: string;
  email: string;
  phone: string;
  role: StaffRole;
  password: string;
};

const emptyValues: FormValues = {
  name: "",
  email: "",
  phone: "",
  role: "operacoes",
  password: "",
};

// Sem caracteres ambíguos (0/O, 1/l/I): a senha é passada por WhatsApp e
// digitada à mão do outro lado.
const PASSWORD_ALPHABET =
  "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";

const generatePassword = (): string => {
  const bytes = new Uint32Array(12);
  window.crypto.getRandomValues(bytes);
  return Array.from(
    bytes,
    (value) => PASSWORD_ALPHABET[value % PASSWORD_ALPHABET.length]
  ).join("");
};

const request = async (url: string, method: string, body?: unknown) => {
  const response = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data?.error ?? "Não foi possível concluir a ação.");
  }
  return data;
};

const AdminUsers = () => {
  const { user } = useSupabaseSession();
  const [users, setUsers] = useState<StaffUser[]>([]);
  const [values, setValues] = useState<FormValues>(emptyValues);
  const [editing, setEditing] = useState<StaffUser | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [loadStatus, setLoadStatus] = useState<"loading" | "ready" | "error">(
    "loading"
  );
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{
    tone: "ok" | "error";
    text: string;
  } | null>(null);
  // Credencial recém-criada, para o admin copiar e enviar à pessoa.
  const [credential, setCredential] = useState<{
    email: string;
    password: string;
  } | null>(null);

  const load = async () => {
    setLoadStatus("loading");
    setLoadError(null);
    try {
      const data = await request("/api/admin/users", "GET");
      setUsers((data?.users ?? []) as StaffUser[]);
      setLoadStatus("ready");
    } catch (caught) {
      setLoadError(
        caught instanceof Error
          ? caught.message
          : "Não foi possível carregar os usuários. A migration de usuários do sistema já rodou?"
      );
      setLoadStatus("error");
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const set = <K extends keyof FormValues>(key: K, value: FormValues[K]) =>
    setValues((current) => ({ ...current, [key]: value }));

  const resetForm = () => {
    setValues(emptyValues);
    setEditing(null);
    setNewPassword("");
  };

  const startEditing = (staffUser: StaffUser) => {
    setEditing(staffUser);
    setMessage(null);
    setCredential(null);
    setNewPassword("");
    setValues({
      name: staffUser.name ?? "",
      email: staffUser.email ?? "",
      phone: staffUser.phone ?? "",
      role: staffUser.role,
      password: "",
    });
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setMessage(null);
    setCredential(null);
    setIsSaving(true);

    try {
      if (editing) {
        await request(`/api/admin/users/${editing.id}`, "PATCH", {
          name: values.name,
          phone: values.phone,
          role: values.role,
        });
        setMessage({ tone: "ok", text: "Usuário salvo." });
      } else {
        const data = await request("/api/admin/users", "POST", {
          name: values.name,
          email: values.email,
          phone: values.phone,
          role: values.role,
          password: values.password,
        });

        if (data?.promoted) {
          setMessage({
            tone: "ok",
            text: `${values.email} já tinha conta de cliente no site — a conta foi promovida a ${
              ROLE_LABELS[values.role]
            }. A senha que a pessoa já usa continua valendo.`,
          });
        } else {
          setMessage({ tone: "ok", text: "Acesso criado." });
          setCredential({
            email: values.email.trim().toLowerCase(),
            password: values.password,
          });
        }
      }

      resetForm();
      await load();
    } catch (caught) {
      setMessage({
        tone: "error",
        text:
          caught instanceof Error
            ? caught.message
            : "Não foi possível salvar o usuário.",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const changePassword = async () => {
    if (!editing) return;
    setMessage(null);
    setCredential(null);
    setIsSaving(true);

    try {
      await request(`/api/admin/users/${editing.id}/reset-password`, "POST", {
        password: newPassword,
      });
      setMessage({ tone: "ok", text: "Senha trocada." });
      setCredential({ email: editing.email ?? "", password: newPassword });
      setNewPassword("");
    } catch (caught) {
      setMessage({
        tone: "error",
        text:
          caught instanceof Error
            ? caught.message
            : "Não foi possível trocar a senha.",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const setActive = async (staffUser: StaffUser, active: boolean) => {
    await request(`/api/admin/users/${staffUser.id}`, "PATCH", { active });
  };

  const isSelf = (staffUser: StaffUser) => staffUser.user_id === user?.id;

  return (
    <AdminGuard>
      <AdminLayout
        title="Usuários do sistema"
        description="Quem entra no painel e o que cada um pode ver. Clientes do site ficam em Clientes."
      >
        <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
          <Card className="h-fit p-5">
            <h2 className="text-lg font-semibold">
              {editing ? "Editar usuário" : "Novo usuário"}
            </h2>
            <form className="mt-4 space-y-4" onSubmit={submit}>
              <Field label="Nome">
                <Input
                  data-test="user-name"
                  onChange={(event) => set("name", event.target.value)}
                  required
                  value={values.name}
                />
              </Field>
              <Field label="E-mail">
                <Input
                  data-test="user-email"
                  // O e-mail é a identidade do login: trocar depois viraria
                  // outra conta, então na edição ele fica travado.
                  disabled={Boolean(editing)}
                  onChange={(event) => set("email", event.target.value)}
                  required
                  type="email"
                  value={values.email}
                />
              </Field>
              <Field label="Telefone">
                <Input
                  onChange={(event) => set("phone", event.target.value)}
                  value={values.phone}
                />
              </Field>
              <Field label="Papel">
                <Select
                  data-test="user-role"
                  disabled={Boolean(editing && isSelf(editing))}
                  onChange={(event) =>
                    set("role", event.target.value as StaffRole)
                  }
                  value={values.role}
                >
                  {STAFF_ROLES.map((role) => (
                    <option key={role} value={role}>
                      {ROLE_LABELS[role]}
                    </option>
                  ))}
                </Select>
              </Field>
              <p className="rounded-lg bg-gray-50 p-3 text-xs text-gray-600">
                {ROLE_DESCRIPTIONS[values.role]}
              </p>
              {editing && isSelf(editing) && (
                <p className="text-xs text-gray-500">
                  Você não pode trocar o seu próprio papel — pede para outro
                  administrador fazer isso.
                </p>
              )}

              {!editing && (
                <Field label="Senha provisória">
                  <div className="flex gap-2">
                    <Input
                      data-test="user-password"
                      minLength={8}
                      onChange={(event) => set("password", event.target.value)}
                      required
                      value={values.password}
                    />
                    <Button
                      onClick={() => set("password", generatePassword())}
                      type="button"
                      variant="secondary"
                    >
                      Gerar
                    </Button>
                  </div>
                </Field>
              )}

              {message && (
                <p
                  className={`text-sm ${
                    message.tone === "ok" ? "text-green-700" : "text-red-600"
                  }`}
                  role="alert"
                >
                  {message.text}
                </p>
              )}

              {credential && (
                <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm">
                  <p className="font-semibold text-green-800">
                    Envie estes dados para a pessoa:
                  </p>
                  <p className="mt-1 break-all text-green-900">
                    <b>Acesso:</b> {credential.email}
                    <br />
                    <b>Senha:</b> {credential.password}
                  </p>
                  <p className="mt-2 text-xs text-green-700">
                    Esta senha não fica salva em nenhum log — se sair desta tela,
                    só resta gerar outra.
                  </p>
                </div>
              )}

              <div className="flex gap-3">
                <Button data-test="user-submit" loading={isSaving} type="submit">
                  {isSaving ? "Salvando…" : editing ? "Salvar" : "Criar acesso"}
                </Button>
                {editing && (
                  <Button onClick={resetForm} type="button" variant="secondary">
                    Cancelar
                  </Button>
                )}
              </div>
            </form>

            {editing && (
              <div className="mt-6 border-t pt-4">
                <h3 className="text-sm font-semibold">Trocar a senha</h3>
                <p className="mt-1 text-xs text-gray-500">
                  Use quando a pessoa esquecer a senha. O acesso muda na hora.
                </p>
                <div className="mt-3 flex gap-2">
                  <Input
                    minLength={8}
                    onChange={(event) => setNewPassword(event.target.value)}
                    placeholder="Nova senha (mín. 8)"
                    value={newPassword}
                  />
                  <Button
                    onClick={() => setNewPassword(generatePassword())}
                    type="button"
                    variant="secondary"
                  >
                    Gerar
                  </Button>
                </div>
                <Button
                  className="mt-3"
                  disabled={newPassword.length < 8}
                  loading={isSaving}
                  onClick={changePassword}
                  type="button"
                >
                  Trocar senha
                </Button>
              </div>
            )}
          </Card>

          <AdminListState
            emptyHint="Cadastre o primeiro usuário no formulário ao lado."
            emptyTitle="Nenhum usuário do sistema ainda"
            error={loadError}
            isEmpty={users.length === 0}
            onRetry={load}
            status={loadStatus}
          >
            <div className="overflow-x-auto rounded-lg border bg-white shadow-sm">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                  <tr>
                    <th className="px-4 py-3">Pessoa</th>
                    <th className="px-4 py-3">Papel</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {users.map((staffUser) => (
                    <tr className="hover:bg-gray-50" key={staffUser.id}>
                      <td className="px-4 py-3">
                        <p className="font-medium">
                          {staffUser.name || "—"}
                          {isSelf(staffUser) && (
                            <span className="ml-2 rounded bg-gray-100 px-1.5 py-0.5 text-xs font-normal text-gray-500">
                              você
                            </span>
                          )}
                        </p>
                        <p className="text-xs text-gray-500">
                          {staffUser.email}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        {ROLE_LABELS[staffUser.role] ?? staffUser.role}
                      </td>
                      <td className="px-4 py-3">
                        {staffUser.active ? (
                          "Ativo"
                        ) : (
                          <span className="text-red-600">Desativado</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          className="font-semibold text-orange-600 hover:text-orange-700"
                          onClick={() => startEditing(staffUser)}
                          type="button"
                        >
                          Editar
                        </button>
                        {!isSelf(staffUser) &&
                          (staffUser.active ? (
                            <ConfirmButton
                              className="ml-4 font-semibold text-red-600 hover:text-red-700"
                              confirmLabel="Desativar acesso"
                              message={`Desativar o acesso de ${
                                staffUser.name || staffUser.email
                              }? A pessoa deixa de entrar no painel na hora, mas o histórico dela continua.`}
                              onConfirm={() => setActive(staffUser, false)}
                              onDone={load}
                              title="Confirmar desativação"
                            >
                              Desativar
                            </ConfirmButton>
                          ) : (
                            // Reativar não destrói nada, então vai direto —
                            // confirmação fica só no lado destrutivo.
                            <button
                              className="ml-4 font-semibold text-green-700 hover:text-green-800"
                              onClick={async () => {
                                try {
                                  await setActive(staffUser, true);
                                  await load();
                                } catch (caught) {
                                  setMessage({
                                    tone: "error",
                                    text:
                                      caught instanceof Error
                                        ? caught.message
                                        : "Não foi possível reativar o acesso.",
                                  });
                                }
                              }}
                              type="button"
                            >
                              Reativar
                            </button>
                          ))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-4 space-y-1 text-xs text-gray-500">
              {STAFF_ROLES.map((role) => (
                <p key={role}>
                  <b className="text-gray-700">{ROLE_LABELS[role]}:</b>{" "}
                  {ROLE_DESCRIPTIONS[role]}
                </p>
              ))}
            </div>
          </AdminListState>
        </div>
      </AdminLayout>
    </AdminGuard>
  );
};

export default AdminUsers;
