import { useEffect, useState } from "react";
import type { ProductFormValues } from "../../lib/admin/client";
import { getActiveCategories } from "../../lib/products/client";
import type {
  Category,
  FaqItem,
  ItineraryDay,
  Product,
  ProductTier,
} from "../../lib/products/types";
import Button from "../ui/Button";
import Card from "../ui/Card";
import { Field, Input, Select, Textarea } from "../ui/form";
import { slugFieldProps, useSlugStatus } from "../../hooks/useSlugStatus";
import { isUniqueViolation } from "../../lib/admin/slugs";

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
    itinerary: Array.isArray(initialProduct?.itinerary)
      ? (initialProduct?.itinerary as ItineraryDay[])
      : [],
    faq: Array.isArray(initialProduct?.faq)
      ? (initialProduct?.faq as FaqItem[])
      : [],
    tiers: Array.isArray(initialProduct?.tiers) ? initialProduct.tiers : [],
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

  const slugStatus = useSlugStatus("products", values.slug, initialProduct?.id);

  const toggleCategory = (id: string) => {
    setValues((current) => ({
      ...current,
      category_ids: current.category_ids.includes(id)
        ? current.category_ids.filter((value) => value !== id)
        : [...current.category_ids, id],
    }));
  };

  // --- Galeria de fotos ---
  const addGalleryImage = () =>
    setValues((c) => ({ ...c, gallery: [...c.gallery, ""] }));
  const updateGalleryImage = (index: number, url: string) =>
    setValues((c) => ({
      ...c,
      gallery: c.gallery.map((item, i) => (i === index ? url : item)),
    }));
  const removeGalleryImage = (index: number) =>
    setValues((c) => ({
      ...c,
      gallery: c.gallery.filter((_, i) => i !== index),
    }));

  // --- Itinerário dia a dia ---
  const addItineraryDay = () =>
    setValues((c) => ({
      ...c,
      itinerary: [
        ...c.itinerary,
        { day: c.itinerary.length + 1, title: "", description: "" },
      ],
    }));
  const updateItineraryDay = (index: number, patch: Partial<ItineraryDay>) =>
    setValues((c) => ({
      ...c,
      itinerary: c.itinerary.map((item, i) =>
        i === index ? { ...item, ...patch } : item
      ),
    }));
  const removeItineraryDay = (index: number) =>
    setValues((c) => ({
      ...c,
      itinerary: c.itinerary.filter((_, i) => i !== index),
    }));
  const moveItineraryDay = (index: number, dir: -1 | 1) =>
    setValues((c) => {
      const next = [...c.itinerary];
      const target = index + dir;
      if (target < 0 || target >= next.length) return c;
      [next[index], next[target]] = [next[target], next[index]];
      return { ...c, itinerary: next };
    });

  // --- FAQ ---
  const addFaqItem = () =>
    setValues((c) => ({ ...c, faq: [...c.faq, { question: "", answer: "" }] }));
  const updateFaqItem = (index: number, patch: Partial<FaqItem>) =>
    setValues((c) => ({
      ...c,
      faq: c.faq.map((item, i) => (i === index ? { ...item, ...patch } : item)),
    }));
  const removeFaqItem = (index: number) =>
    setValues((c) => ({ ...c, faq: c.faq.filter((_, i) => i !== index) }));

  // --- Opções de suíte (tiers, informativo) ---
  const addTier = () =>
    setValues((c) => ({ ...c, tiers: [...c.tiers, { name: "", price: 0 }] }));
  const updateTier = (index: number, patch: Partial<ProductTier>) =>
    setValues((c) => ({
      ...c,
      tiers: c.tiers.map((t, i) => (i === index ? { ...t, ...patch } : t)),
    }));
  const removeTier = (index: number) =>
    setValues((c) => ({ ...c, tiers: c.tiers.filter((_, i) => i !== index) }));

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setIsSaving(true);

    try {
      const normalized: ProductFormValues = {
        ...values,
        gallery: values.gallery.map((url) => url.trim()).filter(Boolean),
        itinerary: values.itinerary
          .filter((day) => day.title.trim() || day.description.trim())
          .map((day, index) => ({
            day: index + 1,
            title: day.title.trim(),
            description: day.description.trim(),
          })),
        faq: values.faq.filter(
          (item) => item.question.trim() || item.answer.trim()
        ),
        tiers: values.tiers
          .map((tier) => ({ name: tier.name.trim(), price: Number(tier.price) || 0 }))
          .filter((tier) => tier.name),
      };
      await onSubmit(normalized);
    } catch (submitError) {
      setError(
        isUniqueViolation(submitError)
          ? "Este slug já está em uso. Escolha outro."
          : submitError instanceof Error
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
          <Field label="Slug" {...slugFieldProps(slugStatus)}>
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
          hint="Fotos extras exibidas no carrossel do produto (a capa entra automaticamente)."
          label="Galeria de fotos (URLs)"
        >
          <div className="space-y-2">
            {values.gallery.map((url, index) => (
              <div className="flex gap-2" key={index}>
                <Input
                  onChange={(event) =>
                    updateGalleryImage(index, event.target.value)
                  }
                  placeholder="https://…"
                  value={url}
                />
                <button
                  aria-label="Remover foto"
                  className="rounded border px-3 text-red-600 hover:bg-red-50"
                  onClick={() => removeGalleryImage(index)}
                  type="button"
                >
                  ✕
                </button>
              </div>
            ))}
            <Button
              onClick={addGalleryImage}
              size="sm"
              type="button"
              variant="secondary"
            >
              + Adicionar foto
            </Button>
          </div>
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

        <Field
          hint="Monte o roteiro dia a dia. Aparece como linha do tempo na página do produto."
          label="Itinerário (dia a dia)"
        >
          <div className="space-y-3">
            {values.itinerary.map((day, index) => (
              <div className="rounded border p-3" key={index}>
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-sm font-semibold text-gray-600">
                    Dia {index + 1}
                  </span>
                  <div className="flex gap-1">
                    <button
                      aria-label="Mover para cima"
                      className="rounded border px-2 text-gray-600 disabled:opacity-40"
                      disabled={index === 0}
                      onClick={() => moveItineraryDay(index, -1)}
                      type="button"
                    >
                      ↑
                    </button>
                    <button
                      aria-label="Mover para baixo"
                      className="rounded border px-2 text-gray-600 disabled:opacity-40"
                      disabled={index === values.itinerary.length - 1}
                      onClick={() => moveItineraryDay(index, 1)}
                      type="button"
                    >
                      ↓
                    </button>
                    <button
                      aria-label="Remover dia"
                      className="rounded border px-2 text-red-600 hover:bg-red-50"
                      onClick={() => removeItineraryDay(index)}
                      type="button"
                    >
                      ✕
                    </button>
                  </div>
                </div>
                <Input
                  onChange={(event) =>
                    updateItineraryDay(index, { title: event.target.value })
                  }
                  placeholder="Título do dia (ex.: Chegada e city tour)"
                  value={day.title}
                />
                <Textarea
                  className="mt-2"
                  onChange={(event) =>
                    updateItineraryDay(index, {
                      description: event.target.value,
                    })
                  }
                  placeholder="O que acontece neste dia"
                  value={day.description}
                />
              </div>
            ))}
            <Button
              onClick={addItineraryDay}
              size="sm"
              type="button"
              variant="secondary"
            >
              + Adicionar dia
            </Button>
          </div>
        </Field>

        <Field
          hint="Perguntas frequentes exibidas no produto (também viram rich snippet no Google)."
          label="Perguntas frequentes (FAQ)"
        >
          <div className="space-y-3">
            {values.faq.map((item, index) => (
              <div className="rounded border p-3" key={index}>
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-sm font-semibold text-gray-600">
                    Pergunta {index + 1}
                  </span>
                  <button
                    aria-label="Remover pergunta"
                    className="rounded border px-2 text-red-600 hover:bg-red-50"
                    onClick={() => removeFaqItem(index)}
                    type="button"
                  >
                    ✕
                  </button>
                </div>
                <Input
                  onChange={(event) =>
                    updateFaqItem(index, { question: event.target.value })
                  }
                  placeholder="Pergunta"
                  value={item.question}
                />
                <Textarea
                  className="mt-2"
                  onChange={(event) =>
                    updateFaqItem(index, { answer: event.target.value })
                  }
                  placeholder="Resposta"
                  value={item.answer}
                />
              </div>
            ))}
            <Button
              onClick={addFaqItem}
              size="sm"
              type="button"
              variant="secondary"
            >
              + Adicionar pergunta
            </Button>
          </div>
        </Field>

        <Field
          hint="Opções de suíte/quarto com preços. Informativo: aparece na página do pacote, não altera a reserva."
          label="Opções de suíte (tiers)"
        >
          <div className="space-y-2">
            {values.tiers.map((tier, index) => (
              <div className="flex gap-2" key={index}>
                <Input
                  onChange={(event) =>
                    updateTier(index, { name: event.target.value })
                  }
                  placeholder="Nome (ex.: Master)"
                  value={tier.name}
                />
                <Input
                  className="w-36"
                  min={0}
                  onChange={(event) =>
                    updateTier(index, {
                      price: event.target.value ? Number(event.target.value) : 0,
                    })
                  }
                  placeholder="Preço"
                  type="number"
                  value={tier.price || ""}
                />
                <button
                  aria-label="Remover opção"
                  className="rounded border px-3 text-red-600 hover:bg-red-50"
                  onClick={() => removeTier(index)}
                  type="button"
                >
                  ✕
                </button>
              </div>
            ))}
            <Button
              onClick={addTier}
              size="sm"
              type="button"
              variant="secondary"
            >
              + Adicionar opção
            </Button>
          </div>
        </Field>

        <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
          <input
            checked={values.active}
            onChange={(event) => updateValue("active", event.target.checked)}
            type="checkbox"
          />
          Produto ativo
        </label>

        <Button
          className="w-fit"
          disabled={slugStatus === "taken"}
          loading={isSaving}
          type="submit"
        >
          {isSaving ? "Salvando..." : submitLabel}
        </Button>
      </form>
    </Card>
  );
};

export default ProductForm;
