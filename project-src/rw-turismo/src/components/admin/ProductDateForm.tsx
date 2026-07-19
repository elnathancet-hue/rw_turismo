import { useEffect, useState } from "react";
import {
  listAdminProducts,
  type ProductDateFormValues,
} from "../../lib/admin/client";
import type { Product, ProductDate } from "../../lib/products/types";

type Props = {
  initialDate?: ProductDate | null;
  onSubmit: (values: ProductDateFormValues) => Promise<void>;
  submitLabel: string;
};

// Hoje no fuso local do admin (en-CA = YYYY-MM-DD), para o min dos inputs.
const todayLocalISO = () =>
  new Intl.DateTimeFormat("en-CA").format(new Date());

const ProductDateForm = ({ initialDate, onSubmit, submitLabel }: Props) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [values, setValues] = useState<ProductDateFormValues>({
    product_id: initialDate?.product_id ?? "",
    start_date: initialDate?.start_date ?? "",
    end_date: initialDate?.end_date ?? "",
    available_slots: initialDate?.available_slots ?? 0,
    price_override: initialDate?.price_override ?? null,
    active: initialDate?.active ?? true,
  });
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    listAdminProducts()
      .then((items) => {
        setProducts(items);
        if (!values.product_id && items[0]) {
          setValues((current) => ({ ...current, product_id: items[0].id }));
        }
      })
      .catch((loadError) =>
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Nao foi possivel carregar produtos."
        )
      );
  }, []);

  const updateValue = <K extends keyof ProductDateFormValues>(
    key: K,
    value: ProductDateFormValues[K]
  ) => setValues((current) => ({ ...current, [key]: value }));

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setIsSaving(true);

    try {
      await onSubmit(values);
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Nao foi possivel salvar data."
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form className="grid gap-5 rounded-lg border bg-white p-6 shadow-sm" onSubmit={handleSubmit}>
      {error && (
        <p className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </p>
      )}
      <label className="text-sm font-medium">
        Produto
        <select
          className="mt-1 w-full rounded border px-3 py-2"
          onChange={(event) => updateValue("product_id", event.target.value)}
          required
          value={values.product_id}
        >
          {products.map((product) => (
            <option key={product.id} value={product.id}>
              {product.title}
            </option>
          ))}
        </select>
      </label>
      <div className="grid gap-4 md:grid-cols-2">
        <label className="text-sm font-medium">
          Inicio
          <input
            className="mt-1 w-full rounded border px-3 py-2"
            min={initialDate ? undefined : todayLocalISO()}
            onChange={(event) => updateValue("start_date", event.target.value)}
            required
            type="date"
            value={values.start_date}
          />
        </label>
        <label className="text-sm font-medium">
          Fim
          <input
            className="mt-1 w-full rounded border px-3 py-2"
            min={values.start_date || (initialDate ? undefined : todayLocalISO())}
            onChange={(event) => updateValue("end_date", event.target.value)}
            required
            type="date"
            value={values.end_date}
          />
        </label>
        <label className="text-sm font-medium">
          Vagas
          <input
            className="mt-1 w-full rounded border px-3 py-2"
            min={0}
            onChange={(event) =>
              updateValue("available_slots", Number(event.target.value))
            }
            required
            type="number"
            value={values.available_slots}
          />
        </label>
        <label className="text-sm font-medium">
          Preco especial
          <input
            className="mt-1 w-full rounded border px-3 py-2"
            min={0}
            onChange={(event) =>
              updateValue(
                "price_override",
                event.target.value ? Number(event.target.value) : null
              )
            }
            type="number"
            value={values.price_override ?? ""}
          />
        </label>
      </div>
      <label className="flex items-center gap-2 text-sm font-medium">
        <input
          checked={values.active}
          onChange={(event) => updateValue("active", event.target.checked)}
          type="checkbox"
        />
        Data ativa
      </label>
      <button
        className="w-fit rounded bg-orange-500 px-5 py-2 font-semibold text-white hover:bg-orange-600 disabled:opacity-60"
        disabled={isSaving}
        type="submit"
      >
        {isSaving ? "Salvando..." : submitLabel}
      </button>
    </form>
  );
};

export default ProductDateForm;
