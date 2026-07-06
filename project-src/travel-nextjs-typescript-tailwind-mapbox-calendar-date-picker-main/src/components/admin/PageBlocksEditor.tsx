import { useState } from "react";
import type { PageBlock } from "../../lib/content/types";
import MarkdownContent from "../MarkdownContent";
import Button from "../ui/Button";
import Card from "../ui/Card";
import { Field, Input, Select, Textarea } from "../ui/form";
import ImageUpload from "./ImageUpload";

export const blockId = () =>
  `b_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

const blockLabels: Record<PageBlock["type"], string> = {
  text: "Texto",
  image: "Imagem",
  gallery: "Galeria",
  banner: "Banner",
  cta: "Chamada (CTA)",
  video: "Vídeo",
  quote: "Depoimento",
  faq: "Perguntas (FAQ)",
  spacer: "Espaço",
};

const createBlock = (type: PageBlock["type"]): PageBlock => {
  const id = blockId();
  switch (type) {
    case "text":
      return { id, type, markdown: "" };
    case "image":
      return { id, type, url: "", alt: "", caption: "" };
    case "gallery":
      return { id, type, images: [] };
    case "banner":
      return {
        id,
        type,
        image: "",
        title: "",
        subtitle: "",
        button_label: "",
        button_url: "",
      };
    case "cta":
      return { id, type, title: "", text: "", button_label: "", button_url: "" };
    case "video":
      return { id, type, url: "", caption: "" };
    case "quote":
      return { id, type, text: "", author: "" };
    case "faq":
      return { id, type, items: [] };
    case "spacer":
      return { id, type, size: "medium" };
  }
};

type Props = {
  blocks: PageBlock[];
  onChange: (blocks: PageBlock[]) => void;
};

const PageBlocksEditor = ({ blocks, onChange }: Props) => {
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  // The block-type guards in the JSX narrow the union, so a loose patch is fine.
  const patch = (index: number, next: Record<string, unknown>) =>
    onChange(
      blocks.map((block, i) =>
        i === index ? ({ ...block, ...next } as PageBlock) : block
      )
    );
  const remove = (index: number) =>
    onChange(blocks.filter((_, i) => i !== index));
  const duplicate = (index: number) => {
    const copy = {
      ...JSON.parse(JSON.stringify(blocks[index])),
      id: blockId(),
    } as PageBlock;
    const next = [...blocks];
    next.splice(index + 1, 0, copy);
    onChange(next);
  };
  const move = (index: number, dir: -1 | 1) => {
    const target = index + dir;
    if (target < 0 || target >= blocks.length) return;
    const next = [...blocks];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  };
  const drop = (targetIndex: number) => {
    if (dragIndex === null || dragIndex === targetIndex) return;
    const next = [...blocks];
    const [moved] = next.splice(dragIndex, 1);
    next.splice(targetIndex, 0, moved);
    onChange(next);
    setDragIndex(null);
  };
  const add = (type: PageBlock["type"]) =>
    onChange([...blocks, createBlock(type)]);

  return (
    <div className="space-y-4">
      {blocks.length === 0 && (
        <p className="rounded-lg border border-dashed p-6 text-center text-sm text-gray-500">
          Nenhum bloco ainda. Adicione um bloco abaixo para montar a página.
        </p>
      )}

      {blocks.map((block, index) => (
        <Card
          className={`space-y-4 p-4 ${dragIndex === index ? "opacity-50" : ""}`}
          key={block.id}
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            event.preventDefault();
            drop(index);
          }}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span
                aria-hidden="true"
                className="cursor-grab select-none text-lg text-gray-400"
                draggable
                onDragEnd={() => setDragIndex(null)}
                onDragStart={() => setDragIndex(index)}
                title="Arraste para reordenar"
              >
                ⠿
              </span>
              <span className="text-sm font-semibold uppercase tracking-wide text-gray-500">
                {blockLabels[block.type]}
              </span>
            </div>
            <div className="flex flex-wrap gap-1">
              <Button
                aria-label="Subir"
                disabled={index === 0}
                onClick={() => move(index, -1)}
                size="sm"
                variant="secondary"
              >
                ↑
              </Button>
              <Button
                aria-label="Descer"
                disabled={index === blocks.length - 1}
                onClick={() => move(index, 1)}
                size="sm"
                variant="secondary"
              >
                ↓
              </Button>
              <Button
                onClick={() => duplicate(index)}
                size="sm"
                variant="secondary"
              >
                Duplicar
              </Button>
              <Button onClick={() => remove(index)} size="sm" variant="ghost">
                Remover
              </Button>
            </div>
          </div>

          {block.type === "text" && (
            <div className="grid gap-4 lg:grid-cols-2">
              <Field
                hint="# Título, ## Subtítulo, - listas, **negrito**, [texto](/link)."
                label="Texto (Markdown)"
              >
                <Textarea
                  className="min-h-[200px] font-mono text-sm"
                  onChange={(e) => patch(index, { markdown: e.target.value })}
                  value={block.markdown}
                />
              </Field>
              <div className="overflow-auto rounded-lg border bg-gray-50 p-3">
                <MarkdownContent
                  className="prose prose-sm max-w-none prose-a:text-orange-600"
                  content={block.markdown}
                />
              </div>
            </div>
          )}

          {block.type === "image" && (
            <div className="space-y-3">
              <ImageUpload
                bucket="site-assets"
                onChange={(url) => patch(index, { url })}
                value={block.url}
              />
              <div className="grid gap-3 md:grid-cols-2">
                <Field label="Texto alternativo (alt)">
                  <Input
                    onChange={(e) => patch(index, { alt: e.target.value })}
                    value={block.alt}
                  />
                </Field>
                <Field label="Legenda">
                  <Input
                    onChange={(e) => patch(index, { caption: e.target.value })}
                    value={block.caption}
                  />
                </Field>
              </div>
            </div>
          )}

          {block.type === "gallery" && (
            <div className="space-y-3">
              {block.images.map((image, imageIndex) => (
                <div
                  className="flex flex-wrap items-end gap-3 rounded-lg border p-3"
                  key={imageIndex}
                >
                  <div className="w-40">
                    <ImageUpload
                      bucket="site-assets"
                      onChange={(url) =>
                        patch(index, {
                          images: block.images.map((im, j) =>
                            j === imageIndex ? { ...im, url } : im
                          ),
                        })
                      }
                      value={image.url}
                    />
                  </div>
                  <div className="flex-1">
                    <Field label="Texto alternativo">
                      <Input
                        onChange={(e) =>
                          patch(index, {
                            images: block.images.map((im, j) =>
                              j === imageIndex ? { ...im, alt: e.target.value } : im
                            ),
                          })
                        }
                        value={image.alt}
                      />
                    </Field>
                  </div>
                  <Button
                    onClick={() =>
                      patch(index, {
                        images: block.images.filter((_, j) => j !== imageIndex),
                      })
                    }
                    size="sm"
                    variant="ghost"
                  >
                    Remover
                  </Button>
                </div>
              ))}
              <Button
                onClick={() =>
                  patch(index, {
                    images: [...block.images, { url: "", alt: "" }],
                  })
                }
                size="sm"
                variant="secondary"
              >
                + Adicionar foto
              </Button>
            </div>
          )}

          {block.type === "banner" && (
            <div className="space-y-3">
              <ImageUpload
                bucket="site-assets"
                onChange={(url) => patch(index, { image: url })}
                value={block.image}
              />
              <div className="grid gap-3 md:grid-cols-2">
                <Field label="Título">
                  <Input
                    onChange={(e) => patch(index, { title: e.target.value })}
                    value={block.title}
                  />
                </Field>
                <Field label="Subtítulo">
                  <Input
                    onChange={(e) => patch(index, { subtitle: e.target.value })}
                    value={block.subtitle}
                  />
                </Field>
                <Field label="Texto do botão">
                  <Input
                    onChange={(e) =>
                      patch(index, { button_label: e.target.value })
                    }
                    value={block.button_label}
                  />
                </Field>
                <Field label="Link do botão">
                  <Input
                    onChange={(e) => patch(index, { button_url: e.target.value })}
                    placeholder="/pagina ou https://..."
                    value={block.button_url}
                  />
                </Field>
              </div>
            </div>
          )}

          {block.type === "cta" && (
            <div className="grid gap-3 md:grid-cols-2">
              <Field label="Título">
                <Input
                  onChange={(e) => patch(index, { title: e.target.value })}
                  value={block.title}
                />
              </Field>
              <Field label="Texto">
                <Input
                  onChange={(e) => patch(index, { text: e.target.value })}
                  value={block.text}
                />
              </Field>
              <Field label="Texto do botão">
                <Input
                  onChange={(e) => patch(index, { button_label: e.target.value })}
                  value={block.button_label}
                />
              </Field>
              <Field label="Link do botão">
                <Input
                  onChange={(e) => patch(index, { button_url: e.target.value })}
                  placeholder="/pagina ou https://..."
                  value={block.button_url}
                />
              </Field>
            </div>
          )}

          {block.type === "video" && (
            <div className="grid gap-3 md:grid-cols-2">
              <Field label="Link do vídeo (YouTube ou Vimeo)">
                <Input
                  onChange={(e) => patch(index, { url: e.target.value })}
                  placeholder="https://youtube.com/watch?v=..."
                  value={block.url}
                />
              </Field>
              <Field label="Legenda">
                <Input
                  onChange={(e) => patch(index, { caption: e.target.value })}
                  value={block.caption}
                />
              </Field>
            </div>
          )}

          {block.type === "quote" && (
            <div className="space-y-3">
              <Field label="Depoimento">
                <Textarea
                  className="min-h-[100px]"
                  onChange={(e) => patch(index, { text: e.target.value })}
                  value={block.text}
                />
              </Field>
              <Field label="Autor">
                <Input
                  onChange={(e) => patch(index, { author: e.target.value })}
                  value={block.author}
                />
              </Field>
            </div>
          )}

          {block.type === "faq" && (
            <div className="space-y-3">
              {block.items.map((item, itemIndex) => (
                <div className="space-y-2 rounded-lg border p-3" key={itemIndex}>
                  <Field label="Pergunta">
                    <Input
                      onChange={(e) =>
                        patch(index, {
                          items: block.items.map((it, j) =>
                            j === itemIndex
                              ? { ...it, question: e.target.value }
                              : it
                          ),
                        })
                      }
                      value={item.question}
                    />
                  </Field>
                  <Field label="Resposta">
                    <Textarea
                      className="min-h-[80px]"
                      onChange={(e) =>
                        patch(index, {
                          items: block.items.map((it, j) =>
                            j === itemIndex
                              ? { ...it, answer: e.target.value }
                              : it
                          ),
                        })
                      }
                      value={item.answer}
                    />
                  </Field>
                  <Button
                    onClick={() =>
                      patch(index, {
                        items: block.items.filter((_, j) => j !== itemIndex),
                      })
                    }
                    size="sm"
                    variant="ghost"
                  >
                    Remover pergunta
                  </Button>
                </div>
              ))}
              <Button
                onClick={() =>
                  patch(index, {
                    items: [...block.items, { question: "", answer: "" }],
                  })
                }
                size="sm"
                variant="secondary"
              >
                + Adicionar pergunta
              </Button>
            </div>
          )}

          {block.type === "spacer" && (
            <Field label="Tamanho do espaço">
              <Select
                onChange={(e) => patch(index, { size: e.target.value })}
                value={block.size}
              >
                <option value="small">Pequeno</option>
                <option value="medium">Médio</option>
                <option value="large">Grande</option>
              </Select>
            </Field>
          )}
        </Card>
      ))}

      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-dashed p-3">
        <span className="text-sm font-medium text-gray-500">
          Adicionar bloco:
        </span>
        {(Object.keys(blockLabels) as PageBlock["type"][]).map((type) => (
          <Button
            key={type}
            onClick={() => add(type)}
            size="sm"
            variant="secondary"
          >
            + {blockLabels[type]}
          </Button>
        ))}
      </div>
    </div>
  );
};

export default PageBlocksEditor;
