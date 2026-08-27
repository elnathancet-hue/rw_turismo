// Regras de tarifa por faixa etária, configuráveis por pacote
// (`products.fare_rules`, jsonb livre — nunca confiar no formato).
//
// Os padrões são deliberadamente NEUTROS: 100% para todo mundo. Um pacote sem
// regra cadastrada cobra exatamente como cobrava antes de a tarifa infantil
// existir, então nada muda de preço sem alguém decidir que muda.

export type FareRules = {
  infantMaxAge: number;
  childMaxAge: number;
  // Percentual do preço de adulto que cada faixa paga.
  infantPercent: number;
  childPercent: number;
  // Ate que idade (na data da saida) o documento e obrigatorio. null = nunca.
  // E o que decide se o pagamento fica travado esperando o envio.
  documentRequiredMaxAge: number | null;
};

export const DEFAULT_FARE_RULES: FareRules = {
  infantMaxAge: 1,
  childMaxAge: 11,
  infantPercent: 100,
  childPercent: 100,
  documentRequiredMaxAge: null,
};

const toNumber = (value: unknown, fallback: number): number => {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const clampPercent = (value: number): number =>
  Math.min(100, Math.max(0, value));

export const normalizeFareRules = (value: unknown): FareRules => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return DEFAULT_FARE_RULES;
  }

  const raw = value as Record<string, unknown>;
  const infantMaxAge = Math.max(
    0,
    Math.trunc(toNumber(raw.infant_max_age, DEFAULT_FARE_RULES.infantMaxAge))
  );
  const childMaxAge = Math.max(
    infantMaxAge,
    Math.trunc(toNumber(raw.child_max_age, DEFAULT_FARE_RULES.childMaxAge))
  );

  return {
    infantMaxAge,
    // Criança nunca pode terminar antes de bebê: uma configuração invertida
    // deixaria uma faixa de idade sem classificação nenhuma.
    childMaxAge,
    infantPercent: clampPercent(
      toNumber(raw.infant_percent, DEFAULT_FARE_RULES.infantPercent)
    ),
    childPercent: clampPercent(
      toNumber(raw.child_percent, DEFAULT_FARE_RULES.childPercent)
    ),
    documentRequiredMaxAge:
      raw.document_required_max_age === null ||
      raw.document_required_max_age === undefined ||
      raw.document_required_max_age === ""
        ? null
        : Math.max(0, Math.trunc(toNumber(raw.document_required_max_age, 0))),
  };
};

// Formato de ida (o que vai para o banco).
export const toFareRulesJson = (rules: FareRules) => ({
  infant_max_age: rules.infantMaxAge,
  child_max_age: rules.childMaxAge,
  infant_percent: rules.infantPercent,
  child_percent: rules.childPercent,
  document_required_max_age: rules.documentRequiredMaxAge,
});

export const hasFareDiscount = (rules: FareRules): boolean =>
  rules.infantPercent < 100 || rules.childPercent < 100;
