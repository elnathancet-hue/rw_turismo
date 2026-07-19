import { useEffect, useState } from "react";
import type { ProductFormValues } from "../../lib/admin/client";
import { getActiveCategories } from "../../lib/products/client";
import type { Category, Product } from "../../lib/products/types";
import Button from "../ui/Button";
import Card from "../ui/Card";
import { Field, Input, Select, Textarea } from "../ui/form";

type Props = {
  initialProduct?: Product | null;
  onSubmit: (values: ProductFormValues) => Promise<void>;
  submitLabel: string;
};

const productTypes: { value: ProductFormValues["type"]; label: string }[] = [
  { value: "package", label: "Pacote" },
  { value: "hotel", label: "Hotel" },
  { value: "flight", label: "Voo" },
  { value: "stay", label: "Hospedagem" },
  { value: "experience", label: "Experiência" },
];

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
    category_ids: initialProduct?.category_ids ?? [],
  });
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);

  useEffect(() => {
    getActiveCategories()
      .then(setCategories)
      .catch(() => setCategories([]));
  }, []);

  const updateValue = <K extends keyof ProductFormValues>(
    key: K,
    value: ProductFormValues[K]
  ) => {
    setValues((current) => ({ ...current, [key]: value }));
  };

  const toggleCategory = (id: string) => {
    setValues((current) => ({
      ...current,
      category_ids: current.category_ids.includes(id)
        ? current.category_ids.filter((value) => value !== id)
        : [...current.category_ids, id],
    }));
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
          : "Não foi possível salvar o produto."
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Card className="p-6">
      <form className="grid gap-5" onSubmit={handleSubmit}>
        {error && (
          <p
            className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700"
            role="alert"
          >
            {error}
          </p>
        )}

        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Título">
            <Input
              onChange={(event) => updateValue("title", event.target.value)}
              required
              value={values.title}
            />
          </Field>
          <Field label="Slug">
            <Input
              onChange={(event) => updateValue("slug", event.target.value)}
              required
              value={values.slug}
            />
          </Field>
          <Field label="Tipo">
            <Select
              onChange={(event) =>
                updateValue(
                  "type",
                  event.target.value as ProductFormValues["type"]
                )
              }
              value={values.type}
            >
              {productTypes.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Destino">
            <Input
              onChange={(event) =>
                updateValue("destination", event.target.value)
              }
              required
              value={values.destination}
            />
          </Field>
          <Field
            hint="Cidade de onde o grupo parte. Aparece no filtro de busca do site."
            label="Origem (cidade de saída)"
          >
            <Input
              onChange={(event) => updateValue("origin", event.target.value)}
              placeholder="Ex.: Teresina"
              value={values.origin}
            />
          </Field>
          <Field label="Preço">
            <Input
              min={0}
              onChange={(event) =>
                updateValue("price", Number(event.target.value))
              }
              required
              type="number"
              value={values.price}
            />
          </Field>
          <Field label="Preço promocional">
            <Input
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
          </Field>
        </div>

        <Field label="Descrição">
          <Textarea
            className="min-h-[120px]"
            onChange={(event) => updateValue("description", event.target.value)}
            value={values.description}
          />
        </Field>
        <Field label="Imagem de capa (URL)">
          <Input
            onChange={(event) => updateValue("cover_image", event.target.value)}
            value={values.cover_image}
          />
        </Field>

        <Field
          hint="Usado para montar vitrines por categoria na página inicial."
          label="Categorias"
        >
          {categories.length === 0 ? (
            <p className="text-sm text-gray-500">
              Nenhuma categoria criada ainda — crie em Catálogo → Categorias.
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {categories.map((category) => {
                const checked = values.category_ids.includes(category.id);
                return (
                  <label
                    className={`flex cursor-pointer items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition ${
                      checked
                        ? "border-orange-500 bg-orange-50 text-orange-700"
                        : "border-gray-300 text-gray-600 hover:bg-gray-50"
                    }`}
                    key={category.id}
                  >
                    <input
                      checked={checked}
                      className="sr-only"
                      onChange={() => toggleCategory(category.id)}
                      type="checkbox"
                    />
                    {category.name}
                  </label>
                );
              })}
            </div>
          )}
        </Field>

        <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
          <input
            checked={values.active}
            onChange={(event) => updateValue("active", event.target.checked)}
            type="checkbox"
          />
          Produto ativo
        </label>

        <Button className="w-fit" loading={isSaving} type="submit">
          {isSaving ? "Salvando..." : submitLabel}
        </Button>
      </form>
    </Card>
  );
};

export default ProductForm;
