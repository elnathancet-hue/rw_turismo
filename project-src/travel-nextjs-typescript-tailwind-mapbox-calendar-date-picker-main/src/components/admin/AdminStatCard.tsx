import type { ComponentType, SVGProps } from "react";

type Props = {
  label: string;
  value: string | number;
  helper: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
};

const AdminStatCard = ({ label, value, helper, icon: Icon }: Props) => (
  <article className="rounded-lg border bg-white p-5 shadow-sm">
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm text-gray-500">{label}</p>
        <p className="mt-2 text-3xl font-semibold">{value}</p>
      </div>
      <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-orange-50 text-orange-600">
        <Icon className="h-6 w-6" />
      </span>
    </div>
    <p className="mt-4 text-sm text-gray-500">{helper}</p>
  </article>
);

export default AdminStatCard;
