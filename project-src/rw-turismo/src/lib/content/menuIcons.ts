import {
  BuildingOffice2Icon,
  CalendarDaysIcon,
  ChatBubbleLeftRightIcon,
  EnvelopeIcon,
  GlobeAmericasIcon,
  HomeIcon,
  InformationCircleIcon,
  MapIcon,
  NewspaperIcon,
  PaperAirplaneIcon,
  PhoneIcon,
  QuestionMarkCircleIcon,
  SparklesIcon,
  StarIcon,
  TagIcon,
  TruckIcon,
  UserGroupIcon,
} from "@heroicons/react/24/outline";
import type { ComponentType, SVGProps } from "react";

// Ícones que o menu do site pode usar. Catálogo fechado de propósito: a chave
// é o que fica salvo no banco, então precisa ser estável e pequena — nome de
// componente do heroicons mudaria a cada atualização da biblioteca.
//
// Os nomes descrevem o DESENHO, não a aba ("ônibus", não "terrestre"), para o
// mesmo ícone servir a menus diferentes sem ficar com nome errado.

export type MenuIconKey =
  | "onibus"
  | "aviao"
  | "hotel"
  | "pessoas"
  | "interrogacao"
  | "chat"
  | "telefone"
  | "envelope"
  | "casa"
  | "mapa"
  | "globo"
  | "etiqueta"
  | "jornal"
  | "estrela"
  | "calendario"
  | "brilho"
  | "info";

type IconEntry = {
  label: string;
  Icon: ComponentType<SVGProps<SVGSVGElement>>;
};

export const MENU_ICONS: Record<MenuIconKey, IconEntry> = {
  onibus: { label: "Ônibus / terrestre", Icon: TruckIcon },
  aviao: { label: "Avião / aéreo", Icon: PaperAirplaneIcon },
  hotel: { label: "Hotel / hospedagem", Icon: BuildingOffice2Icon },
  pessoas: { label: "Pessoas / quem somos", Icon: UserGroupIcon },
  interrogacao: { label: "Dúvidas", Icon: QuestionMarkCircleIcon },
  chat: { label: "Conversa / contato", Icon: ChatBubbleLeftRightIcon },
  telefone: { label: "Telefone", Icon: PhoneIcon },
  envelope: { label: "E-mail", Icon: EnvelopeIcon },
  casa: { label: "Início", Icon: HomeIcon },
  mapa: { label: "Mapa / roteiro", Icon: MapIcon },
  globo: { label: "Mundo / internacional", Icon: GlobeAmericasIcon },
  etiqueta: { label: "Promoções", Icon: TagIcon },
  jornal: { label: "Blog", Icon: NewspaperIcon },
  estrela: { label: "Destaques", Icon: StarIcon },
  calendario: { label: "Datas / agenda", Icon: CalendarDaysIcon },
  brilho: { label: "Experiências", Icon: SparklesIcon },
  info: { label: "Informações", Icon: InformationCircleIcon },
};

export const MENU_ICON_KEYS = Object.keys(MENU_ICONS) as MenuIconKey[];

export const isMenuIconKey = (value: unknown): value is MenuIconKey =>
  typeof value === "string" && value in MENU_ICONS;

// Devolve o componente do ícone ou null. Chave desconhecida (catálogo mudou,
// valor digitado à mão no banco) vira "sem ícone" em vez de quebrar a página.
export const menuIconComponent = (
  key: string | null | undefined
): ComponentType<SVGProps<SVGSVGElement>> | null =>
  isMenuIconKey(key) ? MENU_ICONS[key].Icon : null;
