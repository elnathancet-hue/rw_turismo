import { XMarkIcon } from "@heroicons/react/24/outline";
import { useEffect } from "react";
import {
  sectionRegistry,
  type SectionTypeMeta,
} from "../../../lib/content/home-registry";
import { sectionTypeIcons } from "./sectionIcons";

type Props = {
  // Types already on the page (to disable singleton duplicates).
  presentTypes: string[];
  onClose: () => void;
  onPick: (meta: SectionTypeMeta) => void;
};

const SectionPicker = ({ presentTypes, onClose, onPick }: Props) => {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      aria-labelledby="section-picker-title"
      aria-modal="true"
      className="fixed inset-0 z-[110] flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
      role="dialog"
    >
      <div
        className="w-full max-w-xl rounded-xl bg-white p-5 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold" id="section-picker-title">
            Adicionar seção
          </h2>
          <button
            aria-label="Fechar"
            className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100"
            onClick={onClose}
            type="button"
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>
        <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
          {sectionRegistry.map((meta) => {
            const Icon = sectionTypeIcons[meta.type];
            const taken = meta.singleton && presentTypes.includes(meta.type);
            return (
              <button
                className="flex items-start gap-3 rounded-lg border p-3 text-left transition enabled:hover:border-orange-400 enabled:hover:bg-orange-50 disabled:opacity-50"
                disabled={taken}
                key={meta.type}
                onClick={() => onPick(meta)}
                type="button"
              >
                {Icon && <Icon className="mt-0.5 h-6 w-6 shrink-0 text-orange-500" />}
                <span>
                  <span className="block text-sm font-semibold text-gray-800">
                    {meta.label}
                    {!meta.singleton && (
                      <span className="ml-2 rounded-full bg-orange-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-orange-700">
                        Várias
                      </span>
                    )}
                  </span>
                  <span className="mt-0.5 block text-xs text-gray-500">
                    {taken ? "Já está na página." : meta.description}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default SectionPicker;
