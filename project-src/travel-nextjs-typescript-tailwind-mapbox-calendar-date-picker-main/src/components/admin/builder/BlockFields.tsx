import type { PageBlock } from "../../../lib/content/types";
import Button from "../../ui/Button";
import { Field, Input, Select, Textarea } from "../../ui/form";
import ImageUpload from "../ImageUpload";

type Props = {
  block: PageBlock;
  // Partial patch merged over the block; the type guards below keep it sane.
  onPatch: (patch: Record<string, unknown>, coalesce?: boolean) => void;
};

// Field editors for one block, rendered in the inspector panel. The canvas is
// the live preview, so fields stay compact and stacked (single column).
const BlockFields = ({ block, onPatch }: Props) => {
  switch (block.type) {
    case "text":
      return (
        <Field
          hint="# Título, ## Subtítulo, - listas, **negrito**, [texto](/link)."
          label="Texto (Markdown)"
        >
          <Textarea
            className="min-h-[260px] font-mono text-sm"
            onChange={(e) => onPatch({ markdown: e.target.value }, true)}
            value={block.markdown}
          />
        </Field>
      );

    case "image":
      return (
        <div className="space-y-3">
          <ImageUpload
            bucket="site-assets"
            onChange={(url) => onPatch({ url })}
            value={block.url}
          />
          <Field label="Texto alternativo (alt)">
            <Input
              onChange={(e) => onPatch({ alt: e.target.value }, true)}
              value={block.alt}
            />
          </Field>
          <Field label="Legenda">
            <Input
              onChange={(e) => onPatch({ caption: e.target.value }, true)}
              value={block.caption}
            />
          </Field>
        </div>
      );

    case "gallery":
      return (
        <div className="space-y-3">
          {block.images.map((image, imageIndex) => (
            <div className="space-y-2 rounded-lg border p-3" key={imageIndex}>
              <ImageUpload
                bucket="site-assets"
                onChange={(url) =>
                  onPatch({
                    images: block.images.map((im, j) =>
                      j === imageIndex ? { ...im, url } : im
                    ),
                  })
                }
                value={image.url}
              />
              <Field label="Texto alternativo">
                <Input
                  onChange={(e) =>
                    onPatch(
                      {
                        images: block.images.map((im, j) =>
                          j === imageIndex ? { ...im, alt: e.target.value } : im
                        ),
                      },
                      true
                    )
                  }
                  value={image.alt}
                />
              </Field>
              <Button
                onClick={() =>
                  onPatch({
                    images: block.images.filter((_, j) => j !== imageIndex),
                  })
                }
                size="sm"
                variant="ghost"
              >
                Remover foto
              </Button>
            </div>
          ))}
          <Button
            onClick={() =>
              onPatch({ images: [...block.images, { url: "", alt: "" }] })
            }
            size="sm"
            variant="secondary"
          >
            + Adicionar foto
          </Button>
        </div>
      );

    case "banner":
      return (
        <div className="space-y-3">
          <ImageUpload
            bucket="site-assets"
            onChange={(url) => onPatch({ image: url })}
            value={block.image}
          />
          <Field label="Título">
            <Input
              onChange={(e) => onPatch({ title: e.target.value }, true)}
              value={block.title}
            />
          </Field>
          <Field label="Subtítulo">
            <Input
              onChange={(e) => onPatch({ subtitle: e.target.value }, true)}
              value={block.subtitle}
            />
          </Field>
          <Field label="Texto do botão">
            <Input
              onChange={(e) => onPatch({ button_label: e.target.value }, true)}
              value={block.button_label}
            />
          </Field>
          <Field label="Link do botão">
            <Input
              onChange={(e) => onPatch({ button_url: e.target.value }, true)}
              placeholder="/pagina ou https://..."
              value={block.button_url}
            />
          </Field>
        </div>
      );

    case "cta":
      return (
        <div className="space-y-3">
          <Field label="Título">
            <Input
              onChange={(e) => onPatch({ title: e.target.value }, true)}
              value={block.title}
            />
          </Field>
          <Field label="Texto">
            <Input
              onChange={(e) => onPatch({ text: e.target.value }, true)}
              value={block.text}
            />
          </Field>
          <Field label="Texto do botão">
            <Input
              onChange={(e) => onPatch({ button_label: e.target.value }, true)}
              value={block.button_label}
            />
          </Field>
          <Field label="Link do botão">
            <Input
              onChange={(e) => onPatch({ button_url: e.target.value }, true)}
              placeholder="/pagina ou https://..."
              value={block.button_url}
            />
          </Field>
        </div>
      );

    case "video":
      return (
        <div className="space-y-3">
          <Field label="Link do vídeo (YouTube ou Vimeo)">
            <Input
              onChange={(e) => onPatch({ url: e.target.value }, true)}
              placeholder="https://youtube.com/watch?v=..."
              value={block.url}
            />
          </Field>
          <Field label="Legenda">
            <Input
              onChange={(e) => onPatch({ caption: e.target.value }, true)}
              value={block.caption}
            />
          </Field>
        </div>
      );

    case "quote":
      return (
        <div className="space-y-3">
          <Field label="Depoimento">
            <Textarea
              className="min-h-[120px]"
              onChange={(e) => onPatch({ text: e.target.value }, true)}
              value={block.text}
            />
          </Field>
          <Field label="Autor">
            <Input
              onChange={(e) => onPatch({ author: e.target.value }, true)}
              value={block.author}
            />
          </Field>
        </div>
      );

    case "faq":
      return (
        <div className="space-y-3">
          {block.items.map((item, itemIndex) => (
            <div className="space-y-2 rounded-lg border p-3" key={itemIndex}>
              <Field label={`Pergunta ${itemIndex + 1}`}>
                <Input
                  onChange={(e) =>
                    onPatch(
                      {
                        items: block.items.map((it, j) =>
                          j === itemIndex
                            ? { ...it, question: e.target.value }
                            : it
                        ),
                      },
                      true
                    )
                  }
                  value={item.question}
                />
              </Field>
              <Field label="Resposta">
                <Textarea
                  className="min-h-[80px]"
                  onChange={(e) =>
                    onPatch(
                      {
                        items: block.items.map((it, j) =>
                          j === itemIndex
                            ? { ...it, answer: e.target.value }
                            : it
                        ),
                      },
                      true
                    )
                  }
                  value={item.answer}
                />
              </Field>
              <Button
                onClick={() =>
                  onPatch({
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
              onPatch({
                items: [...block.items, { question: "", answer: "" }],
              })
            }
            size="sm"
            variant="secondary"
          >
            + Adicionar pergunta
          </Button>
        </div>
      );

    case "spacer":
      return (
        <Field label="Tamanho do espaço">
          <Select
            onChange={(e) => onPatch({ size: e.target.value })}
            value={block.size}
          >
            <option value="small">Pequeno</option>
            <option value="medium">Médio</option>
            <option value="large">Grande</option>
          </Select>
        </Field>
      );
  }
};

export default BlockFields;
