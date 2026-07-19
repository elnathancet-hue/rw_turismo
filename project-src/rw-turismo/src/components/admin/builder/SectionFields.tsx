import {
  ArrowDownIcon,
  ArrowUpIcon,
  TrashIcon,
} from "@heroicons/react/24/outline";
import type { HomeBanner, HomeSection } from "../../../lib/content/types";
import {
  PRODUCT_TYPE_LABELS,
  collectionUrl,
  normalizeCollectionContent,
  sectionTypeOf,
} from "../../../lib/content/home-registry";
import type {
  Category,
  Product,
  ProductType,
} from "../../../lib/products/types";
import Button from "../../ui/Button";
import { Field, Input, Select, Textarea } from "../../ui/form";
import ImageUpload from "../ImageUpload";

// ---------------------------------------------------------------------------
// Inspector fields for one home section. Adding a new section type? Extend
// the switch at the bottom (see home-registry.ts for the checklist).
// ---------------------------------------------------------------------------

type PatchFn = (patch: Partial<HomeSection>, coalesce?: boolean) => void;

type Props = {
  section: HomeSection;
  products: Product[];
  categories: Category[];
  onPatch: PatchFn;
};

const rowButton =
  "flex h-7 w-7 items-center justify-center rounded text-gray-500 transition hover:bg-gray-100 disabled:opacity-40";

// Generic list editor for content.items arrays (destinations, benefits,
// testimonials). Field rendering is delegated; move/remove/add is shared.
const ItemsEditor = <T extends Record<string, any>>({
  items,
  addLabel,
  newItem,
  onChange,
  renderFields,
  itemLabel,
}: {
  items: T[];
  addLabel: string;
  newItem: () => T;
  onChange: (items: T[]) => void;
  renderFields: (item: T, update: (patch: Partial<T>) => void) => JSX.Element;
  itemLabel: (item: T, index: number) => string;
}) => {
  const move = (index: number, dir: -1 | 1) => {
    const target = index + dir;
    if (target < 0 || target >= items.length) return;
    const next = [...items];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  };

  return (
    <div className="space-y-3">
      {items.map((item, index) => (
        <details
          className="rounded-lg border"
          // Stable key so the native <details open> state (and any local UI
          // state) stays attached to the right item when one is removed from
          // the middle of the list — index alone would shift it onto a
          // neighboring item. Legacy items saved before this field existed
          // fall back to the index (best effort, matches prior behavior).
          key={item._key ?? index}
          open={!item.title && !item.name}
        >
          <summary className="flex cursor-pointer items-center gap-2 p-2.5">
            <span className="min-w-0 flex-1 truncate text-sm font-medium text-gray-700">
              {itemLabel(item, index)}
            </span>
            <span
              className="flex items-center gap-0.5"
              onClick={(event) => event.preventDefault()}
            >
              <button
                className={rowButton}
                disabled={index === 0}
                onClick={() => move(index, -1)}
                title="Subir"
                type="button"
              >
                <ArrowUpIcon className="h-3.5 w-3.5" />
              </button>
              <button
                className={rowButton}
                disabled={index === items.length - 1}
                onClick={() => move(index, 1)}
                title="Descer"
                type="button"
              >
                <ArrowDownIcon className="h-3.5 w-3.5" />
              </button>
              <button
                className={`${rowButton} text-red-500 hover:bg-red-50`}
                onClick={() => onChange(items.filter((_, i) => i !== index))}
                title="Remover"
                type="button"
              >
                <TrashIcon className="h-3.5 w-3.5" />
              </button>
            </span>
          </summary>
          <div className="space-y-3 border-t p-3">
            {renderFields(item, (patch) =>
              onChange(items.map((it, i) => (i === index ? { ...it, ...patch } : it)))
            )}
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                checked={item.active !== false}
                className="h-4 w-4 rounded border-gray-300 text-orange-500 focus:ring-orange-400"
                onChange={(event) => {
                  onChange(
                    items.map((it, i) =>
                      i === index ? { ...it, active: event.target.checked } : it
                    )
                  );
                }}
                type="checkbox"
              />
              Visível no site
            </label>
          </div>
        </details>
      ))}
      <Button
        onClick={() =>
          onChange([
            ...items,
            { ...newItem(), _key: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}` },
          ])
        }
        size="sm"
        variant="secondary"
      >
        {addLabel}
      </Button>
    </div>
  );
};

const itemsOf = (section: HomeSection): any[] =>
  Array.isArray(section.content?.items) ? section.content.items : [];

const SectionFields = ({
  section,
  products,
  categories,
  onPatch,
}: Props) => {
  const patchContent = (patch: Record<string, any>, coalesce = false) =>
    onPatch({ content: { ...section.content, ...patch } }, coalesce);

  const type = sectionTypeOf(section.section_key);

  const commonFields = (
    <div className="space-y-3">
      <Field label="Título">
        <Input
          onChange={(event) => onPatch({ title: event.target.value }, true)}
          value={section.title ?? ""}
        />
      </Field>
      <Field label="Subtítulo">
        <Input
          onChange={(event) => onPatch({ subtitle: event.target.value }, true)}
          value={section.subtitle ?? ""}
        />
      </Field>
    </div>
  );

  const typeFields = () => {
    switch (type) {
      case "product_collection": {
        const content = normalizeCollectionContent(section.content);
        // Dropdown values come from what the admin actually cadastrou nos
        // produtos, so the filter can only point at destinos/origens que existem.
        const destinations = Array.from(
          new Set(products.map((p) => p.destination).filter(Boolean))
        ).sort((a, b) => a.localeCompare(b, "pt-BR"));
        const origins = Array.from(
          new Set(
            products
              .map((p) => p.origin)
              .filter((v): v is string => Boolean(v && v.trim()))
          )
        ).sort((a, b) => a.localeCompare(b, "pt-BR"));

        // Switching mode pré-seleciona o 1º valor disponível, so the section
        // never fica vazia por falta de escolha.
        const changeMode = (mode: string) => {
          const patch: Record<string, any> = { mode };
          if (mode === "destination" && !content.destination && destinations[0]) {
            patch.destination = destinations[0];
          }
          if (mode === "origin" && !content.origin && origins[0]) {
            patch.origin = origins[0];
          }
          if (mode === "category" && !content.category_id && categories[0]) {
            patch.category_id = categories[0].id;
          }
          patchContent(patch);
        };

        return (
          <div className="space-y-3">
            <Field
              hint="A vitrine se preenche sozinha com as viagens que batem com esta regra."
              label="Quais viagens mostrar"
            >
              <Select
                onChange={(event) => changeMode(event.target.value)}
                value={content.mode}
              >
                <option value="promo">Somente viagens em promoção</option>
                <option value="type">Filtrar por tipo de viagem</option>
                <option value="destination">Filtrar por destino</option>
                <option value="origin">Filtrar por cidade de saída</option>
                <option value="category">Filtrar por categoria</option>
                <option value="all">Todas as viagens ativas</option>
              </Select>
            </Field>
            {content.mode === "type" && (
              <Field
                hint="Mostra só as viagens deste tipo."
                label="Tipo de viagem"
              >
                <Select
                  onChange={(event) =>
                    patchContent({ product_type: event.target.value })
                  }
                  value={content.product_type}
                >
                  {(
                    Object.entries(PRODUCT_TYPE_LABELS) as [ProductType, string][]
                  ).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </Select>
              </Field>
            )}
            {content.mode === "destination" && (
              <Field
                hint="Mostra só as viagens para este destino."
                label="Destino"
              >
                <Select
                  onChange={(event) =>
                    patchContent({ destination: event.target.value })
                  }
                  value={content.destination}
                >
                  {destinations.length === 0 && (
                    <option value="">Cadastre destinos nos produtos</option>
                  )}
                  {content.destination &&
                    !destinations.includes(content.destination) && (
                      <option value={content.destination}>
                        {content.destination}
                      </option>
                    )}
                  {destinations.map((value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
                </Select>
              </Field>
            )}
            {content.mode === "origin" && (
              <Field
                hint="Mostra só as viagens que saem desta cidade."
                label="Cidade de saída"
              >
                <Select
                  onChange={(event) =>
                    patchContent({ origin: event.target.value })
                  }
                  value={content.origin}
                >
                  {origins.length === 0 && (
                    <option value="">
                      Preencha “Origem” no cadastro dos produtos
                    </option>
                  )}
                  {content.origin && !origins.includes(content.origin) && (
                    <option value={content.origin}>{content.origin}</option>
                  )}
                  {origins.map((value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
                </Select>
              </Field>
            )}
            {content.mode === "category" && (
              <Field
                hint="Mostra as viagens marcadas com esta categoria (marque em Catálogo → Categorias ou no cadastro da viagem)."
                label="Categoria"
              >
                <Select
                  onChange={(event) =>
                    patchContent({ category_id: event.target.value })
                  }
                  value={content.category_id}
                >
                  {categories.length === 0 && (
                    <option value="">
                      Crie categorias em Catálogo → Categorias
                    </option>
                  )}
                  {[...categories]
                    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"))
                    .map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                </Select>
              </Field>
            )}
            <Field
              hint="Quantos cards aparecem na home (1 a 12). O resto abre no botão abaixo."
              label="Quantas viagens exibir"
            >
              <Input
                max={12}
                min={1}
                onChange={(event) =>
                  patchContent({ limit: Number(event.target.value) })
                }
                type="number"
                value={content.limit}
              />
            </Field>
            <Field
              hint={`O botão leva para ${collectionUrl(section.content)} com todas as viagens do filtro.`}
              label="Texto do botão ver mais"
            >
              <Input
                onChange={(event) =>
                  patchContent({ cta_label: event.target.value }, true)
                }
                value={content.cta_label}
              />
            </Field>
          </div>
        );
      }

      case "featured_products": {
        const ids: string[] = Array.isArray(section.content?.product_ids)
          ? section.content.product_ids
          : [];
        return (
          <div className="space-y-3">
            <Field label="Quantidade na home">
              <Input
                max={12}
                min={1}
                onChange={(event) =>
                  patchContent({ limit: Number(event.target.value) })
                }
                type="number"
                value={Number(section.content?.limit ?? 6)}
              />
            </Field>
            <Field
              hint="Sem seleção, os produtos mais recentes entram automaticamente."
              label="Produtos escolhidos"
            >
              <div className="mt-1 max-h-64 space-y-1 overflow-y-auto rounded-lg border p-2">
                {products.map((product) => (
                  <label
                    className="flex items-center gap-2 rounded p-1.5 text-sm hover:bg-gray-50"
                    key={product.id}
                  >
                    <input
                      checked={ids.includes(product.id)}
                      className="h-4 w-4 rounded border-gray-300 text-orange-500 focus:ring-orange-400"
                      onChange={(event) =>
                        patchContent({
                          product_ids: event.target.checked
                            ? [...ids, product.id]
                            : ids.filter((id) => id !== product.id),
                        })
                      }
                      type="checkbox"
                    />
                    <span className="min-w-0 flex-1 truncate">{product.title}</span>
                  </label>
                ))}
                {products.length === 0 && (
                  <p className="p-2 text-xs text-gray-500">
                    Nenhum produto ativo ainda.
                  </p>
                )}
              </div>
            </Field>
          </div>
        );
      }

      case "destinations":
        return (
          <ItemsEditor
            addLabel="+ Adicionar destino"
            itemLabel={(item, index) => item.title || `Destino ${index + 1}`}
            items={itemsOf(section)}
            newItem={() => ({ title: "", subtitle: "", image: "", url: "", active: true })}
            onChange={(items) => patchContent({ items })}
            renderFields={(item, update) => (
              <>
                <ImageUpload
                  bucket="site-assets"
                  onChange={(url) => update({ image: url })}
                  value={item.image}
                />
                <Field label="Destino">
                  <Input
                    onChange={(event) => update({ title: event.target.value })}
                    value={item.title ?? ""}
                  />
                </Field>
                <Field label="Localização">
                  <Input
                    onChange={(event) => update({ subtitle: event.target.value })}
                    value={item.subtitle ?? ""}
                  />
                </Field>
                <Field hint="/search?destino=... ou /products/slug" label="Link do card">
                  <Input
                    onChange={(event) => update({ url: event.target.value })}
                    value={item.url ?? ""}
                  />
                </Field>
              </>
            )}
          />
        );

      case "benefits":
        return (
          <ItemsEditor
            addLabel="+ Adicionar benefício"
            itemLabel={(item, index) => item.title || `Benefício ${index + 1}`}
            items={itemsOf(section)}
            newItem={() => ({ title: "", description: "", icon: "", active: true })}
            onChange={(items) => patchContent({ items })}
            renderFields={(item, update) => (
              <>
                <Field hint="Um emoji funciona bem (ex.: 🧳)." label="Ícone">
                  <Input
                    onChange={(event) => update({ icon: event.target.value })}
                    value={item.icon ?? ""}
                  />
                </Field>
                <Field label="Título">
                  <Input
                    onChange={(event) => update({ title: event.target.value })}
                    value={item.title ?? ""}
                  />
                </Field>
                <Field label="Descrição">
                  <Textarea
                    className="min-h-[70px]"
                    onChange={(event) => update({ description: event.target.value })}
                    value={item.description ?? item.text ?? ""}
                  />
                </Field>
              </>
            )}
          />
        );

      case "testimonials":
        return (
          <ItemsEditor
            addLabel="+ Adicionar depoimento"
            itemLabel={(item, index) => item.name || `Depoimento ${index + 1}`}
            items={itemsOf(section)}
            newItem={() => ({ name: "", city: "", text: "", photo: "", active: true })}
            onChange={(items) => patchContent({ items })}
            renderFields={(item, update) => (
              <>
                <Field label="Nome">
                  <Input
                    onChange={(event) => update({ name: event.target.value })}
                    value={item.name ?? ""}
                  />
                </Field>
                <Field label="Cidade">
                  <Input
                    onChange={(event) => update({ city: event.target.value })}
                    value={item.city ?? ""}
                  />
                </Field>
                <Field label="Depoimento">
                  <Textarea
                    className="min-h-[90px]"
                    onChange={(event) => update({ text: event.target.value })}
                    value={item.text ?? ""}
                  />
                </Field>
                <ImageUpload
                  bucket="site-assets"
                  onChange={(url) => update({ photo: url })}
                  value={item.photo}
                />
              </>
            )}
          />
        );

      case "promotional_banner":
        return (
          <div className="space-y-3">
            <Field label="Texto">
              <Textarea
                className="min-h-[90px]"
                onChange={(event) => patchContent({ text: event.target.value }, true)}
                value={section.content?.text ?? ""}
              />
            </Field>
            <Field label="Texto do botão">
              <Input
                onChange={(event) =>
                  patchContent({ button_text: event.target.value }, true)
                }
                value={section.content?.button_text ?? ""}
              />
            </Field>
            <Field label="Link do botão">
              <Input
                onChange={(event) =>
                  patchContent({ button_url: event.target.value }, true)
                }
                placeholder="/search?promo=1 ou /paginas/contato"
                value={section.content?.button_url ?? ""}
              />
            </Field>
          </div>
        );

      default:
        return (
          <p className="rounded-lg border border-dashed p-3 text-xs text-gray-500">
            Esta seção não tem campos extras.
          </p>
        );
    }
  };

  return (
    <div className="space-y-4">
      {commonFields}
      {typeFields()}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Hero banners (home_banners table) — managed as a list in the inspector.
// ---------------------------------------------------------------------------

export const HeroBannerFields = ({
  banners,
  onChange,
}: {
  banners: HomeBanner[];
  onChange: (banners: HomeBanner[], coalesce?: string) => void;
}) => {
  // coalesce=true groups keystrokes/slider drags into one undo entry.
  const update = (
    index: number,
    patch: Partial<HomeBanner>,
    coalesce = false
  ) =>
    onChange(
      banners.map((banner, i) => (i === index ? { ...banner, ...patch } : banner)),
      coalesce ? `banner:${banners[index]?.id}` : undefined
    );
  const move = (index: number, dir: -1 | 1) => {
    const target = index + dir;
    if (target < 0 || target >= banners.length) return;
    const next = [...banners];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  };

  return (
    <div className="space-y-3">
      <p className="text-xs text-gray-500">
        O primeiro banner ativo aparece no topo do site. Use a ordem para
        escolher qual entra no ar.
      </p>
      {banners.map((banner, index) => (
        <details className="rounded-lg border" key={banner.id} open={!banner.image_url}>
          <summary className="flex cursor-pointer items-center gap-2 p-2.5">
            <span
              className={`h-2 w-2 shrink-0 rounded-full ${
                banner.active ? "bg-green-500" : "bg-gray-300"
              }`}
              title={banner.active ? "Ativo" : "Inativo"}
            />
            <span className="min-w-0 flex-1 truncate text-sm font-medium text-gray-700">
              {banner.title || `Banner ${index + 1}`}
            </span>
            <span
              className="flex items-center gap-0.5"
              onClick={(event) => event.preventDefault()}
            >
              <button
                className={rowButton}
                disabled={index === 0}
                onClick={() => move(index, -1)}
                title="Subir"
                type="button"
              >
                <ArrowUpIcon className="h-3.5 w-3.5" />
              </button>
              <button
                className={rowButton}
                disabled={index === banners.length - 1}
                onClick={() => move(index, 1)}
                title="Descer"
                type="button"
              >
                <ArrowDownIcon className="h-3.5 w-3.5" />
              </button>
              <button
                className={`${rowButton} text-red-500 hover:bg-red-50`}
                onClick={() => onChange(banners.filter((_, i) => i !== index))}
                title="Remover banner"
                type="button"
              >
                <TrashIcon className="h-3.5 w-3.5" />
              </button>
            </span>
          </summary>
          <div className="space-y-3 border-t p-3">
            <Field label="Imagem de fundo">
              <ImageUpload
                bucket="site-assets"
                onChange={(url) => update(index, { image_url: url })}
                value={banner.image_url}
              />
            </Field>
            <Field label="Título">
              <Input
                onChange={(event) =>
                  update(index, { title: event.target.value }, true)
                }
                value={banner.title ?? ""}
              />
            </Field>
            <Field label="Subtítulo">
              <Input
                onChange={(event) =>
                  update(index, { subtitle: event.target.value }, true)
                }
                value={banner.subtitle ?? ""}
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Texto do botão">
                <Input
                  onChange={(event) =>
                    update(index, { button_text: event.target.value }, true)
                  }
                  value={banner.button_text ?? ""}
                />
              </Field>
              <Field label="Link do botão">
                <Input
                  onChange={(event) =>
                    update(index, { button_url: event.target.value }, true)
                  }
                  placeholder="/search?promo=1"
                  value={banner.button_url ?? ""}
                />
              </Field>
            </div>
            <Field
              hint="Escurece a foto para o texto ficar legível."
              label={`Sombra sobre a foto: ${Math.round(
                Number(banner.overlay_strength ?? 0.35) * 100
              )}%`}
            >
              <input
                className="mt-2 w-full accent-orange-500"
                max={0.9}
                min={0}
                onChange={(event) =>
                  update(
                    index,
                    { overlay_strength: Number(event.target.value) },
                    true
                  )
                }
                step={0.05}
                type="range"
                value={Number(banner.overlay_strength ?? 0.35)}
              />
            </Field>
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                checked={banner.active}
                className="h-4 w-4 rounded border-gray-300 text-orange-500 focus:ring-orange-400"
                onChange={(event) => update(index, { active: event.target.checked })}
                type="checkbox"
              />
              Ativo
            </label>
          </div>
        </details>
      ))}
      <Button
        onClick={() =>
          onChange([
            ...banners,
            {
              id: `new_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
              title: "",
              subtitle: "",
              image_url: "",
              mobile_image_url: null,
              button_text: "",
              button_url: "",
              overlay_strength: 0.35,
              active: banners.length === 0,
              display_order: banners.length,
              starts_at: null,
              ends_at: null,
              created_at: "",
              updated_at: "",
            },
          ])
        }
        size="sm"
        variant="secondary"
      >
        + Adicionar banner
      </Button>
    </div>
  );
};

export default SectionFields;
