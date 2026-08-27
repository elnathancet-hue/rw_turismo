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
import ImageDropzone from "./ImageDropzone";
import {
  normalizeAccommodations,
  type Accommodation,
} from "../../lib/products/accommodation";
import {
  normalizeFareRules,
  toFareRulesJson,
} from "../../lib/products/fareRules";
import ImageField from "./ImageField";
import SaveMessage from "./SaveMessage";
import { slugFieldProps, useSlugStatus } from "../../hooks/useSlugStatus";
import { useSaveMessage } from "../../hooks/useSaveMessage";
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
    accommodations: normalizeAccommodations(initialProduct?.accommodations),
    fare_rules: toFareRulesJson(normalizeFareRules(initialProduct?.fare_rules)),
    active: initialProduct?.active ?? true,
    category_ids: initialProduct?.category_ids ?? [],
  });
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const { message, showOk, clearMessage } = useSaveMessage();
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
  // Uploads em lote entram no fim da galeria, na ordem em que foram enviados.
  const addGalleryImages = (urls: string[]) =>
    setValues((c) => ({ ...c, gallery: [...c.gallery, ...urls] }));
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


  // --- Acomodações (vendáveis: entram no preço e na reserva) ---
  const slugifyCode = (value: string) =>
    value
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");

  const addAccommodation = () =>
    setValues((c) => ({
      ...c,
      accommodations: [
        ...c.accommodations,
        { code: "", name: "", capacity: 2, price: 0, shared: false, active: true },
      ],
    }));
  const updateAccommodation = (index: number, patch: Partial<Accommodation>) =>
    setValues((c) => ({
      ...c,
      accommodations: c.accommodations.map((item, i) =>
        i === index ? { ...item, ...patch } : item
      ),
    }));
  const removeAccommodation = (index: number) =>
    setValues((c) => ({
      ...c,
      accommodations: c.accommodations.filter((_, i) => i !== index),
    }));

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    clearMessage();
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
        // Codigo vazio vira o nome em formato de slug. Depois de salvo NAO deve
        // mudar: e ele que fica gravado nas reservas ja vendidas.
        accommodations: values.accommodations
          .map((item) => ({
            ...item,
            name: item.name.trim(),
            code: (item.code || slugifyCode(item.name)).trim(),
            capacity: Number(item.capacity) || 0,
            price: Number(item.price) || 0,
          }))
          .filter((item) => item.name && item.capacity > 0 && item.price > 0),
        // Passa pelo normalizador para nao gravar percentual fora de 0-100 nem
        // faixa de crianca menor que a de bebe (deixaria idades sem regra).
        fare_rules: toFareRulesJson(normalizeFareRules(values.fare_rules)),
      };
      await onSubmit(normalized);
      // Na criação o onSubmit redireciona; na edição a pessoa fica na mesma
      // tela, e sem isto não havia como saber que gravou.
      showOk("Produto salvo.");
    } catch (submitError) {
      setError(
        isUniqueViolation(submitError)
          ? "Este endereço já está em uso. Escolha outro."
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
          <Field
          hint="Como a viagem aparece no link do site: /products/nome-da-viagem"
          label="Endereço no site"
          {...slugFieldProps(slugStatus)}
        >
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
        <Field
          hint="Cole um link ou envie a foto do computador."
          label="Imagem de capa"
        >
          <div className="mt-1">
            <ImageField
              bucket="product-images"
              onChange={(url) => updateValue("cover_image", url)}
              value={values.cover_image}
            />
          </div>
        </Field>

        <Field
          hint="Fotos extras exibidas no carrossel do produto (a capa entra automaticamente)."
          label="Galeria de fotos"
        >
          <div className="mt-1 space-y-3">
            <ImageDropzone
              bucket="product-images"
              onUploaded={addGalleryImages}
            />

            {values.gallery.map((url, index) => (
              <ImageField
                bucket="product-images"
                key={index}
                onChange={(next) => updateGalleryImage(index, next)}
                onRemove={() => removeGalleryImage(index)}
                value={url}
              />
            ))}

            <Button
              onClick={addGalleryImage}
              size="sm"
              type="button"
              variant="secondary"
            >
              + Adicionar por link
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
          hint="A idade é calculada na DATA DA SAÍDA, a partir do nascimento que o cliente informa. Deixe 100% para cobrar cheio."
          label="Tarifa por faixa etária"
        >
          <div className="grid gap-3 md:grid-cols-4">
            <Field label="Bebê até (anos)">
              <Input
                min={0}
                onChange={(event) =>
                  updateValue("fare_rules", {
                    ...values.fare_rules,
                    infant_max_age: Number(event.target.value),
                  })
                }
                type="number"
                value={values.fare_rules.infant_max_age ?? 1}
              />
            </Field>
            <Field label="Bebê paga (%)">
              <Input
                max={100}
                min={0}
                onChange={(event) =>
                  updateValue("fare_rules", {
                    ...values.fare_rules,
                    infant_percent: Number(event.target.value),
                  })
                }
                type="number"
                value={values.fare_rules.infant_percent ?? 100}
              />
            </Field>
            <Field label="Criança até (anos)">
              <Input
                min={0}
                onChange={(event) =>
                  updateValue("fare_rules", {
                    ...values.fare_rules,
                    child_max_age: Number(event.target.value),
                  })
                }
                type="number"
                value={values.fare_rules.child_max_age ?? 11}
              />
            </Field>
            <Field label="Criança paga (%)">
              <Input
                max={100}
                min={0}
                onChange={(event) =>
                  updateValue("fare_rules", {
                    ...values.fare_rules,
                    child_percent: Number(event.target.value),
                  })
                }
                type="number"
                value={values.fare_rules.child_percent ?? 100}
              />
            </Field>
          </div>
          <div className="mt-3 max-w-xs">
            <Field
              hint="Deixe vazio para nunca exigir. Com um valor, o pagamento fica bloqueado até o documento ser enviado."
              label="Documento obrigatório até (anos)"
            >
              <Input
                min={0}
                onChange={(event) =>
                  updateValue("fare_rules", {
                    ...values.fare_rules,
                    document_required_max_age:
                      event.target.value === ""
                        ? null
                        : Number(event.target.value),
                  })
                }
                placeholder="ex.: 17"
                type="number"
                value={values.fare_rules.document_required_max_age ?? ""}
              />
            </Field>
          </div>
        </Field>

        <Field
          hint="O cliente escolhe uma delas no checkout e o preço muda de verdade. Só aparecem as que dividem o grupo exatamente: um duplo não é oferecido para 3 pessoas."
          label="Acomodações (vendáveis)"
        >
          <div className="space-y-3">
            {values.accommodations.map((item, index) => (
              <div className="rounded border p-3" key={index}>
                <div className="grid gap-2 md:grid-cols-[1fr_7rem_9rem]">
                  <Field label="Nome">
                    <Input
                      onChange={(event) =>
                        updateAccommodation(index, { name: event.target.value })
                      }
                      placeholder="Duplo"
                      value={item.name}
                    />
                  </Field>
                  <Field label="Pessoas no quarto">
                    <Input
                      min={1}
                      onChange={(event) =>
                        updateAccommodation(index, {
                          capacity: Number(event.target.value),
                        })
                      }
                      type="number"
                      value={item.capacity || ""}
                    />
                  </Field>
                  <Field label="Preço por pessoa">
                    <Input
                      min={0}
                      onChange={(event) =>
                        updateAccommodation(index, {
                          price: Number(event.target.value),
                        })
                      }
                      step="0.01"
                      type="number"
                      value={item.price || ""}
                    />
                  </Field>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-4">
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      checked={Boolean(item.shared)}
                      onChange={(event) =>
                        updateAccommodation(index, {
                          shared: event.target.checked,
                        })
                      }
                      type="checkbox"
                    />
                    Vaga compartilhada (a RW pareia depois)
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      checked={item.active !== false}
                      onChange={(event) =>
                        updateAccommodation(index, {
                          active: event.target.checked,
                        })
                      }
                      type="checkbox"
                    />
                    Disponível
                  </label>
                  <button
                    className="ml-auto text-sm font-semibold text-red-600 hover:text-red-700"
                    onClick={() => removeAccommodation(index)}
                    type="button"
                  >
                    Remover
                  </button>
                </div>
              </div>
            ))}
            <Button
              onClick={addAccommodation}
              size="sm"
              type="button"
              variant="secondary"
            >
              + Adicionar acomodação
            </Button>
            {values.accommodations.length > 0 && (
              <p className="text-xs text-gray-500">
                Com acomodação cadastrada, o cliente é obrigado a escolher uma
                para reservar — e o preço passa a sair daqui, não do campo
                &ldquo;Preço&rdquo; acima.
              </p>
            )}
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

        {/* A confirmação fica junto do botão, não no topo: o formulário é
            longo e quem clica em Salvar está no fim da página. */}
        <SaveMessage message={message} />

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
