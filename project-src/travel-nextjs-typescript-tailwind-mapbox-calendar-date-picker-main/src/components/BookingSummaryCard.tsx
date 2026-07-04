import type { ReactNode } from "react";
import { getCustomerBookingState } from "../lib/bookings/status";
import type { BookingSummary } from "../lib/bookings/types";
import { formatBRL, formatDateRangeBR } from "../lib/format";
import StatusPill from "./StatusPill";

const Field = ({ label, children }: { label: string; children: ReactNode }) => (
  <div>
    <p className="text-sm text-gray-500">{label}</p>
    <div className="font-semibold">{children}</div>
  </div>
);

const BookingSummaryCard = ({
  booking,
  children,
}: {
  booking: BookingSummary;
  children?: ReactNode;
}) => {
  const state = getCustomerBookingState(booking);

  return (
    <section className="overflow-hidden rounded-lg border bg-white shadow-sm">
      {booking.products?.cover_image && (
        <img
          alt={booking.products.title}
          className="h-56 w-full object-cover"
          src={booking.products.cover_image}
        />
      )}
      <div className="p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <StatusPill label={state.label} tone={state.tone} />
          <span className="font-mono text-xs uppercase tracking-wide text-gray-400">
            Reserva #{booking.id.slice(0, 8)}
          </span>
        </div>
        <p className="mt-3 text-sm text-gray-600">{state.description}</p>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <Field label="Pacote">
            {booking.products?.title}
            <span className="block text-sm font-normal text-gray-600">
              {booking.products?.destination}
            </span>
          </Field>
          <Field label="Período">
            {formatDateRangeBR(
              booking.product_dates?.start_date,
              booking.product_dates?.end_date
            )}
          </Field>
          <Field label="Viajantes">{booking.travelers_count}</Field>
          <Field label="Valor total">{formatBRL(booking.total_amount)}</Field>
        </div>

        {children && <div className="mt-6 border-t pt-6">{children}</div>}
      </div>
    </section>
  );
};

export default BookingSummaryCard;
