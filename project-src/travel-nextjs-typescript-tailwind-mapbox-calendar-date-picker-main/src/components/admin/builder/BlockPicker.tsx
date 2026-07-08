import { XMarkIcon } from "@heroicons/react/24/outline";
import { useEffect } from "react";
import type { PageBlock } from "../../../lib/content/types";
import { blockMeta, blockTypes } from "./blockMeta";

type Props = {
  onClose: () => void;
  onPick: (type: PageBlock["type"]) => void;
};

// Modal grid of block types, opened from the "+" insertion points on the
// canvas and from the structure panel.
const BlockPicker = ({ onClose, onPick }: Props) => {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      aria-labelledby="block-picker-title"
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
          <h2 className="text-base font-semibold" id="block-picker-title">
            Adicionar bloco
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
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {blockTypes.map((type) => {
            const meta = blockMeta[type];
            const Icon = meta.icon;
            return (
              <button
                className="flex flex-col items-start gap-2 rounded-lg border p-3 text-left transition hover:border-orange-400 hover:bg-orange-50"
                key={type}
                onClick={() => onPick(type)}
                type="button"
              >
                <Icon className="h-6 w-6 text-orange-500" />
                <span>
                  <span className="block text-sm font-semibold text-gray-800">
                    {meta.label}
                  </span>
                  <span className="mt-0.5 block text-xs text-gray-500">
                    {meta.description}
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

export default BlockPicker;
