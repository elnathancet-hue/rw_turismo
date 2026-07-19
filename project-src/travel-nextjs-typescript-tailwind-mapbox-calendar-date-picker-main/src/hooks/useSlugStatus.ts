import { useEffect, useState } from "react";
import { isSlugTaken } from "../lib/admin/slugs";

export type SlugStatus = "idle" | "checking" | "available" | "taken" | "error";

// Checagem debounced (500ms) de disponibilidade de slug. Retorna o status para
// a UI mostrar "verificando…" / "disponível" / "slug já em uso".
export const useSlugStatus = (
  table: string,
  slug: string,
  excludeId?: string | null
): SlugStatus => {
  const [status, setStatus] = useState<SlugStatus>("idle");

  useEffect(() => {
    const trimmed = slug.trim();
    if (!trimmed) {
      setStatus("idle");
      return;
    }

    setStatus("checking");
    let active = true;
    const timer = setTimeout(() => {
      isSlugTaken(table, trimmed, excludeId)
        .then((taken) => {
          if (active) setStatus(taken ? "taken" : "available");
        })
        .catch(() => {
          if (active) setStatus("error");
        });
    }, 500);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [table, slug, excludeId]);

  return status;
};

// Texto/erro prontos para o componente Field.
export const slugFieldProps = (
  status: SlugStatus
): { hint?: string; error?: string } => {
  if (status === "checking") return { hint: "Verificando disponibilidade…" };
  if (status === "available") return { hint: "Slug disponível ✓" };
  if (status === "taken") return { error: "Este slug já está em uso." };
  return {};
};
