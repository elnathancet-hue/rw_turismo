export type PaymentStatus =
  | "pending"
  | "paid"
  | "failed"
  | "refunded"
  | "cancelled"
  | "requires_review";

export type CreateCheckoutInput = {
  booking_id: string;
  user_id: string;
};

export type CreateCheckoutResult = {
  checkout_url: string;
};

export type InternalStripeMetadata = {
  booking_id: string;
  payment_id: string;
  user_id: string;
  source: "internal_booking";
};

export type ConfirmInternalPaymentResult = {
  booking_id?: string;
  payment_id?: string;
  status: "confirmed" | "duplicate" | "ignored" | "requires_review";
  reason?: string;
};

export type HandleInternalPaymentNegativeEventResult = {
  booking_id?: string;
  payment_id?: string;
  status: "expired" | "updated" | "duplicate" | "skipped" | "ignored";
  slots_released?: boolean;
  reason?: string;
};
