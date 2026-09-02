import type {
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";

const controlClass =
  "mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 outline-none transition focus:border-brand-500 disabled:bg-gray-50";

// Label + control + optional hint/error. The control is passed as children so
// the <label> implicitly associates with it (accessible without id wiring).
export const Field = ({
  label,
  hint,
  error,
  children,
  className = "",
}: {
  label: ReactNode;
  hint?: string;
  error?: string | null;
  children: ReactNode;
  /** Espaçamento e largura de fora. O Field é um <label class="block">, e sem
   *  isto não dá para lhe dar margem nem `flex-1` no lugar onde ele é usado. */
  className?: string;
}) => (
  <label className={`block text-sm font-medium text-gray-700 ${className}`}>
    {label}
    {children}
    {hint && !error && (
      <span className="mt-1 block text-xs font-normal text-gray-500">
        {hint}
      </span>
    )}
    {error && (
      <span className="mt-1 block text-xs font-normal text-red-600">
        {error}
      </span>
    )}
  </label>
);

export const Input = ({
  className = "",
  ...props
}: InputHTMLAttributes<HTMLInputElement>) => (
  <input className={`${controlClass} ${className}`} {...props} />
);

// `rows` default 4. Sem ele o navegador usa 2, e como o controlClass e a MESMA
// string do <input>, a caixa de texto ficava indistinguivel de um campo de uma
// linha — era o que fazia o editor de quiz parecer apertado. Continua sendo so
// um default: quem precisa de mais passa `rows`.
export const Textarea = ({
  className = "",
  rows = 4,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement>) => (
  <textarea className={`${controlClass} ${className}`} rows={rows} {...props} />
);

export const Select = ({
  className = "",
  ...props
}: SelectHTMLAttributes<HTMLSelectElement>) => (
  <select className={`${controlClass} ${className}`} {...props} />
);
