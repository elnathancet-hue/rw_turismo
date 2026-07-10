import {
  AdjustmentsHorizontalIcon,
  ArrowDownIcon,
  ArrowTopRightOnSquareIcon,
  ArrowUpIcon,
  ArrowUturnLeftIcon,
  ArrowUturnRightIcon,
  ChevronLeftIcon,
  Cog6ToothIcon,
  ComputerDesktopIcon,
  DevicePhoneMobileIcon,
  DocumentDuplicateIcon,
  ListBulletIcon,
  PencilSquareIcon,
  PlusIcon,
  TrashIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { invalidateSiteMenu } from "../../../hooks/useSiteMenu";
import { deleteAdminPage, saveAdminPage } from "../../../lib/content/client";
import {
  getSiteMenu,
  removePageMenuItem,
  upsertPageMenuItem,
} from "../../../lib/content/menu";
import {
  pageTemplates,
  type PageTemplate,
} from "../../../lib/content/page-templates";
import type { Page, PageBlock } from "../../../lib/content/types";
import { PageBlockView } from "../../PageBlocks";
import Button from "../../ui/Button";
import { Field, Input, Select, Textarea } from "../../ui/form";
import BlockFields from "./BlockFields";
import BlockPicker from "./BlockPicker";
import {
  blockId,
  blockMeta,
  createBlock,
  isBlockEmpty,
  summarizeBlock,
} from "./blockMeta";
import useHistory from "./useHistory";

const slugify = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

// Page content under undo/redo history. The menu entry lives outside it (see
// menuState) so undoing content edits never silently unpins the page from
// the site menu.
type Draft = {
  title: string;
  slug: string;
  status: Page["status"];
  seo_title: string;
  seo_description: string;
  blocks: PageBlock[];
  // Modo HTML: quando preenchido, a página publicada usa este HTML.
  custom_html: string;
  custom_html_chrome: boolean;
};

type MenuState = { show: boolean; label: string };

type Message = { tone: "ok" | "error"; text: string };

type Tab = "estrutura" | "bloco" | "pagina";

const draftFromPage = (page: Page | null): Draft => ({
  title: page?.title ?? "",
  slug: page?.slug ?? "",
  status: page?.status ?? "draft",
  seo_title: page?.seo_title ?? "",
  seo_description: page?.seo_description ?? "",
  custom_html: page?.custom_html ?? "",
  custom_html_chrome: page?.custom_html_chrome ?? false,
  blocks: page?.blocks?.length
    ? page.blocks
    : page?.content
    ? // Legacy pages written before blocks existed: edit as one text block.
      [{ id: blockId(), type: "text", markdown: page.content }]
    : [],
});

const serialize = (draft: Draft, menu: MenuState) =>
  JSON.stringify([draft, menu]);

const statusChip: Record<Page["status"], { label: string; className: string }> =
  {
    draft: { label: "Rascunho", className: "bg-amber-100 text-amber-800" },
    published: {
      label: "Publicada",
      className: "bg-green-100 text-green-800",
    },
  };

const toolbarButton =
  "flex h-8 w-8 items-center justify-center text-gray-600 transition hover:bg-gray-100 disabled:opacity-40 disabled:hover:bg-transparent";

const topbarIconButton =
  "flex h-9 w-9 items-center justify-center rounded-lg text-gray-600 transition hover:bg-gray-100 disabled:opacity-40 disabled:hover:bg-transparent";

const PageBuilder = ({ page }: { page: Page | null }) => {
  const router = useRouter();
  const initialDraft = useMemo(() => draftFromPage(page), [page]);
  const {
    value: draft,
    set,
    undo,
    redo,
    canUndo,
    canRedo,
  } = useHistory<Draft>(initialDraft);
  const [menuState, setMenuState] = useState<MenuState>({
    show: false,
    label: "",
  });
  const [savedSnapshot, setSavedSnapshot] = useState(() =>
    serialize(initialDraft, { show: false, label: "" })
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>(
    page && (page.blocks?.length || page.content) ? "estrutura" : "pagina"
  );
  const [pickerIndex, setPickerIndex] = useState<number | null>(null);
  const [viewport, setViewport] = useState<"desktop" | "mobile">("desktop");
  const [panelOpen, setPanelOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<Message | null>(null);

  // Live refs so stable callbacks (shortcuts, save) read current state.
  const stateRef = useRef({ draft, menuState, isSaving });
  stateRef.current = { draft, menuState, isSaving };
  const pageIdRef = useRef<string | null>(page?.id ?? null);
  const savedSlugRef = useRef<string | null>(page?.slug ?? null);
  const skipGuardRef = useRef(false);
  const savingRef = useRef(false);
  const blockRefs = useRef(new Map<string, HTMLDivElement>());
  const dragIndexRef = useRef<number | null>(null);
  // Guards the async menu-entry load below from clobbering an edit the user
  // makes to the "mostrar no menu" toggle while that fetch is still pending.
  const menuTouchedRef = useRef(false);

  const isDirty = serialize(draft, menuState) !== savedSnapshot;
  const isDirtyRef = useRef(isDirty);
  isDirtyRef.current = isDirty;

  const selectedIndex = draft.blocks.findIndex(
    (block) => block.id === selectedId
  );
  const selectedBlock =
    selectedIndex >= 0 ? draft.blocks[selectedIndex] : null;

  // ----- Load the page's menu entry (if any) -------------------------------
  useEffect(() => {
    if (!page?.id) return;
    let cancelled = false;
    getSiteMenu()
      .then((menu) => {
        if (cancelled || menuTouchedRef.current) return;
        const item = menu.items.find((entry) => entry.page_id === page.id);
        if (!item) return;
        const loaded = { show: true, label: item.label };
        setMenuState(loaded);
        setSavedSnapshot(serialize(initialDraft, loaded));
      })
      .catch(() => {
        // Menu is optional; the builder still works without it.
      });
    return () => {
      cancelled = true;
    };
  }, [page, initialDraft]);

  // ----- Unsaved-changes guards ---------------------------------------------
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
      if (
        window.confirm("Você tem alterações não salvas. Sair mesmo assim?")
      ) {
        return;
      }
      router.events.emit("routeChangeError");
      // The pages router only aborts navigation via a thrown value.
      throw "Navegação cancelada: alterações não salvas.";
    };
    router.events.on("routeChangeStart", onRouteChangeStart);
    return () => router.events.off("routeChangeStart", onRouteChangeStart);
  }, [router.events]);

  // ----- Edit operations ----------------------------------------------------
  const setDraftField = useCallback(
    <K extends keyof Draft>(key: K, value: Draft[K], coalesce = false) =>
      set(
        (current) => ({ ...current, [key]: value }),
        coalesce ? { coalesce: `field:${key}` } : undefined
      ),
    [set]
  );

  const updateBlocks = useCallback(
    (updater: (blocks: PageBlock[]) => PageBlock[]) =>
      set((current) => ({ ...current, blocks: updater(current.blocks) })),
    [set]
  );

  const patchBlock = useCallback(
    (id: string, patch: Record<string, unknown>, coalesce = false) =>
      set(
        (current) => ({
          ...current,
          blocks: current.blocks.map((block) =>
            block.id === id ? ({ ...block, ...patch } as PageBlock) : block
          ),
        }),
        coalesce ? { coalesce: `block:${id}` } : undefined
      ),
    [set]
  );

  const scrollToBlock = useCallback((id: string) => {
    requestAnimationFrame(() => {
      blockRefs.current
        .get(id)
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  }, []);

  const selectBlock = useCallback(
    (id: string, options?: { scroll?: boolean }) => {
      setSelectedId(id);
      setTab("bloco");
      if (options?.scroll) scrollToBlock(id);
    },
    [scrollToBlock]
  );

  const insertBlock = (index: number, type: PageBlock["type"]) => {
    const block = createBlock(type);
    updateBlocks((blocks) => [
      ...blocks.slice(0, index),
      block,
      ...blocks.slice(index),
    ]);
    setPickerIndex(null);
    selectBlock(block.id, { scroll: true });
  };

  const moveBlock = (index: number, dir: -1 | 1) => {
    const target = index + dir;
    if (target < 0 || target >= draft.blocks.length) return;
    updateBlocks((blocks) => {
      const next = [...blocks];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const duplicateBlock = (index: number) => {
    const copy = {
      ...(JSON.parse(JSON.stringify(draft.blocks[index])) as PageBlock),
      id: blockId(),
    } as PageBlock;
    updateBlocks((blocks) => {
      const next = [...blocks];
      next.splice(index + 1, 0, copy);
      return next;
    });
    selectBlock(copy.id, { scroll: true });
  };

  const removeBlock = (index: number) => {
    const removed = draft.blocks[index];
    updateBlocks((blocks) => blocks.filter((_, i) => i !== index));
    if (removed?.id === selectedId) {
      setSelectedId(null);
      setTab("estrutura");
    }
  };

  const reorderBlocks = (from: number, to: number) => {
    if (from === to) return;
    updateBlocks((blocks) => {
      const next = [...blocks];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
  };

  const applyTemplate = (template: PageTemplate) => {
    if (
      draft.blocks.length > 0 &&
      !window.confirm(
        `Aplicar o modelo "${template.label}"? Isso substitui os blocos atuais (dá para desfazer com Ctrl+Z).`
      )
    ) {
      return;
    }
    updateBlocks(() => template.build());
    setSelectedId(null);
    setTab("estrutura");
  };

  // ----- Save ---------------------------------------------------------------
  const save = useCallback(async () => {
    const { draft: current, menuState: menu } = stateRef.current;
    // Synchronous re-entry guard: two triggers in the same tick (Ctrl+S +
    // click) would both pass a state-based check before React re-renders.
    if (savingRef.current) return;
    savingRef.current = true;
    const title = current.title.trim();
    if (!title) {
      savingRef.current = false;
      setMessage({
        tone: "error",
        text: "Dê um título à página antes de salvar.",
      });
      return;
    }
    const slug = slugify(current.slug.trim() || title);
    setIsSaving(true);
    setMessage(null);
    try {
      const saved = await saveAdminPage({
        id: pageIdRef.current ?? undefined,
        title,
        slug,
        status: current.status,
        seo_title: current.seo_title.trim() || null,
        seo_description: current.seo_description.trim() || null,
        blocks: current.blocks,
        custom_html: current.custom_html.trim() || null,
        custom_html_chrome: current.custom_html_chrome,
      });
      pageIdRef.current = saved.id;
      savedSlugRef.current = saved.slug;

      let menuWarning = false;
      try {
        if (menu.show) {
          await upsertPageMenuItem(
            { id: saved.id, slug: saved.slug },
            menu.label.trim() || saved.title
          );
        } else {
          await removePageMenuItem(saved.id);
        }
        invalidateSiteMenu();
      } catch {
        menuWarning = true;
      }

      const nextDraft: Draft = { ...current, title, slug: saved.slug };
      if (current.title !== title || current.slug !== saved.slug) {
        set(() => nextDraft, { coalesce: "save" });
      }
      setSavedSnapshot(serialize(nextDraft, menu));
      setMessage(
        menuWarning
          ? {
              tone: "error",
              text: "Página salva, mas o menu do site não pôde ser atualizado.",
            }
          : { tone: "ok", text: "Página salva." }
      );

      if (!page?.id) {
        // First save of a new page: move to the edit URL without the guard.
        skipGuardRef.current = true;
        void router.replace(`/admin/pages/${saved.id}`);
      }
    } catch (error) {
      const code = (error as { code?: string } | null)?.code;
      setMessage({
        tone: "error",
        text:
          code === "23505"
            ? "Já existe uma página com este endereço (slug). Escolha outro."
            : "Não foi possível salvar a página.",
      });
    } finally {
      savingRef.current = false;
      setIsSaving(false);
    }
  }, [page, router, set]);

  const deletePage = async () => {
    if (!pageIdRef.current) return;
    if (
      !window.confirm(
        `Excluir a página "${draft.title || "sem título"}"? Esta ação não pode ser desfeita.`
      )
    ) {
      return;
    }
    try {
      await removePageMenuItem(pageIdRef.current).catch(() => undefined);
      await deleteAdminPage(pageIdRef.current);
      invalidateSiteMenu();
      skipGuardRef.current = true;
      void router.push("/admin/pages");
    } catch {
      setMessage({ tone: "error", text: "Não foi possível excluir a página." });
    }
  };

  // ----- Keyboard shortcuts -------------------------------------------------
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const mod = event.ctrlKey || event.metaKey;
      const key = event.key.toLowerCase();
      if (mod && key === "s") {
        event.preventDefault();
        void save();
      } else if (mod && key === "z" && !event.shiftKey) {
        event.preventDefault();
        undo();
      } else if (mod && (key === "y" || (key === "z" && event.shiftKey))) {
        event.preventDefault();
        redo();
      } else if (event.key === "Escape" && pickerIndex === null) {
        setSelectedId(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [save, undo, redo, pickerIndex]);

  // Transient toast.
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => setMessage(null), 4000);
    return () => clearTimeout(timer);
  }, [message]);

  // Selection was removed by undo/redo? Clear the stale pointer.
  useEffect(() => {
    if (selectedId && !draft.blocks.some((block) => block.id === selectedId)) {
      setSelectedId(null);
      setTab((current) => (current === "bloco" ? "estrutura" : current));
    }
  }, [draft.blocks, selectedId]);

  const publishedUrl =
    savedSlugRef.current && draft.status === "published"
      ? `/paginas/${savedSlugRef.current}`
      : null;

  const templates = pageTemplates.filter((template) => template.key !== "blank");

  // ----- Render -------------------------------------------------------------
  return (
    <div className="flex h-screen flex-col bg-gray-100 text-gray-900">
      <Head>
        <title>{`${draft.title || "Nova página"} — Construtor | RW Turismo`}</title>
      </Head>

      {/* Topbar */}
      <header className="flex h-14 shrink-0 items-center gap-2 border-b bg-white px-3">
        <Link
          className="flex shrink-0 items-center gap-1 rounded-lg px-2 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-100"
          href="/admin/pages"
        >
          <ChevronLeftIcon className="h-4 w-4" />
          Páginas
        </Link>
        <span aria-hidden="true" className="h-5 w-px shrink-0 bg-gray-200" />
        <input
          aria-label="Título da página"
          className="w-40 min-w-0 flex-shrink rounded-lg border border-transparent px-2 py-1.5 text-sm font-semibold outline-none transition hover:border-gray-200 focus:border-orange-400 sm:w-64"
          onChange={(event) =>
            setDraftField("title", event.target.value, true)
          }
          placeholder="Título da página"
          value={draft.title}
        />
        <span
          className={`hidden shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold sm:inline ${statusChip[draft.status].className}`}
        >
          {statusChip[draft.status].label}
        </span>
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
          {publishedUrl && (
            <a
              className={`${topbarIconButton} hidden md:flex`}
              href={publishedUrl}
              rel="noopener noreferrer"
              target="_blank"
              title="Abrir página publicada"
            >
              <ArrowTopRightOnSquareIcon className="h-5 w-5" />
            </a>
          )}
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
          <div
            className={`mx-auto my-8 bg-white px-6 py-12 shadow-sm ring-1 ring-gray-200 transition-all sm:px-10 ${
              viewport === "mobile"
                ? "max-w-[420px] rounded-3xl"
                : "max-w-4xl rounded-xl"
            }`}
          >
            <h1
              className={`text-4xl font-bold ${
                draft.title ? "" : "text-gray-300"
              }`}
            >
              {draft.title || "Título da página"}
            </h1>

            {draft.blocks.length === 0 ? (
              <div
                className="mt-10 rounded-xl border-2 border-dashed px-6 py-12 text-center"
                onClick={(event) => event.stopPropagation()}
              >
                <p className="text-lg font-semibold text-gray-700">
                  Comece a montar a página
                </p>
                <p className="mt-1 text-sm text-gray-500">
                  Escolha um modelo pronto (é só trocar textos e fotos) ou
                  adicione o primeiro bloco.
                </p>
                <div className="mt-6 grid gap-3 sm:grid-cols-3">
                  {templates.map((template) => (
                    <button
                      className="rounded-lg border p-3 text-left transition hover:border-orange-500 hover:bg-orange-50"
                      key={template.key}
                      onClick={() => applyTemplate(template)}
                      type="button"
                    >
                      <span className="block text-sm font-semibold">
                        {template.label}
                      </span>
                      <span className="mt-0.5 block text-xs text-gray-500">
                        {template.description}
                      </span>
                    </button>
                  ))}
                </div>
                <Button
                  className="mt-6"
                  onClick={() => setPickerIndex(0)}
                  variant="secondary"
                >
                  <PlusIcon className="h-4 w-4" /> Adicionar bloco
                </Button>
              </div>
            ) : (
              <div className="mt-8">
                <InsertPoint onInsert={() => setPickerIndex(0)} />
                {draft.blocks.map((block, index) => (
                  <Fragment key={block.id}>
                    <CanvasBlock
                      block={block}
                      count={draft.blocks.length}
                      index={index}
                      onDuplicate={() => duplicateBlock(index)}
                      onMove={(dir) => moveBlock(index, dir)}
                      onRemove={() => removeBlock(index)}
                      onSelect={() => selectBlock(block.id)}
                      selected={block.id === selectedId}
                      setRef={(node) => {
                        if (node) blockRefs.current.set(block.id, node);
                        else blockRefs.current.delete(block.id);
                      }}
                    />
                    <InsertPoint
                      onInsert={() => setPickerIndex(index + 1)}
                    />
                  </Fragment>
                ))}
              </div>
            )}
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
                { key: "bloco", label: "Bloco", icon: PencilSquareIcon },
                { key: "pagina", label: "Página", icon: Cog6ToothIcon },
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
                {draft.blocks.length === 0 ? (
                  <p className="rounded-lg border border-dashed p-4 text-center text-sm text-gray-500">
                    Nenhum bloco ainda. Adicione o primeiro para montar a
                    página.
                  </p>
                ) : (
                  <div className="space-y-1.5">
                    {draft.blocks.map((block, index) => {
                      const meta = blockMeta[block.type];
                      const Icon = meta.icon;
                      return (
                        <div
                          className={`flex w-full cursor-pointer items-center gap-2 rounded-lg border p-2 transition ${
                            block.id === selectedId
                              ? "border-orange-500 bg-orange-50"
                              : "hover:bg-gray-50"
                          }`}
                          draggable
                          key={block.id}
                          onClick={() =>
                            selectBlock(block.id, { scroll: true })
                          }
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
                              reorderBlocks(dragIndexRef.current, index);
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
                          <Icon className="h-4 w-4 shrink-0 text-gray-400" />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-xs font-semibold text-gray-700">
                              {meta.label}
                            </span>
                            <span className="block truncate text-xs text-gray-400">
                              {summarizeBlock(block)}
                            </span>
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}

                <Button
                  className="w-full"
                  onClick={() => setPickerIndex(draft.blocks.length)}
                  variant="secondary"
                >
                  <PlusIcon className="h-4 w-4" /> Adicionar bloco
                </Button>

                <details className="rounded-lg border p-3">
                  <summary className="cursor-pointer text-sm font-semibold text-gray-700">
                    Modelos prontos
                  </summary>
                  <div className="mt-3 space-y-2">
                    {templates.map((template) => (
                      <button
                        className="w-full rounded-lg border p-3 text-left transition hover:border-orange-500 hover:bg-orange-50"
                        key={template.key}
                        onClick={() => applyTemplate(template)}
                        type="button"
                      >
                        <span className="block text-sm font-semibold">
                          {template.label}
                        </span>
                        <span className="mt-0.5 block text-xs text-gray-500">
                          {template.description}
                        </span>
                      </button>
                    ))}
                  </div>
                </details>
              </div>
            )}

            {tab === "bloco" &&
              (selectedBlock ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-gray-700">
                      {blockMeta[selectedBlock.type].label}
                      <span className="ml-2 text-xs font-normal text-gray-400">
                        {selectedIndex + 1} de {draft.blocks.length}
                      </span>
                    </p>
                    <div className="flex overflow-hidden rounded-lg border">
                      <button
                        className={toolbarButton}
                        disabled={selectedIndex === 0}
                        onClick={() => moveBlock(selectedIndex, -1)}
                        title="Mover para cima"
                        type="button"
                      >
                        <ArrowUpIcon className="h-4 w-4" />
                      </button>
                      <button
                        className={toolbarButton}
                        disabled={selectedIndex === draft.blocks.length - 1}
                        onClick={() => moveBlock(selectedIndex, 1)}
                        title="Mover para baixo"
                        type="button"
                      >
                        <ArrowDownIcon className="h-4 w-4" />
                      </button>
                      <button
                        className={toolbarButton}
                        onClick={() => duplicateBlock(selectedIndex)}
                        title="Duplicar bloco"
                        type="button"
                      >
                        <DocumentDuplicateIcon className="h-4 w-4" />
                      </button>
                      <button
                        className={`${toolbarButton} text-red-500 hover:bg-red-50`}
                        onClick={() => removeBlock(selectedIndex)}
                        title="Remover bloco"
                        type="button"
                      >
                        <TrashIcon className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                  <BlockFields
                    block={selectedBlock}
                    onPatch={(patch, coalesce) =>
                      patchBlock(selectedBlock.id, patch, coalesce)
                    }
                  />
                </div>
              ) : (
                <p className="rounded-lg border border-dashed p-4 text-center text-sm text-gray-500">
                  Clique em um bloco na página (ou na aba Estrutura) para
                  editá-lo aqui.
                </p>
              ))}

            {tab === "pagina" && (
              <div className="space-y-5">
                <Field label="Título">
                  <Input
                    onChange={(event) =>
                      setDraftField("title", event.target.value, true)
                    }
                    value={draft.title}
                  />
                </Field>
                <Field
                  hint={`A página fica em /paginas/${
                    draft.slug || "endereco"
                  }.`}
                  label="Endereço (slug)"
                >
                  <Input
                    onChange={(event) =>
                      setDraftField("slug", slugify(event.target.value), true)
                    }
                    placeholder={slugify(draft.title) || "minha-pagina"}
                    value={draft.slug}
                  />
                </Field>
                <Field label="Status">
                  <Select
                    onChange={(event) =>
                      setDraftField(
                        "status",
                        event.target.value as Page["status"]
                      )
                    }
                    value={draft.status}
                  >
                    <option value="draft">Rascunho (só você vê)</option>
                    <option value="published">Publicada (no ar)</option>
                  </Select>
                </Field>

                <div className="rounded-lg border p-3">
                  <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                    <input
                      checked={menuState.show}
                      className="h-4 w-4 rounded border-gray-300 text-orange-500 focus:ring-orange-400"
                      onChange={(event) => {
                        menuTouchedRef.current = true;
                        setMenuState((current) => ({
                          ...current,
                          show: event.target.checked,
                        }));
                      }}
                      type="checkbox"
                    />
                    Mostrar no menu do site
                  </label>
                  <p className="mt-1 text-xs text-gray-500">
                    Cria uma aba no topo do site apontando para esta página
                    (aplicado ao salvar).
                  </p>
                  {menuState.show && (
                    <Field label="Nome da aba">
                      <Input
                        onChange={(event) => {
                          menuTouchedRef.current = true;
                          setMenuState((current) => ({
                            ...current,
                            label: event.target.value,
                          }));
                        }}
                        placeholder={draft.title || "Ex.: Sobre nós"}
                        value={menuState.label}
                      />
                    </Field>
                  )}
                </div>

                <div className="space-y-3 rounded-lg border p-3">
                  <p className="text-sm font-semibold text-gray-700">
                    SEO (Google)
                  </p>
                  <Field
                    hint="Aparece na aba do navegador e no Google."
                    label="Título SEO"
                  >
                    <Input
                      onChange={(event) =>
                        setDraftField("seo_title", event.target.value, true)
                      }
                      value={draft.seo_title}
                    />
                  </Field>
                  <Field label="Meta descrição">
                    <Textarea
                      className="min-h-[70px]"
                      onChange={(event) =>
                        setDraftField(
                          "seo_description",
                          event.target.value,
                          true
                        )
                      }
                      value={draft.seo_description}
                    />
                  </Field>
                </div>

                <div className="space-y-3 rounded-lg border p-3">
                  <p className="text-sm font-semibold text-gray-700">
                    Página em HTML (avançado)
                  </p>
                  <p className="text-xs text-gray-500">
                    Cole aqui um HTML completo (landing pronta) e a página
                    publicada será <b>exatamente</b> este HTML — os blocos são
                    ignorados. Apague o HTML para voltar aos blocos.
                  </p>
                  <Textarea
                    aria-label="HTML da página"
                    className="min-h-[220px] font-mono text-xs"
                    onChange={(event) =>
                      setDraftField("custom_html", event.target.value, true)
                    }
                    placeholder="<!DOCTYPE html>&#10;<html>…"
                    spellCheck={false}
                    value={draft.custom_html}
                  />
                  {draft.custom_html.trim() && (
                    <>
                      <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                        <input
                          checked={draft.custom_html_chrome}
                          className="h-4 w-4 rounded border-gray-300 text-orange-500 focus:ring-orange-400"
                          onChange={(event) =>
                            setDraftField(
                              "custom_html_chrome",
                              event.target.checked
                            )
                          }
                          type="checkbox"
                        />
                        Mostrar menu e rodapé do site
                      </label>
                      <p className="text-xs text-gray-500">
                        {draft.custom_html_chrome
                          ? "O HTML aparece isolado dentro da página do site (o CSS dele não conflita com o do site)."
                          : "A página é servida sozinha, exatamente como colada — tela cheia, scripts e pixels funcionando."}
                      </p>
                    </>
                  )}
                </div>

                {pageIdRef.current && (
                  <div className="rounded-lg border border-red-200 p-3">
                    <p className="text-sm font-semibold text-red-700">
                      Zona de risco
                    </p>
                    <p className="mt-1 text-xs text-gray-500">
                      Excluir remove a página do site e do menu. Não pode ser
                      desfeito.
                    </p>
                    <Button
                      className="mt-3"
                      onClick={() => void deletePage()}
                      size="sm"
                      variant="danger"
                    >
                      Excluir página
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
        </aside>
      </div>

      {pickerIndex !== null && (
        <BlockPicker
          onClose={() => setPickerIndex(null)}
          onPick={(type) => insertBlock(pickerIndex, type)}
        />
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

// Thin hover zone between blocks with a centered "+" to insert right there.
const InsertPoint = ({ onInsert }: { onInsert: () => void }) => (
  <div
    className="group/insert relative flex h-8 items-center justify-center"
    onClick={(event) => event.stopPropagation()}
  >
    <span
      aria-hidden="true"
      className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-orange-300 opacity-0 transition group-hover/insert:opacity-100"
    />
    <button
      aria-label="Adicionar bloco aqui"
      className="relative z-10 flex h-6 w-6 items-center justify-center rounded-full border border-orange-300 bg-white text-orange-500 opacity-0 shadow-sm transition hover:bg-orange-500 hover:text-white focus-visible:opacity-100 group-hover/insert:opacity-100"
      onClick={onInsert}
      type="button"
    >
      <PlusIcon className="h-4 w-4" />
    </button>
  </div>
);

type CanvasBlockProps = {
  block: PageBlock;
  count: number;
  index: number;
  onDuplicate: () => void;
  onMove: (dir: -1 | 1) => void;
  onRemove: () => void;
  onSelect: () => void;
  selected: boolean;
  setRef: (node: HTMLDivElement | null) => void;
};

// Wraps the real public block render with selection, hover outline and a
// floating toolbar. Content is inert (pointer-events-none): the canvas is an
// editing surface, so links/accordions inside blocks must not navigate.
const CanvasBlock = ({
  block,
  count,
  index,
  onDuplicate,
  onMove,
  onRemove,
  onSelect,
  selected,
  setRef,
}: CanvasBlockProps) => {
  const meta = blockMeta[block.type];
  return (
    <div
      className={`group relative cursor-pointer rounded-lg transition ${
        selected
          ? "ring-2 ring-orange-500"
          : "hover:ring-2 hover:ring-orange-200"
      }`}
      onClick={(event) => {
        event.stopPropagation();
        onSelect();
      }}
      ref={setRef}
    >
      <span
        className={`absolute -top-2.5 left-2 z-10 rounded-md bg-orange-500 px-2 py-0.5 text-[11px] font-semibold text-white transition ${
          selected ? "" : "opacity-0 group-hover:opacity-100"
        }`}
      >
        {meta.label}
      </span>

      {selected && (
        <div
          className="absolute -top-4 right-2 z-10 flex overflow-hidden rounded-lg border bg-white shadow-md"
          onClick={(event) => event.stopPropagation()}
        >
          <button
            className={toolbarButton}
            disabled={index === 0}
            onClick={() => onMove(-1)}
            title="Mover para cima"
            type="button"
          >
            <ArrowUpIcon className="h-4 w-4" />
          </button>
          <button
            className={toolbarButton}
            disabled={index === count - 1}
            onClick={() => onMove(1)}
            title="Mover para baixo"
            type="button"
          >
            <ArrowDownIcon className="h-4 w-4" />
          </button>
          <button
            className={toolbarButton}
            onClick={onDuplicate}
            title="Duplicar bloco"
            type="button"
          >
            <DocumentDuplicateIcon className="h-4 w-4" />
          </button>
          <button
            className={`${toolbarButton} text-red-500 hover:bg-red-50`}
            onClick={onRemove}
            title="Remover bloco"
            type="button"
          >
            <TrashIcon className="h-4 w-4" />
          </button>
        </div>
      )}

      <div className="pointer-events-none">
        {isBlockEmpty(block) ? (
          <div className="flex flex-col items-center gap-2 rounded-lg border-2 border-dashed bg-gray-50 px-6 py-8 text-center">
            <meta.icon className="h-6 w-6 text-gray-400" />
            <p className="text-sm font-medium text-gray-500">
              Bloco {meta.label.toLowerCase()} vazio — preencha no painel ao
              lado.
            </p>
          </div>
        ) : (
          <PageBlockView block={block} />
        )}
      </div>
    </div>
  );
};

export default PageBuilder;
