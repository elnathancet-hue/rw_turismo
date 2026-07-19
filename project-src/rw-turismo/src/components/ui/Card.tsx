import type { HTMLAttributes } from "react";

// The standard white surface used across the app (list containers, forms,
// panels). Pass padding via className, e.g. <Card className="p-6">.
const Card = ({ className = "", ...props }: HTMLAttributes<HTMLDivElement>) => (
  <div
    className={`rounded-lg border bg-white shadow-sm ${className}`}
    {...props}
  />
);

export default Card;
