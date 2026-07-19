import { useEffect, useState } from "react";
import AdminGuard from "../../components/admin/AdminGuard";
import AdminLayout from "../../components/admin/AdminLayout";
import AdminListState from "../../components/admin/AdminListState";
import {
  createAdminCategory,
  deleteAdminCategory,
  getCategoryProductIds,
  listAdminCategories,
  listAdminProducts,
  setCategoryProducts,
  updateAdminCategory,
  type CategoryFormValues,
} from "../../lib/admin/client";
import type { Category, Product } from "../../lib/products/types";

const emptyCategory: CategoryFormValues = {
  name: "",
  slug: "",
  active: true,
};

const AdminCategories = () => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [values, setValues] = useState<CategoryFormValues>(emptyCategory);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadStatus, setLoadStatus] = useState<"loading" | "ready" | "error">(
    "loading"
  );
  const [loadError, setLoadError] = useState<string | null>(null);
  // Products picker for the category being edited.
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
  const [savingProducts, setSavingProducts] = useState(false);
  const [productsMsg, setProductsMsg] = useState<string | null>(null);

  const loadCategories = async () => {
    setLoadStatus("loading");
    setLoadError(null);
    try {
      setCategories(await listAdminCategories());
      setLoadStatus("ready");
    } catch (caught) {
      setLoadError(
        caught instanceof Error
          ? caught.message
          : "Não foi possível carregar as categorias."
      );
      setLoadStatus("error");
    }
  };

  useEffect(() => {
    loadCategories();
    listAdminProducts()
      .then(setProducts)
      .catch(() => setProducts([]));
  }, []);

  const resetForm = () => {
    setValues(emptyCategory);
    setEditingId(null);
    setSelectedProductIds([]);
    setProductsMsg(null);
  };

  const toggleProduct = (id: string) => {
    setProductsMsg(null);
    setSelectedProductIds((current) =>
      current.includes(id)
        ? current.filter((value) => value !== id)
        : [...current, id]
    );
  };

  const saveCategoryProducts = async () => {
    if (!editingId) return;
    setSavingProducts(true);
    setProductsMsg(null);
    try {
      await setCategoryProducts(editingId, selectedProductIds);
      setProductsMsg("Viagens da categoria salvas.");
    } catch (caught) {
      setProductsMsg(
        caught instanceof Error
          ? caught.message
          : "Não foi possível salvar as viagens."
      );
    } finally {
      setSavingProducts(false);
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    try {
      if (editingId) {
        await updateAdminCategory(editingId, values);
      } else {
        await createAdminCategory(values);
      }

      resetForm();
      await loadCategories();
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Nao foi possivel salvar categoria."
      );
    }
  };

  const startEditing = (category: Category) => {
    setEditingId(category.id);
    setValues({
      name: category.name,
      slug: category.slug,
      active: category.active,
    });
    setProductsMsg(null);
    setSelectedProductIds([]);
    getCategoryProductIds(category.id)
      .then(setSelectedProductIds)
      .catch(() => setSelectedProductIds([]));
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Remover esta categoria?")) return;

    await deleteAdminCategory(id);
    setCategories((current) => current.filter((category) => category.id !== id));
  };

  return (
    <AdminGuard>
      <AdminLayout
        title="Categorias"
        description="Crie categorias e, ao editar, escolha quais viagens entram em cada uma. Depois use “Filtrar por categoria” nas vitrines da Home."
      >
        {error && (
          <p className="mb-4 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </p>
        )}

        <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
          <div className="space-y-6">
          <form
            className="h-fit rounded-lg border bg-white p-5 shadow-sm"
            onSubmit={handleSubmit}
          >
            <h2 className="text-lg font-semibold">
              {editingId ? "Editar categoria" : "Nova categoria"}
            </h2>
            <label className="mt-4 block text-sm font-medium">
              Nome
              <input
                className="mt-1 w-full rounded border px-3 py-2"
                onChange={(event) =>
                  setValues((current) => ({
                    ...current,
                    name: event.target.value,
                  }))
                }
                required
                value={values.name}
              />
            </label>
            <label className="mt-4 block text-sm font-medium">
              Slug
              <input
                className="mt-1 w-full rounded border px-3 py-2"
                onChange={(event) =>
                  setValues((current) => ({
                    ...current,
                    slug: event.target.value,
                  }))
                }
                required
                value={values.slug}
              />
            </label>
            <label className="mt-4 flex items-center gap-2 text-sm font-medium">
              <input
                checked={values.active}
                onChange={(event) =>
                  setValues((current) => ({
                    ...current,
                    active: event.target.checked,
                  }))
                }
                type="checkbox"
              />
              Categoria ativa
            </label>
            <div className="mt-5 flex gap-3">
              <button
                className="rounded bg-orange-500 px-4 py-2 font-semibold text-white hover:bg-orange-600"
                type="submit"
              >
                {editingId ? "Salvar" : "Criar"}
              </button>
              {editingId && (
                <button
                  className="rounded border px-4 py-2 font-semibold hover:bg-gray-100"
                  onClick={resetForm}
                  type="button"
                >
                  Cancelar
                </button>
              )}
            </div>
          </form>
          {editingId && (
            <div className="rounded-lg border bg-white p-5 shadow-sm">
              <h2 className="text-lg font-semibold">Viagens desta categoria</h2>
              <p className="mt-1 text-sm text-gray-500">
                Marque as viagens que entram em “{values.name || "categoria"}”.
              </p>
              {productsMsg && (
                <p className="mt-3 rounded border border-gray-200 bg-gray-50 p-2 text-sm text-gray-700">
                  {productsMsg}
                </p>
              )}
              {products.length === 0 ? (
                <p className="mt-3 text-sm text-gray-500">
                  Nenhuma viagem cadastrada ainda.
                </p>
              ) : (
                <div className="mt-3 max-h-72 space-y-1 overflow-y-auto pr-1">
                  {products.map((product) => {
                    const checked = selectedProductIds.includes(product.id);
                    return (
                      <label
                        className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-gray-50"
                        key={product.id}
                      >
                        <input
                          checked={checked}
                          onChange={() => toggleProduct(product.id)}
                          type="checkbox"
                        />
                        <span className="min-w-0 flex-1 truncate">
                          {product.title}
                          {!product.active && (
                            <span className="ml-1 text-xs text-gray-400">
                              (inativa)
                            </span>
                          )}
                        </span>
                      </label>
                    );
                  })}
                </div>
              )}
              <div className="mt-4 flex items-center gap-3">
                <button
                  className="rounded bg-orange-500 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-600 disabled:opacity-60"
                  disabled={savingProducts}
                  onClick={saveCategoryProducts}
                  type="button"
                >
                  {savingProducts ? "Salvando…" : "Salvar viagens"}
                </button>
                <span className="text-xs text-gray-500">
                  {selectedProductIds.length} selecionada(s)
                </span>
              </div>
            </div>
          )}
          </div>

          <AdminListState
            emptyHint="Crie a primeira categoria no formulário ao lado."
            emptyTitle="Nenhuma categoria ainda"
            error={loadError}
            isEmpty={categories.length === 0}
            onRetry={loadCategories}
            status={loadStatus}
          >
          <div className="overflow-x-auto rounded-lg border bg-white shadow-sm">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                <tr>
                  <th className="px-4 py-3">Nome</th>
                  <th className="px-4 py-3">Slug</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Acoes</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {categories.map((category) => (
                  <tr key={category.id}>
                    <td className="px-4 py-3 font-medium">{category.name}</td>
                    <td className="px-4 py-3">{category.slug}</td>
                    <td className="px-4 py-3">
                      {category.active ? "Ativa" : "Inativa"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        className="font-semibold text-orange-600 hover:text-orange-700"
                        onClick={() => startEditing(category)}
                        type="button"
                      >
                        Editar
                      </button>
                      <button
                        className="ml-4 font-semibold text-red-600 hover:text-red-700"
                        onClick={() => handleDelete(category.id)}
                        type="button"
                      >
                        Excluir
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          </AdminListState>
        </div>
      </AdminLayout>
    </AdminGuard>
  );
};

export default AdminCategories;
