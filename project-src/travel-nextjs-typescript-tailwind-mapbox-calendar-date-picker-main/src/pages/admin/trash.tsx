import { useEffect, useState } from "react";
import AdminGuard from "../../components/admin/AdminGuard";
import AdminLayout from "../../components/admin/AdminLayout";
import AdminListState from "../../components/admin/AdminListState";
import Button from "../../components/ui/Button";
import {
  listDeletedCategories,
  listDeletedProductDates,
  listDeletedProducts,
  listDeletedSuppliers,
  restoreAdminCategory,
  restoreAdminProduct,
  restoreAdminProductDate,
  restoreAdminSupplier,
  type Deleted,
  type ProductDateWithProduct,
  type Supplier,
} from "../../lib/admin/client";
import {
  listDeletedLeads,
  restoreLead,
  type DeletedLead,
} from "../../lib/admin/crm";
import type { Category, Product } from "../../lib/products/types";
import { formatDateRangeBR, formatDateTimeBR } from "../../lib/format";

type TrashState = {
  products: Deleted<Product>[];
  categories: Deleted<Category>[];
  dates: Deleted<ProductDateWithProduct>[];
  suppliers: Deleted<Supplier>[];
  leads: DeletedLead[];
};

const emptyState: TrashState = {
  products: [],
  categories: [],
  dates: [],
  suppliers: [],
  leads: [],
};

const AdminTrash = () => {
  const [state, setState] = useState<TrashState>(emptyState);
  const [loadStatus, setLoadStatus] = useState<"loading" | "ready" | "error">(
    "loading"
  );
  const [error, setError] = useState<string | null>(null);
  const [restoringId, setRestoringId] = useState<string | null>(null);

  const load = async () => {
    setLoadStatus("loading");
    setError(null);
    try {
      const [products, categories, dates, suppliers, leads] = await Promise.all([
        listDeletedProducts(),
        listDeletedCategories(),
        listDeletedProductDates(),
        listDeletedSuppliers(),
        listDeletedLeads(),
      ]);
      setState({ products, categories, dates, suppliers, leads });
      setLoadStatus("ready");
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Não foi possível carregar a lixeira. A migration de soft delete já rodou?"
      );
      setLoadStatus("error");
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const restore = async (id: string, fn: (id: string) => Promise<void>) => {
    setRestoringId(id);
    try {
      await fn(id);
      await load();
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Não foi possível restaurar."
      );
    } finally {
      setRestoringId(null);
    }
  };

  const totalCount =
    state.products.length +
    state.categories.length +
    state.dates.length +
    state.suppliers.length +
    state.leads.length;

  const Section = ({
    title,
    rows,
  }: {
    title: string;
    rows: { id: string; label: string; sub?: string; onRestore: () => void }[];
  }) => {
    if (rows.length === 0) return null;
    return (
      <div className="rounded-lg border bg-white shadow-sm">
        <div className="border-b bg-gray-50 px-4 py-2 text-xs font-semibold uppercase text-gray-500">
          {title} · {rows.length}
        </div>
        <ul className="divide-y">
          {rows.map((row) => (
            <li
              className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
              key={row.id}
            >
              <div className="min-w-0">
                <p className="truncate font-medium">{row.label}</p>
                {row.sub && (
                  <p className="truncate text-xs text-gray-500">{row.sub}</p>
                )}
              </div>
              <Button
                loading={restoringId === row.id}
                onClick={row.onRestore}
                size="sm"
                type="button"
                variant="secondary"
              >
                Restaurar
              </Button>
            </li>
          ))}
        </ul>
      </div>
    );
  };

  return (
    <AdminGuard>
      <AdminLayout
        description="Itens excluídos podem ser restaurados aqui. Reservas históricas continuam apontando para eles mesmo enquanto estão na lixeira."
        title="Lixeira"
      >
        <AdminListState
          emptyHint="Quando você excluir um produto, categoria, data, fornecedor ou lead, ele aparece aqui para ser restaurado."
          emptyTitle="A lixeira está vazia"
          error={error}
          isEmpty={totalCount === 0}
          onRetry={load}
          status={loadStatus}
        >
          <div className="space-y-6">
            <Section
              title="Produtos"
              rows={state.products.map((product) => ({
                id: product.id,
                label: product.title,
                sub: `${product.destination} · excluído em ${formatDateTimeBR(
                  product.deleted_at
                )}`,
                onRestore: () => restore(product.id, restoreAdminProduct),
              }))}
            />
            <Section
              title="Categorias"
              rows={state.categories.map((category) => ({
                id: category.id,
                label: category.name,
                sub: `excluída em ${formatDateTimeBR(category.deleted_at)}`,
                onRestore: () => restore(category.id, restoreAdminCategory),
              }))}
            />
            <Section
              title="Datas de saída"
              rows={state.dates.map((date) => ({
                id: date.id,
                label: date.products?.title ?? date.product_id,
                sub: `${formatDateRangeBR(
                  date.start_date,
                  date.end_date
                )} · excluída em ${formatDateTimeBR(date.deleted_at)}`,
                onRestore: () => restore(date.id, restoreAdminProductDate),
              }))}
            />
            <Section
              title="Fornecedores"
              rows={state.suppliers.map((supplier) => ({
                id: supplier.id,
                label: supplier.name,
                sub: `excluído em ${formatDateTimeBR(supplier.deleted_at)}`,
                onRestore: () => restore(supplier.id, restoreAdminSupplier),
              }))}
            />
            <Section
              title="Leads (CRM)"
              rows={state.leads.map((lead) => ({
                id: lead.id,
                label: lead.name,
                sub: `${[lead.email, lead.phone]
                  .filter(Boolean)
                  .join(" · ")} · excluído em ${formatDateTimeBR(
                  lead.deleted_at
                )}`,
                onRestore: () => restore(lead.id, restoreLead),
              }))}
            />
          </div>
        </AdminListState>
      </AdminLayout>
    </AdminGuard>
  );
};

export default AdminTrash;
