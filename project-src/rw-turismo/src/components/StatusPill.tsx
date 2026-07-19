import { toneClasses, type StatusTone } from "../lib/bookings/status";

const StatusPill = ({ label, tone }: { label: string; tone: StatusTone }) => (
  <span
    className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${toneClasses[tone]}`}
  >
    {label}
  </span>
);

export default StatusPill;
