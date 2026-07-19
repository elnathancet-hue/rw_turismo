import { FormEvent, useEffect, useState } from "react";
import AdminGuard from "../../components/admin/AdminGuard";
import AdminLayout from "../../components/admin/AdminLayout";
import AdminListState from "../../components/admin/AdminListState";
import ConfirmButton from "../../components/admin/ConfirmButton";
import Button from "../../components/ui/Button";
import Card from "../../components/ui/Card";
import { Field, Input, Select, Textarea } from "../../components/ui/form";
import {
  createAdminSupplier,
  deleteAdminSupplier,
  searchAdminSuppliers,
  updateAdminSupplier,
  type Supplier,
  type SupplierFormValues,
} from "../../lib/admin/client";

const categoryLabels: Record<string, string> = {
  hotel: "Hotel / Pousada",
  transporte: "Transporte",
  guia: "Guia",
  restaurante: "Restaurante",
  passeio: "Passeio / Receptivo",
  outro: "Outro",
};

const emptyValues: SupplierFormValues = {
  name: "",
  category: "outro",
  contact_name: "",
  phone: "",
  email: "",
  city: "",
  notes: "",
  active: true,
};

const PAGE_SIZE = 25;

const AdminSuppliers = () => {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [count, setCount] = useState(0);
  const [page, setPage] = useState(1);
  const [values, setValues] = useState<SupplierFormValues>(emptyValues);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loadStatus, setLoadStatus] = useState<"loading" | "ready" | "error">(
    "loading"
  );
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{
    tone: "ok" | "error";
    text: string;
  } | null>(null);

  const load = async () => {
    setLoadStatus("loading");
    setLoadError(null);
    try {
      const result = await searchAdminSuppliers({ page, limit: PAGE_SIZE });
      setSuppliers(result.items);
      setCount(result.count);
      setLoadStatus("ready");
    } catch (caught) {
      setLoadError(
        caught instanceof Error
          ? caught.message
          : "Não foi possível carregar os fornecedores. A migration da Fase 1 já rodou?"
      );
      setLoadStatus("error");
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  const totalPages = Math.max(1, Math.ceil(count / PAGE_SIZE));

  const set = <K extends keyof SupplierFormValues>(
    key: K,
    value: SupplierFormValues[K]
  ) => setValues((current) => ({ ...current, [key]: value }));

  const resetForm = () => {
    setValues(emptyValues);
    setEditingId(null);
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setMessage(null);
    setIsSaving(true);
    try {
      if (editingId) {
        await updateAdminSupplier(editingId, values);
      } else {
        await createAdminSupplier(values);
      }
      setMessage({ tone: "ok", text: "Fornecedor salvo." });
      resetForm();
      await load();
    } catch (caught) {
      setMessage({
        tone: "error",
        text:
          caught instanceof Error
            ? caught.message
            : "Não foi possível salvar o fornecedor.",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const startEditing = (supplier: Supplier) => {
    setEditingId(supplier.id);
    setValues({
      name: supplier.name,
      category: supplier.category,
      contact_name: supplier.contact_name ?? "",
      phone: supplier.phone ?? "",
      email: supplier.email ?? "",
      city: supplier.city ?? "",
      notes: supplier.notes ?? "",
      active: supplier.active,
    });
  };

  return (
    <AdminGuard>
      <AdminLayout
        title="Fornecedores"
        description="Hotéis, transporte, guias e parceiros — a base para transfers e despesas."
      >
        <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
          <Card className="h-fit p-5">
            <h2 className="text-lg font-semibold">
              {editingId ? "Editar fornecedor" : "Novo fornecedor"}
            </h2>
            <form className="mt-4 space-y-4" onSubmit={submit}>
              <Field label="Nome">
                <Input
                  onChange={(event) => set("name", event.target.value)}
                  required
                  value={values.name}
                />
              </Field>
              <Field label="Categoria">
                <Select
                  onChange={(event) => set("category", event.target.value)}
                  value={values.category}
                >
                  {Object.entries(categoryLabels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </Select>
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Contato">
                  <Input
                    onChange={(event) =>
                      set("contact_name", event.target.value)
                    }
                    value={values.contact_name}
                  />
                </Field>
                <Field label="Telefone">
                  <Input
                    onChange={(event) => set("phone", event.target.value)}
                    value={values.phone}
                  />
                </Field>
                <Field label="E-mail">
                  <Input
                    onChange={(event) => set("email", event.target.value)}
                    type="email"
                    value={values.email}
                  />
                </Field>
                <Field label="Cidade">
                  <Input
                    onChange={(event) => set("city", event.target.value)}
                    value={values.city}
                  />
                </Field>
              </div>
              <Field label="Observações">
                <Textarea
                  className="min-h-[80px]"
                  onChange={(event) => set("notes", event.target.value)}
                  value={values.notes}
                />
              </Field>
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                <input
                  checked={values.active}
                  onChange={(event) => set("active", event.target.checked)}
                  type="checkbox"
                />
                Fornecedor ativo
              </label>
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
              <div className="flex gap-3">
                <Button loading={isSaving} type="submit">
                  {isSaving ? "Salvando…" : editingId ? "Salvar" : "Criar"}
                </Button>
                {editingId && (
                  <Button onClick={resetForm} type="button" variant="secondary">
                    Cancelar
                  </Button>
                )}
              </div>
            </form>
          </Card>

          <AdminListState
            emptyHint="Cadastre o primeiro fornecedor no formulário ao lado."
            emptyTitle="Nenhum fornecedor ainda"
            error={loadError}
            isEmpty={suppliers.length === 0}
            onRetry={load}
            status={loadStatus}
          >
            <div className="overflow-x-auto rounded-lg border bg-white shadow-sm">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                  <tr>
                    <th className="px-4 py-3">Nome</th>
                    <th className="px-4 py-3">Categoria</th>
                    <th className="px-4 py-3">Contato</th>
                    <th className="px-4 py-3">Cidade</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {suppliers.map((supplier) => (
                    <tr className="hover:bg-gray-50" key={supplier.id}>
                      <td className="px-4 py-3 font-medium">
                        {supplier.name}
                      </td>
                      <td className="px-4 py-3">
                        {categoryLabels[supplier.category] ?? supplier.category}
                      </td>
                      <td className="px-4 py-3">
                        <p>{supplier.contact_name || "—"}</p>
                        <p className="text-xs text-gray-500">
                          {[supplier.phone, supplier.email]
                            .filter(Boolean)
                            .join(" · ") || "sem contato"}
                        </p>
                      </td>
                      <td className="px-4 py-3">{supplier.city || "—"}</td>
                      <td className="px-4 py-3">
                        {supplier.active ? "Ativo" : "Inativo"}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          className="font-semibold text-orange-600 hover:text-orange-700"
                          onClick={() => startEditing(supplier)}
                          type="button"
                        >
                          Editar
                        </button>
                        <ConfirmButton
                          className="ml-4 font-semibold text-red-600 hover:text-red-700"
                          confirmLabel="Excluir fornecedor"
                          message={`Excluir o fornecedor "${supplier.name}"? Esta ação não pode ser desfeita.`}
                          onConfirm={() => deleteAdminSupplier(supplier.id)}
                          onDone={load}
                        >
                          Excluir
                        </ConfirmButton>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-gray-500">
                Página {page} de {totalPages} · {count}{" "}
                {count === 1 ? "fornecedor" : "fornecedores"}
              </p>
              <div className="flex gap-2">
                <button
                  className="rounded border px-4 py-1.5 text-sm font-semibold disabled:opacity-50"
                  disabled={page <= 1}
                  onClick={() => setPage((current) => current - 1)}
                  type="button"
                >
                  ‹ Anterior
                </button>
                <button
                  className="rounded border px-4 py-1.5 text-sm font-semibold disabled:opacity-50"
                  disabled={page >= totalPages}
                  onClick={() => setPage((current) => current + 1)}
                  type="button"
                >
                  Próxima ›
                </button>
              </div>
            </div>
          </AdminListState>
        </div>
      </AdminLayout>
    </AdminGuard>
  );
};

export default AdminSuppliers;
