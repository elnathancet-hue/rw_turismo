import { forwardRef, type ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md";

const base =
  "inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition disabled:cursor-not-allowed disabled:opacity-60";

const variantClass: Record<Variant, string> = {
  primary: "bg-brand-500 text-white hover:bg-brand-600",
  secondary: "border border-gray-300 bg-white text-gray-800 hover:bg-gray-50",
  ghost: "text-brand-600 hover:bg-brand-50",
  danger: "bg-red-600 text-white hover:bg-red-700",
};

const sizeClass: Record<Size, string> = {
  sm: "px-3 py-1.5 text-sm",
  md: "px-5 py-2.5 text-sm",
};

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
};

// Single source of truth for buttons: consistent colour, size, focus and
// loading/disabled behaviour. Focus ring comes from the global :focus-visible.
const Button = forwardRef<HTMLButtonElement, Props>(function Button(
  {
    variant = "primary",
    size = "md",
    loading = false,
    type = "button",
    className = "",
    disabled,
    children,
    ...props
  },
  ref
) {
  return (
    <button
      className={`${base} ${variantClass[variant]} ${sizeClass[size]} ${className}`}
      disabled={disabled || loading}
      ref={ref}
      type={type}
      {...props}
    >
      {loading && (
        <span
          aria-hidden="true"
          className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
        />
      )}
      {children}
    </button>
  );
});

export default Button;
