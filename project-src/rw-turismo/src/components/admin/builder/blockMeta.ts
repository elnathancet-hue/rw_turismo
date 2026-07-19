import {
  ArrowsUpDownIcon,
  Bars3BottomLeftIcon,
  ChatBubbleBottomCenterTextIcon,
  InboxArrowDownIcon,
  MegaphoneIcon,
  PhotoIcon,
  PlayCircleIcon,
  QuestionMarkCircleIcon,
  RectangleStackIcon,
  Squares2X2Icon,
} from "@heroicons/react/24/outline";
import type { ComponentType, SVGProps } from "react";
import type { PageBlock } from "../../../lib/content/types";

export const blockId = () =>
  `b_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

export type BlockMeta = {
  label: string;
  description: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
};

export const blockMeta: Record<PageBlock["type"], BlockMeta> = {
  text: {
    label: "Texto",
    description: "Títulos, parágrafos e listas",
    icon: Bars3BottomLeftIcon,
  },
  image: {
    label: "Imagem",
    description: "Uma foto com legenda",
    icon: PhotoIcon,
  },
  gallery: {
    label: "Galeria",
    description: "Grade de fotos",
    icon: Squares2X2Icon,
  },
  banner: {
    label: "Banner",
    description: "Foto de fundo, título e botão",
    icon: RectangleStackIcon,
  },
  cta: {
    label: "Chamada (CTA)",
    description: "Faixa de destaque com botão",
    icon: MegaphoneIcon,
  },
  video: {
    label: "Vídeo",
    description: "YouTube ou Vimeo",
    icon: PlayCircleIcon,
  },
  quote: {
    label: "Depoimento",
    description: "Citação com autor",
    icon: ChatBubbleBottomCenterTextIcon,
  },
  faq: {
    label: "Perguntas (FAQ)",
    description: "Perguntas e respostas",
    icon: QuestionMarkCircleIcon,
  },
  form: {
    label: "Formulário (lead)",
    description: "Captação direto para o CRM",
    icon: InboxArrowDownIcon,
  },
  spacer: {
    label: "Espaço",
    description: "Respiro entre seções",
    icon: ArrowsUpDownIcon,
  },
};

export const blockTypes = Object.keys(blockMeta) as PageBlock["type"][];

export const createBlock = (type: PageBlock["type"]): PageBlock => {
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
    case "form":
      return {
        id,
        type,
        title: "Fale com a gente",
        subtitle: "Deixe seus dados e um consultor de viagens te chama.",
        button_label: "Quero saber mais",
        interest: "",
        success_message:
          "Recebemos seus dados! Em breve entraremos em contato. 💛",
      };
  }
};

const firstLine = (markdown: string) => {
  const line = markdown
    .split("\n")
    .map((raw) => raw.replace(/^#+\s*/, "").trim())
    .find(Boolean);
  return line ?? "";
};

const truncate = (value: string, max = 40) =>
  value.length > max ? `${value.slice(0, max - 1)}…` : value;

// Short human summary shown in the structure outline, so the admin can tell
// blocks of the same type apart without opening them.
export const summarizeBlock = (block: PageBlock): string => {
  switch (block.type) {
    case "text":
      return truncate(firstLine(block.markdown)) || "Sem texto ainda";
    case "image":
      return truncate(block.caption || block.alt) || "Sem foto ainda";
    case "gallery":
      return block.images.length
        ? `${block.images.length} foto${block.images.length > 1 ? "s" : ""}`
        : "Sem fotos ainda";
    case "banner":
      return truncate(block.title) || "Sem título ainda";
    case "cta":
      return truncate(block.title || block.text) || "Sem título ainda";
    case "video":
      return truncate(block.caption || block.url) || "Sem vídeo ainda";
    case "quote":
      return truncate(block.author || block.text) || "Sem depoimento ainda";
    case "faq":
      return block.items.length
        ? `${block.items.length} pergunta${block.items.length > 1 ? "s" : ""}`
        : "Sem perguntas ainda";
    case "spacer":
      return { small: "Pequeno", medium: "Médio", large: "Grande" }[block.size];
    case "form":
      return truncate(block.interest || block.title) || "Formulário de contato";
  }
};

// Blocks with no real content yet render invisibly on the canvas; the wrapper
// shows a placeholder for these so they stay clickable.
export const isBlockEmpty = (block: PageBlock): boolean => {
  switch (block.type) {
    case "text":
      return !block.markdown.trim();
    case "image":
      return !block.url;
    case "gallery":
      return !block.images.some((image) => image.url);
    case "banner":
      return !block.image && !block.title && !block.subtitle;
    case "cta":
      return !block.title && !block.text && !block.button_label;
    case "video":
      return !block.url;
    case "quote":
      return !block.text;
    case "faq":
      return !block.items.some((item) => item.question);
    case "spacer":
      return false;
    case "form":
      return false;
  }
};
