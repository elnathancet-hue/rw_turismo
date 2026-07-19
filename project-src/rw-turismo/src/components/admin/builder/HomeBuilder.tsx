import {
  AdjustmentsHorizontalIcon,
  ArrowDownIcon,
  ArrowTopRightOnSquareIcon,
  ArrowUpIcon,
  ArrowUturnLeftIcon,
  ArrowUturnRightIcon,
  ChevronLeftIcon,
  ComputerDesktopIcon,
  DevicePhoneMobileIcon,
  EyeIcon,
  EyeSlashIcon,
  InformationCircleIcon,
  ListBulletIcon,
  PencilSquareIcon,
  PhotoIcon,
  PlusIcon,
  TrashIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  deleteAdminBanner,
  deleteAdminHomeSection,
  listAdminBanners,
  listAdminHomeSections,
  saveAdminBanner,
  saveAdminHomeSection,
} from "../../../lib/content/client";
import {
  filterCollectionProducts,
  newSectionKey,
  sectionMetaOf,
  sectionTypeOf,
  type SectionTypeMeta,
} from "../../../lib/content/home-registry";
import type { HomeBanner, HomeSection } from "../../../lib/content/types";
import {
  getActiveCategories,
  getActiveProducts,
} from "../../../lib/products/client";
import type { Category, Product } from "../../../lib/products/types";
import HeroBanner from "../../home/HeroBanner";
import HomeSectionRenderer from "../../home/HomeSectionRenderer";
import Button from "../../ui/Button";
import SectionFields, { HeroBannerFields } from "./SectionFields";
import SectionPicker from "./SectionPicker";
import { sectionTypeIcons } from "./sectionIcons";
import useHistory from "./useHistory";

const newId = () =>
  `new_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

type HomeDraft = {
  banners: HomeBanner[];
  sections: HomeSection[];
  deletedBannerIds: string[];
  deletedSectionIds: string[];
};

type Message = { tone: "ok" | "error"; text: string };

type Tab = "estrutura" | "secao";

const HERO_ID = "__hero";

const toolbarButton =
  "flex h-8 w-8 items-center justify-center text-gray-600 transition hover:bg-gray-100 disabled:opacity-40 disabled:hover:bg-transparent";

const topbarIconButton =
  "flex h-9 w-9 items-center justify-center rounded-lg text-gray-600 transition hover:bg-gray-100 disabled:opacity-40 disabled:hover:bg-transparent";

const byDisplayOrder = <T extends { display_order: number }>(rows: T[]) =>
  [...rows].sort((a, b) => a.display_order - b.display_order);

// A section that would render nothing on the public home (so the canvas can
// show a placeholder instead of an invisible, unclickable strip).
const sectionIsEmpty = (section: HomeSection, products: Product[]): boolean => {
  // Types without a registry entry (e.g. legacy latest_blog_posts) render
  // nothing publicly — show the placeholder so they stay visible/clickable.
  if (!sectionMetaOf(section.section_key)) return true;
  const items: any[] = Array.isArray(section.content?.items)
    ? section.content.items
    : [];
  switch (sectionTypeOf(section.section_key)) {
    case "product_collection":
      return filterCollectionProducts(products, section.content).length === 0;
    case "featured_products":
      return products.length === 0;
    case "destinations":
    case "benefits":
      return !items.some((item) => item.active !== false && item.title);
    case "testimonials":
      return !items.some((item) => item.active !== false && item.name && item.text);
    default:
      return false;
  }
};

// ---------------------------------------------------------------------------
// Loader: fetches sections/banners/products, then mounts the builder once.
// ---------------------------------------------------------------------------

const HomeBuilder = () => {
  const [data, setData] = useState<{
    draft: HomeDraft;
    products: Product[];
    categories: Category[];
  } | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      listAdminHomeSections(),
      listAdminBanners(),
      getActiveProducts().catch(() => [] as Product[]),
      getActiveCategories().catch(() => [] as Category[]),
    ])
      .then(([sections, banners, products, categories]) => {
        if (cancelled) return;
        setData({
          draft: {
            sections: byDisplayOrder(sections),
            banners: byDisplayOrder(banners),
            deletedBannerIds: [],
            deletedSectionIds: [],
          },
          products,
          categories,
        });
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-100 px-6">
        <div className="rounded-lg border bg-white p-6 text-center shadow-sm">
          <p className="font-semibold">Não foi possível carregar a home.</p>
          <Link
            className="mt-3 inline-block font-semibold text-orange-600 hover:text-orange-700"
            href="/admin"
          >
            Voltar para o painel
          </Link>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-100">
        <p className="text-sm text-gray-500">Carregando a home…</p>
      </div>
    );
  }

  return (
    <HomeBuilderInner
      categories={data.categories}
      initialDraft={data.draft}
      products={data.products}
    />
  );
};

// ---------------------------------------------------------------------------
// The builder itself.
// ---------------------------------------------------------------------------

const HomeBuilderInner = ({
  initialDraft,
  products,
  categories,
}: {
  initialDraft: HomeDraft;
  products: Product[];
  categories: Category[];
}) => {
  const router = useRouter();
  const {
    value: draft,
    set,
    undo,
    redo,
    reset,
    canUndo,
    canRedo,
  } = useHistory<HomeDraft>(initialDraft);
  const [savedSnapshot, setSavedSnapshot] = useState(() =>
    JSON.stringify(initialDraft)
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("estrutura");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [viewport, setViewport] = useState<"desktop" | "mobile">("desktop");
  const [panelOpen, setPanelOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<Message | null>(null);
  // Quick-start guide strip; dismissed state persists per browser.
  const [showGuide, setShowGuide] = useState(false);
  useEffect(() => {
    setShowGuide(
      typeof window !== "undefined" &&
        window.localStorage.getItem("home-builder-guide-dismissed") !== "1"
    );
  }, []);
  const dismissGuide = () => {
    setShowGuide(false);
    if (typeof window !== "undefined") {
      window.localStorage.setItem("home-builder-guide-dismissed", "1");
    }
  };

  const stateRef = useRef({ draft, isSaving });
  stateRef.current = { draft, isSaving };
  const savingRef = useRef(false);
  const skipGuardRef = useRef(false);
  const sectionRefs = useRef(new Map<string, HTMLDivElement>());
  const dragIndexRef = useRef<number | null>(null);

  const isDirty = JSON.stringify(draft) !== savedSnapshot;
  const isDirtyRef = useRef(isDirty);
  isDirtyRef.current = isDirty;

  const selectedSection =
    selectedId && selectedId !== HERO_ID
      ? draft.sections.find((section) => section.id === selectedId) ?? null
      : null;

  // ----- Guards ---------------------------------------------------------------
  useEffect(() => {
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!isDirtyRef.current) return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, []);

  useEffect(() => {
    const onRouteChangeStart = () => {
      if (skipGuardRef.current || !isDirtyRef.current) return;
      if (window.confirm("Você tem alterações não salvas. Sair mesmo assim?")) {
        return;
      }
      router.events.emit("routeChangeError");
      throw "Navegação cancelada: alterações não salvas.";
    };
    router.events.on("routeChangeStart", onRouteChangeStart);
    return () => router.events.off("routeChangeStart", onRouteChangeStart);
  }, [router.events]);

  // ----- Edit operations -------------------------------------------------------
  const patchSection = useCallback(
    (id: string, patch: Partial<HomeSection>, coalesce = false) =>
      set(
        (current) => ({
          ...current,
          sections: current.sections.map((section) =>
            section.id === id ? { ...section, ...patch } : section
          ),
        }),
        coalesce ? { coalesce: `section:${id}` } : undefined
      ),
    [set]
  );

  const setBanners = useCallback(
    (banners: HomeBanner[], coalesce?: string) =>
      set(
        (current) => {
          const keptIds = new Set(banners.map((banner) => banner.id));
          const removed = current.banners
            .filter((banner) => !keptIds.has(banner.id) && !banner.id.startsWith("new_"))
            .map((banner) => banner.id);
          return {
            ...current,
            banners,
            deletedBannerIds: [...current.deletedBannerIds, ...removed],
          };
        },
        coalesce ? { coalesce } : undefined
      ),
    [set]
  );

  const scrollToSection = useCallback((id: string) => {
    requestAnimationFrame(() => {
      sectionRefs.current
        .get(id)
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  }, []);

  const selectSection = useCallback(
    (id: string, options?: { scroll?: boolean }) => {
      setSelectedId(id);
      setTab("secao");
      // On mobile the inspector is a slide-over; opening it here means tapping a
      // section (or adding one) takes you straight to its fields instead of
      // looking like "nothing happened". On desktop the panel is always visible,
      // so this is a no-op there.
      setPanelOpen(true);
      if (options?.scroll) scrollToSection(id);
    },
    [scrollToSection]
  );

  const moveSection = (index: number, dir: -1 | 1) => {
    const target = index + dir;
    if (target < 0 || target >= draft.sections.length) return;
    set((current) => {
      const next = [...current.sections];
      [next[index], next[target]] = [next[target], next[index]];
      return { ...current, sections: next };
    });
  };

  const reorderSections = (from: number, to: number) => {
    if (from === to) return;
    set((current) => {
      const next = [...current.sections];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return { ...current, sections: next };
    });
  };

  const toggleSectionActive = (id: string) => {
    const section = draft.sections.find((row) => row.id === id);
    if (section) patchSection(id, { active: !section.active });
  };

  const removeSection = (id: string) => {
    set((current) => ({
      ...current,
      sections: current.sections.filter((section) => section.id !== id),
      deletedSectionIds: id.startsWith("new_")
        ? current.deletedSectionIds
        : [...current.deletedSectionIds, id],
    }));
    if (selectedId === id) {
      setSelectedId(null);
      setTab("estrutura");
    }
  };

  const addSection = (meta: SectionTypeMeta) => {
    const section: HomeSection = {
      id: newId(),
      section_key: newSectionKey(meta.type, meta.singleton),
      title: meta.defaults.title,
      subtitle: meta.defaults.subtitle,
      content: JSON.parse(JSON.stringify(meta.defaults.content)),
      active: meta.defaults.active,
      display_order: (draft.sections.length + 1) * 10,
      created_at: "",
      updated_at: "",
    };
    set((current) => ({ ...current, sections: [...current.sections, section] }));
    setPickerOpen(false);
    selectSection(section.id, { scroll: true });
  };

  // ----- Save -------------------------------------------------------------------
  const save = useCallback(async () => {
    if (savingRef.current) return;
    savingRef.current = true;
    setIsSaving(true);
    setMessage(null);
    const { draft: current } = stateRef.current;
    try {
      // Deletes first: a removed-then-recreated singleton shares the same
      // section_key, and upserting before deleting would lose the new row.
      await Promise.all([
        ...current.deletedSectionIds.map((id) => deleteAdminHomeSection(id)),
        ...current.deletedBannerIds.map((id) => deleteAdminBanner(id)),
      ]);
      await Promise.all([
        ...current.sections.map((section, index) =>
          saveAdminHomeSection({
            section_key: section.section_key,
            title: section.title,
            subtitle: section.subtitle,
            content: section.content,
            active: section.active,
            display_order: (index + 1) * 10,
          })
        ),
        ...current.banners.map((banner, index) => {
          const isNew = banner.id.startsWith("new_");
          return saveAdminBanner({
            ...(isNew ? {} : { id: banner.id }),
            title: banner.title || null,
            subtitle: banner.subtitle || null,
            image_url: banner.image_url || null,
            mobile_image_url: banner.mobile_image_url || null,
            button_text: banner.button_text || null,
            button_url: banner.button_url || null,
            overlay_strength: banner.overlay_strength ?? 0.35,
            active: banner.active,
            display_order: index,
            starts_at: banner.starts_at,
            ends_at: banner.ends_at,
          });
        }),
      ]);
      // Refetch so new rows get their real ids (needed for future deletes).
      const [sections, banners] = await Promise.all([
        listAdminHomeSections(),
        listAdminBanners(),
      ]);
      const fresh: HomeDraft = {
        sections: byDisplayOrder(sections),
        banners: byDisplayOrder(banners),
        deletedBannerIds: [],
        deletedSectionIds: [],
      };
      reset(fresh);
      setSavedSnapshot(JSON.stringify(fresh));
      setSelectedId(null);
      setTab("estrutura");
      setMessage({ tone: "ok", text: "Home salva." });
    } catch {
      setMessage({ tone: "error", text: "Não foi possível salvar a home." });
    } finally {
      savingRef.current = false;
      setIsSaving(false);
    }
  }, [reset]);

  // ----- Shortcuts ----------------------------------------------------------------
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const mod = event.ctrlKey || event.metaKey;
      const key = event.key.toLowerCase();
      // While saving, the captured draft is being persisted — swallow edits
      // so nothing changes under the save (the overlay blocks the mouse).
      if (savingRef.current) {
        if (mod && ["s", "z", "y"].includes(key)) event.preventDefault();
        return;
      }
      if (mod && key === "s") {
        event.preventDefault();
        void save();
      } else if (mod && key === "z" && !event.shiftKey) {
        event.preventDefault();
        undo();
      } else if (mod && (key === "y" || (key === "z" && event.shiftKey))) {
        event.preventDefault();
        redo();
      } else if (event.key === "Escape" && !pickerOpen) {
        setSelectedId(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [save, undo, redo, pickerOpen]);

  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => setMessage(null), 4000);
    return () => clearTimeout(timer);
  }, [message]);

  // Selection removed by undo/redo? Clear it.
  useEffect(() => {
    if (
      selectedId &&
      selectedId !== HERO_ID &&
      !draft.sections.some((section) => section.id === selectedId)
    ) {
      setSelectedId(null);
      setTab((current) => (current === "secao" ? "estrutura" : current));
    }
  }, [draft.sections, selectedId]);

  const activeBanner = useMemo(
    () => draft.banners.find((banner) => banner.active) ?? null,
    [draft.banners]
  );

  const presentTypes = draft.sections.map((section) =>
    sectionTypeOf(section.section_key)
  );

  // ----- Render --------------------------------------------------------------------
  return (
    <div className="flex h-screen flex-col bg-gray-100 text-gray-900">
      <Head>
        <title>Página inicial — Construtor | RW Turismo</title>
      </Head>

      {/* Topbar */}
      <header className="flex h-14 shrink-0 items-center gap-2 border-b bg-white px-3">
        <Link
          className="flex shrink-0 items-center gap-1 rounded-lg px-2 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-100"
          href="/admin"
        >
          <ChevronLeftIcon className="h-4 w-4" />
          Admin
        </Link>
        <span aria-hidden="true" className="h-5 w-px shrink-0 bg-gray-200" />
        <p className="truncate text-sm font-semibold">Página inicial</p>
        {isDirty && (
          <span className="hidden shrink-0 text-xs font-medium text-amber-600 md:inline">
            • não salvo
          </span>
        )}

        <div className="ml-auto flex shrink-0 items-center gap-1">
          <button
            className={topbarIconButton}
            disabled={!canUndo}
            onClick={undo}
            title="Desfazer (Ctrl+Z)"
            type="button"
          >
            <ArrowUturnLeftIcon className="h-5 w-5" />
          </button>
          <button
            className={topbarIconButton}
            disabled={!canRedo}
            onClick={redo}
            title="Refazer (Ctrl+Shift+Z)"
            type="button"
          >
            <ArrowUturnRightIcon className="h-5 w-5" />
          </button>
          <span aria-hidden="true" className="mx-1 h-5 w-px bg-gray-200" />
          <div className="hidden items-center rounded-lg border p-0.5 md:flex">
            <button
              className={`flex h-7 w-8 items-center justify-center rounded-md transition ${
                viewport === "desktop"
                  ? "bg-orange-100 text-orange-600"
                  : "text-gray-500 hover:bg-gray-100"
              }`}
              onClick={() => setViewport("desktop")}
              title="Visualizar como computador"
              type="button"
            >
              <ComputerDesktopIcon className="h-4 w-4" />
            </button>
            <button
              className={`flex h-7 w-8 items-center justify-center rounded-md transition ${
                viewport === "mobile"
                  ? "bg-orange-100 text-orange-600"
                  : "text-gray-500 hover:bg-gray-100"
              }`}
              onClick={() => setViewport("mobile")}
              title="Visualizar como celular"
              type="button"
            >
              <DevicePhoneMobileIcon className="h-4 w-4" />
            </button>
          </div>
          <a
            className={`${topbarIconButton} hidden md:flex`}
            href="/"
            rel="noopener noreferrer"
            target="_blank"
            title="Abrir o site"
          >
            <ArrowTopRightOnSquareIcon className="h-5 w-5" />
          </a>
          <Button loading={isSaving} onClick={() => void save()} size="sm">
            Salvar
          </Button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        {/* Canvas */}
        <main
          className="min-w-0 flex-1 overflow-y-auto"
          onClick={() => setSelectedId(null)}
        >
          {showGuide && (
            <div
              className="mx-auto mt-6 flex max-w-5xl items-start gap-3 rounded-xl border border-orange-200 bg-orange-50 px-4 py-3 text-sm"
              onClick={(event) => event.stopPropagation()}
            >
              <InformationCircleIcon className="mt-0.5 h-5 w-5 shrink-0 text-orange-500" />
              <div className="min-w-0 flex-1 text-orange-900">
                <p className="font-semibold">Como montar sua página inicial</p>
                <p className="mt-0.5 text-orange-800">
                  <b>1.</b> Clique em <b>Adicionar seção</b> &middot; <b>2.</b>{" "}
                  Escolha o tipo (ex.: <b>Coleção de viagens</b> para uma vitrine
                  automática) &middot; <b>3.</b> Preencha os campos no painel{" "}
                  <b>Seção</b> &middot; <b>4.</b> Clique em <b>Salvar</b>.
                </p>
              </div>
              <button
                aria-label="Dispensar guia"
                className="shrink-0 rounded-lg p-1 text-orange-500 hover:bg-orange-100"
                onClick={dismissGuide}
                title="Dispensar"
                type="button"
              >
                <XMarkIcon className="h-4 w-4" />
              </button>
            </div>
          )}
          <div
            className={`mx-auto my-8 overflow-hidden bg-white shadow-sm ring-1 ring-gray-200 transition-all ${
              viewport === "mobile"
                ? "max-w-[420px] rounded-3xl"
                : "max-w-5xl rounded-xl"
            }`}
          >
            {/* Hero */}
            <div
              className={`group relative cursor-pointer transition ${
                selectedId === HERO_ID
                  ? "ring-2 ring-inset ring-orange-500"
                  : "hover:ring-2 hover:ring-inset hover:ring-orange-300"
              }`}
              onClick={(event) => {
                event.stopPropagation();
                selectSection(HERO_ID);
              }}
              ref={(node) => {
                if (node) sectionRefs.current.set(HERO_ID, node);
                else sectionRefs.current.delete(HERO_ID);
              }}
            >
              <span
                className={`absolute left-2 top-2 z-10 rounded-md bg-orange-500 px-2 py-0.5 text-[11px] font-semibold text-white transition ${
                  selectedId === HERO_ID ? "" : "opacity-0 group-hover:opacity-100"
                }`}
              >
                Banner principal
                {draft.banners.length > 1 ? ` · ${draft.banners.length} banners` : ""}
              </span>
              <div className="pointer-events-none">
                {activeBanner ? (
                  <HeroBanner banner={activeBanner} />
                ) : (
                  <div className="flex min-h-[240px] flex-col items-center justify-center gap-2 border-2 border-dashed bg-gray-50 text-center">
                    <PhotoIcon className="h-7 w-7 text-gray-400" />
                    <p className="text-sm font-medium text-gray-500">
                      Sem banner ativo — clique para configurar.
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Sections */}
            <div className="px-6 pb-10 sm:px-10">
              {draft.sections.map((section, index) => {
                const meta = sectionMetaOf(section.section_key);
                const label = meta?.label ?? section.section_key;
                const selected = section.id === selectedId;
                const empty = sectionIsEmpty(section, products);
                return (
                  <div
                    className={`group relative mt-2 cursor-pointer rounded-lg transition ${
                      selected
                        ? "ring-2 ring-orange-500"
                        : "hover:ring-2 hover:ring-orange-200"
                    } ${section.active ? "" : "opacity-50"}`}
                    key={section.id}
                    onClick={(event) => {
                      event.stopPropagation();
                      selectSection(section.id);
                    }}
                    ref={(node) => {
                      if (node) sectionRefs.current.set(section.id, node);
                      else sectionRefs.current.delete(section.id);
                    }}
                  >
                    <span
                      className={`absolute -top-2.5 left-2 z-10 rounded-md px-2 py-0.5 text-[11px] font-semibold text-white transition ${
                        section.active ? "bg-orange-500" : "bg-gray-400"
                      } ${selected ? "" : "opacity-0 group-hover:opacity-100"}`}
                    >
                      {label}
                      {section.active ? "" : " · oculta"}
                    </span>

                    {selected && (
                      <div
                        className="absolute -top-4 right-2 z-10 flex overflow-hidden rounded-lg border bg-white shadow-md"
                        onClick={(event) => event.stopPropagation()}
                      >
                        <button
                          className={toolbarButton}
                          disabled={index === 0}
                          onClick={() => moveSection(index, -1)}
                          title="Mover para cima"
                          type="button"
                        >
                          <ArrowUpIcon className="h-4 w-4" />
                        </button>
                        <button
                          className={toolbarButton}
                          disabled={index === draft.sections.length - 1}
                          onClick={() => moveSection(index, 1)}
                          title="Mover para baixo"
                          type="button"
                        >
                          <ArrowDownIcon className="h-4 w-4" />
                        </button>
                        <button
                          className={toolbarButton}
                          onClick={() => toggleSectionActive(section.id)}
                          title={section.active ? "Ocultar do site" : "Mostrar no site"}
                          type="button"
                        >
                          {section.active ? (
                            <EyeIcon className="h-4 w-4" />
                          ) : (
                            <EyeSlashIcon className="h-4 w-4" />
                          )}
                        </button>
                        <button
                          className={`${toolbarButton} text-red-500 hover:bg-red-50`}
                          onClick={() => removeSection(section.id)}
                          title="Remover seção"
                          type="button"
                        >
                          <TrashIcon className="h-4 w-4" />
                        </button>
                      </div>
                    )}

                    <div className="pointer-events-none">
                      {empty ? (
                        <div className="my-4 flex flex-col items-center gap-2 rounded-lg border-2 border-dashed bg-gray-50 px-6 py-10 text-center">
                          <p className="text-sm font-medium text-gray-500">
                            Seção {label.toLowerCase()} ainda sem conteúdo —
                            clique para preencher os campos.
                          </p>
                        </div>
                      ) : (
                        <HomeSectionRenderer
                          products={products}
                          section={{ ...section, active: true }}
                        />
                      )}
                    </div>
                  </div>
                );
              })}

              <div className="mt-6 flex justify-center pb-2">
                <Button onClick={() => setPickerOpen(true)} variant="secondary">
                  <PlusIcon className="h-4 w-4" /> Adicionar seção
                </Button>
              </div>
            </div>
          </div>
        </main>

        {/* Mobile panel toggle */}
        <button
          className="fixed bottom-5 right-5 z-[104] flex h-12 w-12 items-center justify-center rounded-full bg-orange-500 text-white shadow-lg lg:hidden"
          onClick={() => setPanelOpen(true)}
          title="Abrir painel de edição"
          type="button"
        >
          <AdjustmentsHorizontalIcon className="h-6 w-6" />
        </button>
        {panelOpen && (
          <div
            aria-hidden="true"
            className="fixed inset-0 z-[104] bg-black/40 lg:hidden"
            onClick={() => setPanelOpen(false)}
          />
        )}

        {/* Inspector */}
        <aside
          className={`${
            panelOpen
              ? "fixed inset-y-0 right-0 z-[105] flex w-[85vw] max-w-[380px] shadow-2xl"
              : "hidden"
          } flex-col border-l bg-white lg:static lg:z-auto lg:flex lg:w-[380px] lg:shrink-0 lg:shadow-none`}
        >
          <div className="flex shrink-0 items-center border-b">
            {(
              [
                { key: "estrutura", label: "Estrutura", icon: ListBulletIcon },
                { key: "secao", label: "Seção", icon: PencilSquareIcon },
              ] as const
            ).map((item) => {
              const Icon = item.icon;
              const active = tab === item.key;
              return (
                <button
                  className={`flex flex-1 items-center justify-center gap-1.5 border-b-2 px-2 py-3 text-sm font-medium transition ${
                    active
                      ? "border-orange-500 text-orange-600"
                      : "border-transparent text-gray-500 hover:text-gray-700"
                  }`}
                  key={item.key}
                  onClick={() => setTab(item.key)}
                  type="button"
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </button>
              );
            })}
            <button
              aria-label="Fechar painel"
              className="mr-2 rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 lg:hidden"
              onClick={() => setPanelOpen(false)}
              type="button"
            >
              <XMarkIcon className="h-5 w-5" />
            </button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-4">
            {tab === "estrutura" && (
              <div className="space-y-4">
                <div className="space-y-1.5">
                  {/* Hero pinned row */}
                  <div
                    className={`flex w-full cursor-pointer items-center gap-2 rounded-lg border p-2 transition ${
                      selectedId === HERO_ID
                        ? "border-orange-500 bg-orange-50"
                        : "hover:bg-gray-50"
                    }`}
                    onClick={() => selectSection(HERO_ID, { scroll: true })}
                    role="button"
                    tabIndex={0}
                  >
                    <PhotoIcon className="ml-5 h-4 w-4 shrink-0 text-gray-400" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xs font-semibold text-gray-700">
                        Banner principal
                      </span>
                      <span className="block truncate text-xs text-gray-400">
                        {draft.banners.filter((banner) => banner.active).length}{" "}
                        ativo(s) de {draft.banners.length}
                      </span>
                    </span>
                  </div>

                  {draft.sections.map((section, index) => {
                    const meta = sectionMetaOf(section.section_key);
                    const Icon = sectionTypeIcons[sectionTypeOf(section.section_key)];
                    return (
                      <div
                        className={`flex w-full cursor-pointer items-center gap-2 rounded-lg border p-2 transition ${
                          section.id === selectedId
                            ? "border-orange-500 bg-orange-50"
                            : "hover:bg-gray-50"
                        }`}
                        draggable
                        key={section.id}
                        onClick={() => selectSection(section.id, { scroll: true })}
                        onDragEnd={() => {
                          dragIndexRef.current = null;
                        }}
                        onDragOver={(event) => event.preventDefault()}
                        onDragStart={() => {
                          dragIndexRef.current = index;
                        }}
                        onDrop={(event) => {
                          event.preventDefault();
                          if (dragIndexRef.current !== null) {
                            reorderSections(dragIndexRef.current, index);
                            dragIndexRef.current = null;
                          }
                        }}
                        role="button"
                        tabIndex={0}
                      >
                        <span
                          aria-hidden="true"
                          className="cursor-grab select-none text-gray-300"
                          title="Arraste para reordenar"
                        >
                          ⠿
                        </span>
                        {Icon && <Icon className="h-4 w-4 shrink-0 text-gray-400" />}
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-xs font-semibold text-gray-700">
                            {meta?.label ?? section.section_key}
                          </span>
                          <span className="block truncate text-xs text-gray-400">
                            {section.title || "Sem título"}
                          </span>
                        </span>
                        <button
                          className={`${toolbarButton} h-7 w-7 shrink-0`}
                          onClick={(event) => {
                            event.stopPropagation();
                            toggleSectionActive(section.id);
                          }}
                          title={section.active ? "Ocultar do site" : "Mostrar no site"}
                          type="button"
                        >
                          {section.active ? (
                            <EyeIcon className="h-4 w-4" />
                          ) : (
                            <EyeSlashIcon className="h-4 w-4 text-gray-300" />
                          )}
                        </button>
                      </div>
                    );
                  })}
                </div>

                <Button
                  className="w-full"
                  onClick={() => setPickerOpen(true)}
                  variant="secondary"
                >
                  <PlusIcon className="h-4 w-4" /> Adicionar seção
                </Button>
              </div>
            )}

            {tab === "secao" &&
              (selectedId === HERO_ID ? (
                <HeroBannerFields banners={draft.banners} onChange={setBanners} />
              ) : selectedSection ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-gray-700">
                      {sectionMetaOf(selectedSection.section_key)?.label ??
                        selectedSection.section_key}
                    </p>
                    <label className="flex items-center gap-2 text-sm text-gray-600">
                      <input
                        checked={selectedSection.active}
                        className="h-4 w-4 rounded border-gray-300 text-orange-500 focus:ring-orange-400"
                        onChange={() => toggleSectionActive(selectedSection.id)}
                        type="checkbox"
                      />
                      No ar
                    </label>
                  </div>
                  <SectionFields
                    categories={categories}
                    onPatch={(patch, coalesce) =>
                      patchSection(selectedSection.id, patch, coalesce)
                    }
                    products={products}
                    section={selectedSection}
                  />
                </div>
              ) : (
                <p className="rounded-lg border border-dashed p-4 text-center text-sm text-gray-500">
                  Clique em uma seção na página (ou na aba Estrutura) para
                  editá-la aqui.
                </p>
              ))}
          </div>
        </aside>
      </div>

      {pickerOpen && (
        <SectionPicker
          onClose={() => setPickerOpen(false)}
          onPick={addSection}
          presentTypes={presentTypes}
        />
      )}

      {/* Blocks edits while the captured draft is being persisted; without
          this, changes made mid-save are silently replaced by the refetch. */}
      {isSaving && (
        <div aria-hidden="true" className="fixed inset-0 z-[115] cursor-wait" />
      )}

      {message && (
        <p
          className={`fixed bottom-5 left-1/2 z-[120] -translate-x-1/2 rounded-lg px-4 py-2.5 text-sm font-semibold text-white shadow-lg ${
            message.tone === "ok" ? "bg-green-600" : "bg-red-600"
          }`}
          role="alert"
        >
          {message.text}
        </p>
      )}
    </div>
  );
};

export default HomeBuilder;
