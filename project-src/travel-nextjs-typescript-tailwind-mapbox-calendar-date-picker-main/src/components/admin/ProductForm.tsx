import { useState } from "react";
import type { Product } from "../../lib/products/types";
import type { ProductFormValues } from "../../lib/admin/client";

type Props = {
  initialProduct?: Product | null;
  onSubmit: (values: ProductFormValues) => Promise<void>;
  submitLabel: string;
};

const productTypes = ["package", "hotel", "flight", "stay", "experience"] as const;

const ProductForm = ({ initialProduct, onSubmit, submitLabel }: Props) => {
  const [values, setValues] = useState<ProductFormValues>({
    title: initialProduct?.title ?? "",
    slug: initialProduct?.slug ?? "",
    description: initialProduct?.description ?? "",
    type: initialProduct?.type ?? "package",
    destination: initialProduct?.destination ?? "",
    origin: initialProduct?.origin ?? "",
    price: initialProduct?.price ?? 0,
    promotional_price: initialProduct?.promotional_price ?? null,
    cover_image: initialProduct?.cover_image ?? "",
    gallery: Array.isArray(initialProduct?.gallery)
      ? (initialProduct?.gallery as string[])
      : [],
    active: initialProduct?.active ?? true,
  });
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const updateValue = <K extends keyof ProductFormValues>(
    key: K,
    value: ProductFormValues[K]
  ) => {
    setValues((current) => ({ ...current, [key]: value }));
  };

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
          : "Nao foi possivel salvar produto."
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
      <div className="grid gap-4 md:grid-cols-2">
        <label className="text-sm font-medium">
          Titulo
          <input
            className="mt-1 w-full rounded border px-3 py-2"
            onChange={(event) => updateValue("title", event.target.value)}
            required
            value={values.title}
          />
        </label>
        <label className="text-sm font-medium">
          Slug
          <input
            className="mt-1 w-full rounded border px-3 py-2"
            onChange={(event) => updateValue("slug", event.target.value)}
            required
            value={values.slug}
          />
        </label>
        <label className="text-sm font-medium">
          Tipo
          <select
            className="mt-1 w-full rounded border px-3 py-2"
            onChange={(event) => updateValue("type", event.target.value as ProductFormValues["type"])}
            value={values.type}
          >
            {productTypes.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm font-medium">
          Destino
          <input
            className="mt-1 w-full rounded border px-3 py-2"
            onChange={(event) => updateValue("destination", event.target.value)}
            required
            value={values.destination}
          />
        </label>
        <label className="text-sm font-medium">
          Origem (cidade de saída)
          <input
            className="mt-1 w-full rounded border px-3 py-2"
            onChange={(event) => updateValue("origin", event.target.value)}
            placeholder="Ex.: Teresina"
            value={values.origin}
          />
          <span className="mt-1 block text-xs font-normal text-gray-500">
            Cidade de onde o grupo parte. Aparece no filtro de busca do site.
          </span>
        </label>
        <label className="text-sm font-medium">
          Preco
          <input
            className="mt-1 w-full rounded border px-3 py-2"
            min={0}
            onChange={(event) => updateValue("price", Number(event.target.value))}
            required
            type="number"
            value={values.price}
          />
        </label>
        <label className="text-sm font-medium">
          Preco promocional
          <input
            className="mt-1 w-full rounded border px-3 py-2"
            min={0}
            onChange={(event) =>
              updateValue(
                "promotional_price",
                event.target.value ? Number(event.target.value) : null
              )
            }
            type="number"
            value={values.promotional_price ?? ""}
          />
        </label>
      </div>
      <label className="text-sm font-medium">
        Descricao
        <textarea
          className="mt-1 min-h-[120px] w-full rounded border px-3 py-2"
          onChange={(event) => updateValue("description", event.target.value)}
          value={values.description}
        />
      </label>
      <label className="text-sm font-medium">
        Imagem de capa
        <input
          className="mt-1 w-full rounded border px-3 py-2"
          onChange={(event) => updateValue("cover_image", event.target.value)}
          value={values.cover_image}
        />
      </label>
      <label className="flex items-center gap-2 text-sm font-medium">
        <input
          checked={values.active}
          onChange={(event) => updateValue("active", event.target.checked)}
          type="checkbox"
        />
        Produto ativo
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

export default ProductForm;
